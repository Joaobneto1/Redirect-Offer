import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { z } from "zod";

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(200),
});

const endpointCreateSchema = z.object({
  campaignId: z.string().min(1),
  url: z.string().url(),
  priority: z.number().int().default(0),
});

router.get("/", async (_req: Request, res: Response) => {
  const list = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { endpoints: true, links: true } } },
  });
  res.json(list);
});

router.get("/:id", async (req: Request, res: Response) => {
  const item = await prisma.campaign.findUnique({
    where: { id: req.params.id },
    include: { endpoints: true, links: true },
  });
  if (!item) return res.status(404).json({ error: "Campaign não encontrada" });
  res.json(item);
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const campaign = await prisma.campaign.create({ data: parsed.data });
  res.status(201).json(campaign);
});

router.post("/endpoints", async (req: Request, res: Response) => {
  const parsed = endpointCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const endpoint = await prisma.endpoint.create({ data: parsed.data });
  res.status(201).json(endpoint);
});

router.patch("/:id", async (req: Request, res: Response) => {
  const body = req.body as { name?: string; autoCheckEnabled?: boolean; autoCheckInterval?: number };
  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.autoCheckEnabled !== undefined) data.autoCheckEnabled = body.autoCheckEnabled;
  if (body.autoCheckInterval !== undefined) data.autoCheckInterval = body.autoCheckInterval;
  const campaign = await prisma.campaign.update({ where: { id: req.params.id }, data });
  res.json(campaign);
});

router.delete("/:id", async (req: Request, res: Response) => {
  await prisma.campaign.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;

