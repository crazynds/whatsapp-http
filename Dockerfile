FROM node:22-alpine

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NODE_ENV=production

RUN npm install -g typescript
WORKDIR /app
COPY . .

RUN npm install --include=dev
RUN tsc
RUN npm uninstall -g typescript

EXPOSE 8000

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start"]

