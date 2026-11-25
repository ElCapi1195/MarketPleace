FROM node:24-alpine AS build
WORKDIR /repo
ENV NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
# Las páginas son dinámicas: el nicho real se elige al arrancar, no al construir.
RUN VERTICAL=demo pnpm turbo run build --filter=@marketplace/web

FROM node:24-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=root:root /repo/apps/web/.next/standalone .
COPY --from=build --chown=root:root /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
