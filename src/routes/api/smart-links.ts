import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { z } from "zod";
import type { AuthUser } from "../../middleware/auth.js";

const router = Router();

// Helper para pegar userId do request
function getUserId(req: Request): string {
  return (req as Request & { user: AuthUser }).user.id;
}

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

// Gerar sugestões de slugs disponíveis
async function generateSlugSuggestions(baseSlug: string): Promise<string[]> {
  const suggestions: string[] = [];
  const candidates = [
    `${baseSlug}-2`,
    `${baseSlug}-novo`,
    `meu-${baseSlug}`,
    `${baseSlug}-${Date.now().toString().slice(-4)}`,
    `${baseSlug}-pro`,
  ];

  for (const candidate of candidates) {
    const exists = await prisma.campaignLink.findUnique({
      where: { slug: candidate.toLowerCase() },
    });
    if (!exists) {
      suggestions.push(candidate.toLowerCase());
    }
    if (suggestions.length >= 3) break;
  }

  return suggestions;
}

// Verificar disponibilidade de slug
router.get("/check-slug/:slug", async (req: Request, res: Response) => {
  const slug = req.params.slug.toLowerCase().trim();

  if (!slugRegex.test(slug)) {
    return res.status(400).json({
      available: false,
      error: "Slug inválido. Use apenas letras, números, _ e -",
    });
  }

  const existing = await prisma.campaignLink.findUnique({
    where: { slug },
  });

  if (existing) {
    const suggestions = await generateSlugSuggestions(slug);
    return res.json({
      available: false,
      error: "Este slug já está em uso",
      suggestions,
    });
  }

  return res.json({ available: true });
});

// Listar links do usuário logado
router.get("/", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const campaignId = req.query.campaignId as string | undefined;
  const where = campaignId ? { campaignId, userId } : { userId };
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

// Obter link (verificando se pertence ao usuário)
router.get("/:id", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const link = await prisma.campaignLink.findFirst({
    where: { id: req.params.id, userId },
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

// Criar link para o usuário logado
router.post("/", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const slug = parsed.data.slug.toLowerCase().trim();

  // Verificar se slug já existe
  const existingSlug = await prisma.campaignLink.findUnique({
    where: { slug },
  });

  if (existingSlug) {
    const suggestions = await generateSlugSuggestions(slug);
    return res.status(409).json({
      error: "Este slug já está em uso",
      suggestions,
    });
  }

  // Verificar se a campanha pertence ao usuário
  const campaign = await prisma.campaign.findFirst({
    where: { id: parsed.data.campaignId, userId },
  });
  if (!campaign) {
    return res.status(404).json({ error: "Campanha não encontrada" });
  }

  const data = {
    slug,
    campaignId: parsed.data.campaignId,
    userId,
    fallbackUrl: parsed.data.fallbackUrl ?? null,
  };
  const link = await prisma.campaignLink.create({ data });
  res.status(201).json(link);
});

// Atualizar link (verificando se pertence ao usuário)
router.patch("/:id", async (req: Request, res: Response) => {
  const userId = getUserId(req);

  // Verificar se o link pertence ao usuário
  const existing = await prisma.campaignLink.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Link não encontrado" });
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  // Se está alterando o slug, verificar se já existe
  if (parsed.data.slug) {
    const newSlug = parsed.data.slug.toLowerCase().trim();
    if (newSlug !== existing.slug) {
      const existingSlug = await prisma.campaignLink.findUnique({
        where: { slug: newSlug },
      });
      if (existingSlug) {
        const suggestions = await generateSlugSuggestions(newSlug);
        return res.status(409).json({
          error: "Este slug já está em uso",
          suggestions,
        });
      }
    }
  }

  const data = {
    ...(parsed.data.slug ? { slug: parsed.data.slug.toLowerCase().trim() } : {}),
    ...(parsed.data.fallbackUrl !== undefined ? { fallbackUrl: parsed.data.fallbackUrl } : {}),
  };
  const link = await prisma.campaignLink.update({
    where: { id: req.params.id },
    data,
  });
  res.json(link);
});

// Excluir link (verificando se pertence ao usuário)
router.delete("/:id", async (req: Request, res: Response) => {
  const userId = getUserId(req);

  // Verificar se o link pertence ao usuário
  const existing = await prisma.campaignLink.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Link não encontrado" });
  }

  await prisma.campaignLink.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
