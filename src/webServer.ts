import express, { Request, Response } from 'express';
import { createClient, getChatMessages, getChats, getChat, sendMessage, getContact, getContacts, Message, JsonMsg, JsonClient, getMessageMedia, JsonChat, getMessage, deleteMessage, forwardMessage, acceptMessageInvite, sentChatState, ChatState} from './whatsapp_api';
import Client from './models/client';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';

export const port: number = parseInt(process.env.PORT ?? '3000');
const server = express();
server.use(express.json());

import multer from 'multer';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Use original filename or customize here
        cb(null, `${Date.now()}_${file.originalname}`);
    }
});

const upload = multer({ storage });


export default server;

function on_message(webHook: string | null) {
    return async function (msg: Message) {
        if (webHook === null) {
            console.log(`${msg.from}: ${msg.body}`);
            console.log(msg)
            return false;
        }

        const chat = await msg.getChat();
        const m = {chat: await JsonChat(chat), message: await JsonMsg(msg)};
        try {
            await fetch(webHook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(m),
            });
        } catch {
            console.error('Failed to notify webhook of message');
            return false;
        }
        return true;
    };
}

// Helper to normalize chatId suffix based on param or query
function normalizeChatId(chatId: string, isGroupQuery?: string | undefined) {
    if (chatId.endsWith('@c.us') || chatId.endsWith('@g.us')) {
        return chatId;
    }
    if (isGroupQuery === 'true') {
        return chatId + '@g.us';
    }
    return chatId + '@c.us';
}

