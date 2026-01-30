/**
 * Detecta se um checkout está "inativo" (oferta encerrada, indisponível) por URL final ou conteúdo HTML.
 * Otimizado para Hotmart com detecção robusta.
 */

export interface InactiveDetectionResult {
  inactive: boolean;
  reason?: string;
  platform?: "hotmart" | "eduzz" | "generic";
}

/**
 * Padrões de URL que indicam checkout INATIVO na Hotmart.
 * - /error?errorMessage= indica erro/checkout inativo
 * - URLs com "unavailable", "closed", etc.
 */
const HOTMART_INACTIVE_URL_PATTERNS: RegExp[] = [
  // URL de erro da Hotmart (principal indicador)
  /pay\.hotmart\.com\/error/i,
  /hotmart\.com\/error\?/i,
  /errorMessage=/i,
  
  // Outros padrões de inatividade
  /hotmart\.com.*(unavailable|closed|expired|encerrad|indisponivel)/i,
  /pay\.hotmart\.com.*(unavailable|closed|expired)/i,
];

/**
 * Padrões de URL para outros checkouts (Eduzz, genérico).
 */
const OTHER_INACTIVE_URL_PATTERNS: Array<{ pattern: RegExp; platform: string }> = [
  { pattern: /eduzz\.com.*(unavailable|closed|expired|encerrad|indisponivel|not.?found|404)/i, platform: "eduzz" },
  { pattern: /mono\.eduzz\.com.*(unavailable|closed|expired)/i, platform: "eduzz" },
];

/**
 * Frases no HTML que indicam checkout INATIVO na Hotmart.
 * Baseado nos prints: PT e EN.
 */
const HOTMART_INACTIVE_HTML_PHRASES: string[] = [
  // Português
  "vendas deste produto estão temporariamente encerradas",
  "vendas deste produto estao temporariamente encerradas",
  "agradecemos o interesse, mas as vendas",
  "ofertas encerradas",
  "oferta encerrada",
  "checkout indisponível",
  "checkout indisponivel",
  "produto indisponível",
  "produto indisponivel",
  "esta oferta não está disponível",
  "esta oferta nao esta disponivel",
  "link expirado",
  "promoção encerrada",
  "promocao encerrada",
  
  // Inglês
  "sales of this product are temporarily closed",
  "thank you for your interest, but sales",
  "product is not available",
  "offer closed",
  "offer is closed",
  "this offer is not available",
  "checkout unavailable",
  "expired link",
];

/**
 * Frases genéricas que indicam página de erro/404.
 */
const GENERIC_ERROR_PHRASES: string[] = [
  "página não encontrada",
  "pagina nao encontrada",
  "page not found",
  "404 not found",
  "erro 404",
  "error 404",
  "não foi possível encontrar",
  "nao foi possivel encontrar",
];

/**
 * Verifica se a URL indica checkout inativo (Hotmart primeiro, depois outros).
 */
export function checkUrlInactive(finalUrl: string): InactiveDetectionResult {
  const urlLower = finalUrl.toLowerCase();

  // 1. Verificar padrões específicos da Hotmart
  for (const pattern of HOTMART_INACTIVE_URL_PATTERNS) {
    if (pattern.test(finalUrl)) {
      return {
        inactive: true,
        reason: "Checkout Hotmart inativo (URL de erro)",
        platform: "hotmart",
      };
    }
  }

  // 2. Verificar outros padrões (Eduzz, etc.)
  for (const { pattern, platform } of OTHER_INACTIVE_URL_PATTERNS) {
    if (pattern.test(finalUrl)) {
      return {
        inactive: true,
        reason: `Checkout ${platform} inativo`,
        platform: platform as "eduzz",
      };
    }
  }

  return { inactive: false };
}

/**
 * Verifica se o HTML indica checkout inativo.
 * Prioriza detecção de Hotmart, depois genérico.
 */
export function checkHtmlInactive(html: string): InactiveDetectionResult {
  // Limitar a 80KB para performance
  const body = html.slice(0, 80000);
  const bodyLower = body.toLowerCase();

  // 1. Verificar frases específicas da Hotmart
  for (const phrase of HOTMART_INACTIVE_HTML_PHRASES) {
    if (bodyLower.includes(phrase.toLowerCase())) {
      return {
        inactive: true,
        reason: "Oferta Hotmart encerrada",
        platform: "hotmart",
      };
    }
  }

  // 2. Verificar frases genéricas de erro
  for (const phrase of GENERIC_ERROR_PHRASES) {
    if (bodyLower.includes(phrase.toLowerCase())) {
      return {
        inactive: true,
        reason: "Página não encontrada",
        platform: "generic",
      };
    }
  }

  // 3. Verificar se é página de erro da Hotmart pelo tamanho do HTML
  // Páginas de erro da Hotmart são bem menores que checkouts normais
  // Checkout ativo: geralmente > 50KB de HTML
  // Checkout inativo: geralmente < 10KB de HTML
  if (detectPlatform(body) === "hotmart" && body.length < 15000) {
    // Verificar se NÃO tem elementos de checkout (form, input de cartão, etc.)
    const hasCheckoutForm = 
      bodyLower.includes('name="cardnumber"') ||
      bodyLower.includes('name="card_number"') ||
      bodyLower.includes('payment-method') ||
      bodyLower.includes('cartão de crédito') ||
      bodyLower.includes('credit card') ||
      bodyLower.includes('método de pagamento') ||
      bodyLower.includes('payment methods') ||
      bodyLower.includes('seu email') ||
      bodyLower.includes('your email');

    if (!hasCheckoutForm) {
      return {
        inactive: true,
        reason: "Página Hotmart sem formulário de checkout",
        platform: "hotmart",
      };
    }
  }

  return { inactive: false };
}

/**
 * Detecta plataforma pela URL ou conteúdo.
 */
export function detectPlatform(urlOrHtml: string): "hotmart" | "eduzz" | "other" {
  const lower = urlOrHtml.toLowerCase();
  if (lower.includes("hotmart.com") || lower.includes("pay.hotmart")) return "hotmart";
  if (lower.includes("eduzz.com") || lower.includes("mono.eduzz")) return "eduzz";
  return "other";
}

/**
 * Verifica se uma URL é um checkout Hotmart válido.
 * Checkouts válidos da Hotmart seguem o padrão: pay.hotmart.com/[CÓDIGO]
 */
export function isValidHotmartCheckoutUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Deve ser pay.hotmart.com
    if (!parsed.hostname.includes("pay.hotmart.com")) {
      return false;
    }

    // Não deve ser URL de erro
    if (parsed.pathname.includes("/error")) {
      return false;
    }

    // Deve ter um código de produto no path (ex: /B104050761G)
    const pathMatch = parsed.pathname.match(/^\/[A-Z0-9]+/i);
    if (!pathMatch) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
