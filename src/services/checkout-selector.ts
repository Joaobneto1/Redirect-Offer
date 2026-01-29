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
}

/**
 * Ordena checkouts conforme estratégia do grupo.
 * Round-robin: menos usado primeiro (lastUsedAt ASC, nulls first).
 * Priority: maior priority primeiro.
 */
function sortEndpoints(
  endpoints: Endpoint[],
  strategy: string
): Endpoint[] {
  const active = endpoints.filter((c) => c.isActive);
  if (strategy === "priority") {
    return [...active].sort((a, b) => b.priority - a.priority);
  }
  return [...active].sort((a, b) => {
    const aVal = a.lastUsedAt?.getTime() ?? 0;
    const bVal = b.lastUsedAt?.getTime() ?? 0;
    return aVal - bVal;
  });
}

/**
 * Marca checkout como falha e atualiza estado.
 * Se consecutiveFailures >= threshold, desativa.
 */
async function recordFailure(
  endpointId: string,
  error: string,
  threshold: number
): Promise<void> {
  const c = await prisma.endpoint.update({
    where: { id: endpointId },
    data: {
      lastError: error,
      lastCheckedAt: new Date(),
      consecutiveFailures: { increment: 1 },
    },
  });
  if (c.consecutiveFailures >= threshold) {
    await prisma.endpoint.update({
      where: { id: endpointId },
      data: { isActive: false },
    });
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
    },
  });
}

/**
 * Resolve o link inteligente: escolhe checkout ativo, health check, fallback se necessário.
 */
export async function resolveSmartLink(
  input: ResolveSmartLinkInput
): Promise<RedirectOutcome> {
  const { slug, env } = input;

  const campaignLink = await prisma.campaignLink.findUnique({
    where: { slug },
    include: {
      campaign: {
        include: {
          endpoints: true,
        },
      },
    },
  });

  if (!campaignLink) {
    return { type: "error", message: "Link não encontrado" };
  }

  const { campaign } = campaignLink;
  const ordered = sortEndpoints(campaign.endpoints, "priority");

  if (ordered.length === 0) {
    return { type: "error", message: "Nenhum endpoint disponível" };
  }

  const healthConfig = {
    timeoutMs: env.HEALTH_CHECK_TIMEOUT_MS,
    allowedStatuses: env.HEALTH_CHECK_ALLOWED_STATUSES,
    deep: true,
  };
  const threshold = env.FAILURE_THRESHOLD;

  for (const endpoint of ordered) {
    const result = await checkCheckoutHealth(endpoint.url, healthConfig);

    if (result.ok) {
      await recordSuccess(endpoint.id);
      return { type: "redirect", url: endpoint.url, endpointId: endpoint.id };
    }

    const errorMsg = result.inactiveReason ?? result.error ?? `HTTP ${result.status ?? "unknown"}`;
    await recordFailure(endpoint.id, errorMsg, threshold);
  }

  return { type: "error", message: "Nenhuma oferta disponível no momento." };
}
