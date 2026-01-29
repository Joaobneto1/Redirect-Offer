export interface FallbackPageOptions {
  message?: string;
  title?: string;
}

/**
 * Página HTML exibida quando todos os checkouts falham e não há fallback configurado.
 */
export function renderFallbackPage(opts: FallbackPageOptions = {}): string {
  const message = opts.message ?? "Nenhuma oferta disponível no momento. Quando todos os checkouts estão fora do ar, não redirecionamos para lugar nenhum.";
  const title = opts.title ?? "Nenhuma oferta disponível";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f172a;
      color: #e2e8f0;
    }
    .card {
      max-width: 420px;
      padding: 2rem;
      text-align: center;
      background: #1e293b;
      border-radius: 12px;
      border: 1px solid #334155;
    }
    h1 { font-size: 1.25rem; margin: 0 0 0.75rem; color: #f8fafc; }
    p { margin: 0; color: #94a3b8; line-height: 1.5; }
    .retry { margin-top: 1.5rem; }
    a {
      display: inline-block;
      padding: 0.5rem 1rem;
      background: #3b82f6;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
    }
    a:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <p class="retry"><a href="javascript:location.reload()">Tentar novamente</a> — ou feche a página.</p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
