FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Ensure app directory permissions belong to non-root node user
RUN chown -R node:node /app

USER node

EXPOSE 3000
CMD ["npm", "run", "start"]
