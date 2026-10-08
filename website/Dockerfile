# syntax=docker/dockerfile:1
#
# Build and serve the flotilla.social marketing site.
#
#   docker build -t flotilla-website .
#   docker run -p 8080:80 flotilla-website

# The site is static, so the same bytes come out on every architecture — build it once on the
# builder's own arch rather than once per target under emulation.
FROM --platform=$BUILDPLATFORM node:24-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Dependencies first, so editing src doesn't reinstall them.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM nginx:alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
