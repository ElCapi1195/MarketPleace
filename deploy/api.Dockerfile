FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN MIGRATION_DATABASE_URL=postgresql://marketplace:build@127.0.0.1:5432/marketplace pnpm turbo run build --filter=@marketplace/api

FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/core/package.json packages/core/
COPY packages/verticals/package.json packages/verticals/
RUN pnpm install --prod --frozen-lockfile --filter "@marketplace/api..."

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN mkdir -p /data/media /data/documents && chown -R node:node /data
COPY --from=deps /app .
COPY --from=build /repo/packages/contracts/dist packages/contracts/dist
COPY --from=build /repo/packages/core/dist packages/core/dist
COPY --from=build /repo/packages/verticals/dist packages/verticals/dist
COPY --from=build /repo/packages/verticals/assets packages/verticals/assets
COPY --from=build /repo/apps/api/dist apps/api/dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
CMD ["node", "--enable-source-maps", "apps/api/dist/main.js"]
