#!/bin/bash

# Docker Manager - Quick Start Script

set -e

echo "🐳 Docker Manager - Quick Start"
echo "================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.docker..."
    cp .env.docker .env
    echo "✅ .env file created"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "🔨 Building Docker image..."
docker-compose build

echo ""
echo "🚀 Starting Docker Manager..."
docker-compose up -d

echo ""
echo "⏳ Waiting for container to be ready..."
sleep 5

# Check container status
if docker-compose ps | grep -q "Up"; then
    echo ""
    echo "✅ Docker Manager is running!"
    echo ""
    echo "📱 Access the application at:"
    echo "   http://localhost:$(grep VITE_PORT .env | cut -d '=' -f2)"
    echo ""
    echo "📊 View logs:"
    echo "   docker-compose logs -f"
    echo ""
    echo "🛑 Stop the application:"
    echo "   docker-compose down"
else
    echo ""
    echo "❌ Failed to start Docker Manager"
    echo "View logs with: docker-compose logs"
    exit 1
fi
