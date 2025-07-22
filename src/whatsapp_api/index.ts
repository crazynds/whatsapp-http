import WAWebJS, { Client, LocalAuth, MessageMedia} from 'whatsapp-web.js';

import ClientModel from '../models/client'
import { FindOrCreateOptions, Model } from '@sequelize/core';
import fs from 'fs/promises';
import path from 'path';

export const clients = {
} as {
    [key: string]: Client
}

export type Message = WAWebJS.Message;
export type Chat = WAWebJS.Chat;
export type Contact = WAWebJS.Contact;

export async function JsonMsg(msg: Message): Promise<object> {
    const infos = await msg.getInfo();
    return {
        id: msg.id._serialized,
        from: msg.from,
        group_member_from: msg.author,
        fromMe: msg.fromMe,
        body: msg.body || '',
        timestamp: new Date(msg.timestamp * 1000),
        hasMedia: msg.hasMedia === true,
        isQuote:msg.hasQuotedMsg,
        quoteId: msg.hasQuotedMsg ? (await msg.getQuotedMessage()).id._serialized : null,
        isForwarded: msg.isForwarded || false,
        mentionedIds: msg.mentionedIds ?? [],
        info: infos ? {
            delivered: infos.delivery.length > 0,
            read: infos.read.length > 0,
            played: infos.played.length > 0
        } : {}
    };
}

export async function JsonChat(chat: Chat): Promise<object> {
    return {
        id: chat.id._serialized,
        name: chat.name,
        unreadCount: chat.unreadCount,
        lastMessageBody: chat.lastMessage?.body ?? null,
        isArchived: chat.archived,
        isGroup: chat.isGroup,
        isMuted: chat.isMuted,
        isReadOnly: chat.isReadOnly,
        isPinned: chat.pinned,
    }
}

export async function JsonContact(contact: Contact): Promise<object> {
    const profilePicUrl = await contact.getProfilePicUrl();
    return {
        id: contact.id._serialized,
        name: contact.name,
        number: contact.number,
        pushname: contact.pushname,
        profilePicUrl,
    };
}

export function JsonClient(client: Model<any, any>): object {
    return {
        clientId: client.get('clientId'),
        name: client.get('name'),
        ready: client.get('ready'),
        qr: client.get('qrCode') ?? null,
        webHook: client.get('webHook') ?? null,
    };
}



export async function sendMessage(
    model: Model<any, any>, chatId: string,
    message: string | null = null,
    mediaPath: string | null = null,
    responseToId: string | null = null,
    isAudio: boolean = false
    ) {

    const clientId = model.get('clientId') as string | null;
    const client = clients[ clientId ?? ''];
    if(!client) return false;

    const chat = await client.getChatById(chatId);

    const options: any = {};

    if (responseToId) {
        options.quotedMessageId = responseToId;
    }

    if (mediaPath) {
        const media = MessageMedia.fromFilePath(mediaPath);
        if (message) options.caption = message;
        options.sendAudioAsVoice = isAudio;
        return await JsonMsg(await chat.sendMessage(media, options));
    }

    if (message) {
        return await JsonMsg(await chat.sendMessage(message, options));
    }

    throw new Error('Nothing to send: no media or message');
}

export async function getMessage(model: Model<any, any>, messageId: string): Promise<object | false> {
    const clientId = model.get('clientId') as string | null;
    const client = clients[ clientId ?? ''];
    if(!client) return false;

    const msg = await client.getMessageById(messageId);
    return await JsonMsg(msg);
}

export async function getMessageMedia(model: Model<any, any>, messageId: string): Promise<string | false> {
    const MEDIA_DIR = path.resolve('./media');
    await fs.mkdir(MEDIA_DIR, { recursive: true });

    const clientId = model.get('clientId') as string | null;
    const client = clients[ clientId ?? ''];
    if(!client) return false;

    const msg = await client.getMessageById(messageId);
    if (!msg.hasMedia) return false;

    const media = await msg.downloadMedia();
    if (!media) return false;

    const extension = getExtension(media.mimetype);
    const filename = `${msg.id.id}.${extension}`;
    const filepath = path.join(MEDIA_DIR, filename);

    await fs.writeFile(filepath, Buffer.from(media.data, 'base64'));

    return filename;
}

export async function getChats(model: Model<any, any>) {
    const clientId = model.get('clientId') as string | null;
    const client = clients[clientId ?? ''];
    if (!client) return false;

    const chats = await client.getChats();

    const results = await Promise.all(
        chats.map(chat => JsonChat(chat))
    );

    return results;
}
export async function getChat(model: Model<any, any>, chatId: string) {
    const clientId = model.get('clientId') as string | null;
    const client = clients[clientId ?? ''];
    if (!client) return false;

    const chat = await client.getChatById(chatId);

    return await JsonChat(chat);
}
export async function getChatMessages(model: Model<any, any>, chatId: string, count: number) {
    const clientId = model.get('clientId') as string | null;
    const client = clients[clientId ?? ''];
    if (!client) return false;

    const chat = await client.getChatById(chatId);
    if (!chat) return false;

    const msgs = await chat.fetchMessages({ limit: count });

    const m = await Promise.all(
        msgs.map(msg => JsonMsg(msg))
    );

    return m;
}

export async function getContacts(model: Model<any, any>) {
    const clientId = model.get('clientId') as string | null;
    const client = clients[clientId ?? ''];
    if (!client) return false;

    const contacts = await client.getContacts();

    const results = await Promise.all(
        contacts.map(async (contact) => {
            return JsonContact(contact);
        })
    );

    return results;
}

export async function getContact(model: Model<any, any>, chatId: string) {
    const clientId = model.get('clientId') as string | null;
    const client = clients[clientId ?? ''];
    if (!client) return false;

    const chat = await client.getChatById(chatId);
    const contact = await chat.getContact();

    return await JsonContact(contact);
}


export async function createClient(message_handler: ((msg: WAWebJS.Message) => Promise<boolean>) | null = null, clientId: string | null = null) {
    if (!clientId) {
        clientId = (await ClientModel.count() + 1).toString()
    }

    const opts: FindOrCreateOptions = {
        where: { clientId: clientId},
        defaults: { ready: false }
    };

    const [clientModel, created] = await ClientModel.findOrCreate(opts);
    if (!created) {
        return clientModel;
    }


    const client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './data/',
            clientId: clientId
        }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: '/usr/bin/google-chrome-stable',
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

    client.on('ready', async () => {
        clientModel.set({
            ready: true,
            name: client.info.pushname,
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


const MIME_MAP: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'audio/ogg': 'ogg',
    'application/pdf': 'pdf',
};

function getExtension(mimetype: string): string {
    return MIME_MAP[mimetype] || 'bin';
}

