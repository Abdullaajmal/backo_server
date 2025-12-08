import mongoose from 'mongoose';

const connectDB = async (retries = 3, delay = 5000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Check if already connected
      if (mongoose.connection.readyState === 1) {
        console.log('✅ MongoDB already connected');
        return;
      }

      // Check if MONGODB_URI is set
      if (!process.env.MONGODB_URI) {
        console.error('❌ MONGODB_URI is not set!');
        throw new Error('MONGODB_URI environment variable is not set');
      }

      if (attempt === 1) {
        console.log('🔄 Attempting to connect to MongoDB...');
      } else {
        console.log(`🔄 Retrying MongoDB connection... (Attempt ${attempt}/${retries})`);
      }
      
      // Clean the connection string (remove any extra spaces or newlines)
      const mongoUri = process.env.MONGODB_URI.trim();
      
      // Validate connection string format
      if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
        throw new Error(`Invalid MongoDB URI format. Must start with "mongodb://" or "mongodb+srv://". Got: ${mongoUri.substring(0, 30)}...`);
      }

      // Check if database name is present
      if (!mongoUri.includes('/?') && !mongoUri.match(/\/[^\/\?]+(\?|$)/)) {
        console.warn('⚠️  Warning: Database name might be missing in connection string.');
        console.warn('   Add database name after host: mongodb+srv://...@cluster.../DATABASE_NAME?...');
      }

      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 30000, // 30 seconds timeout
        socketTimeoutMS: 45000,
        retryWrites: true,
        w: 'majority',
        maxPoolSize: 10, // Maximum connections in pool
        minPoolSize: 1, // Minimum connections in pool
      });

      console.log(`✅ MongoDB Connected Successfully!`);
      console.log(`   Host: ${conn.connection.host}`);
      console.log(`   Database: ${conn.connection.name}`);
      console.log(`   Ready State: ${conn.connection.readyState} (1 = connected)`);
      return conn;
    } catch (error) {
      console.error(`\n❌ MongoDB Connection Error (Attempt ${attempt}/${retries}):`);
      console.error(`   Message: ${error.message}`);
      console.error(`   Code: ${error.code || 'N/A'}`);
      
      // Provide helpful error messages based on error type
      if (error.code === 'ESERVFAIL') {
        console.error('\n⚠️  DNS Resolution Failed!');
        console.error('   Solutions:');
        console.error('   1. Check internet connection');
        console.error('   2. MongoDB Atlas cluster might be paused - unpause it');
        console.error('   3. Verify cluster URL is correct in connection string');
        console.error('   4. Check firewall/network settings');
      } else if (error.code === 'ENOTFOUND') {
        console.error('\n⚠️  Host Not Found!');
        console.error('   Solutions:');
        console.error('   1. Check cluster URL in connection string');
        console.error('   2. Verify MongoDB Atlas cluster is active');
      } else if (error.message.includes('authentication')) {
        console.error('\n⚠️  Authentication Failed!');
        console.error('   Solutions:');
        console.error('   1. Check username and password in connection string');
        console.error('   2. URL encode special characters in password (@ → %40, # → %23)');
        console.error('   3. Verify database user exists in MongoDB Atlas');
      } else if (error.message.includes('timeout')) {
        console.error('\n⚠️  Connection Timeout!');
        console.error('   Solutions:');
        console.error('   1. Check internet connection speed');
        console.error('   2. MongoDB Atlas cluster might be slow to respond');
        console.error('   3. Try again after a few seconds');
      }

      // If this was the last attempt, throw error
      if (attempt === retries) {
        console.error('\n❌ Failed to connect after', retries, 'attempts');
        
        if (process.env.VERCEL !== '1') {
          console.error('\n💡 Quick Fix Steps:');
          console.error('   1. Open MongoDB Atlas: https://cloud.mongodb.com');
          console.error('   2. Check if cluster is Active (not paused)');
          console.error('   3. Click "Connect" → "Connect your application"');
          console.error('   4. Copy connection string and update .env file');
          console.error('   5. Make sure database name is in connection string: /backo');
          console.error('\n❌ Server cannot start without database connection.\n');
          process.exit(1);
        }
        throw error;
      }

      // Wait before retrying
      console.log(`⏳ Waiting ${delay/1000} seconds before retry...\n`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

export default connectDB;

