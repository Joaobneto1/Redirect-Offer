import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { loadConfig } from "../../config.js";
import { checkCheckoutHealth } from "../../services/health-check.js";

const router = Router();
const config = loadConfig();

// Manual check for an endpoint
router.post("/:id/check", async (req: Request, res: Response) => {
  const ep = await prisma.endpoint.findUnique({ where: { id: req.params.id } });
  if (!ep) return res.status(404).json({ error: "Endpoint não encontrado" });

  const result = await checkCheckoutHealth(ep.url, {
    timeoutMs: config.HEALTH_CHECK_TIMEOUT_MS,
    allowedStatuses: config.HEALTH_CHECK_ALLOWED_STATUSES,
    deep: true,
  });

  if (result.ok) {
    await prisma.endpoint.update({
      where: { id: ep.id },
      data: {
        lastCheckedAt: new Date(),
        consecutiveFailures: 0,
        lastError: null,
        lastUsedAt: new Date(),
      },
    });
    return res.json({ ok: true, status: result.status });
  }

  const errorMsg = result.inactiveReason ?? result.error ?? `HTTP ${result.status ?? "?"}`;
  const updated = await prisma.endpoint.update({
    where: { id: ep.id },
    data: {
      lastError: errorMsg,
      lastCheckedAt: new Date(),
      consecutiveFailures: { increment: 1 },
    },
  });
  if (updated.consecutiveFailures >= config.FAILURE_THRESHOLD) {
    await prisma.endpoint.update({ where: { id: ep.id }, data: { isActive: false } });
  }

  return res.json({ ok: false, error: errorMsg, status: result.status, inactiveReason: result.inactiveReason ?? undefined });
});

// update endpoint (URL, priority, isActive)
router.patch("/:id", async (req: Request, res: Response) => {
  const data = req.body as { url?: string; priority?: number; isActive?: boolean };
  const updated = await prisma.endpoint.update({ where: { id: req.params.id }, data });
  res.json(updated);
});

// delete endpoint
router.delete("/:id", async (req: Request, res: Response) => {
  await prisma.endpoint.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;

