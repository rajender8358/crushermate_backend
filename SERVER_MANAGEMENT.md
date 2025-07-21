# 🚀 CrusherMate Backend Server Management

## 📋 **Production-Ready Server Setup**

Your server is now configured with robust auto-restart and monitoring capabilities for testing with 3-4 people.

## 🔧 **Server Commands**

### **Start Server (if stopped):**
```bash
cd backend
./start-server.sh
```

### **Check Server Status:**
```bash
cd backend
./monitor-server.sh
```

### **Quick Status Check:**
```bash
pm2 status
```

### **View Logs:**
```bash
pm2 logs crushermate-backend
```

### **Monitor in Real-time:**
```bash
pm2 monit
```

## ✅ **Auto-Restart Features**

- ✅ **Auto-restart on crash**
- ✅ **Memory limit protection** (500MB)
- ✅ **Startup on system boot**
- ✅ **Process monitoring**
- ✅ **Error logging**
- ✅ **Graceful shutdown**

## 🌐 **Network Access**

- **Local:** `http://localhost:3000`
- **Network:** `http://192.168.29.243:3000`
- **APK Connection:** `http://192.168.29.243:3000`

## 📱 **Testing Instructions**

### **For Testers:**
1. **Install APK:** `android/app/build/outputs/apk/release/app-release.apk`
2. **Connect to same WiFi** as your computer
3. **Login:** `raju@gmail.com` / `Test@12345`
4. **All APIs will work** automatically

### **For You (Server Management):**
1. **Check status:** `./monitor-server.sh`
2. **Restart if needed:** `pm2 restart crushermate-backend`
3. **View logs:** `pm2 logs crushermate-backend`

## 🔄 **Auto-Recovery**

The server will automatically:
- ✅ Restart if it crashes
- ✅ Restart if memory exceeds 500MB
- ✅ Start on system boot
- ✅ Log all errors for debugging

## 📊 **Monitoring**

- **Status:** `pm2 status`
- **Logs:** `pm2 logs crushermate-backend`
- **Monitor:** `pm2 monit`
- **Health Check:** `curl http://192.168.29.243:3000/health`

## 🚨 **Troubleshooting**

### **If server stops:**
```bash
cd backend
pm2 restart crushermate-backend
```

### **If PM2 issues:**
```bash
pm2 delete crushermate-backend
./start-server.sh
```

### **Check network access:**
```bash
curl http://192.168.29.243:3000/health
```

## ✅ **Ready for Testing**

Your server is now production-ready and will stay running continuously for your 3-4 testers! 