FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache postgresql-client

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts
COPY .env.example ./.env.example

EXPOSE 5000

CMD ["npm", "run", "start"]
