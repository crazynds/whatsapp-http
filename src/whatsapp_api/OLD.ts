// const convertBaileysMessageToWhatsappMessage = (message: WAMessage) => {
//   if (
//     !message.message?.extendedTextMessage?.text &&
//     !message.message?.conversation &&
//     !message.message?.audioMessage
//   ) {
//     return {
//       ack: MessageAck.ACK_ERROR,
//     } as Message;
//   }
//   console.log(
//     "mensagem",
//     message,
//     message.message.senderKeyDistributionMessage
//   );
//   return {
//     ack: message.status || MessageAck.ACK_SERVER,
//     deviceType: "",
//     body: message.message?.extendedTextMessage
//       ? message.message.extendedTextMessage.text
//       : message.message?.conversation || "",
//     timestamp: message.messageTimestamp,
//     broadcast: message.broadcast,
//     hasMedia: !!message.message?.imageMessage,
//     type: message.message?.audioMessage
//       ? MessageTypes.AUDIO
//       : MessageTypes.TEXT,
//     downloadMedia: ,
//     hasQuotedMsg: !!message.message?.extendedTextMessage?.contextInfo,
//     getQuotedMessage: async () => {
//       return {
//         from:
//           message.message?.extendedTextMessage?.contextInfo?.participant ?? "",
//         id: {
//           id: message.message?.extendedTextMessage?.contextInfo?.stanzaId,
//           remote:
//             message.message?.extendedTextMessage?.contextInfo?.participant,
//           _serialized:
//             message.message?.extendedTextMessage?.contextInfo?.stanzaId,
//         },
//       };
//     },
//     from: message.key.remoteJid,
//     fromMe: message.key.fromMe,
//     id: {
//       _serialized: message.key.id,
//       fromMe: message.key.fromMe,
//       id: message.key.id,
//       remote: message.key.remoteJid,
//     },
//   } as Message;
// };
