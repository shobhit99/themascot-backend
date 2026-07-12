FROM node:22-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY package.json server.js ffmpeg-operations.js ./

EXPOSE 8080
CMD ["node", "server.js"]
