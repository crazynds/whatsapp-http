# WhatsApp API Docker Container

Docker container for whatsapp interaction over http

## Getting Started

These instructions cover the necessary information to use the Docker container.

### Prerequisites

To run this container, you will need to have Docker installed.

* [Windows](https://docs.docker.com/windows/started)
* [OS X](https://docs.docker.com/mac/started/)
* [Linux](https://docs.docker.com/linux/started/)

### Usage

#### Container Parameters

You can run the container with the following parameters:

```shell
docker run arturcsegat/whatshttp:latest [parameters]
```

Basic usage example:
```shell
docker run -d --name whatshttp -p 3000:3000 arturcsegat/whatshttp:latest
```

To start a shell inside the container:
```shell
docker run -it --rm arturcsegat/whatshttp:latest bash
```

#### Environment Variables
* PORT - Port the server will run inside the docker. Default: 3000
* DB_PATH - Path to sqlite database, if not defined will store clients in memory

#### Volumes
* /app/data - Directory where session are stored.

#### Useful File Locations
* /app - The aplication folder.

## API Routes

### 1. Get QR Code for Client  
`GET /client/qrCode?clientId=&webHook=`  
Returns a QR code image to scan for WhatsApp login.  
- `clientId` (optional): reuse existing client or create new.  
- `webHook` (optional): URL to receive message webhook POSTs.

### 2. Get Client Info  
`GET /client/:clientId`  
Returns client status including readiness, QR code data, and webhook URL.

### 3. Get All Chats  
`GET /client/:clientId/chat`  
Lists all chats for the client. Client must be ready.

### 4. Get Single Chat  
`GET /client/:clientId/chat/:chatId[?group=true]`  
Returns chat info and associated contact details.  
- If `chatId` lacks suffix, adds `@g.us` if `group=true`, otherwise `@c.us`.

### 5. Send Message  
`POST /client/:clientId/chat/:chatId/send`  
Send a text message to the chat.  
- JSON body: `{ "message": "text" }`  
- `chatId` suffix logic applies as above.

### 6. Get Chat Messages  
`GET /client/:clientId/chat/:chatId/messages[?group=true]`  
Returns last 200 messages from the chat.

### 7. Donwload Media from Message
`GET /client/:clientId/message/:messageId`  
Returns file containing media for the message
- The `messageId` should be retrieved from the previous route.

### 8. Get All Contacts  
`GET /client/:clientId/contact`  
Returns all contacts for the client. Client must be ready.

### 9. Get Contact by Chat ID  
`GET /client/:clientId/contact/:chatId[?group=true]`  
Returns contact info for given chat ID, with suffix logic applied.

## Examples

Remember the id of a private chat is the phone number plus @c.us, the id of a group is different (see all chats to find your group id);

Ex: 
```json
phone +55 11 91234-5678
id: 5511912345678@c.us
```



### Get QR Code for new client
```bash
curl "http://localhost:3000/client/qrCode"
```

### Get all chats for a client
```bash
curl "http://localhost:3000/client/123/chat"
```

### Get single chat (individual)
```bash
curl "http://localhost:3000/client/123/chat/456"
```

### Get single chat (group)
```bash
curl "http://localhost:3000/client/123/chat/456?group=true"
```

### Send message to chat
```bash
curl -X POST "http://localhost:3000/client/123/chat/456/send" \
    -H "Content-Type: application/json" \
    -d '{"message":"Hello from API!"}'
```

### Get all messages from chat
```bash
curl "http://localhost:3000/client/123/chat/456/messages"
```

### Send message to chat (group)
```bash
curl -X POST "http://localhost:3000/client/123/chat/456/send?group=true" \
    -H "Content-Type: application/json" \
    -d '{"message":"Hello from API!"}'
```

### Donwload media from message
```bash
curl -X GET "http://localhost:3000/client/123/message/456/media" \
```

### Get all contacts
```bash
curl "http://localhost:3000/client/123/contact"
```

### Get contact info by chat ID (individual)
```bash
curl "http://localhost:3000/client/123/contact/456"
```

### Get contact info by chat ID (group)
```bash
curl "http://localhost:3000/client/123/contact/456?group=true"
```

## Find Us

* [GitHub](https://github.com/ArturCSegat/whatshttp)
* [Docker Hub](https://hub.docker.com/r/arturcsegat/whatshttp)


## Authors
* [ArturCSegat](https://github.com/ArturCSegat)
* [Crazynds](https://github.com/crazynds)


## License

This project is licensed under the MIT License - see the LICENSE.md file for details.

