import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB already connected');
      return;
    }

    // Check if MONGODB_URI is set
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI is not set!');
      throw new Error('MONGODB_URI environment variable is not set');
    }

    console.log('Attempting to connect to MongoDB...');
    console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
    console.log('MONGODB_URI length:', process.env.MONGODB_URI?.length);
    console.log('MONGODB_URI starts with:', process.env.MONGODB_URI?.substring(0, 30));
    
    // Clean the connection string (remove any extra spaces or newlines)
    const mongoUri = process.env.MONGODB_URI.trim();
    
    // Validate connection string format
    if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
      throw new Error(`Invalid MongoDB URI format. Must start with "mongodb://" or "mongodb+srv://". Got: ${mongoUri.substring(0, 30)}...`);
    }

    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    // Don't exit process in Vercel serverless functions
    if (process.env.VERCEL !== '1') {
      process.exit(1);
    }
    throw error;
  }
};

export default connectDB;

