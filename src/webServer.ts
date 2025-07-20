import express, { Request, Response } from 'express';
import { createClient, getChatMessages, getChats, getChat, sendMessage, Message } from './whatsapp_api';
import Client from './models/client';
import QRCode from 'qrcode';

export const port: number = parseInt(process.env.PORT ?? '3000');
const server = express()
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
            'id': msg.id._serialized,
            'author': msg.from,
            'body': msg.body,
            'type': msg.type,
            'info': infos ? {
                'deliverd': infos.delivery.length > 0,
                'read': infos.read.length > 0,
                'played': infos.played.length > 0
            } : {},
            'isForwarded': msg.isForwarded,
            'timestamp': new Date(msg.timestamp * 1000),
        };
        try {
            await fetch(webHook, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(m)
            });
        }
        catch {
            console.error("Failed to notify webhook of message");
            return false;
        }
        return true;
    };
}

export async function createWebServer() {

    server.get('/client/create', async (req: Request, res: Response) => {
        const id = req.query.clientId as string || null;
        const wh = req.query.webHook as string || null;
        let client = await Client.findByPk(id);

        if (!client) {
            client = await createClient(on_message(wh), id);
        }

        if (req.query.webHook) {
            client.set('webHook', req.query.webHook as string);
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            clientId: id
        }));
    });

    server.get('/client/:clientId', async (req: Request, res: Response) => {
        const id = req.params.clientId;
        const client = await Client.findByPk(id);

        if (!client) return res.status(404).send('Not found');

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            clientId: client.get('clientId'),
            ready: client.get('ready'),
            qr: client.get('qrCode') ?? null,
            webHook: client.get('webHook') ?? null
        }));
    });

    server.get('/client/:clientId/qrCode', async (req: Request, res: Response) => {
        const id = req.params.clientId;
        let client = await Client.findByPk(id);

        if (!client) {
            await createClient(on_message(req.query.webHook as string || null), id);
            return
        }
        if (!client.get("qrCode")) {
            res.status(200).send("Wait a few seconds and try again: Loading...")
            return;
        }

        const qrCode = client.get('qrCode') as string;

        const qrCodeImage = await QRCode.toDataURL(qrCode);
        res.send(`<img src="${qrCodeImage}" alt="QR Code"/>`);
    });

    server.get('/client/:clientId/chat', async (req: Request, res: Response) => {
        const id = req.params.clientId;
        const client = await Client.findByPk(id);

        if (!client || !client.get('ready')) return res.status(404).send('Not found');

        try {
            const chats = await getChats(client);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(chats));
        }
        catch {
            res.status(500).json({ error: "error getting chats" });
        }
    });

    server.get('/client/:clientId/chat/:chatId', async (req: Request, res: Response) => {
        const client = await Client.findByPk(req.params.clientId);
        if (!client || !client.get('ready')) return res.status(404).send('Not found');

        const chatId = req.params.chatId + '@c.us';

        try {
            const chat = await getChat(client, chatId);
            res.json(JSON.stringify(chat));
        } catch {
            res.status(500).json({ error: "error getting chat" });
        }
    });

    server.post('/client/:clientId/chat/:chatId/send', async (req: Request, res: Response) => {
        const client = await Client.findByPk(req.params.clientId);
        if (!client) return res.status(404).send('Not found');

        const chatId = req.params.chatId + '@c.us';
        const { message } = req.body;

        try {
            const result = await sendMessage(client, chatId, message);
            res.json(result);
        }
        catch {
            res.status(500).json({ error: "error sending message" });
        }
    });

    server.get('/client/:clientId/chat/:chatId/messages', async (req: Request, res: Response) => {
        const client = await Client.findByPk(req.params.clientId);
        if (!client || !client.get('ready')) return res.status(404).send('Not found');

        const chatId = req.params.chatId + '@c.us';

        try {
            const messages = await getChatMessages(client, chatId, 200);
            res.json(messages);
        }
        catch {
            res.status(500).json({ error: "error getting messages" });
        }
    });

    server.listen(port, () => {
        console.log(`!!WebServer Started on port ${port}!!`);
    });

    return server;
}

