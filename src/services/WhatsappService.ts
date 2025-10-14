import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  WASocket,
  BaileysEventMap,
} from "baileys";
import { Boom } from "@hapi/boom";
import * as path from "path";
import logger from "../lib/logger";
import { ILogger } from "baileys/lib/Utils/logger";

const fetchLatestWaConnectVersion = async (options = {}) => {
  try {
    const response = await fetch("https://wppconnect.io/whatsapp-versions/", {
      method: "GET",
    });
    if (!response.ok) {
      throw new Boom(`Failed to fetch sw.js: ${response.statusText}`, {
        statusCode: response.status,
      });
    }
    const data = await response.text();
    const regex = /(\d+)\.(\d+)\.(\d+)-alpha/g;
    const match = regex.exec(data);
    if (!match) {
      return false;
    }
    const [full, major, minor, patch] = match;
    return {
      version: [Number(major), Number(minor), Number(patch)],
      isLatest: true,
    };
  } catch (error) {
    return false;
  }
};

export class WhatsappService {
  private sock: WASocket | null = null;
  private sessionId: string;
  private callbacks: { [key: string]: CallableFunction } = {};

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Inicializa a sessão do WhatsApp
   */
  public async connect(sessionDir: string): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(
      path.join(sessionDir, `${this.sessionId}`)
    );

    const waVersion = await fetchLatestWaConnectVersion();
    const { version: baileysVersion } = await fetchLatestBaileysVersion();
    console.log("baileysVersion", baileysVersion);

    var version: any;
    if (!waVersion) {
      version = baileysVersion;
    } else {
      version = waVersion.version;
      console.log("waVersion", version);
    }

    const customLogger = {
      level: logger.level,
      child(obj: Record<string, any>) {
        return customLogger;
      },
      trace(obj: any, msg?: string) {
        return null;
      },
      debug(obj: any, msg?: string) {
        if (!msg) return;
        //logger.debug(msg, obj);
      },
      info(obj: any, msg?: string) {
        if (!msg) return;
        switch (msg) {
          case "connected to WA":
          case "not logged in, attempting registration...":
            logger.debug(msg, obj);
            break;
          default:
            logger.info(msg, obj);
        }
      },
      warn(obj: any, msg?: string) {
        if (!msg) return;
        logger.warn(msg, obj);
      },
      error(obj: any, msg?: string) {
        if (!msg) return;
        logger.error(msg, obj);
      },
    } as ILogger;
    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false, // Mostra QR no terminal
      syncFullHistory: false,
      markOnlineOnConnect: false,
      logger: customLogger,
    });

    this.sock.ev.on("creds.update", saveCreds);

    this.sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        if ("qrCode" in this.callbacks) this.callbacks["qrCode"](qr);
      }
      if (connection === "close") {
        console.log(connection, lastDisconnect?.error);
        const shouldReconnect = [
          DisconnectReason.connectionLost,
          DisconnectReason.connectionReplaced,
          DisconnectReason.connectionClosed,
          DisconnectReason.restartRequired,
          DisconnectReason.timedOut,
          DisconnectReason.unavailableService,
          DisconnectReason.unavailableService,
        ].includes((lastDisconnect?.error as Boom)?.output?.statusCode);
        if (shouldReconnect) this.connect(sessionDir);
        else if ("close" in this.callbacks) this.callbacks["close"]();
      } else if (connection === "open") {
        if ("open" in this.callbacks) this.callbacks["open"]();
      }
    });

    this.sock.ev.on("messages.upsert", async (m) => {
      if (m.type == "notify") {
        if ("message" in this.callbacks)
          this.callbacks["message"]({
            ...m,
            messages: m.messages,
            //.filter((m) => !m.key.fromMe),
          });
      } else {
        // old already seen / handled messages
        // handle them however you want to
      }
    });
    this.sock.ev.on(
      "messaging-history.set",
      ({
        chats: newChats,
        contacts: newContacts,
        messages: newMessages,
        syncType,
      }) => {}
    );
    this.sock.ev.on("creds.update", (creds) => {
      if ("credentials" in this.callbacks) this.callbacks["credentials"](creds);
    });
    this.sock.ev.on("messages.update", (m) => {
      if ("update" in this.callbacks) this.callbacks["update"](m);
    });
  }

  public on(event: keyof BaileysEventMap, callback: any) {
    if (!this.sock) throw new Error("Socket não inicializado");
    this.sock.ev.on(event, callback);
  }

  public onQrCode(callback: CallableFunction) {
    this.callbacks["qrCode"] = callback;
  }
  public onOpen(callback: CallableFunction) {
    this.callbacks["open"] = callback;
  }
  public onClose(callback: CallableFunction) {
    this.callbacks["close"] = callback;
  }
  public onUpdate(callback: (arg: BaileysEventMap["messages.update"]) => void) {
    this.callbacks["update"] = callback;
  }
  public onCredentials(
    callback: (arg: BaileysEventMap["creds.update"]) => void
  ) {
    this.callbacks["credentials"] = callback;
  }
  public onMessage(
    callback: (arg: BaileysEventMap["messages.upsert"]) => void
  ) {
    this.callbacks["message"] = callback;
  }

  /**
   * Envia uma mensagem para um número
   */
  public async sendMessage(to: string, message: string) {
    if (!this.sock) throw new Error("Socket não inicializado");
    const jid = to.includes("@s.whatsapp.net") ? to : `${to}@s.whatsapp.net`;
    this.sock.sendPresenceUpdate("available");
    this.sock.sendPresenceUpdate("composing", jid);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.log2((message?.length ?? 0) + 10) * 1000)
    );
    this.sock.sendPresenceUpdate("available", jid);
    await this.sock.sendMessage(jid, { text: message });
    this.sock.sendPresenceUpdate("unavailable");
  }

  // /**
  //  * Retorna a lista de contatos
  //  */
  // public getContacts() {
  //   if (!this.sock) throw new Error("Socket não inicializado");
  //   return this.sock.store?.contacts || {};
  // }

  // /**
  //  * Retorna os chats
  //  */
  // public getChats() {
  //   if (!this.sock) throw new Error("Socket não inicializado");
  //   return this.sock.store?.chats || {};
  // }

  /**
   * Desloga e encerra a sessão
   */
  public async logout() {
    if (!this.sock) throw new Error("Socket não inicializado");
    await this.sock.logout();
  }

  public async destroy() {
    await this.logout();
  }
}
