import { Router, type Response } from "express";
import { prisma } from "../../lib/prisma.js";

const router = Router();

router.get("/", async (_req, res: Response) => {
  const [campaigns, endpoints, links, activeEndpoints] = await Promise.all([
    prisma.campaign.count(),
    prisma.endpoint.count(),
    prisma.campaignLink.count(),
    prisma.endpoint.count({ where: { isActive: true } }),
  ]);
  res.json({
    campaigns,
    endpoints,
    links,
    activeEndpoints,
  });
});

export default router;
