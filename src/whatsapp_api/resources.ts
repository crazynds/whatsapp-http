import { Model } from "@sequelize/core";
import WAWebJS, { Chat, Contact, GroupChat, Message } from "whatsapp-web.js";

export async function JsonMsg(msg: Message): Promise<object> {
  const infos = await msg.getInfo();
  return {
    id: msg.id._serialized,
    from: msg.from,
    type: msg.type,
    groupMemberFrom: msg.author,
    fromMe: msg.fromMe,
    body: msg.body || "",
    timestamp: new Date(msg.timestamp * 1000),
    hasMedia: msg.hasMedia === true,
    groupInvite: msg.inviteV4 ? msg.inviteV4 : null,
    isQuote: msg.hasQuotedMsg,
    quoteId: msg.hasQuotedMsg
      ? (await msg.getQuotedMessage()).id._serialized
      : null,
    isForwarded: msg.isForwarded || false,
    mentionedIds:
      msg.mentionedIds.map((i: any) => {
        return i._serialized;
      }) ?? [],
    info: infos
      ? {
          delivered: infos.delivery.length > 0,
          read: infos.read.length > 0,
          played: infos.played.length > 0,
        }
      : {},
  };
}

export async function JsonChat(chat: Chat): Promise<object> {
  const get_part = (chat: GroupChat) => {
    return chat.participants.map((p) => {
      return { id: p.id._serialized, isAdmin: p.isAdmin };
    });
  };

  return {
    id: chat.id._serialized,
    name: chat.name,
    unreadCount: chat.unreadCount,
    lastMessageBody: chat.lastMessage?.body ?? null,
    isArchived: chat.archived,
    isGroup: chat.isGroup,
    groupMembers: chat.isGroup ? get_part(chat as WAWebJS.GroupChat) : null,
    isMuted: chat.isMuted,
    isReadOnly: chat.isReadOnly,
    //isPinned: chat.pinned,
  };
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
    clientId: client.get("clientId"),
    name: client.get("name"),
    ready: client.get("ready") ?? false,
    qr: client.get("qrCode") ?? null,
    webHook: client.get("webHook") ?? null,
  };
}
