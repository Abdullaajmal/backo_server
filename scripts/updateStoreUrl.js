import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

// Update Store URL
const updateStoreUrl = async () => {
  try {
    await connectDB();

    // Find the user (first user with store setup)
    const user = await User.findOne({ isStoreSetup: true });

    if (!user) {
      console.error('❌ No user found with store setup completed.');
      process.exit(1);
    }

    console.log(`\n📋 Current Store Info:`);
    console.log(`   Store Name: ${user.storeName}`);
    console.log(`   Current Store URL: ${user.storeUrl || 'Not set'}`);

    // Update with actual store URL
    // Option 1: Use Shopify shop domain if connected
    let newStoreUrl = user.storeUrl;

    if (user.shopify?.isConnected && user.shopify.shopDomain) {
      // Use Shopify shop domain as store URL
      const shopDomain = user.shopify.shopDomain;
      // Convert myshopify.com to actual store URL
      if (shopDomain.includes('.myshopify.com')) {
        const shopName = shopDomain.replace('.myshopify.com', '');
        // You can use custom domain if you have one, or use myshopify.com domain
        newStoreUrl = `https://${shopName}.myshopify.com`;
      } else {
        newStoreUrl = `https://${shopDomain}`;
      }
      console.log(`\n🛍️  Shopify shop detected: ${shopDomain}`);
      console.log(`   Using: ${newStoreUrl}`);
    } else {
      // Option 2: Prompt user or use default
      // For now, let's use merchant.myshopify.com as default
      newStoreUrl = 'https://merchant-9706.myshopify.com';
      console.log(`\n⚠️  No Shopify connection found.`);
      console.log(`   Using default: ${newStoreUrl}`);
      console.log(`\n💡 Tip: You can update this in Settings page or run this script again.`);
    }

    // Update store URL
    user.storeUrl = newStoreUrl;
    await user.save();

    console.log(`\n✅ Store URL updated successfully!`);
    console.log(`   New Store URL: ${user.storeUrl}`);
    console.log(`\n🔗 Return Portal URL:`);
    console.log(`   http://localhost:5173/return/${user.storeUrl.replace(/^https?:\/\//, '').replace(/^www\./, '')}`);
    console.log(`\n🎉 Done!`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating store URL:', error);
    process.exit(1);
  }
};

// Run update function
updateStoreUrl();

