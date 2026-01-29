import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { z } from "zod";

const router = Router();
const createSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1).max(200),
  rotationStrategy: z.enum(["round-robin", "priority"]).default("round-robin"),
});
const updateSchema = z
  .object({
    name: z.string().min(1).max(200),
    rotationStrategy: z.enum(["round-robin", "priority"]),
  })
  .partial();

router.get("/", async (req: Request, res: Response) => {
  const productId = req.query.productId as string | undefined;
  const where = productId ? { productId } : {};
  const list = await prisma.checkoutGroup.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { id: true, name: true } },
      _count: { select: { checkouts: true, smartLinks: true } },
    },
  });
  res.json(list);
});

router.get("/:id", async (req: Request, res: Response) => {
  const group = await prisma.checkoutGroup.findUnique({
    where: { id: req.params.id },
    include: {
      product: { select: { id: true, name: true } },
      checkouts: true,
      smartLinks: true,
    },
  });
  if (!group) return res.status(404).json({ error: "Grupo não encontrado" });
  res.json(group);
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const group = await prisma.checkoutGroup.create({ data: parsed.data });
  res.status(201).json(group);
});

router.patch("/:id", async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const group = await prisma.checkoutGroup.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(group);
});

router.delete("/:id", async (req: Request, res: Response) => {
  await prisma.checkoutGroup.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
