import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../../middleware/auth.js";

const router = Router();

// Helper para pegar userId do request
function getUserId(req: Request): string {
  return (req as Request & { user: AuthUser }).user.id;
}

router.get("/", async (req: Request, res: Response) => {
  const userId = getUserId(req);

  // Buscar campanhas do usuário para filtrar endpoints
  const userCampaignIds = await prisma.campaign.findMany({
    where: { userId },
    select: { id: true },
  });
  const campaignIds = userCampaignIds.map((c) => c.id);

  const [campaigns, endpoints, links, activeEndpoints] = await Promise.all([
    prisma.campaign.count({ where: { userId } }),
    prisma.endpoint.count({ where: { campaignId: { in: campaignIds } } }),
    prisma.campaignLink.count({ where: { userId } }),
    prisma.endpoint.count({ where: { campaignId: { in: campaignIds }, isActive: true } }),
  ]);

  res.json({
    campaigns,
    endpoints,
    links,
    activeEndpoints,
  });
});

export default router;
