FROM node:18-alpine AS build

WORKDIR /app

# Copy dependency files first for caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build for production (optional — dev mode uses vite dev server)
# RUN npm run build

# ── Development Stage ───────────────────────────────────────
# For dev, we just run the Vite dev server
EXPOSE 3000

CMD ["npm", "run", "dev"]
