const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function sendTelegramNotification(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("Telegram não configurado (TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID ausente)");
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
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Erro ao enviar notificação Telegram:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Erro ao enviar notificação Telegram:", error);
    return false;
  }
}

export async function notifyEndpointDown(
  campaignName: string,
  endpointUrl: string,
  reason: string,
  consecutiveFailures: number
): Promise<void> {
  const message = `
🚨 *Endpoint Inativo*

*Campanha:* ${campaignName}
*URL:* ${endpointUrl}
*Motivo:* ${reason}
*Falhas consecutivas:* ${consecutiveFailures}
*Horário:* ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
  `.trim();

  await sendTelegramNotification(message);
}

export async function notifyEndpointRecovered(
  campaignName: string,
  endpointUrl: string
): Promise<void> {
  const message = `
✅ *Endpoint Recuperado*

*Campanha:* ${campaignName}
*URL:* ${endpointUrl}
*Horário:* ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
  `.trim();

  await sendTelegramNotification(message);
}
