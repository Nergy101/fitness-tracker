# FitnessTracker frontend — Vite/React build served as static files by nginx.
FROM node:26-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Empty → relative /api requests, proxied by nginx to the backend. This is what
# lets the same image work on localhost or any domain without a rebuild.
ENV VITE_API_URL=""
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
