import { checkUrlInactive, checkHtmlInactive, detectPlatform } from "./inactive-detector.js";

export interface HealthCheckResult {
  ok: boolean;
  status?: number;
  error?: string;
  errorCode?: ErrorCode;
  /** Preenchido quando deep check detecta oferta inativa (Hotmart, Eduzz, etc.). */
  inactiveReason?: string;
}

export type ErrorCode =
  | "TIMEOUT"
  | "INVALID_URL"
  | "DNS_ERROR"
  | "CONNECTION_REFUSED"
  | "SSL_ERROR"
  | "NETWORK_ERROR"
  | "HTTP_ERROR"
  | "INACTIVE_OFFER"
  | "FETCH_ERROR"
  | "UNKNOWN";

export interface HealthCheckConfig {
  timeoutMs: number;
  allowedStatuses: number[];
  /** Se true, segue redirects e valida URL final + HTML (oferta inativa). */
  deep?: boolean;
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  timeoutMs: 5000,
  allowedStatuses: [200, 302],
  deep: false,
};

/**
 * Valida se a URL é válida e acessível.
 */
function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== "string") {
    return { valid: false, error: "URL não informada" };
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: false, error: "URL vazia" };
  }

  // Verifica protocolo
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return { valid: false, error: "URL deve começar com http:// ou https://" };
  }

  try {
    const parsed = new URL(trimmed);

    // Verifica se tem hostname
    if (!parsed.hostname) {
      return { valid: false, error: "URL sem domínio válido" };
    }

    // Bloqueia localhost/IPs privados em produção (opcional)
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.") || hostname.startsWith("10.")) {
      return { valid: false, error: "URLs locais não são permitidas" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "URL com formato inválido" };
  }
}

/**
 * Categoriza erros de fetch para mensagens mais claras.
 */
function categorizeError(error: Error): { message: string; code: ErrorCode } {
  const msg = error.message.toLowerCase();
  const name = error.name;

  // Timeout
  if (name === "AbortError" || msg.includes("aborted") || msg.includes("timeout")) {
    return {
      message: "Tempo limite excedido. O servidor não respondeu a tempo.",
      code: "TIMEOUT",
    };
  }

  // DNS
  if (msg.includes("getaddrinfo") || msg.includes("enotfound") || msg.includes("dns")) {
    return {
      message: "Domínio não encontrado. Verifique se a URL está correta.",
      code: "DNS_ERROR",
    };
  }

  // Conexão recusada
  if (msg.includes("econnrefused") || msg.includes("connection refused")) {
    return {
      message: "Conexão recusada. O servidor pode estar offline.",
      code: "CONNECTION_REFUSED",
    };
  }

  // Conexão resetada
  if (msg.includes("econnreset") || msg.includes("connection reset")) {
    return {
      message: "Conexão interrompida pelo servidor.",
      code: "NETWORK_ERROR",
    };
  }

  // SSL/TLS
  if (
    msg.includes("ssl") ||
    msg.includes("tls") ||
    msg.includes("certificate") ||
    msg.includes("cert") ||
    msg.includes("unable to verify")
  ) {
    return {
      message: "Erro de certificado SSL. O site pode ter um certificado inválido.",
      code: "SSL_ERROR",
    };
  }

  // Rede genérica
  if (
    msg.includes("network") ||
    msg.includes("etimedout") ||
    msg.includes("socket") ||
    msg.includes("ehostunreach")
  ) {
    return {
      message: "Erro de rede. Não foi possível conectar ao servidor.",
      code: "NETWORK_ERROR",
    };
  }

  // Fetch genérico
  if (msg.includes("fetch failed") || msg.includes("failed to fetch")) {
    return {
      message: "Falha ao acessar URL. Verifique se o endereço está correto e acessível.",
      code: "FETCH_ERROR",
    };
  }

  // Erro desconhecido
  return {
    message: `Erro ao verificar: ${error.message}`,
    code: "UNKNOWN",
  };
}

/**
 * Gera mensagem de erro HTTP amigável.
 */
function httpErrorMessage(status: number): string {
  const messages: Record<number, string> = {
    400: "Requisição inválida (400)",
    401: "Acesso não autorizado (401)",
    403: "Acesso proibido (403)",
    404: "Página não encontrada (404)",
    405: "Método não permitido (405)",
    408: "Tempo limite da requisição (408)",
    429: "Muitas requisições. Tente novamente depois (429)",
    500: "Erro interno do servidor (500)",
    502: "Gateway inválido (502)",
    503: "Serviço indisponível (503)",
    504: "Gateway timeout (504)",
  };

  return messages[status] ?? `Erro HTTP ${status}`;
}

