# BACKO Server - Backend API

Backend server for BACKO merchant platform built with Node.js, Express, and MongoDB.

## Features

- User authentication (Register/Login) with JWT
- Store setup with file upload
- MongoDB database integration
- File upload handling (Store logo - max 2MB)
- Protected routes with JWT authentication
- RESTful API design

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)

## Installation

1. Navigate to server directory:
```bash
cd backo_server
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file in the `backo_server` directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/backo_db
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d
NODE_ENV=development
```

4. Make sure MongoDB is running on your system (if using local MongoDB):
```bash
# Windows (if MongoDB is installed as service, it should auto-start)
# Or start manually:
mongod
```

## Running the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Server will run on `http://localhost:5000`

## API Endpoints

### Authentication Routes

- `POST /api/auth/register` - Register new user
  - Body: `{ email: string, password: string }`

- `POST /api/auth/login` - Login user
  - Body: `{ email: string, password: string }`

- `GET /api/auth/me` - Get current user (Protected)
  - Headers: `Authorization: Bearer <token>`

### Store Routes

- `POST /api/store/setup` - Setup store (Protected)
  - Headers: `Authorization: Bearer <token>`
  - Body (FormData): `{ storeName: string, storeUrl: string, storeLogo: file (optional) }`

- `GET /api/store` - Get store info (Protected)
  - Headers: `Authorization: Bearer <token>`

- `PUT /api/store` - Update store info (Protected)
  - Headers: `Authorization: Bearer <token>`
  - Body (FormData): `{ storeName: string, storeUrl: string, storeLogo: file (optional) }`

### Health Check

- `GET /api/health` - Check server status

## Project Structure

```
backo_server/
├── config/
│   ├── database.js      # MongoDB connection
│   └── multer.js        # File upload configuration
├── controllers/
│   ├── authController.js    # Authentication logic
│   └── storeController.js   # Store management logic
├── middleware/
│   └── auth.js          # JWT authentication middleware
├── models/
│   └── User.js          # User/Store model
├── routes/
│   ├── authRoutes.js    # Authentication routes
│   └── storeRoutes.js   # Store routes
├── uploads/             # Uploaded files directory
├── utils/
│   └── generateToken.js # JWT token generation
├── .env                 # Environment variables (create this)
├── .gitignore
├── package.json
└── server.js           # Entry point
```

## Notes

- Uploaded files are stored in the `uploads/` directory
- Files are served statically at `/uploads/filename`
- JWT tokens expire after 7 days (configurable)
- File size limit: 2MB for store logo
- Supported image formats: PNG, JPG, JPEG

