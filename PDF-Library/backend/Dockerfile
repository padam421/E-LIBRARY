FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts
COPY aiven-ca.pem* ./

EXPOSE 3000

CMD ["npm", "start"]