async function fetchStatus(
  url: string,
  method: "HEAD" | "GET",
  signal: AbortSignal,
  redirect: "manual" | "follow" = "manual"
): Promise<{ status: number }> {
  const res = await fetch(url, {
    method,
    redirect,
    signal,
    headers: { "User-Agent": "RedirectOffer-HealthCheck/1.0" },
  });
  return { status: res.status };
}

/**
 * Faz GET seguindo redirects e retorna URL final + corpo (para validação de oferta inativa).
 */
async function fetchFinal(
  url: string,
  signal: AbortSignal
): Promise<{ finalUrl: string; body: string; status: number }> {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal,
    headers: { "User-Agent": "RedirectOffer-HealthCheck/1.0" },
  });
  const body = await res.text();
  const finalUrl = res.url || url;
  return { finalUrl, body, status: res.status };
}

/**
 * Verifica se a URL do checkout está respondendo.
 * - Valida URL antes de acessar
 * - HEAD com timeout; status 200/302 (ou configurável) = ok.
 * - Se 405 (Method Not Allowed), tenta GET (ex.: Hotmart).
 * - Se deep=true: segue redirects e valida URL final + HTML para detectar oferta inativa.
 */
export async function checkCheckoutHealth(
  url: string,
  config: Partial<HealthCheckConfig> = {}
): Promise<HealthCheckResult> {
  const { timeoutMs, allowedStatuses, deep = false } = { ...DEFAULT_CONFIG, ...config };

  // 1. Validar URL
  const validation = validateUrl(url);
  if (!validation.valid) {
    return {
      ok: false,
      error: validation.error,
      errorCode: "INVALID_URL",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 2. Tentar HEAD primeiro
    let res = await fetchStatus(url, "HEAD", controller.signal);
    clearTimeout(timeout);

    // 3. Se 405, tentar GET
    if (res.status === 405) {
      const c2 = new AbortController();
      const t2 = setTimeout(() => c2.abort(), timeoutMs);
      try {
        res = await fetchStatus(url, "GET", c2.signal);
      } finally {
        clearTimeout(t2);
      }
    }

    const status = res.status;

    // 4. Verificar status permitido
    if (!allowedStatuses.includes(status)) {
      return {
        ok: false,
        status,
        error: httpErrorMessage(status),
        errorCode: "HTTP_ERROR",
      };
    }

    // 5. Verificação profunda (oferta inativa)
    if (deep) {
      const c3 = new AbortController();
      const t3 = setTimeout(() => c3.abort(), timeoutMs);
      try {
        const { finalUrl, body } = await fetchFinal(url, c3.signal);
        clearTimeout(t3);

        // Verificar URL final
        const urlCheck = checkUrlInactive(finalUrl);
        if (urlCheck.inactive) {
          const platform = detectPlatform(url);
          const platformName = platform === "hotmart" ? "Hotmart" : platform === "eduzz" ? "Eduzz" : "checkout";
          return {
            ok: false,
            status,
            error: `Oferta inativa no ${platformName}`,
            errorCode: "INACTIVE_OFFER",
            inactiveReason: urlCheck.reason,
          };
        }

        // Verificar HTML
        const htmlCheck = checkHtmlInactive(body);
        if (htmlCheck.inactive) {
          return {
            ok: false,
            status,
            error: htmlCheck.reason ?? "Oferta indisponível",
            errorCode: "INACTIVE_OFFER",
            inactiveReason: htmlCheck.reason,
          };
        }
      } catch (e) {
        clearTimeout(t3);
        // Deep check falhou (timeout, etc.); consideramos o checkout ok pelo status
        // para não quebrar o fluxo por causa da validação extra.
        console.warn(`[HealthCheck] Deep check falhou para ${url}:`, e instanceof Error ? e.message : e);
      }
    }

    return { ok: true, status };
  } catch (e) {
    clearTimeout(timeout);
    const err = e instanceof Error ? e : new Error(String(e));
    const categorized = categorizeError(err);

    return {
      ok: false,
      error: categorized.message,
      errorCode: categorized.code,
    };
  }
}
