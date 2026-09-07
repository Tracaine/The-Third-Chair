FROM node:24-bookworm-slim AS builder
ENV NODE_OPTIONS=--conditions=development
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json tsconfig.evals.json vitest.config.ts ./
COPY apps ./apps
COPY packages ./packages
COPY evals ./evals
COPY plugins ./plugins
COPY scripts ./scripts
RUN npm ci
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8787 \
    THIRD_CHAIR_HOST=0.0.0.0 \
    CAMPAIGN_DB_PATH=/app/data/campaigns.sqlite \
    SOURCE_PACK_DB_PATH=/app/private/source-pack.sqlite \
    THIRD_CHAIR_EXPORT_DIRECTORY=/app/data/exports \
    THIRD_CHAIR_WIDGET_BUILD=/app/apps/widget/dist/index.html \
    THIRD_CHAIR_WIDGET_DOMAIN=https://tracaine.github.io \
    THIRD_CHAIR_TRACE_MODE=off \
    OPENAI_AGENTS_DISABLE_TRACING=1
WORKDIR /app
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/widget/package.json ./apps/widget/package.json
COPY --from=builder /app/apps/widget/dist ./apps/widget/dist
COPY --from=builder /app/packages/agents/package.json ./packages/agents/package.json
COPY --from=builder /app/packages/agents/dist ./packages/agents/dist
COPY --from=builder /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/packages/engine/package.json ./packages/engine/package.json
COPY --from=builder /app/packages/engine/dist ./packages/engine/dist
COPY --from=builder /app/packages/source-pack/package.json ./packages/source-pack/package.json
COPY --from=builder /app/packages/source-pack/dist ./packages/source-pack/dist
COPY --from=builder /app/packages/storage/package.json ./packages/storage/package.json
COPY --from=builder /app/packages/storage/dist ./packages/storage/dist
RUN mkdir -p /app/data/exports /app/private && chown -R node:node /app/data /app/private
USER node
EXPOSE 8787
CMD ["node", "apps/server/dist/src/main.js"]
