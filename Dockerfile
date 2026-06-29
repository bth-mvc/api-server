FROM node:24-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY src/ ./src/
COPY openapi.yaml ./dist/openapi.yaml
RUN npm run build && npm prune --omit=dev

FROM node:24-slim
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data
EXPOSE 5000
CMD ["node", "dist/src/index.js"]
