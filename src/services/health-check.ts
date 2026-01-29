export interface HealthCheckResult {
  ok: boolean;
  status?: number;
  error?: string;
}

export interface HealthCheckConfig {
  timeoutMs: number;
  allowedStatuses: number[];
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  timeoutMs: 5000,
  allowedStatuses: [200, 302],
};

async function fetchStatus(
  url: string,
  method: "HEAD" | "GET",
  signal: AbortSignal
): Promise<{ status: number }> {
  const res = await fetch(url, {
    method,
    redirect: "manual",
    signal,
    headers: { "User-Agent": "RedirectOffer-HealthCheck/1.0" },
  });
  return { status: res.status };
}

/**
 * Verifica se a URL do checkout está respondendo.
 * HEAD com timeout; status 200/302 (ou configurável) = ok.
 * Se o servidor retornar 405 (Method Not Allowed), tenta GET (ex.: Hotmart).
 */
export async function checkCheckoutHealth(
  url: string,
  config: Partial<HealthCheckConfig> = {}
): Promise<HealthCheckResult> {
  const { timeoutMs, allowedStatuses } = { ...DEFAULT_CONFIG, ...config };
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
    if (allowedStatuses.includes(status)) {
      return { ok: true, status };
    }
    return { ok: false, status, error: `HTTP ${status}` };
  } catch (e) {
    clearTimeout(timeout);
    const err = e instanceof Error ? e : new Error(String(e));
    const message = err.name === "AbortError" ? "Timeout" : err.message;
    return { ok: false, error: message };
  }
}
