# Build and run the Flotilla web server.
#
#   docker build -t flotilla .
#   docker run -p 3000:3000 flotilla
#
# Pass --build-arg VITE_BUILD_HASH=$(git rev-parse --short HEAD) to stamp the build.
# A .env in the build context is picked up by scripts/build/app.sh for branding config.

# https://pnpm.io/docker#example-3-build-on-cicd
FROM node:24-slim AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
ENV NODE_OPTIONS=--max_old_space_size=16384
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
RUN pnpm i --frozen-lockfile
COPY . .
ARG VITE_BUILD_HASH
RUN pnpm run build
RUN pnpm run build:server

FROM node:24-slim AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/build /app/build
COPY --from=builder /app/build-server/server.js /app/server.js
EXPOSE 3000
USER node
CMD ["node", "server.js"]
