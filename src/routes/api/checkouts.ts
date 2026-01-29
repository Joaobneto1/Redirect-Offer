import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { z } from "zod";
import { loadConfig } from "../../config.js";
import { checkCheckoutHealth } from "../../services/health-check.js";

const router = Router();
const config = loadConfig();
const createSchema = z.object({
  groupId: z.string().min(1),
  url: z.string().url(),
  priority: z.number().int().default(0),
});
const updateSchema = z
  .object({
    url: z.string().url(),
    priority: z.number().int(),
    isActive: z.boolean(),
  })
  .partial();

router.get("/", async (req: Request, res: Response) => {
  const groupId = req.query.groupId as string | undefined;
  const where = groupId ? { groupId } : {};
  const list = await prisma.checkout.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: {
      group: { select: { id: true, name: true } },
    },
  });
  res.json(list);
});

router.get("/:id", async (req: Request, res: Response) => {
  const checkout = await prisma.checkout.findUnique({
    where: { id: req.params.id },
    include: {
      group: { select: { id: true, name: true, productId: true } },
    },
  });
  if (!checkout) return res.status(404).json({ error: "Checkout não encontrado" });
  res.json(checkout);
});

/** Verificação sob demanda: roda health check, atualiza lastError/lastCheckedAt/isActive e retorna resultado. */
router.post("/:id/check", async (req: Request, res: Response) => {
  const checkout = await prisma.checkout.findUnique({
    where: { id: req.params.id },
  });
  if (!checkout) return res.status(404).json({ error: "Checkout não encontrado" });

  const result = await checkCheckoutHealth(checkout.url, {
    timeoutMs: config.HEALTH_CHECK_TIMEOUT_MS,
    allowedStatuses: config.HEALTH_CHECK_ALLOWED_STATUSES,
  });

  if (result.ok) {
    await prisma.checkout.update({
      where: { id: checkout.id },
      data: {
        lastCheckedAt: new Date(),
        consecutiveFailures: 0,
        lastError: null,
      },
    });
    return res.json({ ok: true, status: result.status });
  }

  const errorMsg = result.error ?? `HTTP ${result.status ?? "?"}`;
  const updated = await prisma.checkout.update({
    where: { id: checkout.id },
    data: {
      lastError: errorMsg,
      lastCheckedAt: new Date(),
      consecutiveFailures: { increment: 1 },
    },
  });

  const threshold = config.FAILURE_THRESHOLD;
  if (updated.consecutiveFailures >= threshold) {
    await prisma.checkout.update({
      where: { id: checkout.id },
      data: { isActive: false },
    });
  }

  return res.json({ ok: false, error: errorMsg, status: result.status });
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const checkout = await prisma.checkout.create({ data: parsed.data });
  res.status(201).json(checkout);
});

router.patch("/:id", async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const checkout = await prisma.checkout.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(checkout);
});

router.delete("/:id", async (req: Request, res: Response) => {
  await prisma.checkout.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
