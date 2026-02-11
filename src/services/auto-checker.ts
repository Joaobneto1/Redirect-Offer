import { prisma } from "../lib/prisma.js";
import { checkCheckoutHealth } from "./health-check.js";
import { loadConfig } from "../config.js";
import {
  notifyFirstFailure,
  notifyEndpointDeactivated,
  notifyEndpointRecovered,
  notifyAllEndpointsDown,
} from "./telegram-notifier.js";

const config = loadConfig();

/** Run health check for endpoints that are overdue per their campaign interval */
export async function runAutoChecksOnce() {
  // load campaigns with autoCheckEnabled = true
  const campaigns = await prisma.campaign.findMany({
    where: { autoCheckEnabled: true },
    include: {
      endpoints: true,
      links: { select: { slug: true } },
    },
  });

  const threshold = config.FAILURE_THRESHOLD;

  for (const camp of campaigns) {
    const intervalSec = camp.autoCheckInterval ?? 60;
    const now = new Date();
    let failedInThisRound = 0;

    for (const ep of camp.endpoints) {
      const last = ep.lastCheckedAt ? new Date(ep.lastCheckedAt) : new Date(0);
      const elapsed = (now.getTime() - last.getTime()) / 1000;
      if (elapsed < intervalSec) continue;

      try {
        const res = await checkCheckoutHealth(ep.url, {
          timeoutMs: config.HEALTH_CHECK_TIMEOUT_MS,
          allowedStatuses: config.HEALTH_CHECK_ALLOWED_STATUSES,
          deep: true,
        });

        if (res.ok) {
          // Se estava inativo e agora voltou
          const wasInactive = !ep.isActive || ep.consecutiveFailures > 0;
          
          await prisma.endpoint.update({
            where: { id: ep.id },
            data: {
              lastUsedAt: new Date(),
              lastCheckedAt: new Date(),
              consecutiveFailures: 0,
              lastError: null,
              isActive: true,
            },
          });

          // Notificar recuperação
          if (wasInactive) {
            await notifyEndpointRecovered(camp.name, ep.url);
          }
        } else {
          const reason = res.inactiveReason ?? res.error ?? `HTTP ${res.status ?? "?"}`;
          const updated = await prisma.endpoint.update({
            where: { id: ep.id },
            data: {
              lastCheckedAt: new Date(),
              lastError: reason,
              consecutiveFailures: { increment: 1 },
            },
          });

          failedInThisRound++;

          // NOTIFICA NA PRIMEIRA FALHA (e em todas as seguintes)
          const activeCount = camp.endpoints.filter(
            (e) => e.isActive && e.id !== ep.id // excluir o atual que pode ser desativado
          ).length;

          await notifyFirstFailure(
            camp.name,
            ep.url,
            reason,
            updated.consecutiveFailures,
            {
              slug: camp.links[0]?.slug,
              totalEndpoints: camp.endpoints.length,
              activeEndpoints: activeCount,
            }
          );

          if (updated.consecutiveFailures >= threshold) {
            await prisma.endpoint.update({
              where: { id: ep.id },
              data: { isActive: false },
            });

            // Notificar desativação
            await notifyEndpointDeactivated(camp.name, ep.url, reason, updated.consecutiveFailures);
          }
        }
      } catch (e) {
        console.error("Auto-check error for endpoint", ep.id, e);
      }
    }

    // Depois de checar todos: verificar se TODOS estão fora
    if (failedInThisRound > 0) {
      const freshEndpoints = await prisma.endpoint.findMany({
        where: { campaignId: camp.id },
      });
      const anyActive = freshEndpoints.some((e) => e.isActive && e.consecutiveFailures === 0);

      if (!anyActive && camp.links.length > 0) {
        await notifyAllEndpointsDown(
          camp.name,
          camp.links[0].slug,
          freshEndpoints.length
        );
      }
    }
  }
}

let intervalHandle: NodeJS.Timeout | null = null;

export function startAutoChecker(pollIntervalSec = 15) {
  if (intervalHandle) clearInterval(intervalHandle);
  // run immediately then schedule
  runAutoChecksOnce().catch(console.error);
  intervalHandle = setInterval(() => runAutoChecksOnce().catch(console.error), pollIntervalSec * 1000);
  console.log("Auto-checker started (global poll every", pollIntervalSec, "sec).");
}

export function stopAutoChecker() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}
