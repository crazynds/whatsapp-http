import { Model } from "@sequelize/core";

export function JsonClient(client: Model<any, any>): object {
  return {
    clientId: client.get("clientId"),
    name: client.get("name"),
    ready: client.get("ready") ?? false,
    qr: client.get("qrCode") ?? null,
    webHook: client.get("webHook") ?? null,
  };
}
