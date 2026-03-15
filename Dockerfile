FROM node:20-alpine3.19

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npm install ts-node typescript && npx prisma generate

COPY src ./src
COPY tsconfig.json ./

ENV NODE_ENV=production

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node --transpile-only src/index.ts"]
