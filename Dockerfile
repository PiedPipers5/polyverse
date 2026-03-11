# Stage 1: Install dependencies
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Stage 2: Build the application
FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args for SvelteKit (needed at build time, not runtime)
ARG DATABASE_URL=postgresql://dummy:dummy@localhost/dummy
ARG DOMAIN=localhost
ARG ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
ARG JWT_SECRET=0000000000000000000000000000000000000000000000000000000000000000

ENV DATABASE_URL=$DATABASE_URL
ENV DOMAIN=$DOMAIN
ENV ENCRYPTION_KEY=$ENCRYPTION_KEY
ENV JWT_SECRET=$JWT_SECRET

RUN bun run build

# Stage 3: Production image
FROM oven/bun:1-slim AS production
WORKDIR /app

COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules

# Runtime env vars are injected via docker run -e or docker-compose
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "./build/index.js"]
