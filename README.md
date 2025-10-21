# WhatsApp HTTP API

A Docker container that provides a RESTful API for WhatsApp Web, enabling easy integration with WhatsApp for messaging automation and other services.

![WhatsApp API](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)

## ✨ Features

- 💬 Send and receive WhatsApp messages
- 📁 Media support (images, documents, audio, video)
- 🔄 Multiple client sessions support
- 📊 Webhook notifications for incoming messages
- 📝 Fully documented REST API with Swagger
- 🐳 Easy Docker deployment
- 🔒 Session persistence
- 🚀 Built with TypeScript for type safety

## 🚀 Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed on your system
- Node.js 16+ (for development)

### Quick Start

1. **Run with Docker** (recommended):
   ```bash
   docker run -d \
     --name whatshttp \
     -p 3000:3000 \
     -v whatsapp-sessions:/app/data \
     crazynds/whatshttp:latest
   ```

2. **Access the API documentation**:
   Open your browser and navigate to `http://localhost:3000/docs`

## 📚 Documentation

### API Reference

Detailed API documentation is available at `/docs` when the server is running. The documentation includes:

- Available endpoints
- Request/response schemas
- Example requests
- Authentication requirements

### Webhook Payload Format

When a webhook URL is configured, the server will send HTTP POST requests with the following JSON structure for each event:

#### Message Received
```json
{
  "object": "whatsapp_web_account",
  "entry": [
    {
      "id": $clientId,
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": $whatsappWebName,
              "phone_number_id": $clientId
            },
            "messages": [
              {
                "from": $senderPhoneNumber,
                "id": $messageId,
                "timestamp": $timestamp,
                "type": "text",
                "text": {
                  "body": $message_content,
                }
              },
              ...
            ]
          },
          "field": "messages"
        },
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": $whatsappWebName,
              "phone_number_id": $clientId
            },
            "statuses": [
              {
                "id": $messageId,
                "status": "sent|delivered|read|error",
                "timestamp": $timestamp,
                "recipient_id": $recipientPhoneNumber
              },
              ...
            ]
          },
          "field": "message_status"
        }
      ]
    },
    ...
  ]
}
```

#### Whatsapp Web Disconnected

```json
{
  "object": "whatsapp_web_account",
  "entry": [
    {
      "id": $clientId,
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": $whatsappWebName,
              "phone_number_id": $clientId
            },
          },
          "field": "whatsapp_web_disconected"
        }
      ]
    },
    ...
  ]
}
```

If you are familiar with the Meta API, you will notice that the payload is very similar, but with some differences like the `object` field contains the value `whatsapp_web_account` instead of `whatsapp_business_account` and the disconected event has not an equivalent in the Meta API.

We will try to maintain compatibility with the Meta API in the future updates so you don't have to worry about.

#### Status Values
- `sent`: Message was sent by the server.
- `delivered`: Message was delivered to the recipient's device.
- `read`: Message was read by the recipient.
- `error`: There was an error when sending the message.


### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the server will listen on |
| `DB_PATH` | `./data/db.sqlite` | Path to SQLite database file (use `:memory:` for in-memory) |
| `LOG_LEVEL` | `http` | Logging level (error, warn, info, http, debug) |

### Volumes

| Path | Description |
|------|-------------|
| `/app/data` | Directory where the data files are stored and the database are stored |

## 🔧 Development

### Prerequisites

- Node.js 22+
- npm
- Docker (for containerized development)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/crazynds/whatshttp.git
   cd whatshttp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. The API docs will be available at `http://localhost:3000/docs` 

> **Note:**
> If you are using an OS other than Linux, you will need to comment or change the `executablePath` in the `puppeteer` options to the path of your Google Chrome installation. 

### Building for Production

```bash
# Build the Docker image
docker build -t whatshttp .

# Run the container
docker run -d -p 3000:3000 whatshttp
```

## 🤝 Contributing

We welcome contributions from the community!


## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📬 Contact

- [Crazynds](https://github.com/crazynds)
- [ArturCSegat](https://github.com/ArturCSegat)

## 🔗 Links

- [GitHub Repository](https://github.com/crazynds/whatshttp)
- [Docker Hub](https://hub.docker.com/r/crazynds/whatshttp)
- [Report Bug](https://github.com/crazynds/whatshttp/issues)

