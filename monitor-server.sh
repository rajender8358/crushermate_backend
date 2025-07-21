#!/bin/bash

# CrusherMate Server Monitoring Script
# Use this to check server status and health

echo "🔍 CrusherMate Server Monitor"
echo "=============================="

# Check PM2 status
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "🌐 Network Health Check:"
curl -s http://192.168.29.243:3000/health | jq . 2>/dev/null || curl -s http://192.168.29.243:3000/health

echo ""
echo "📝 Recent Logs (last 10 lines):"
pm2 logs crushermate-backend --lines 10

echo ""
echo "💾 Memory Usage:"
pm2 monit --no-daemon 2>/dev/null || echo "Run 'pm2 monit' for detailed monitoring"

echo ""
echo "🔄 Auto-restart Status:"
pm2 show crushermate-backend | grep -E "(restarts|uptime|status)"

echo ""
echo "✅ Server is ready for testing!"
echo "📱 APK can connect to: http://192.168.29.243:3000" 