import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { z } from "zod";

const router = Router();
const createSchema = z.object({ name: z.string().min(1).max(200) });
const updateSchema = createSchema.partial();

router.get("/", async (_req: Request, res: Response) => {
  const list = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { groups: true } },
    },
  });
  res.json(list);
});

router.get("/:id", async (req: Request, res: Response) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: {
      groups: {
        include: {
          _count: { select: { checkouts: true, smartLinks: true } },
        },
      },
    },
  });
  if (!product) return res.status(404).json({ error: "Produto não encontrado" });
  res.json(product);
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const product = await prisma.product.create({ data: parsed.data });
  res.status(201).json(product);
});

router.patch("/:id", async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(product);
});

router.delete("/:id", async (req: Request, res: Response) => {
  await prisma.product.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
