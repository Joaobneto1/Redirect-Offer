import { prisma } from "../lib/prisma.js";
import { checkCheckoutHealth } from "./health-check.js";
import { loadConfig } from "../config.js";

const config = loadConfig();

/** Run health check for endpoints that are overdue per their campaign interval */
export async function runAutoChecksOnce() {
  // load campaigns with autoCheckEnabled = true
  const campaigns = await prisma.campaign.findMany({
    where: { autoCheckEnabled: true },
    include: { endpoints: true },
  });

  const threshold = config.FAILURE_THRESHOLD;

  for (const camp of campaigns) {
    const intervalSec = camp.autoCheckInterval ?? 60;
    const now = new Date();
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
          await prisma.endpoint.update({
            where: { id: ep.id },
            data: {
              lastUsedAt: new Date(),
              lastCheckedAt: new Date(),
              consecutiveFailures: 0,
              lastError: null,
            },
          });
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
          if (updated.consecutiveFailures >= threshold) {
            await prisma.endpoint.update({
              where: { id: ep.id },
              data: { isActive: false },
            });
          }
        }
      } catch (e) {
        console.error("Auto-check error for endpoint", ep.id, e);
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

