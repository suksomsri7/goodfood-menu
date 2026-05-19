FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund --legacy-peer-deps

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache fontconfig ttf-dejavu ttf-freefont curl ca-certificates && \
    mkdir -p /usr/share/fonts/prompt && \
    curl -fsSL -o /usr/share/fonts/prompt/Prompt-Regular.ttf \
      "https://github.com/google/fonts/raw/main/ofl/prompt/Prompt-Regular.ttf" && \
    curl -fsSL -o /usr/share/fonts/prompt/Prompt-Medium.ttf \
      "https://github.com/google/fonts/raw/main/ofl/prompt/Prompt-Medium.ttf" && \
    curl -fsSL -o /usr/share/fonts/prompt/Prompt-Bold.ttf \
      "https://github.com/google/fonts/raw/main/ofl/prompt/Prompt-Bold.ttf" && \
    curl -fsSL -o /usr/share/fonts/prompt/Prompt-Black.ttf \
      "https://github.com/google/fonts/raw/main/ofl/prompt/Prompt-Black.ttf" && \
    fc-cache -f && \
    apk del curl ca-certificates

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Pre-create the uploads dir with correct ownership so the bind/named volume
# picks up these permissions on first creation.
RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
