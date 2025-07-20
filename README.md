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

### Routes
* [GET]```/client/create?clientId={id}&webHook={url}```: Create a client and saves the webHook url. You can recall this route to update the webHook without recreating the client. And if you use the same `clientId` you can recover old sessions.
* [GET]```/client/:clientId```: Show the current status of this client. This route return a json like: `{clientId:{string}, ready:{bool}, qrCode:{string|null}, webHook: {string|null}}`. The meaning of the ready variable is if the client is connected and able to send or recive any messages.
* [GET]```/client/:clientId/qrCode```: Route to render the qr code if it exists, or return 404.
* [GET]```/client/:clientId/chat```: return list of chats of this client
* [GET]```/client/:clientId/chat/:phoneNumber```: return information about the chat 
* [GET]```/client/:clientID/chat/:phoneNumber/messages```: return list of messages of chat
* [POST]```/client/:clientId/chat/:phoneNumber/send```: Send messages to chats, should `message` in body.

## Find Us

* [GitHub](https://github.com/ArturCSegat/whatshttp)
* [Docker Hub](https://hub.docker.com/r/arturcsegat/whatshttp)


## Authors
* [ArturCSegat](https://github.com/ArturCSegat)
* [Crazynds](https://github.com/crazynds)


## License

This project is licensed under the MIT License - see the LICENSE.md file for details.

