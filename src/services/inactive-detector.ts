/**
 * Detecta se um checkout está "inativo" (oferta encerrada, indisponível) por URL final ou conteúdo HTML.
 * Suporta Hotmart, Eduzz e outras plataformas via padrões de URL e texto na página.
 */

export interface InactiveDetectionResult {
  inactive: boolean;
  reason?: string;
  platform?: "hotmart" | "eduzz" | "generic";
}

/** Padrões de URL que indicam oferta/checkout indisponível (case insensitive). */
const INACTIVE_URL_PATTERNS: Array<{ pattern: RegExp | string; platform: string }> = [
  { pattern: /hotmart\.com.*(unavailable|closed|expired|encerrad|indisponivel|not.?found|404)/i, platform: "hotmart" },
  { pattern: /pay\.hotmart\.com.*(unavailable|closed|expired)/i, platform: "hotmart" },
  { pattern: /eduzz\.com.*(unavailable|closed|expired|encerrad|indisponivel|not.?found|404)/i, platform: "eduzz" },
  { pattern: /mono\.eduzz\.com.*(unavailable|closed|expired)/i, platform: "eduzz" },
  { pattern: /(offer|oferta|checkout).*(closed|encerrad|unavailable|indisponivel)/i, platform: "generic" },
  { pattern: /(unavailable|not.?found|404|expired|encerrad)/i, platform: "generic" },
];

/** Trechos de texto no HTML que indicam oferta/checkout inativo (case insensitive). */
const INACTIVE_HTML_PHRASES: Array<{ phrase: string; hint: string }> = [
  { phrase: "ofertas encerradas", hint: "Ofertas encerradas" },
  { phrase: "oferta encerrada", hint: "Oferta encerrada" },
  { phrase: "checkout indisponível", hint: "Checkout indisponível" },
  { phrase: "checkout indisponivel", hint: "Checkout indisponível" },
  { phrase: "não está disponível", hint: "Não disponível" },
  { phrase: "nao esta disponivel", hint: "Não disponível" },
  { phrase: "product is not available", hint: "Produto não disponível" },
  { phrase: "offer closed", hint: "Oferta encerrada" },
  { phrase: "offer is closed", hint: "Oferta encerrada" },
  { phrase: "esta oferta não", hint: "Oferta indisponível" },
  { phrase: "produto indisponível", hint: "Produto indisponível" },
  { phrase: "produto indisponivel", hint: "Produto indisponível" },
  { phrase: "página não encontrada", hint: "Página não encontrada" },
  { phrase: "pagina nao encontrada", hint: "Página não encontrada" },
  { phrase: "404 not found", hint: "Página não encontrada" },
  { phrase: "link expirado", hint: "Link expirado" },
  { phrase: "promoção encerrada", hint: "Promoção encerrada" },
];

/**
 * Verifica se a URL final indica checkout inativo (Hotmart, Eduzz, genérico).
 */
export function checkUrlInactive(finalUrl: string): InactiveDetectionResult {
  const urlLower = finalUrl.toLowerCase();
  for (const { pattern, platform } of INACTIVE_URL_PATTERNS) {
    const matches =
      typeof pattern === "string"
        ? urlLower.includes(pattern.toLowerCase())
        : pattern.test(finalUrl);
    if (matches) {
      return {
        inactive: true,
        reason: `URL indica oferta indisponível (${platform})`,
        platform: platform as "hotmart" | "eduzz" | "generic",
      };
    }
  }
  return { inactive: false };
}

/**
 * Verifica se o HTML da página indica checkout inativo (texto de oferta encerrada, etc.).
 */
export function checkHtmlInactive(html: string): InactiveDetectionResult {
  const body = html.slice(0, 50000); // primeiros 50k chars
  const bodyLower = body.toLowerCase();
  for (const { phrase, hint } of INACTIVE_HTML_PHRASES) {
    if (bodyLower.includes(phrase.toLowerCase())) {
      return {
        inactive: true,
        reason: `Página indica: ${hint}`,
        platform: "generic",
      };
    }
  }
  return { inactive: false };
}

/**
 * Detecta plataforma pela URL (para mensagens mais claras).
 */
export function detectPlatform(url: string): "hotmart" | "eduzz" | "other" {
  if (/hotmart\.com|pay\.hotmart/i.test(url)) return "hotmart";
  if (/eduzz\.com|mono\.eduzz/i.test(url)) return "eduzz";
  return "other";
}
