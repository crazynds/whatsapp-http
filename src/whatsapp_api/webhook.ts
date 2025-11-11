import { Chat, Message, MessageAck, MessageTypes } from "whatsapp-web.js";
import log from "../lib/logger";
import { Model } from "@sequelize/core";
import {
  WhatsAppChange,
  WhatsAppContact,
  WhatsAppMessage,
  WhatsAppMessageType,
  WhatsAppStatus,
  WhatsAppWebhookPayload,
} from "../types/MetaAPI";
import { downloadMediaMessage, WAMessage } from "baileys";
import logger from "../lib/logger";

function formatStatus(messageAck: WAMessage): WhatsAppStatus {
  const acks: {
    [key: number]: "sent" | "delivered" | "read" | "failed" | "deleted";
  } = {
    [0]: "failed",
    [1]: "sent",
    [2]: "sent",
    [3]: "delivered",
    [4]: "read",
    [5]: "read",
  };
  return {
    id: messageAck.key.id || "",
    status: acks[messageAck.status ?? 0],
    timestamp: Math.floor(Date.now()).toString(),
    recipient_id: messageAck.key.remoteJid || "",
  };
}

async function downloadMedia(message: WAMessage) {
  if (!message.message?.audioMessage)
    return {
      data: "",
      mimetype: "",
      filesize: 0,
      filename: "",
    };
  const buffer = await downloadMediaMessage(message, "buffer", {});
  const base64Audio = buffer.toString("base64");
  const mimetype = message.message.audioMessage.mimetype || "audio/ogg";
  var fileSize = message.message.audioMessage.fileLength || buffer.length;
  if (typeof fileSize == "object") {
    try {
      fileSize = Number(fileSize);
    } catch (e) {
      fileSize = 0;
    }
  }
  return {
    data: base64Audio,
    mimetype,
    filesize: fileSize,
    filename: message.message.audioMessage.url ?? "",
  };
}

async function formatMessage(message: WAMessage): Promise<WhatsAppMessage> {
  const quote = !!message.message?.extendedTextMessage?.contextInfo
    ? {
        from: (
          message.message?.extendedTextMessage?.contextInfo?.participant ?? ""
        ).split("@")[0],
        id: message.message?.extendedTextMessage?.contextInfo?.stanzaId ?? "",
      }
    : undefined;
  const isGroup = message.key.remoteJid?.includes("@g.us") ?? false;
  logger.debug("message", message);
  return {
    from:
      message.key.remoteJid?.split("@")[0] ??
      message.key.participantAlt?.split("@")[0] ??
      "",
    id: message.key.id ?? "",
    timestamp: Math.floor(Number(message.messageTimestamp)).toString(),
    type: message.message?.audioMessage ? "audio64" : "text",
    text: !!message.message?.audioMessage
      ? {
          audio: await downloadMedia(message),
        }
      : {
          body: message.message?.extendedTextMessage
            ? message.message.extendedTextMessage.text ?? ""
            : message.message?.conversation ?? "",
        },
    context:
      isGroup || quote
        ? {
            ...(quote ?? {}),
            group_id: isGroup ? message.key.remoteJid ?? "" : undefined,
          }
        : undefined,
    fullBody: JSON.stringify(message),
  };
}

async function buildMessageChange(
  client: Model<any, any>,
  messages: WAMessage[]
): Promise<WhatsAppChange> {
  const contacts = messages.map((message) => ({
    profile: {
      name: message.pushName ?? "",
      lid: message.key.participant ?? message.key.remoteJid ?? "",
    },
    wa_id:
      message.key.remoteJid?.split("@")[0] ??
      message.key.participantAlt?.split("@")[0] ??
      "",
  }));
  return {
    value: {
      messaging_product: "whatsapp",
      metadata: {
        display_phone_number: client.get("name") as string,
        phone_number_id: client.get("clientId") as string,
      },
      contacts: contacts,
      messages: await Promise.all(messages.map(formatMessage)),
    },
    field: "messages",
  };
}
async function buildStatusChange(
  client: Model<any, any>,
  messageAcks: WAMessage[]
): Promise<WhatsAppChange> {
  return {
    value: {
      messaging_product: "whatsapp",
      metadata: {
        display_phone_number: client.get("name") as string,
        phone_number_id: client.get("clientId") as string,
      },
      statuses: messageAcks?.map(formatStatus),
    },
    field: "message_status",
  };
}

export async function webhookHandler(
  client: Model<any, any>,
  messages: WAMessage[],
  messageAcks: WAMessage[]
) {
  if (messages.length == 0 && messageAcks.length == 0) return true;
  await client.reload();
  const webhookUrl = client.get("webHook") as string | null;
  try {
    const payload: WhatsAppWebhookPayload = {
      object: "whatsapp_web_account",
      entry: [
        {
          id: client.get("clientId") as string,
          changes: [] as any[],
        },
      ],
    };
    if (messages.length > 0) {
      payload.entry[0].changes.push(await buildMessageChange(client, messages));
    }
    if (messageAcks.length > 0) {
      payload.entry[0].changes.push(
        await buildStatusChange(client, messageAcks)
      );
    }
    log.debug("Payload webhook: ", {
      entry: payload.entry[0].changes,
      url: webhookUrl,
    });
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
  } catch (error) {
    log.warn("Failed to notify webhook of message:", error);
    return false;
  }
  return true;
}
