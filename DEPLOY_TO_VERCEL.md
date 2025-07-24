# Deploy CrusherMate Backend to Vercel

## 🚀 Quick Deployment Steps

### 1. Install Vercel CLI (if not already installed)
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy from the backend directory
```bash
cd backend
vercel --prod
```

### 4. Set Environment Variables
After deployment, set these environment variables in your Vercel dashboard:

```env
# Database Configuration
MONGODB_URI=mongodb+srv://rajenderreddygarlapalli:MacBook%408358%249154@crushermate.utrbdfv.mongodb.net/CrusherMate?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=crushermate_practice_app_super_secret_jwt_key_2024_min_32_chars
JWT_EXPIRES_IN=7d

# Server Configuration
NODE_ENV=production
PORT=3000

# CORS Configuration
ALLOWED_ORIGINS=*

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Database Settings
DB_CONNECT_TIMEOUT=30000
DB_SOCKET_TIMEOUT=45000
DB_SERVER_SELECTION_TIMEOUT=15000
DB_MAX_POOL_SIZE=10
DB_MIN_POOL_SIZE=2
```

## 🔧 Manual Deployment Steps

### 1. Prepare the backend for deployment
```bash
cd backend
npm install
```

### 2. Deploy to Vercel
```bash
vercel --prod
```

### 3. Get the deployment URL
After deployment, Vercel will provide a URL like:
`https://crushermate-backend-xxxxx.vercel.app`

### 4. Update your React Native app
Update the production URL in `src/services/apiService.js`:

```javascript
const PRODUCTION_URL = 'https://your-vercel-deployment-url.vercel.app/api';
```

## 🧪 Test the Deployment

### 1. Test health endpoint
```bash
curl https://your-vercel-deployment-url.vercel.app/api/health
```

### 2. Test database connection
```bash
curl https://your-vercel-deployment-url.vercel.app/api/health/db
```

### 3. Test login endpoint
```bash
curl -X POST https://your-vercel-deployment-url.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"raj","password":"Test@123"}'
```

## 🛠️ Troubleshooting

### If deployment fails:
1. Check that all dependencies are in `package.json`
2. Ensure environment variables are set in Vercel dashboard
3. Check Vercel logs for errors

### If API calls fail:
1. Verify the deployment URL is correct
2. Check CORS settings
3. Ensure MongoDB connection string is correct
4. Check Vercel function logs

### If database connection fails:
1. Verify MongoDB Atlas network access
2. Check if IP whitelist includes Vercel IPs
3. Test connection string locally first

## 📊 Monitoring

- **Vercel Dashboard**: Monitor function performance and errors
- **MongoDB Atlas**: Monitor database connections and queries
- **Health Endpoints**: Use `/api/health` and `/api/health/db` for monitoring

## 🔄 Redeployment

To update the deployment:
```bash
cd backend
vercel --prod
```

## 📝 Notes

- The serverless function has a 10-second timeout limit
- Cold starts may cause initial delays
- Database connections are optimized for serverless
- All routes are prefixed with `/api` 