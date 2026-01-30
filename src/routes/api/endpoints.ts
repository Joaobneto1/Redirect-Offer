import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { loadConfig } from "../../config.js";
import { checkCheckoutHealth } from "../../services/health-check.js";

const router = Router();
const config = loadConfig();

// Manual check for an endpoint
router.post("/:id/check", async (req: Request, res: Response) => {
  try {
    const ep = await prisma.endpoint.findUnique({ where: { id: req.params.id } });
    if (!ep) {
      return res.status(404).json({
        ok: false,
        error: "Endpoint não encontrado",
        errorCode: "NOT_FOUND"
      });
    }

    const result = await checkCheckoutHealth(ep.url, {
      timeoutMs: config.HEALTH_CHECK_TIMEOUT_MS,
      allowedStatuses: config.HEALTH_CHECK_ALLOWED_STATUSES,
      deep: true,
    });

    if (result.ok) {
      await prisma.endpoint.update({
        where: { id: ep.id },
        data: {
          lastCheckedAt: new Date(),
          consecutiveFailures: 0,
          lastError: null,
          isActive: true,
        },
      });

      return res.json({
        ok: true,
        status: result.status,
        message: "Endpoint funcionando corretamente"
      });
    }

    // Endpoint com falha
    const errorMsg = result.inactiveReason ?? result.error ?? `HTTP ${result.status ?? "?"}`;
    const updated = await prisma.endpoint.update({
      where: { id: ep.id },
      data: {
        lastError: errorMsg,
        lastCheckedAt: new Date(),
        consecutiveFailures: { increment: 1 },
      },
    });

    // Desativar se atingiu threshold
    const wasDeactivated = updated.consecutiveFailures >= config.FAILURE_THRESHOLD;
    if (wasDeactivated) {
      await prisma.endpoint.update({
        where: { id: ep.id },
        data: { isActive: false }
      });
    }

    return res.json({
      ok: false,
      error: errorMsg,
      errorCode: result.errorCode,
      status: result.status,
      inactiveReason: result.inactiveReason ?? undefined,
      consecutiveFailures: updated.consecutiveFailures,
      wasDeactivated,
    });
  } catch (err) {
    console.error("[POST /endpoints/:id/check]", err);
    return res.status(500).json({
      ok: false,
      error: "Erro interno ao verificar endpoint",
      errorCode: "INTERNAL_ERROR"
    });
  }
});

// Create endpoint
router.post("/", async (req: Request, res: Response) => {
  try {
    const { campaignId, url, priority = 0 } = req.body as {
      campaignId: string;
      url: string;
      priority?: number
    };

    if (!campaignId || !url) {
      return res.status(400).json({
        error: "campaignId e url são obrigatórios"
      });
    }

    // Validar URL básica
    const trimmedUrl = url.trim();
    if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
      return res.status(400).json({
        error: "URL deve começar com http:// ou https://"
      });
    }

    try {
      new URL(trimmedUrl);
    } catch {
      return res.status(400).json({
        error: "URL com formato inválido"
      });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId }
    });
    if (!campaign) {
      return res.status(404).json({
        error: "Campanha não encontrada"
      });
    }

    const endpoint = await prisma.endpoint.create({
      data: {
        campaignId,
        url: trimmedUrl,
        priority,
        isActive: true,
      },
    });

    return res.status(201).json(endpoint);
  } catch (err) {
    console.error("[POST /endpoints]", err);
    return res.status(500).json({
      error: "Erro ao criar endpoint"
    });
  }
});

// Update endpoint (URL, priority, isActive)
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const data = req.body as {
      url?: string;
      priority?: number;
      isActive?: boolean
    };

    // Validar URL se fornecida
    if (data.url) {
      const trimmedUrl = data.url.trim();
      if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
        return res.status(400).json({
          error: "URL deve começar com http:// ou https://"
        });
      }

      try {
        new URL(trimmedUrl);
      } catch {
        return res.status(400).json({
          error: "URL com formato inválido"
        });
      }

      data.url = trimmedUrl;
    }

    const updated = await prisma.endpoint.update({
      where: { id: req.params.id },
      data
    });

    return res.json(updated);
  } catch (err) {
    console.error("[PATCH /endpoints/:id]", err);
    return res.status(500).json({
      error: "Erro ao atualizar endpoint"
    });
  }
});

// Delete endpoint
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await prisma.endpoint.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    console.error("[DELETE /endpoints/:id]", err);
    return res.status(500).json({
      error: "Erro ao remover endpoint"
    });
  }
});

export default router;
