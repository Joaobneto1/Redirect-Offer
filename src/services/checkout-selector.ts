import type { Checkout } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { checkCheckoutHealth } from "./health-check.js";
import type { Env } from "../config.js";

export type RedirectOutcome =
  | { type: "redirect"; url: string; checkoutId: string }
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
function sortCheckouts(
  checkouts: Checkout[],
  strategy: string
): Checkout[] {
  const active = checkouts.filter((c) => c.isActive);
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
  checkoutId: string,
  error: string,
  threshold: number
): Promise<void> {
  const c = await prisma.checkout.update({
    where: { id: checkoutId },
    data: {
      lastError: error,
      lastCheckedAt: new Date(),
      consecutiveFailures: { increment: 1 },
    },
  });
  if (c.consecutiveFailures >= threshold) {
    await prisma.checkout.update({
      where: { id: checkoutId },
      data: { isActive: false },
    });
  }
}

/**
 * Marca uso e zera falhas consecutivas em caso de sucesso.
 */
async function recordSuccess(checkoutId: string): Promise<void> {
  await prisma.checkout.update({
    where: { id: checkoutId },
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

  const smartLink = await prisma.smartLink.findUnique({
    where: { slug },
    include: {
      group: {
        include: {
          checkouts: true,
        },
      },
    },
  });

  if (!smartLink) {
    return { type: "error", message: "Link não encontrado" };
  }

  const { group } = smartLink;
  const ordered = sortCheckouts(
    group.checkouts,
    group.rotationStrategy
  );

  if (ordered.length === 0) {
    return { type: "error", message: "Nenhum checkout disponível" };
  }

  const healthConfig = {
    timeoutMs: env.HEALTH_CHECK_TIMEOUT_MS,
    allowedStatuses: env.HEALTH_CHECK_ALLOWED_STATUSES,
  };
  const threshold = env.FAILURE_THRESHOLD;

  for (const checkout of ordered) {
    const result = await checkCheckoutHealth(checkout.url, healthConfig);

    if (result.ok) {
      await recordSuccess(checkout.id);
      return { type: "redirect", url: checkout.url, checkoutId: checkout.id };
    }

    const errorMsg = result.error ?? `HTTP ${result.status ?? "unknown"}`;
    await recordFailure(checkout.id, errorMsg, threshold);
  }

  // Todos os checkouts falharam: não redireciona para lugar nenhum. Mostra página "nenhuma oferta".
  return { type: "error", message: "Nenhuma oferta disponível no momento." };
}
