FROM oven/bun:1
WORKDIR /app
COPY package.json ./package.json
COPY server.ts ./server.ts
COPY src ./src
COPY public ./public
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["bun", "run", "server.ts"]