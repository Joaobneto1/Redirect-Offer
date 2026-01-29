import { checkUrlInactive, checkHtmlInactive } from "./inactive-detector.js";

export interface HealthCheckResult {
  ok: boolean;
  status?: number;
  error?: string;
  /** Preenchido quando deep check detecta oferta inativa (Hotmart, Eduzz, etc.). */
  inactiveReason?: string;
}

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
 * - HEAD com timeout; status 200/302 (ou configurável) = ok.
 * - Se 405 (Method Not Allowed), tenta GET (ex.: Hotmart).
 * - Se deep=true: segue redirects e valida URL final + HTML para detectar oferta inativa (Hotmart, Eduzz, etc.).
 */
export async function checkCheckoutHealth(
  url: string,
  config: Partial<HealthCheckConfig> = {}
): Promise<HealthCheckResult> {
  const { timeoutMs, allowedStatuses, deep = false } = { ...DEFAULT_CONFIG, ...config };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res = await fetchStatus(url, "HEAD", controller.signal);
    clearTimeout(timeout);

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
    if (!allowedStatuses.includes(status)) {
      return { ok: false, status, error: `HTTP ${status}` };
    }

    // Opcional: validação profunda (oferta inativa por URL/HTML)
    if (deep) {
      const c3 = new AbortController();
      const t3 = setTimeout(() => c3.abort(), timeoutMs);
      try {
        const { finalUrl, body } = await fetchFinal(url, c3.signal);
        clearTimeout(t3);

        const urlCheck = checkUrlInactive(finalUrl);
        if (urlCheck.inactive) {
          return {
            ok: false,
            status,
            error: urlCheck.reason ?? "Checkout inativo (URL)",
            inactiveReason: urlCheck.reason,
          };
        }

        const htmlCheck = checkHtmlInactive(body);
        if (htmlCheck.inactive) {
          return {
            ok: false,
            status,
            error: htmlCheck.reason ?? "Checkout inativo (página)",
            inactiveReason: htmlCheck.reason,
          };
        }
      } catch (e) {
        clearTimeout(t3);
        // Deep check falhou (timeout, etc.); consideramos o checkout ok pelo status
        // e não quebramos o fluxo por causa da validação extra.
      }
    }

    return { ok: true, status };
  } catch (e) {
    clearTimeout(timeout);
    const err = e instanceof Error ? e : new Error(String(e));
    const message = err.name === "AbortError" ? "Timeout" : err.message;
    return { ok: false, error: message };
  }
}