export async function createWebServer() {
    server.get('/client/qrCode', async (req: Request, res: Response) => {
        let id = (req.query.clientId as string) || null;
        const wh = (req.query.webHook as string) || null;

        const client = await createClient(on_message(wh), id);
        id = client.get('clientId') as string;
        if (wh) client.set('webHook', wh);

        if (client.get('ready') as boolean) {
            res.status(200).send('Client ready from cache, you dont need a qrcode');
            return;
        }
        if (!client.get('qrCode')) {
            const whstr = wh ? `&webHook=${wh}` : '';

            res.status(200).send(`
                <p>Wait a few seconds and try again: Loading...</p>
                <br>
                <a href='/client/qrCode?clientId=${id}${whstr}'>
                    <button>Retry</button>
                </a>
            `);
            return;
        }

        const qrCode = client.get('qrCode') as string;
        const qrCodeImage = await QRCode.toDataURL(qrCode);
        res.send(`<img src="${qrCodeImage}" alt="QR Code"/>`);
    });

    server.get('/client/:clientId', async (req: Request, res: Response) => {
        const id = req.params.clientId;
        const client = await Client.findByPk(id);

        if (!client) return res.status(404).send('Client not found');

        res.json(JsonClient(client));
    });

    server.get('/client/:clientId/chat', async (req: Request, res: Response) => {
        const id = req.params.clientId;
        const client = await Client.findByPk(id);

        if (!client) return res.status(404).send('Client not found');
        if (!client.get('ready')) return res.status(400).send('Client not ready');

        try {
            const chats = await getChats(client);
            res.json(chats);
        } catch (err) {
            res.status(500).json({ error: `error getting chats: ${err}` });
        }
    });

    server.get('/client/:clientId/chat/:chatId', async (req: Request, res: Response) => {
        const client = await Client.findByPk(req.params.clientId);
        if (!client) return res.status(404).send('Client not found');
        if (!client.get('ready')) return res.status(400).send('Client not ready');

        const chatId = normalizeChatId(req.params.chatId, req.query.group as string | undefined);

        try {
            const chat = await getChat(client, chatId);
            res.json(chat);
        } catch (err) {
            res.status(500).json({ error: `error getting chat: ${err}` });
        }
    });

    server.post('/client/:clientId/chat/:chatId/send', upload.single('media'), async (req: Request, res: Response) => {
        const client = await Client.findByPk(req.params.clientId);
        if (!client) return res.status(404).send('Client not found');
        if (!client.get('ready')) return res.status(400).send('Client not ready');

        const chatId = normalizeChatId(req.params.chatId, req.query.group as string | undefined);
        const { message, response_to_id } = req.body;

        let finalMediaPath: string | null = null;

        try {
            let isVoice: boolean = false;
            if (req.file) {
                isVoice = req.query.voice === 'true';

                // Ensure ./media exists
                const mediaDir = path.join(process.cwd(), 'media');
                await fs.promises.mkdir(mediaDir, { recursive: true });

                // Build final file path in ./media
                const filename = `${Date.now()}_${req.file.originalname}`;
                finalMediaPath = path.join(mediaDir, filename);

                // Move file to ./media
                await fs.promises.rename(req.file.path, finalMediaPath);
            }

            const result = await sendMessage(
                client,
                chatId,
                message ?? null,
                finalMediaPath,
                response_to_id ?? null,
                isVoice,
            );

            res.json(result);
        } catch (err) {
            res.status(500).json({ error: `error sending message: ${err}` });
        } finally {
            if (finalMediaPath) {
                try {
                    await fs.promises.unlink(finalMediaPath);
                } catch (unlinkErr) {
                    console.error(`Failed to delete media file: ${finalMediaPath}`, unlinkErr);
                }
            }
        }
    });

    server.post('/client/:clientId/chat/:chatId/state/:state', async (req: Request, res: Response) => {
        const client = await Client.findByPk(req.params.clientId);
        if (!client) return res.status(404).send('Client not found');
        if (!client.get('ready')) return res.status(400).send('Client not ready');

        const chatId = normalizeChatId(req.params.chatId, req.query.group as string | undefined);
        let state: ChatState = ChatState.RECORDING;

        let state_s = req.params.state as string
        state_s = state_s.toLowerCase()
        if (state_s === "typing"   ) state = ChatState.TYPING
        else if (state_s === "recording") state=ChatState.RECORDING
        else if (state_s === "seen"     ) state=ChatState.SEEN
        else res.status(400).json({ error: `invalid state, must be one of [seen, typing, recording]` });

        try {
            const chat = await sentChatState(client, chatId, state);
            res.json(chat);
        } catch (err) {
            res.status(500).json({ error: `error getting chat: ${err}` });
        }
    });

    server.get('/client/:clientId/chat/:chatId/messages', async (req: Request, res: Response) => {
        const client = await Client.findByPk(req.params.clientId);
        if (!client) return res.status(404).send('Client not found');
        if (!client.get('ready')) return res.status(400).send('Client not ready');

        const chatId = normalizeChatId(req.params.chatId, req.query.group as string | undefined);

        try {
            const messages = await getChatMessages(client, chatId, 200);
            res.json(messages);
        } catch (err) {
            res.status(500).json({ error: `error getting messages ${err}` });
        }
    });

    server.get('/client/:clientId/message/:messageId', async (req: Request, res: Response) => {
        const client = await Client.findByPk(req.params.clientId);
        if (!client || !client.get('ready')) return res.status(404).send('Not found');

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const messageId = req.params.messageId;

        try {
            const msg = await getMessage(client, messageId);
            if (!msg) {
                return res.status(404).json({ error: 'Message not found' });
            }

            res.json(msg);
        } catch (err) {
            res.status(500).json({ error: `error fetching media ${err}` });
        }
    });
    server.delete('/client/:clientId/message/:messageId', async (req: Request, res: Response) => {
        const client = await Client.findByPk(req.params.clientId);
        if (!client || !client.get('ready')) return res.status(404).send('Not found');

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const messageId = req.params.messageId;

        try {
            const msg = await deleteMessage(client, messageId);
            if (!msg) {
                return res.status(404).json({ error: 'Message not found' });
            }

            res.json(msg);
        } catch (err) {
            res.status(500).json({ error: `error fetching media ${err}` });
        }
    });

    server.post('/client/:clientId/message/:messageId/forward/:to', async (req: Request, res: Response) => {
        const client = await Client.findByPk(req.params.clientId);
        if (!client || !client.get('ready')) return res.status(404).send('Not found');

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const messageId = req.params.messageId;
        let to = req.params.to;
        to = normalizeChatId(to, req.query.group as string | undefined)

        try {
            const msg = await forwardMessage(client, messageId, to);
            if (!msg) {
                return res.status(404).json({ error: 'Message not found' });
            }

            res.json(msg);
        } catch (err) {
            res.status(500).json({ error: `error fetching media ${err}` });
        }
    });

    server.post('/client/:clientId/message/:messageId/accept', async (req: Request, res: Response) => {
        const client = await Client.findByPk(req.params.clientId);
        if (!client || !client.get('ready')) return res.status(404).send('Not found');

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const messageId = req.params.messageId;

        try {
            const msg = await acceptMessageInvite(client, messageId);
            if (!msg) {
                return res.status(404).json({ error: 'Message not found' });
            }

            res.json(msg);
        } catch (err) {
            res.status(500).json({ error: `error fetching media ${err}` });
        }
    });

    server.get('/client/:clientId/message/:messageId/media', async (req: Request, res: Response) => {
        const client = await Client.findByPk(req.params.clientId);
        if (!client || !client.get('ready')) return res.status(404).send('Not found');

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const messageId = req.params.messageId;

        try {
            const filename = await getMessageMedia(client, messageId);
            if (!filename) {
                return res.status(404).json({ error: 'Media not found or download failed' });
            }

            const filepath = path.resolve('./media', filename);
            res.sendFile(filepath, async (err) => {
                try {
                    await fs.promises.unlink(filepath);
                    if (err) {
                        console.error("Error sending file:", err);
                    }
                } catch (unlinkErr) {
                    console.error("Error deleting file:", unlinkErr);
                }
            });
        } catch (err) {
            res.status(500).json({ error: `error fetching media ${err}` });
        }
    });

    server.get('/client/:clientId/contacts', async (req: Request, res: Response) => {
        const client = await Client.findByPk(req.params.clientId);
        if (!client) return res.status(404).send('Client not found');
        if (!client.get('ready')) return res.status(400).send('Client not ready');

        try {
            const contacts = await getContacts(client);
            res.json(contacts);
        } catch (err) {
            res.status(500).json({ error: `error getting contacts: ${err}` });
        }
    });

    server.get('/client/:clientId/contacts/:chatId', async (req: Request, res: Response) => {
        const client = await Client.findByPk(req.params.clientId);
        if (!client) return res.status(404).send('Client not found');
        if (!client.get('ready')) return res.status(400).send('Client not ready');

        const chatId = normalizeChatId(req.params.chatId, req.query.group as string | undefined);

        try {
            const contact = await getContact(client, chatId);
            res.json(contact);
        } catch (err) {
            res.status(500).json({ error: `error getting contact by chat id: ${err}` });
        }
    });

    server.listen(port, () => {
        console.log(`!!WebServer Started on port ${port}!!`);
    });

    return server;
}
