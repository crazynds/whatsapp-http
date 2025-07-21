import express, { Request, Response } from 'express';
import { createClient, getChatMessages, getChats, getChat, sendMessage, getContact, getContacts, Message } from './whatsapp_api';
import Client from './models/client';
import QRCode from 'qrcode';

export const port: number = parseInt(process.env.PORT ?? '3000');
const server = express();
server.use(express.json());

export default server;

function on_message(webHook: string | null) {
    return async function (msg: Message) {
        if (webHook === null) {
            console.log(`${msg.from}: ${msg.body}`);
            return false;
        }
        const infos = await msg.getInfo();
        const m = {
            id: msg.id._serialized,
            author: msg.from,
            body: msg.body,
            type: msg.type,
            info: infos
                ? {
                      deliverd: infos.delivery.length > 0,
                      read: infos.read.length > 0,
                      played: infos.played.length > 0,
                  }
                : {},
            isForwarded: msg.isForwarded,
            timestamp: new Date(msg.timestamp * 1000),
        };
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

        if (!client) return res.status(404).send('Not found');

        res.json({
            clientId: client.get('clientId'),
            ready: client.get('ready'),
            qr: client.get('qrCode') ?? null,
            webHook: client.get('webHook') ?? null,
        });
    });

    server.get('/client/:clientId/chat', async (req: Request, res: Response) => {
        const id = req.params.clientId;
        const client = await Client.findByPk(id);

        if (!client || !client.get('ready')) return res.status(404).send('Not found');

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

    server.post('/client/:clientId/chat/:chatId/send', async (req: Request, res: Response) => {
        const client = await Client.findByPk(req.params.clientId);
        if (!client) return res.status(404).send('Not found');

        const chatId = normalizeChatId(req.params.chatId, req.query.group as string | undefined);
        const { message } = req.body;

        try {
            const result = await sendMessage(client, chatId, message);
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: `error sending message: ${err}` });
        }
    });

    server.get('/client/:clientId/chat/:chatId/messages', async (req: Request, res: Response) => {
        const client = await Client.findByPk(req.params.clientId);
        if (!client || !client.get('ready')) return res.status(404).send('Not found');

        const chatId = normalizeChatId(req.params.chatId, req.query.group as string | undefined);

        try {
            const messages = await getChatMessages(client, chatId, 200);
            res.json(messages);
        } catch (err) {
            res.status(500).json({ error: `error getting messages ${err}` });
        }
    });

    // ==== NEW ROUTES FOR CONTACTS ====

    // Get all contacts for a client
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

    // Get contact info by chat ID
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
