import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { z } from "zod";
import type { AuthUser } from "../../middleware/auth.js";

const router = Router();

// Helper para pegar userId do request
function getUserId(req: Request): string {
  return (req as Request & { user: AuthUser }).user.id;
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
});

const endpointCreateSchema = z.object({
  campaignId: z.string().min(1),
  url: z.string().url(),
  priority: z.number().int().default(0),
});

// Listar campanhas do usuário logado
router.get("/", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const list = await prisma.campaign.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { endpoints: true, links: true } } },
  });
  res.json(list);
});

// Obter campanha (verificando se pertence ao usuário)
router.get("/:id", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const item = await prisma.campaign.findFirst({
    where: { id: req.params.id, userId },
    include: { endpoints: true, links: true },
  });
  if (!item) return res.status(404).json({ error: "Campanha não encontrada" });
  res.json(item);
});

// Criar campanha para o usuário logado
router.post("/", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const campaign = await prisma.campaign.create({
    data: { ...parsed.data, userId },
  });
  res.status(201).json(campaign);
});

// Criar endpoint (verificando se a campanha pertence ao usuário)
router.post("/endpoints", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const parsed = endpointCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  // Verificar se a campanha pertence ao usuário
  const campaign = await prisma.campaign.findFirst({
    where: { id: parsed.data.campaignId, userId },
  });
  if (!campaign) {
    return res.status(404).json({ error: "Campanha não encontrada" });
  }

  const endpoint = await prisma.endpoint.create({ data: parsed.data });
  res.status(201).json(endpoint);
});

// Atualizar campanha (verificando se pertence ao usuário)
router.patch("/:id", async (req: Request, res: Response) => {
  const userId = getUserId(req);

  // Verificar se a campanha pertence ao usuário
  const existing = await prisma.campaign.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Campanha não encontrada" });
  }

  const body = req.body as { name?: string; autoCheckEnabled?: boolean; autoCheckInterval?: number };
  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.autoCheckEnabled !== undefined) data.autoCheckEnabled = body.autoCheckEnabled;
  if (body.autoCheckInterval !== undefined) data.autoCheckInterval = body.autoCheckInterval;
  const campaign = await prisma.campaign.update({ where: { id: req.params.id }, data });
  res.json(campaign);
});

// Excluir campanha (verificando se pertence ao usuário)
router.delete("/:id", async (req: Request, res: Response) => {
  const userId = getUserId(req);

  // Verificar se a campanha pertence ao usuário
  const existing = await prisma.campaign.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Campanha não encontrada" });
  }

  await prisma.campaign.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
