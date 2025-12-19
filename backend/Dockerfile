FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install Python3 and build tools (required for some npm packages)
RUN apk add --no-cache python3 make g++

# Install dependencies
RUN npm ci --only=production

# Remove build tools to keep image small (optional)
RUN apk del make g++

# Copy app source
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start command
CMD [ "node", "server.js" ]
