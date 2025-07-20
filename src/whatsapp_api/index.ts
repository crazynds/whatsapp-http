import WAWebJS, { Client, LocalAuth } from 'whatsapp-web.js';

import ClientModel from '../models/client'
import { FindOrCreateOptions, Model } from '@sequelize/core';

export const clients = {
} as {
    [key: string]: Client
}

export type Message = WAWebJS.Message;
export type Chat = WAWebJS.Chat;


export async function sendMessage(model: Model<any,any>, chatId: string, message: string){
    const clientId = model.get('clientId') as string | null;
    const client = clients[ clientId ?? ''];
    if(!client) return false;

    const msg = await client.sendMessage(chatId, message);
    const infos = await msg.getInfo();

    return {
        'id': msg.id,
        'author': null,
        'body': msg.body,
        'type': msg.type,
        'info': infos ? {
            'deliverd': infos.delivery.length > 0,
            'read': infos.read.length > 0,
            'played': infos.played.length > 0
        } : {},
        'isForwarded': msg.isForwarded,
        'timestamp': new Date(msg.timestamp * 1000),
    }
}
export async function getChats(model: Model<any, any>) {
    const clientId = model.get('clientId') as string | null;
    const client = clients[clientId ?? ''];
    if (!client) return false;

    const chats = await client.getChats();
    const results = [];

    for (const chat of chats) {
        const contact = await chat.getContact();
        const profilePicUrl = await contact.getProfilePicUrl();

        results.push({
            id: chat.id._serialized,
            name: chat.name,
            unreadCount: chat.unreadCount,
            lastMessageBody: chat.lastMessage.body,
            isArchived: chat.archived,
            isGroup: chat.isGroup,
            isMuted: chat.isMuted,
            isReadOnly: chat.isReadOnly,
            isPinned: chat.pinned,
            contactInfo: {
                id: contact.id._serialized,
                name: contact.name,
                number: contact.number,
                pushname: contact.pushname,
                profilePicUrl,
            },
        });
    }

    return results;
}

export async function getChat(model: Model<any, any>, chatId: string) {
    const clientId = model.get('clientId') as string | null;
    const client = clients[clientId ?? ''];
    if (!client) return false;

    const chat = await client.getChatById(chatId);
    const contact = await chat.getContact();
    const profilePicUrl = await contact.getProfilePicUrl();

    return {
        id: chat.id._serialized,
        name: chat.name,
        unreadCount: chat.unreadCount,
        lastMessageBody: chat.lastMessage.body,
        isArchived: chat.archived,
        isGroup: chat.isGroup,
        isMuted: chat.isMuted,
        isReadOnly: chat.isReadOnly,
        isPinned: chat.pinned,
        contactInfo: {
            id: contact.id._serialized,
            name: contact.name,
            number: contact.number,
            pushname: contact.pushname,
            profilePicUrl,
        },
    };
}
export async function getChatMessages(model: Model<any,any>, chatId: string, count: number){
    const clientId = model.get('clientId') as string | null;
    const client = clients[ clientId ?? ''];
    if(!client) return false;
    const chat = await client.getChatById(chatId);

    if(!chat) return false;
    const msgs = await chat.fetchMessages({limit: count})
    console.log(msgs);

    const m = [];
    for (const msg of msgs) {
        const infos = await msg.getInfo();
        m.push( {
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
        })
    }
    return m;
}

export async function createClient(message_handler: ((msg: WAWebJS.Message) => Promise<boolean>) | null = null, clientId: string | null = null) {
    if (!clientId) {
        clientId = (await ClientModel.count() + 1).toString()
    }

    const opts: FindOrCreateOptions = {
        where: { clientId: clientId},
        defaults: { ready: false }
    };

    const r = await ClientModel.findOrCreate(opts);
    const clientModel = r[0];
    const client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './data/',
            clientId: clientId
        }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        }
    });

    client.on('remote_session_saved', () => {
        clientModel.set({
            ready: true
        })
        clientModel.save();
    });
    
    client.on('qr', (qr) => {
        clientModel.set({
            qrCode: qr
        })
        clientModel.save();
    });
    
    client.on('ready', () => {
        clientModel.set({
            ready: true
        })
        clientModel.save();
    });
    
    if (message_handler) {
        client.on('message', async (msg) => {
            const a = await message_handler(msg);
            if (!a) {
                console.error("message_handler failed");
            }
        });
    }
    
    client.initialize();
    clients[clientId] = client
    return clientModel;
}

