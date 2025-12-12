#!/bin/bash
set -e

echo "🔧 Installing dependencies..."
pnpm install --frozen-lockfile || npm install

echo "📦 Building project..."
pnpm run build || npm run build

echo "✅ Build complete!"
