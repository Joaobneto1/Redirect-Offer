import type { Request, Response } from "express";
import { resolveSmartLink } from "../services/checkout-selector.js";
import { loadConfig } from "../config.js";
import { renderFallbackPage } from "../views/fallback.js";

const config = loadConfig();

/**
 * GET /go/:slug
 * Resolve o link inteligente, escolhe checkout ativo, health check, redireciona ou fallback.
 */
export async function handleGo(req: Request, res: Response): Promise<void> {
  const slug = req.params.slug as string;
  if (!slug?.trim()) {
    res.status(400).send("Slug obrigatório");
    return;
  }

  const outcome = await resolveSmartLink({ slug, env: config });

  switch (outcome.type) {
    case "redirect":
      res.redirect(302, outcome.url);
      return;
    case "fallback":
      res.redirect(302, outcome.url);
      return;
    case "error":
      res.status(503).send(renderFallbackPage({ message: outcome.message }));
      return;
  }
}
