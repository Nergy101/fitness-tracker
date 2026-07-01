# FitnessTracker frontend — Vite/React build served as static files by nginx.
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# API base URL is baked in at build time (Vite statically inlines it).
# Override for non-local deploys: --build-arg VITE_API_URL=https://api.example.com
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
