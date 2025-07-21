# 🚀 CrusherMate Backend Cloud Deployment

## 📋 **Deploy to Railway (Free Cloud Service)**

This will make your APK work for users outside your network.

### **Step 1: Prepare for Deployment**

1. **Install Railway CLI:**
```bash
npm install -g @railway/cli
```

2. **Login to Railway:**
```bash
railway login
```

3. **Initialize Railway Project:**
```bash
cd backend
railway init
```

### **Step 2: Set Environment Variables**

In Railway dashboard, set these environment variables:
```
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://rajenderreddygarlapalli:MacBook%408358%249154@crushermate.utrbdfv.mongodb.net/CrusherMate?retryWrites=true&w=majority
JWT_SECRET=crushermate_practice_app_super_secret_jwt_key_2024_min_32_chars
JWT_EXPIRE=7d
BCRYPT_SALT_ROUNDS=12
ALLOWED_ORIGINS=*
CORS_CREDENTIALS=true
```

### **Step 3: Deploy**

```bash
railway up
```

### **Step 4: Get Cloud URL**

After deployment, Railway will give you a URL like:
`https://crushermate-backend-production.up.railway.app`

### **Step 5: Update APK**

Update `src/services/apiService.js`:
```javascript
// For production, use Railway URL
API_BASE_URL = 'https://crushermate-backend-production.up.railway.app/api';
```

### **Step 6: Build New APK**

```bash
cd android && ./gradlew assembleRelease
```

## ✅ **Benefits:**

- ✅ **24/7 uptime** - Server never stops
- ✅ **External access** - Works from anywhere
- ✅ **Auto-scaling** - Handles multiple users
- ✅ **Free tier** - No cost for testing
- ✅ **SSL certificate** - Secure HTTPS

## 🔄 **Local vs Cloud:**

### **Local Server:**
- ✅ Good for development
- ❌ Stops when computer shuts down
- ❌ Only works on same network

### **Cloud Server:**
- ✅ Runs 24/7
- ✅ Works from anywhere
- ✅ Perfect for testing

## 📱 **APK Testing:**

Once deployed, your APK will work for:
- ✅ **Local users** (same WiFi)
- ✅ **External users** (different networks)
- ✅ **Anywhere in the world**

## 🚀 **Quick Deploy Commands:**

```bash
# Deploy to Railway
railway up

# Check deployment status
railway status

# View logs
railway logs

# Get deployment URL
railway domain
``` 