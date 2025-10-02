import { FindOrCreateOptions } from "@sequelize/core";
import {
  MessageAck,
  MessageMedia,
  MessageTypes,
  type Message,
} from "whatsapp-web.js";
import ClientModel from "../models/client";
import { clients, deleteClient } from ".";
import QRCode from "qrcode";
import { webhookHandler } from "./webhook";
import log from "../lib/logger";
import path from "path";
import logger from "../lib/logger";
import { WhatsappService } from "../services/WhatsappService";
import { WAMessage } from "baileys";
import { downloadMediaMessage } from "baileys";

const convertBaileysMessageToWhatsappMessage = (message: WAMessage) => {
  if (
    !message.message?.extendedTextMessage?.text &&
    !message.message?.conversation &&
    !message.message?.audioMessage
  ) {
    return {
      ack: MessageAck.ACK_ERROR,
    } as Message;
  }
  return {
    ack: message.status || MessageAck.ACK_SERVER,
    deviceType: "",
    body: message.message?.extendedTextMessage
      ? message.message.extendedTextMessage.text
      : message.message?.conversation || "",
    timestamp: message.messageTimestamp,
    broadcast: message.broadcast,
    hasMedia: !!message.message?.imageMessage,
    type: message.message?.audioMessage
      ? MessageTypes.AUDIO
      : message.message.senderKeyDistributionMessage
      ? MessageTypes.GROUP_NOTIFICATION
      : MessageTypes.TEXT,
    downloadMedia: async () => {
      if (!message.message?.audioMessage) return {};
      const buffer = await downloadMediaMessage(message, "buffer", {});
      const base64Audio = buffer.toString("base64");
      const mimetype = message.message.audioMessage.mimetype || "audio/ogg";
      var fileSize = message.message.audioMessage.fileLength || buffer.length;
      if (typeof fileSize == "object") {
        fileSize = fileSize.toNumber();
      }
      return {
        data: base64Audio,
        mimetype,
        filesize: fileSize,
        filename: null,
      } as MessageMedia;
    },
    hasQuotedMsg: !!message.message?.extendedTextMessage?.contextInfo,
    getQuotedMessage: async () => {
      return {
        from: message.message?.extendedTextMessage?.contextInfo?.participant,
        id: {
          id: message.message?.extendedTextMessage?.contextInfo?.stanzaId,
          remote:
            message.message?.extendedTextMessage?.contextInfo?.participant,
          _serialized:
            message.message?.extendedTextMessage?.contextInfo?.stanzaId,
        },
      };
    },
    from: message.key.remoteJid,
    fromMe: message.key.fromMe,
    id: {
      _serialized: message.key.id,
      fromMe: message.key.fromMe,
      id: message.key.id,
      remote: message.key.remoteJid,
    },
  } as Message;
};

