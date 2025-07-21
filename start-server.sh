#!/bin/bash

# CrusherMate Backend Server Startup Script
# This script ensures the server starts and stays running

echo "🚀 Starting CrusherMate Backend Server..."

# Navigate to backend directory
cd "$(dirname "$0")"

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Installing PM2..."
    npm install -g pm2
fi

# Kill any existing PM2 processes for this app
pm2 delete crushermate-backend 2>/dev/null || true

# Start the server with PM2
echo "📡 Starting server with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration to start on system boot
pm2 save

# Setup PM2 to start on system boot
pm2 startup

echo "✅ Server started successfully!"
echo "📊 Monitor with: pm2 monit"
echo "📋 Status with: pm2 status"
echo "📝 Logs with: pm2 logs crushermate-backend"

# Show current status
pm2 status 