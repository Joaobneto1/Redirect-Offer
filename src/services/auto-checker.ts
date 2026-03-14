import { prisma } from "../lib/prisma.js";
import { checkCheckoutHealth } from "./health-check.js";
import { loadConfig } from "../config.js";
import {
  notifyFirstFailure,
  notifyEndpointDeactivated,
  notifyEndpointRecovered,
  notifyAllEndpointsDown,
  notifyTimeout,
  notifyAllTimeoutsOrUnstable,
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
    /** Pelo menos uma falha "real" (oferta inativa, HTTP, etc.) — não só timeout */
    let hadRealFailureThisRound = false;

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
          const isTimeout = res.errorCode === "TIMEOUT";

          // Timeout NÃO conta como falha consecutiva e NÃO desativa (evita falso positivo)
          if (isTimeout) {
            await prisma.endpoint.update({
              where: { id: ep.id },
              data: {
                lastCheckedAt: new Date(),
                lastError: reason,
                // não incrementa consecutiveFailures
              },
            });
            failedInThisRound++;
            await notifyTimeout(camp.name, ep.url, { slug: camp.links[0]?.slug, endpointId: ep.id });
          } else {
            hadRealFailureThisRound = true;
            const updated = await prisma.endpoint.update({
              where: { id: ep.id },
              data: {
                lastCheckedAt: new Date(),
                lastError: reason,
                consecutiveFailures: { increment: 1 },
              },
            });

            failedInThisRound++;

            const activeCount = camp.endpoints.filter(
              (e) => e.isActive && e.id !== ep.id
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
              await notifyEndpointDeactivated(camp.name, ep.url, reason, updated.consecutiveFailures);
            }
          }
        }
      } catch (e) {
        console.error("Auto-check error for endpoint", ep.id, e);
      }
    }

    // Só alerta "TODOS CAÍRAM" quando houve falha real (não só timeout)
    if (failedInThisRound > 0 && camp.links.length > 0) {
      const freshEndpoints = await prisma.endpoint.findMany({
        where: { campaignId: camp.id },
      });
      const anyActive = freshEndpoints.some((e) => e.isActive && e.consecutiveFailures === 0);

      if (!anyActive) {
        if (hadRealFailureThisRound) {
          await notifyAllEndpointsDown(camp.name, camp.links[0].slug, freshEndpoints.length);
        } else {
          await notifyAllTimeoutsOrUnstable(camp.name, camp.links[0].slug, freshEndpoints.length);
        }
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
