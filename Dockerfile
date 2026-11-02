# Build and run the Flotilla web server.
#
#   docker build -t flotilla .
#   docker run -p 3000:3000 flotilla
#
# Pass --build-arg VITE_BUILD_HASH=$(git rev-parse --short HEAD) to stamp the build.
# A .env in the build context is picked up by scripts/build/web.sh for branding config.

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
RUN bash scripts/build/web.sh
RUN pnpm run build:server

FROM node:24-slim AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/build /app/build
# The bundle splits, and the chunks it imports at runtime sit beside it.
COPY --from=builder /app/build-server/ /app/
EXPOSE 3000
USER node
CMD ["node", "server.js"]
