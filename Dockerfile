FROM oven/bun:1.3.9-alpine AS build

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1.3.9-alpine AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

WORKDIR /app
COPY --from=build --chown=bun:bun /app/build ./build

USER bun
EXPOSE 3000

CMD ["bun", "build/index.js"]
