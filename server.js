import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import connectDB from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import returnRoutes from './routes/returnRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import productRoutes from './routes/productRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';

// Load env vars
dotenv.config();

const app = express();

// Connect to database
// In Vercel, we'll connect lazily on first request
let dbConnectionPromise = null;

const ensureDBConnection = async () => {
  if (!dbConnectionPromise) {
    dbConnectionPromise = connectDB().catch(err => {
      console.error('DB connection failed:', err);
      dbConnectionPromise = null; // Reset on failure
      throw err;
    });
  }
  return dbConnectionPromise;
};

// For local development, connect immediately
if (process.env.VERCEL !== '1') {
  connectDB();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware - CORS with dynamic origin support
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, WordPress plugins, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'https://backo-client.vercel.app',
      'https://backo-client-git-main-abdullaajmal.vercel.app',
    ];
    
    // Allow all Vercel preview deployments
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    
    // Allow WordPress origins (localhost WordPress installations)
    if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('wp-admin')) {
      return callback(null, true);
    }
    
    // Allow any HTTP/HTTPS origin in development (for WordPress plugin testing)
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Backo-Secret-Key'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory (only in non-Vercel environments)
if (process.env.VERCEL !== '1') {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Database connection middleware for Vercel (must be before routes)
// Only connect for API routes, not for health check
if (process.env.VERCEL === '1') {
  app.use(async (req, res, next) => {
    // Skip DB connection for health check
    if (req.path === '/api/health') {
      return next();
    }
    
    try {
      await ensureDBConnection();
      next();
    } catch (error) {
      console.error('Database connection error:', error);
      console.error('MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
      // Return error response instead of blocking
      return res.status(500).json({
        success: false,
        message: 'Database connection failed. Please check your MongoDB URI.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
}

// API root route - helpful message
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'BACKO API Server is running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      store: '/api/store',
      dashboard: '/api/dashboard',
      orders: '/api/orders',
      returns: '/api/returns',
      customers: '/api/customers',
      analytics: '/api/analytics',
      settings: '/api/settings',
      products: '/api/products',
      webhook: '/api/webhook',
      health: '/api/health'
    },
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/products', productRoutes);
app.use('/api/webhook', webhookRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'BACKO API Server is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum 2MB allowed.',
      });
    }
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server Error',
  });
});

// Export app for Vercel serverless functions
export default app;

// Only start server if not in Vercel environment
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

