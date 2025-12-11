# Use Node.js 18 LTS
FROM node:18-alpine

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy all project files
COPY . .

# Build the project
RUN pnpm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"]
