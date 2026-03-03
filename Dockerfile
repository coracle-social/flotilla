# Stage 1: Build
# Uses .env from build context for config (logo, branding, etc.)
# Optional: docker build --build-arg VITE_BUILD_HASH=$(git rev-parse --short HEAD) -t flotilla .

FROM node:20-bookworm AS builder

RUN npm install -g pnpm@latest

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm i

# Copy everything (including .env when present) - build.sh will source it
COPY . .

ARG VITE_BUILD_HASH
ENV VITE_BUILD_HASH=${VITE_BUILD_HASH}

ENV NODE_OPTIONS=--max_old_space_size=16384
RUN pnpm run build

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Copy only the built output - no source, no .env, no dev deps
COPY --from=builder /app/build ./build

CMD ["npx", "serve", "build"]
