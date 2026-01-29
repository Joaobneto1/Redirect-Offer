import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { z } from "zod";

const router = Router();
const slugRegex = /^[a-z0-9_-]+$/i;
const createSchema = z.object({
  slug: z.string().min(1).max(100).regex(slugRegex, "Slug: apenas letras, números, _ e -"),
  campaignId: z.string().min(1),
  fallbackUrl: z.string().url().optional().nullable(),
});
const updateSchema = z
  .object({
    slug: z.string().min(1).max(100).regex(slugRegex),
    fallbackUrl: z.string().url().optional().nullable(),
  })
  .partial();

router.get("/", async (req: Request, res: Response) => {
  const campaignId = req.query.campaignId as string | undefined;
  const where = campaignId ? { campaignId } : {};
  const list = await prisma.campaignLink.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
  res.json(list);
});

router.get("/:id", async (req: Request, res: Response) => {
  const link = await prisma.campaignLink.findUnique({
    where: { id: req.params.id },
    include: {
      campaign: {
        include: {
          endpoints: { select: { id: true, url: true, isActive: true } },
        },
      },
    },
  });
  if (!link) return res.status(404).json({ error: "Link não encontrado" });
  res.json(link);
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const data = {
    slug: parsed.data.slug,
    campaignId: parsed.data.campaignId,
    fallbackUrl: parsed.data.fallbackUrl ?? null,
  };
  const link = await prisma.campaignLink.create({ data });
  res.status(201).json(link);
});

router.patch("/:id", async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const data = {
    ...(parsed.data.slug ? { slug: parsed.data.slug } : {}),
    ...(parsed.data.fallbackUrl !== undefined ? { fallbackUrl: parsed.data.fallbackUrl } : {}),
  };
  const link = await prisma.campaignLink.update({
    where: { id: req.params.id },
    data,
  });
  res.json(link);
});

router.delete("/:id", async (req: Request, res: Response) => {
  await prisma.campaignLink.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
