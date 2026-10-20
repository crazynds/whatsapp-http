import { Op } from "@sequelize/core";
import log from "../lib/logger";
import PendingWebhook from "../models/pendingWebhook";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000;
const RETRY_LOOP_INTERVAL_MS = 30 * 1000;

async function attemptSend(row: InstanceType<typeof PendingWebhook>) {
  const webhookUrl = row.get("webhookUrl") as string;
  const payload = row.get("payload") as string;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    if (res.ok) {
      await row.destroy();
      log.http(
        `Webhook entregue (client: ${row.get("clientId")}, status: ${res.status})`,
      );
      return true;
    }
    log.warn(
      `Webhook respondeu com status ${res.status} (url: ${webhookUrl})`,
    );
  } catch (error) {
    log.warn("Falha ao entregar webhook:", error);
  }

  const attempts = (row.get("attempts") as number) + 1;
  if (attempts >= MAX_ATTEMPTS) {
    log.error(
      `Webhook descartado após ${attempts} tentativas (url: ${webhookUrl})`,
    );
    await row.destroy();
    return false;
  }
  row.set({
    attempts,
    nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS),
  });
  await row.save();
  return false;
}

/**
 * Persiste o webhook antes de tentar enviar, garantindo que a mensagem
 * não se perde caso o processo caia durante o fetch. Faz uma primeira
 * tentativa imediata; se falhar, o loop de retry assume dali pra frente.
 */
export async function deliverWebhook(
  clientId: string,
  webhookUrl: string,
  payload: unknown,
) {
  const row = await PendingWebhook.create({
    clientId,
    webhookUrl,
    payload: JSON.stringify(payload),
    attempts: 0,
    nextAttemptAt: new Date(),
  });
  return attemptSend(row);
}

async function retryDueWebhooks() {
  const rows = await PendingWebhook.findAll({
    where: { nextAttemptAt: { [Op.lte]: new Date() } },
  });
  for (const row of rows) {
    await attemptSend(row);
  }
}

/**
 * Chamado no boot para retomar webhooks que ficaram pendentes de uma
 * execução anterior (ex: processo crashou antes de confirmar entrega).
 */
export async function retryPendingWebhooksOnStartup() {
  const count = await PendingWebhook.count();
  if (count > 0) {
    log.info(`Retomando ${count} webhook(s) pendente(s) de entrega`);
  }
  await retryDueWebhooks();
}

export function startWebhookRetryLoop() {
  setInterval(() => {
    retryDueWebhooks().catch((error) => {
      log.error("Erro no loop de retry de webhooks:", error);
    });
  }, RETRY_LOOP_INTERVAL_MS);
}
