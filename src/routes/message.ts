import express, { Request, Response } from "express";
import { checkNumber, getChat, getChats, sendMessage } from "../whatsapp_api";
import multer from "multer";
import path from "path";
import fs from "fs";
import { findClient } from "../whatsapp_api/findClient";
import log from "../lib/logger";
import { getWhatsAppId } from "../whatsapp_api/formatNumbers";

const uploadDir = path.join(process.cwd(), "data/uploads");
const upload = multer({ dest: uploadDir });
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const router = express.Router();

// /**
//  * @swagger
//  * /api/message/chat:
//  *   get:
//  *     tags: [Messages]
//  *     summary: Get all chats for a client
//  *     parameters:
//  *       - in: query
//  *         name: clientId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: The client ID
//  *     responses:
//  *       200:
//  *         description: List of chats retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: array
//  *               items:
//  *                 $ref: '#/components/schemas/Chat'
//  *       400:
//  *         description: Client not ready
//  *       404:
//  *         description: Client not found
//  */
// router.get("/chat", async (req: Request, res: Response) => {
//   const id = req.query.clientId;
//   const client = await findClient(id);

//   if (!client) return res.status(404).send("Client not found");
//   if (!client.get("ready")) return res.status(400).send("Client not ready");

//   try {
//     const chats = await getChats(client);
//     res.json(chats);
//   } catch (err) {
//     res.status(500).json({ error: `error getting chats: ${err}` });
//   }
// });

// /**
//  * @swagger
//  * /api/message/chat/{chatId}:
//  *   get:
//  *     tags: [Messages]
//  *     summary: Get a specific chat
//  *     parameters:
//  *       - in: query
//  *         name: clientId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: The client ID
//  *       - in: path
//  *         name: chatId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: The chat ID (without @c.us or @g.us suffix)
//  *       - in: query
//  *         name: group
//  *         schema:
//  *           type: string
//  *         description: Set to 'true' if this is a group chat
//  *     responses:
//  *       200:
//  *         description: Chat details retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Chat'
//  *       400:
//  *         description: Client not ready
//  *       404:
//  *         description: Client or chat not found
//  */
// router.get("/chat/:chatId", async (req: Request, res: Response) => {
//   const client = await findClient(req.query.clientId);
//   if (!client) return res.status(404).send("Client not found");
//   if (!client.get("ready")) return res.status(400).send("Client not ready");

//   const chatId = normalizeChatId(
//     req.params.chatId,
//     req.query.group as string | undefined
//   );

//   try {
//     const chat = await getChat(client, chatId);
//     res.json(chat);
//   } catch (err) {
//     res.status(500).json({ error: `error getting chat: ${err}` });
//   }
// });

/**
 * @swagger
 * /api/message/chat/{chatId}:
 *   post:
 *     tags: [Messages]
 *     summary: Send a message to a chat
 *     description: |
 *       Send a text message or media to a chat. For media messages, use multipart/form-data.
 *       The chatId can be provided without @c.us or @g.us suffix.
 *     parameters:
 *       - in: query
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: The client ID
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: The chat ID (send with @g.us suffix to send to a group chat)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: The text message to send
 *               media:
 *                 type: string
 *                 format: binary
 *                 description: Media file to send (image, video, document, etc.)
 *               response_to_id:
 *                 type: string
 *                 description: ID of the message to reply to (optional)
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       400:
 *         description: Client not ready or invalid request
 *       404:
 *         description: Client or chat not found
 */
router.post(
  "/chat/:chatId",
  upload.single("media"),
  async (req: Request, res: Response) => {
    const client = await findClient(req.query.clientId);
    if (!client) return res.status(404).send("Client not found");
    if (!client.get("ready")) return res.status(400).send("Client not ready");

    const chatId = getWhatsAppId(req.params.chatId);
    console.log("num:", chatId);

    const { message, response_to_id } = req.body;

    let finalMediaPath: string | null = null;

    try {
      let isVoice: boolean = false;
      if (req.file) {
        isVoice = req.query.voice === "true";

        // Ensure ./media exists
        const mediaDir = path.join(process.cwd(), "media");
        await fs.promises.mkdir(mediaDir, { recursive: true });

        // Build final file path in ./media
        const filename = `${Date.now()}_${req.file.originalname}`;
        finalMediaPath = path.join(mediaDir, filename);

        // Move file to ./media
        await fs.promises.rename(req.file.path, finalMediaPath);
      }

      res.status(200).send("OK");

      sendMessage(
        client,
        chatId,
        message ?? null,
        finalMediaPath,
        response_to_id ?? null,
        isVoice
      )
        .catch((err) => {
          log.error(`Failed to send message: ${err}`);
        })
        .finally(async () => {
          if (finalMediaPath) {
            try {
              await fs.promises.unlink(finalMediaPath);
            } catch (unlinkErr) {
              log.error(
                `Failed to delete media file: ${finalMediaPath}`,
                unlinkErr
              );
            }
          }
        });
    } catch (err) {
      res.status(500).json({ error: `error sending message: ${err}` });
    }
  }
);

export default router;
