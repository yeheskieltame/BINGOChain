FROM node:20-alpine
WORKDIR /app

# Install runtime deps (tsx is a runtime dep so TS runs without a build step).
COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm", "start"]
