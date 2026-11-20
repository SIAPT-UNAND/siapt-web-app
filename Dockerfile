FROM node:22-alpine AS frontend-build

WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/app/package.json backend/app/package.json
RUN npm ci

COPY frontend/ frontend/
RUN npm run build -w frontend

FROM node:22-alpine AS runtime

RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/app/package.json backend/app/package.json
RUN npm ci

COPY backend/app/ backend/app/
COPY --from=frontend-build /app/frontend/dist frontend/dist

RUN npm run generate -w @siapt/backend-app

EXPOSE 8080

CMD ["sh", "-c", "npm run migrate:deploy -w @siapt/backend-app && npm start -w @siapt/backend-app"]
