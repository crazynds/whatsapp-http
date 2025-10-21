export interface WhatsAppWebhookPayload {
  //object: "whatsapp_business_account";
  object: "whatsapp_web_account"; // Here is changed to whatsapp_web_account to know the diference
  entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string; // ID da conta Business
  changes: WhatsAppChange[];
}

export interface WhatsAppChange {
  field: "messages" | "message_template_status_update" | "message_status";
  value: WhatsAppChangeValue;
}

export interface WhatsAppChangeValue {
  messaging_product: "whatsapp";
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

/** Representa o contato do remetente */
export interface WhatsAppContact {
  profile?: {
    name?: string;
  };
  wa_id: string; // número do contato
}

/** Representa uma mensagem recebida ou enviada */
export interface WhatsAppMessage {
  from: string; // número do remetente
  id: string; // ID único da mensagem (wamid)
  timestamp: string;
  type: WhatsAppMessageType;

  // 🔹 Contexto (respostas, reações)
  context?: {
    from?: string;
    id?: string;
    referred_product?: any;
    group_id?: string;
  };

  // 🔹 Quando for mensagem de grupo
  group?: {
    id: string; // ex: "120363025988765432@g.us"
    name?: string;
  };

  // 🔹 Tipos possíveis de conteúdo
  text?:
    | {
        body?: string;
      }
    | {
        audio?: {
          mimetype: string;
          data: string;
          filename?: string | null;
          filesize?: number | null;
        };
      };
  image?: WhatsAppMedia;
  video?: WhatsAppMedia;
  audio?: WhatsAppMedia;
  document?: WhatsAppMedia;
  sticker?: WhatsAppMedia;
  location?: {
    latitude: string;
    longitude: string;
    name?: string;
    address?: string;
  };
  contacts?: WhatsAppContactMessage[];
  interactive?: WhatsAppInteractiveMessage;
  reaction?: {
    message_id: string;
    emoji: string;
  };
  button?: {
    payload: string;
    text: string;
  };
}

/** Tipos possíveis de mensagem */
export type WhatsAppMessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "location"
  | "contacts"
  | "interactive"
  | "reaction"
  | "button"
  | "audio64"; // Custom type
/** Mídia genérica */
export interface WhatsAppMedia {
  mime_type?: string;
  sha256?: string;
  id?: string;
  link?: string;
  caption?: string;
  filename?: string;
}

/** Mensagem contendo contato */
export interface WhatsAppContactMessage {
  addresses?: any[];
  birthday?: string;
  emails?: any[];
  name?: {
    formatted_name: string;
    first_name?: string;
    last_name?: string;
  };
  org?: {
    company?: string;
    department?: string;
    title?: string;
  };
  phones?: { phone: string; type?: string; wa_id?: string }[];
  urls?: { url: string; type?: string }[];
}

/** Mensagem interativa (botões, listas etc.) */
export interface WhatsAppInteractiveMessage {
  type: "button_reply" | "list_reply";
  button_reply?: {
    id: string;
    title: string;
  };
  list_reply?: {
    id: string;
    title: string;
    description?: string;
  };
}

/** Representa atualização de status (mensagem entregue, lida etc.) */
export interface WhatsAppStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed" | "deleted";
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    expiration_timestamp?: string;
    origin?: {
      type: "business_initiated" | "user_initiated" | "referral_conversion";
    };
  };
  pricing?: {
    billable: boolean;
    pricing_model: "CBP" | "FREE";
    category:
      | "authentication"
      | "marketing"
      | "utility"
      | "service"
      | "conversation";
  };
  errors?: {
    code: number;
    title: string;
    message: string;
  }[];
}