export async function findClient(clientId: any, can_create: boolean = false) {
  const opts: FindOrCreateOptions = {
    where: { clientId: clientId },
  };

  const [clientModel, created] = await ClientModel.findOrCreate(opts);
  if (!created && clients[clientId]) {
    return clientModel;
  }

  const client = await new Promise<WhatsappService>(async (resolve, reject) => {
    const sessionDir = path.join(process.cwd(), "data", "sessions");
    const waService = new WhatsappService(clientId.toString());
    logger.http(sessionDir);

    const disconectEvent = async () => {
      log.warn("Client disconected: " + clientModel.get("name"));
      const wh = clientModel.get("webHook") as string | null;
      delete clients[clientId];
      clientModel.set({
        ready: false,
      });
      clientModel.save();
      if (wh) {
        try {
          await fetch(wh, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              object: "whatsapp_web_account",
              entry: [
                {
                  id: clientModel.get("clientId"),
                  changes: [
                    {
                      value: {
                        messaging_product: "whatsapp",
                        metadata: {
                          display_phone_number: clientModel.get("name"),
                          phone_number_id: clientModel.get("clientId"),
                        },
                      },
                      field: "whatsapp_web_disconected",
                    },
                  ],
                },
              ],
            }),
          });
        } catch (ex) {}
      }
      deleteClient(clientModel.get("clientId"));
    };

    waService.onClose(disconectEvent);
    waService.onQrCode(async (qrCode: string) => {
      clientModel.set({
        qrCode: await QRCode.toDataURL(qrCode),
        ready: false,
      });
      await clientModel.save();
      resolve(waService);
    });
    waService.onOpen(async () => {
      clientModel.set({
        ready: true,
      });
      await clientModel.save();
      log.info("Client initialized: " + clientId.toString());
      resolve(waService);
    });
    waService.onCredentials(async (creds) => {
      clientModel.set({
        name: creds.me?.name,
        phoneId: creds.me?.id,
        ready: true,
      });
      await clientModel.save();
    });
    waService.onUpdate(async (messages) => {
      console.log(messages.map((message) => message.update));
      const a = await webhookHandler(
        clientModel,
        [],
        messages
          .filter((message) => !!message.update.status)
          .map(
            (message) =>
              ({
                ack: message.update.status ?? MessageAck.ACK_ERROR,
                id: {
                  id: message.key.id,
                  fromMe: message.key.fromMe,
                  remote: message.key.remoteJid,
                  _serialized: message.key.id,
                },
                from: message.key.remoteJid,
              } as Message)
          )
      );
      // messages.forEach(async (message) => {
      //   switch (message.update.keepInChat) {
      //   case MessageAck.ACK_ERROR:
      //     log.error("Error on send message: " + message.id);
      //     break;
      //   case MessageAck.ACK_PENDING:
      //     log.debug("Message not sent yet: " + message.id);
      //     break;
      //   case MessageAck.ACK_SERVER:
      //     log.http("Message Sended Sucessfuly: " + message.id);
      //     break;
      //   case MessageAck.ACK_DEVICE:
      //   case MessageAck.ACK_READ:
      //   case MessageAck.ACK_PLAYED:
      //     log.http("Message ack: " + message.id);
      //     const a = await webhookHandler(clientModel, [], [message]);
      //     break;
      // }
      // })
    });
    waService.onMessage(async ({ messages }) => {
      const a = await webhookHandler(
        clientModel,
        messages
          .map(convertBaileysMessageToWhatsappMessage)
          .filter((message) => {
            console.log(message);
            return (
              message.ack !== MessageAck.ACK_ERROR &&
              //!message.fromMe &&
              message.from &&
              message.type != MessageTypes.GROUP_NOTIFICATION
            );
          }),
        []
      );
    });
    waService.connect(sessionDir);

    // client.on("message_ack", async (message, ack) => {
    //   switch (ack) {
    //     case MessageAck.ACK_ERROR:
    //       log.error("Error on send message: " + message.id);
    //       break;
    //     case MessageAck.ACK_PENDING:
    //       log.debug("Message not sent yet: " + message.id);
    //       break;
    //     case MessageAck.ACK_SERVER:
    //       log.http("Message Sended Sucessfuly: " + message.id);
    //       break;
    //     case MessageAck.ACK_DEVICE:
    //     case MessageAck.ACK_READ:
    //     case MessageAck.ACK_PLAYED:
    //       log.http("Message ack: " + message.id);
    //       const a = await webhookHandler(clientModel, [], [message]);
    //       break;
    //   }
    // });

    // // TODO: message edit, delete, reaction
    // client.on("message_edit", async () => {});
    // client.on("message_delete", async () => {});
    // client.on("message_reaction", async () => {});

    // client.on("message", async (msg) => {
    //   log.http("Message recived: " + clientModel.get("name"));
    //   const a = await webhookHandler(clientModel, [msg], []);
    //   if (!a) {
    //     log.warn("message_handler failed");
    //   }
    // });

    clients[clientId] = waService;
    return waService;
  }).catch((err) => {
    log.error(err);
  });

  if (!client) {
    await clientModel.destroy();
    delete clients[clientId];
    return null;
  }

  if (!clientModel.get("ready") && !can_create) {
    client.logout();
    client.destroy();
    clientModel.destroy();
    delete clients[clientId];
    return null;
  }
  return clientModel;
}
