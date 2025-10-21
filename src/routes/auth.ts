import express, { Request, Response } from "express";
import { deleteClient } from "../whatsapp_api";
import { JsonClient } from "../whatsapp_api/resources";
import { findClient } from "../whatsapp_api/findClient";

const router = express.Router();

/**
 * @swagger
 * /api/auth/qrCode:
 *   get:
 *     tags: [Authentication]
 *     summary: Get QR code for WhatsApp Web authentication
 *     description: Generates or retrieves a QR code for authenticating with WhatsApp Web
 *     parameters:
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *         description: Client ID. You can create any string you want, but always use the same for the same session.
 *       - in: query
 *         name: webHook
 *         schema:
 *           type: string
 *         description: Webhook URL to receive events (optional)
 *     responses:
 *       200:
 *         description: Returns an HTML page with QR code image or status message
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: HTML content with QR code or status message
 */
router.get("/qrCode", async (req: Request, res: Response) => {
  let id = req.query.clientId as string;
  const wh = req.query.webHook || req.query.webhook || null;

  if (!id) {
    res.status(422).send("You need to provide some clientId");
    return;
  }
  var client;
  do {
    client = await findClient(id, true);
  } while (!client);
  id = client.get("clientId") as string;
  if (wh) {
    client.set("webHook", wh);
    client.save();
  }

  if (client.get("ready") as boolean) {
    res.status(200).send("Client ready from cache, you dont need a qrcode");
    return;
  }
  if (!client.get("qrCode")) {
    const whstr = wh ? `&webHook=${wh}` : "";

    res.status(200).send(`
          <p>Wait a few seconds and try again: Loading...</p>
          <br>
          <a href='/client/qrCode?clientId=${id}${whstr}'>
              <button>Retry</button>
          </a>
      `);
    return;
  }

  const qrCode = client.get("qrCode") as string;
  res.send(`<img src="${qrCode}" alt="QR Code"/>`);
});

/**
 * @swagger
 * /api/auth:
 *   get:
 *     tags: [Authentication]
 *     summary: Get client information
 *     description: Retrieves information about a specific client
 *     parameters:
 *       - in: query
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: The client ID to get information for
 *       - in: query
 *         name: webHook
 *         schema:
 *           type: string
 *         description: Update the webhook url for this client (optional)
 *     responses:
 *       200:
 *         description: Client information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClientInfo'
 *       404:
 *         description: Client not found
 */
router.get("/", async (req: Request, res: Response) => {
  const id = req.query.clientId;
  const wh = req.query.webHook || req.query.webhook || null;

  const client = await findClient(id, true);
  if (!client) return res.status(404).send("Client not found");

  if (wh) {
    client.set("webHook", wh);
    client.save();
  }

  res.json(JsonClient(client));
});

router.delete("/", async (req: Request, res: Response) => {
  const id = req.query.clientId;
  await deleteClient(id);
  res.status(200).send("Client deleted");
});

export default router;
