import { Router, type Response } from "express";
import { prisma } from "../../lib/prisma.js";

const router = Router();

router.get("/", async (_req, res: Response) => {
  const [products, groups, checkouts, smartLinks, activeCheckouts] =
    await Promise.all([
      prisma.product.count(),
      prisma.checkoutGroup.count(),
      prisma.checkout.count(),
      prisma.smartLink.count(),
      prisma.checkout.count({ where: { isActive: true } }),
    ]);
  res.json({
    products,
    groups,
    checkouts,
    smartLinks,
    activeCheckouts,
  });
});

export default router;
