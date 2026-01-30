import type { Request, Response } from "express";
import { resolveSmartLink } from "../services/checkout-selector.js";
import { loadConfig } from "../config.js";
import { renderFallbackPage } from "../views/fallback.js";

const config = loadConfig();

/**
 * GET /go/:slug
 * Resolve o link inteligente, escolhe checkout ativo, health check, redireciona ou fallback.
 *
 * Parâmetros UTM e outros query params são passados para o checkout final.
 * Exemplo: /go/demo?utm_source=FB&utm_campaign=test
 * → Redireciona para: https://pay.hotmart.com/XXX?utm_source=FB&utm_campaign=test
 */
export async function handleGo(req: Request, res: Response): Promise<void> {
  const slug = req.params.slug as string;
  if (!slug?.trim()) {
    res.status(400).send("Slug obrigatório");
    return;
  }

  // Capturar todos os query params do request original
  const queryParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === "string") {
      queryParams[key] = value;
    } else if (Array.isArray(value) && typeof value[0] === "string") {
      // Se for array, pegar o primeiro valor
      queryParams[key] = value[0];
    }
  }

  console.log(`[Go] Resolvendo slug: ${slug}, params:`, Object.keys(queryParams).length > 0 ? queryParams : "(nenhum)");

  const outcome = await resolveSmartLink({
    slug,
    env: config,
    queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
  });

  switch (outcome.type) {
    case "redirect":
      console.log(`[Go] Redirecionando para: ${outcome.url}`);
      res.redirect(302, outcome.url);
      return;
    case "fallback":
      console.log(`[Go] Usando fallback: ${outcome.url}`);
      res.redirect(302, outcome.url);
      return;
    case "error":
      console.log(`[Go] Erro: ${outcome.message}`);
      // Todos os checkouts falharam ou não há nenhum: não redireciona; mostra página "nenhuma oferta".
      res.status(503).send(renderFallbackPage({ message: outcome.message }));
      return;
  }
}
