FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
RUN npm ci --no-audit --no-fund
COPY . .
ARG BUILD_SHA=development
ENV VITE_BUILD_SHA=${BUILD_SHA}
RUN npm run build

FROM node:22-alpine AS runtime
ARG BUILD_SHA=development
ENV BUILD_SHA=${BUILD_SHA}
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist
ENV LOG_DIR=/tmp/dogfight-replays
RUN mkdir -p /tmp/dogfight-replays && chown -R node:node /tmp/dogfight-replays
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/index.js"]
