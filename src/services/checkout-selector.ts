import type { Endpoint } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { checkCheckoutHealth } from "./health-check.js";
import type { Env } from "../config.js";

export type RedirectOutcome =
  | { type: "redirect"; url: string; endpointId: string }
  | { type: "fallback"; url: string }
  | { type: "error"; message: string };

export interface ResolveSmartLinkInput {
  slug: string;
  env: Env;
  /** Query string parameters do request original para passar ao checkout */
  queryParams?: Record<string, string>;
}

/**
 * Ordena endpoints por prioridade.
 * LÓGICA: menor número = primeiro na fila (topo da lista = tentado primeiro)
 * - Prioridade 0 = primeiro
 * - Prioridade 1 = segundo
 * - etc.
 * 
 * Se prioridades iguais, ordena por data de criação (mais antigo primeiro).
 */
function sortEndpoints(endpoints: Endpoint[]): Endpoint[] {
  const active = endpoints.filter((e) => e.isActive);
  
  return [...active].sort((a, b) => {
    // Primeiro por prioridade (menor = primeiro)
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // Se igual, por data de criação (mais antigo primeiro)
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/**
 * Anexa query params à URL do checkout.
 * Preserva parâmetros existentes na URL e adiciona os novos.
 */
function appendQueryParams(
  baseUrl: string,
  params?: Record<string, string>
): string {
  if (!params || Object.keys(params).length === 0) {
    return baseUrl;
  }

  try {
    const url = new URL(baseUrl);
    
    // Adicionar cada parâmetro (sobrescreve se já existir)
    for (const [key, value] of Object.entries(params)) {
      if (key && value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  } catch {
    // Se URL inválida, tentar concatenar manualmente
    const separator = baseUrl.includes("?") ? "&" : "?";
    const queryString = Object.entries(params)
      .filter(([k, v]) => k && v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    
    return queryString ? `${baseUrl}${separator}${queryString}` : baseUrl;
  }
}

/**
 * Marca endpoint como falha e atualiza estado.
 * Se consecutiveFailures >= threshold, desativa.
 */
async function recordFailure(
  endpointId: string,
  error: string,
  threshold: number
): Promise<void> {
  const updated = await prisma.endpoint.update({
    where: { id: endpointId },
    data: {
      lastError: error,
      lastCheckedAt: new Date(),
      consecutiveFailures: { increment: 1 },
    },
  });

  if (updated.consecutiveFailures >= threshold) {
    await prisma.endpoint.update({
      where: { id: endpointId },
      data: { isActive: false },
    });
    console.log(`[Selector] Endpoint ${endpointId} desativado após ${updated.consecutiveFailures} falhas`);
  }
}

/**
 * Marca uso e zera falhas consecutivas em caso de sucesso.
 */
async function recordSuccess(endpointId: string): Promise<void> {
  await prisma.endpoint.update({
    where: { id: endpointId },
    data: {
      lastUsedAt: new Date(),
      lastCheckedAt: new Date(),
      consecutiveFailures: 0,
      lastError: null,
      isActive: true, // Reativar se estava inativo
    },
  });
}

/**
 * Resolve o link inteligente:
 * 1. Busca endpoints ativos ordenados por prioridade (menor = primeiro)
 * 2. Tenta cada um com health check
 * 3. Retorna primeiro que funcionar (com query params anexados)
 * 4. Se todos falharem, retorna erro
 */
export async function resolveSmartLink(
  input: ResolveSmartLinkInput
): Promise<RedirectOutcome> {
  const { slug, env, queryParams } = input;

  const campaignLink = await prisma.campaignLink.findUnique({
    where: { slug },
    include: {
      campaign: {
        include: {
          endpoints: {
            orderBy: [
              { priority: "asc" },
              { createdAt: "asc" },
            ],
          },
        },
      },
    },
  });

  if (!campaignLink) {
    return { type: "error", message: "Link não encontrado" };
  }

  const { campaign } = campaignLink;
  const ordered = sortEndpoints(campaign.endpoints);

  if (ordered.length === 0) {
    // Fallback se configurado
    if (campaignLink.fallbackUrl) {
      return { type: "fallback", url: appendQueryParams(campaignLink.fallbackUrl, queryParams) };
    }
    return { type: "error", message: "Nenhum endpoint disponível" };
  }

  const healthConfig = {
    timeoutMs: env.HEALTH_CHECK_TIMEOUT_MS,
    allowedStatuses: env.HEALTH_CHECK_ALLOWED_STATUSES,
    deep: true, // Sempre fazer verificação profunda para Hotmart
  };
  const threshold = env.FAILURE_THRESHOLD;

  // Tentar cada endpoint na ordem
  for (const endpoint of ordered) {
    console.log(`[Selector] Verificando endpoint ${endpoint.id}: ${endpoint.url}`);
    
    const result = await checkCheckoutHealth(endpoint.url, healthConfig);

    if (result.ok) {
      await recordSuccess(endpoint.id);
      
      // Anexar query params ao URL do checkout
      const finalUrl = appendQueryParams(endpoint.url, queryParams);
      console.log(`[Selector] Redirecionando para: ${finalUrl}`);
      
      return { type: "redirect", url: finalUrl, endpointId: endpoint.id };
    }

    // Registrar falha
    const errorMsg = result.inactiveReason ?? result.error ?? `HTTP ${result.status ?? "unknown"}`;
    console.log(`[Selector] Endpoint ${endpoint.id} falhou: ${errorMsg}`);
    await recordFailure(endpoint.id, errorMsg, threshold);
  }

  // Todos falharam - usar fallback se disponível
  if (campaignLink.fallbackUrl) {
    return { type: "fallback", url: appendQueryParams(campaignLink.fallbackUrl, queryParams) };
  }

  return { type: "error", message: "Nenhuma oferta disponível no momento." };
}
