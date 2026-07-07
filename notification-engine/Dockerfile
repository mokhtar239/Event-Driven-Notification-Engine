# syntax=docker/dockerfile:1

##########
# Stage 1 — deps: install ALL dependencies (incl. dev) for building.
##########
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

##########
# Stage 2 — build: compile TypeScript to dist/.
##########
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

##########
# Stage 3 — prod-deps: install ONLY production dependencies.
##########
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

##########
# Stage 4 — runtime: minimal image with compiled output + prod deps only.
##########
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Run as the built-in non-root `node` user.
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 3000

# Simple in-container liveness check (no curl in alpine base image).
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health/live',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/src/main.js"]
