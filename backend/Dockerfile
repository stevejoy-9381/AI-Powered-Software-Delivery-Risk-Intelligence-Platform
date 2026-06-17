FROM node:18-alpine

WORKDIR /app

# Copy dependency files first for better Docker layer caching
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose the API port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Run as non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup
USER appuser

CMD ["node", "src/server.js"]
