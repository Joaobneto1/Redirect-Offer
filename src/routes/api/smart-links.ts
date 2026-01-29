import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { z } from "zod";

const router = Router();
const slugRegex = /^[a-z0-9_-]+$/i;
const createSchema = z.object({
  slug: z.string().min(1).max(100).regex(slugRegex, "Slug: apenas letras, números, _ e -"),
  groupId: z.string().min(1),
  fallbackUrl: z.string().url().optional().nullable(),
});
const updateSchema = z
  .object({
    slug: z.string().min(1).max(100).regex(slugRegex),
    fallbackUrl: z.string().url().optional().nullable(),
  })
  .partial();

router.get("/", async (req: Request, res: Response) => {
  const groupId = req.query.groupId as string | undefined;
  const where = groupId ? { groupId } : {};
  const list = await prisma.smartLink.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          product: { select: { id: true, name: true } },
        },
      },
    },
  });
  res.json(list);
});

router.get("/:id", async (req: Request, res: Response) => {
  const link = await prisma.smartLink.findUnique({
    where: { id: req.params.id },
    include: {
      group: {
        include: {
          product: { select: { id: true, name: true } },
          checkouts: { select: { id: true, url: true, isActive: true } },
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
    ...parsed.data,
    fallbackUrl: parsed.data.fallbackUrl ?? null,
  };
  const link = await prisma.smartLink.create({ data });
  res.status(201).json(link);
});

router.patch("/:id", async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const link = await prisma.smartLink.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(link);
});

router.delete("/:id", async (req: Request, res: Response) => {
  await prisma.smartLink.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
