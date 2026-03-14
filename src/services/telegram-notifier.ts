/**
 * Notificador Telegram — envia alertas ao grupo quando:
 * 1. Um checkout FALHA pela PRIMEIRA vez (alerta imediato)
 * 2. Um checkout é DESATIVADO (atingiu threshold)
 * 3. TODOS os checkouts de uma campanha estão fora (CRÍTICO — tráfego perdido!)
 * 4. Um checkout se RECUPERA
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function sendTelegramNotification(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("[Telegram] Não configurado (TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID ausente)");
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Telegram] Erro ao enviar:", error);
      return false;
    }

    console.log("[Telegram] Notificação enviada com sucesso");
    return true;
  } catch (error) {
    console.error("[Telegram] Erro ao enviar:", error);
    return false;
  }
}

// ────────────────────── Horário ──────────────────────
function now(): string {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// ────────────────────── 1. PRIMEIRA FALHA (alerta imediato) ──────────────────────
/**
 * Avisa no Telegram assim que um checkout FALHA pela primeira vez.
 * Isso garante que o cliente saiba IMEDIATAMENTE que algo está errado,
 * sem precisar esperar o threshold.
 */
export async function notifyFirstFailure(
  campaignName: string,
  endpointUrl: string,
  reason: string,
  consecutiveFailures: number,
  context?: { slug?: string; totalEndpoints?: number; activeEndpoints?: number }
): Promise<void> {
  const ctx = context
    ? `\n<b>Link:</b> /go/${context.slug ?? "?"}\n<b>Endpoints ativos:</b> ${context.activeEndpoints ?? "?"}/${context.totalEndpoints ?? "?"}`
    : "";

  const isTimeout = /tempo limite|timeout|não respondeu a tempo/i.test(reason);
  const extraNote = isTimeout
    ? "\n\nℹ️ Timeout pode ser instabilidade momentânea. O sistema tentará de novo no próximo ciclo."
    : "";

  const message = `⚠️ <b>Checkout com problema</b>

<b>Campanha:</b> ${esc(campaignName)}
<b>URL:</b> <code>${esc(endpointUrl)}</code>
<b>Erro:</b> ${esc(reason)}
<b>Falhas consecutivas:</b> ${consecutiveFailures}${ctx}
<b>Horário:</b> ${now()}

O sistema está tentando os próximos checkouts da fila.${extraNote}`;

  await sendTelegramNotification(message);
}

// ────────────────────── 2. DESATIVADO (threshold atingido) ──────────────────────
/**
 * Avisa quando o checkout é DESATIVADO automaticamente.
 */
export async function notifyEndpointDeactivated(
  campaignName: string,
  endpointUrl: string,
  reason: string,
  consecutiveFailures: number
): Promise<void> {
  const message = `🔴 <b>Checkout DESATIVADO</b>

<b>Campanha:</b> ${esc(campaignName)}
<b>URL:</b> <code>${esc(endpointUrl)}</code>
<b>Motivo:</b> ${esc(reason)}
<b>Falhas consecutivas:</b> ${consecutiveFailures}
<b>Horário:</b> ${now()}

Este checkout foi removido da rotação e NÃO receberá mais tráfego.`;

  await sendTelegramNotification(message);
}

// ────────────────────── 2b. TIMEOUT (alerta suave — limitado para não encher o Telegram) ──────────────────────
/** Máximo 1 alerta de timeout por endpoint a cada 30 minutos */
const TIMEOUT_ALERT_COOLDOWN_MS = 30 * 60 * 1000;
const lastTimeoutAlertByEndpoint = new Map<string, number>();

/**
 * Checkout respondeu com timeout. Não desativa; avisa no máximo 1x a cada 30 min por endpoint.
 */
export async function notifyTimeout(
  campaignName: string,
  endpointUrl: string,
  context?: { slug?: string; endpointId?: string }
): Promise<void> {
  const endpointId = context?.endpointId;
  if (endpointId) {
    const last = lastTimeoutAlertByEndpoint.get(endpointId) ?? 0;
    if (Date.now() - last < TIMEOUT_ALERT_COOLDOWN_MS) {
      return; // evita spam: só 1 aviso a cada 30 min por endpoint
    }
    lastTimeoutAlertByEndpoint.set(endpointId, Date.now());
  }

  const ctx = context?.slug ? `\n<b>Link:</b> /go/${context.slug}` : "";
  const message = `⏱️ <b>Checkout lento (timeout)</b>

<b>Campanha:</b> ${esc(campaignName)}
<b>URL:</b> <code>${esc(endpointUrl)}</code>
<b>Horário:</b> ${now()}${ctx}

O servidor demorou para responder. O sistema <b>não desativou</b> o checkout e tentará de novo no próximo ciclo. Se continuar, verifique o link.`;

  await sendTelegramNotification(message);
}

