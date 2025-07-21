# CrusherMate Backend API

## 🏗️ Project Structure
```
backend/
├── src/
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware
│   ├── config/          # Configuration files
│   ├── utils/           # Utility functions
│   └── server.js        # Main server file
├── uploads/             # File uploads directory
├── package.json         # Dependencies
└── README.md           # This file
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Environment Setup
Create a `.env` file in the backend directory:
```env
# Server Configuration
NODE_ENV=development
PORT=3000

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/crushermate

# JWT Configuration
JWT_SECRET=crushermate_super_secret_key_2024_change_in_production
JWT_EXPIRES_IN=7d

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=uploads/

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
BCRYPT_SALT_ROUNDS=12

# Default Admin User (for seeding)
ADMIN_EMAIL=raj@gmail.com
ADMIN_PASSWORD=Test@123
ADMIN_USERNAME=raj
```

### 3. MongoDB Setup
Make sure MongoDB is running on your system:

**Option 1: Local MongoDB**
```bash
# Install MongoDB (macOS with Homebrew)
brew install mongodb-community
brew services start mongodb-community

# Or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**Option 2: MongoDB Atlas (Cloud)**
1. Create account at https://cloud.mongodb.com
2. Create a cluster
3. Get connection string
4. Update MONGODB_URI in .env

### 4. Start Server
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

## 📊 Database Collections

### Users Collection
```javascript
{
  email: String (unique),
  password: String (hashed),
  username: String,
  mobileNumber: String,
  role: "owner" | "user",
  isActive: Boolean,
  lastLogin: Date
}
```

### TruckEntries Collection
```javascript
{
  userId: ObjectId (ref: User),
  truckNumber: String,
  entryType: "Sales" | "Raw Stone",
  materialType: "M-Sand" | "P-Sand" | "Blue Metal" | null,
  units: Number,
  ratePerUnit: Number,
  totalAmount: Number,
  truckImage: String,
  entryDate: Date,
  entryTime: String,
  status: "active" | "deleted"
}
```

### MaterialRates Collection
```javascript
{
  materialType: "M-Sand" | "P-Sand" | "Blue Metal",
  currentRate: Number,
  updatedBy: ObjectId (ref: User),
  effectiveDate: Date,
  previousRate: Number,
  isActive: Boolean
}
```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify-token` - Verify JWT token

### Users (Protected)
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users` - Get all users (owner only)

### Truck Entries (Protected)
- `POST /api/truck-entries` - Create truck entry
- `GET /api/truck-entries` - Get truck entries with filters
- `GET /api/truck-entries/:id` - Get specific truck entry
- `PUT /api/truck-entries/:id` - Update truck entry
- `DELETE /api/truck-entries/:id` - Delete truck entry

### Dashboard (Protected)
- `GET /api/dashboard/summary` - Get dashboard summary
- `GET /api/dashboard/financial` - Get financial metrics

### Reports (Protected)
- `GET /api/reports/data` - Get report data with filters
- `POST /api/reports/export` - Generate export data

### Material Rates (Protected)
- `GET /api/material-rates` - Get current rates
- `POST /api/material-rates` - Update rates (owner only)
- `GET /api/material-rates/history/:materialType` - Get rate history

## 🔧 API Usage Examples

### Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "username": "testuser",
    "mobileNumber": "9876543210"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "raj@gmail.com",
    "password": "Test@123"
  }'
```

### Create Truck Entry
```bash
curl -X POST http://localhost:3000/api/truck-entries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "truckNumber": "KA01AB1234",
    "entryType": "Sales",
    "materialType": "M-Sand",
    "units": 10,
    "ratePerUnit": 1500,
    "entryTime": "14:30"
  }'
```

### Get Dashboard Summary
```bash
curl -X GET "http://localhost:3000/api/dashboard/summary?period=today" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer your_jwt_token_here
```

### Token Response Format
```javascript
{
  "success": true,
  "data": {
    "user": {
      "id": "userId",
      "email": "user@example.com",
      "username": "username",
      "role": "owner"
    },
    "token": "jwt_token_here",
    "expiresIn": 604800
  }
}
```

## 📝 Error Handling

All API responses follow this format:

### Success Response
```javascript
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```javascript
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE",
  "errors": ["validation errors"] // Optional
}
```

### Common Error Codes
- `VALIDATION_ERROR` - Input validation failed
- `INVALID_TOKEN` - JWT token is invalid
- `TOKEN_EXPIRED` - JWT token has expired
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `NOT_FOUND` - Resource not found
- `DUPLICATE_ERROR` - Duplicate entry (email, etc.)

## 🧪 Testing

### Health Check
```bash
curl http://localhost:3000/health
```

### Test Authentication
```bash
# Register test user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","username":"testuser","mobileNumber":"1234567890"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

## 🔧 Development

### Run in Development Mode
```bash
npm run dev
```

### View Logs
The server logs all requests and errors to the console. In production, consider using a logging service.

### Database Seeding
To create initial data (admin user, material rates):
```bash
npm run seed
```

## 🚀 Deployment

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://your-production-db-url
JWT_SECRET=your-super-secure-secret-key
```

### Production Start
```bash
npm start
```

## 📊 Monitoring

- Health endpoint: `GET /health`
- Server logs include request details, errors, and performance metrics
- Consider adding monitoring tools like PM2 for production

## 🔒 Security Features

- JWT authentication
- Password hashing with bcrypt
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation
- SQL injection protection (MongoDB)
- File upload limits

---

**Ready to integrate with React Native frontend!** 🚀 