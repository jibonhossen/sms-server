FROM oven/bun:1.3.11

WORKDIR /app

# Copy package files
COPY package.json ./
COPY drizzle.config.ts ./
COPY tsconfig.json ./

# Install dependencies
RUN bun install

# Copy source code
COPY src ./src

# Build the application
RUN bun build src/index.ts --outdir ./dist --target bun

# Expose port
EXPOSE 3000

# Run migrations and start server
CMD bun run db:migrate && bun run start