// ────────────────────── 3. TODOS OS CHECKOUTS CAÍRAM (CRÍTICO) ──────────────────────
/**
 * Avisa quando TODOS os checkouts de uma campanha estão fora do ar.
 * Isso é CRÍTICO — o tráfego pago está sendo PERDIDO.
 */
export async function notifyAllEndpointsDown(
  campaignName: string,
  slug: string,
  totalEndpoints: number
): Promise<void> {
  const message = `🚨🚨🚨 <b>TODOS OS CHECKOUTS CAÍRAM!</b>

<b>Campanha:</b> ${esc(campaignName)}
<b>Link:</b> /go/${esc(slug)}
<b>Total de checkouts:</b> ${totalEndpoints} (todos fora do ar)
<b>Horário:</b> ${now()}

<b>AÇÃO URGENTE:</b> O tráfego pago está sendo PERDIDO. Ninguém está conseguindo comprar. Verifique os checkouts AGORA ou pause os anúncios.`;

  await sendTelegramNotification(message);
}

// ────────────────────── 3b. TODOS LENTOS (só timeout — não é “todos caíram”) ──────────────────────
/**
 * Todos os checkouts responderam com timeout. Pode ser instabilidade; não alarmar como “todos caíram”.
 */
export async function notifyAllTimeoutsOrUnstable(
  campaignName: string,
  slug: string,
  totalEndpoints: number
): Promise<void> {
  const message = `⏱️ <b>Checkouts lentos ou instáveis (timeout)</b>

<b>Campanha:</b> ${esc(campaignName)}
<b>Link:</b> /go/${esc(slug)}
<b>Total:</b> ${totalEndpoints} endpoint(s) não responderam a tempo.
<b>Horário:</b> ${now()}

Nenhum foi desativado. O sistema tentará de novo. Se persistir, verifique os links ou a rede.`;

  await sendTelegramNotification(message);
}

// ────────────────────── 4. CHECKOUT RECUPERADO ──────────────────────
/**
 * Avisa quando um checkout que estava com problema volta a funcionar.
 */
export async function notifyEndpointRecovered(
  campaignName: string,
  endpointUrl: string
): Promise<void> {
  const message = `✅ <b>Checkout recuperado</b>

<b>Campanha:</b> ${esc(campaignName)}
<b>URL:</b> <code>${esc(endpointUrl)}</code>
<b>Horário:</b> ${now()}

O checkout voltou a funcionar e está recebendo tráfego normalmente.`;

  await sendTelegramNotification(message);
}

// ────────────────────── 5. CHECK MANUAL — falha no dashboard ──────────────────────
/**
 * Avisa quando o usuário faz check manual no dashboard e o checkout falha.
 */
export async function notifyManualCheckFailed(
  campaignName: string,
  endpointUrl: string,
  reason: string,
  wasDeactivated: boolean
): Promise<void> {
  const statusEmoji = wasDeactivated ? "🔴" : "⚠️";
  const statusText = wasDeactivated ? "DESATIVADO" : "com problema";

  const message = `${statusEmoji} <b>Verificação manual: checkout ${statusText}</b>

<b>Campanha:</b> ${esc(campaignName)}
<b>URL:</b> <code>${esc(endpointUrl)}</code>
<b>Erro:</b> ${esc(reason)}
<b>Horário:</b> ${now()}`;

  await sendTelegramNotification(message);
}

// ────────────────────── Aliases de compatibilidade ──────────────────────
/** @deprecated Use notifyEndpointDeactivated */
export async function notifyEndpointDown(
  campaignName: string,
  endpointUrl: string,
  reason: string,
  consecutiveFailures: number
): Promise<void> {
  return notifyEndpointDeactivated(campaignName, endpointUrl, reason, consecutiveFailures);
}

// ────────────────────── Helper ──────────────────────
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
