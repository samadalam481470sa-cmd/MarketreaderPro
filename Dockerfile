FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY apps ./apps
USER node
EXPOSE 3000
CMD ["node","apps/api/server.js"]
