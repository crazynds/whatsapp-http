import express, { Request, Response } from 'express';
import { createClient, getChatMessages, getChats, sendMessage, start_client, Message} from './whatsapp_api';
import Client from './models/client';
import QRCode from 'qrcode';

export const port: number = parseInt(process.env.PORT ?? '3000');
const server = express()
server.use(express.json()); 

export default server;

function on_message(webHook: string|null) {
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
            await fetch(
                webHook,
                {
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

export async function createWebServer () {

    server.get('/client/:clientId/create',async (req: Request, res: Response) => {
        const id = req.params.clientId;
        let client = await Client.findByPk(id);

        if(!client){
            client = await createClient(id, on_message(req.query.webHook as string || null));
        } else if (!client.get("qrcode")) {
            console.log("starting", id)
            start_client(id, client); 
        }

        if(req.query.webHook){
            client.set('webHook', req.query.webHook as string);
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            clientId: id
        }));
    });


    // Create a clientId
    server.get('/client/:clientId',async (req: Request, res: Response) => {
        const id = req.params.clientId;
        const client = await Client.findByPk(id);

        if(!client)return res.status(404).send('Not found');

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            clientId: client.get('clientId'),
            ready: client.get('ready'),
            qr: client.get('qrCode') ?? null,
            webHook: client.get('webHook') ?? null
        }));
    });

    // render the qr code
    server.get('/client/:clientId/qrCode',async (req: Request, res: Response) => {
        const id = req.params.clientId;
        let client = await Client.findByPk(id);

        if(!client)return res.status(404).send('Not found');
        // else if (!client.get("qrcode")) {
        //     start_client(id, client);
        //     return;
        // }
        if(!client.get("qrCode"))return res.status(404).send('Qrcode not found');

        const qrCode = client.get('qrCode') as string;

        const qrCodeImage = await QRCode.toDataURL(qrCode);
        res.send(`<img src="${qrCodeImage}" alt="QR Code"/>`);
    });

    // get chats
    server.get('/client/:clientId/chat',async (req: Request, res: Response) => {
        const id = req.params.clientId;
        const client = await Client.findByPk(id);

        if(!client || !client.get('ready'))return res.status(404).send('Not found');


        try {
            const chats = await getChats(client);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(chats));
        }
        catch {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({"error": "error geting chats"}));
        }
    })

    // send messages to clients
    server.post('/client/:clientId/send',async (req: Request, res: Response) => {
        const id = req.params.clientId;
        const client = await Client.findByPk(id);

        if(!client)return res.status(404).send('Not found');

        const {chatId, message} = req.body;

        try {
            const result = await sendMessage(client, chatId, message);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
        }
        catch {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({"error": "error geting chats"}));
        }
    })

    // get chat messages
    server.post('/client/:clientId/chat/messages',async (req: Request, res: Response) => {
        const id = req.params.clientId;
        const client = await Client.findByPk(id);

        if(!client || !client.get('ready'))return res.status(404).send('Not found');

        const chatId = req.body.chatId;

        try {
            const messages = await getChatMessages(client,chatId,200);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(messages));
        }
        catch {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({"error": "error geting chats"}));
        }
    })


    server.listen(port, () => {
        // Ready
        console.log(`!!WebServer Started!!`);
    });
    return server
}

