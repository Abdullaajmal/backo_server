import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

import User from '../models/User.js';

const fixReturnPortal = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/backo_db');
    console.log('✅ Connected to MongoDB');

    // Find user with Shopify connected
    const user = await User.findOne({
      'shopify.isConnected': true,
      'shopify.shopDomain': { $exists: true }
    }).select('+shopify.accessToken');

    if (!user) {
      console.log('❌ No user with Shopify connected found');
      process.exit(1);
    }

    console.log(`📋 Found user: ${user.email}`);
    console.log(`   Shopify Domain: ${user.shopify.shopDomain}`);
    console.log(`   Current storeUrl: ${user.storeUrl || 'NOT SET'}`);
    console.log(`   Current storeName: ${user.storeName || 'NOT SET'}`);
    console.log(`   isStoreSetup: ${user.isStoreSetup}`);

    // Update store information
    const updates = {};
    
    // Set storeUrl from shopDomain if not set
    if (!user.storeUrl && user.shopify.shopDomain) {
      updates.storeUrl = user.shopify.shopDomain;
      console.log(`   ✅ Will set storeUrl to: ${updates.storeUrl}`);
    }

    // Set storeName from shopDomain if not set
    if (!user.storeName && user.shopify.shopDomain) {
      const shopName = user.shopify.shopDomain
        .replace('.myshopify.com', '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      updates.storeName = shopName;
      console.log(`   ✅ Will set storeName to: ${updates.storeName}`);
    }

    // Set isStoreSetup to true if Shopify is connected
    if (user.shopify.isConnected && !user.isStoreSetup) {
      updates.isStoreSetup = true;
      console.log(`   ✅ Will set isStoreSetup to: true`);
    }

    if (Object.keys(updates).length > 0) {
      await User.findByIdAndUpdate(user._id, updates, { new: true });
      console.log('\n✅ Store information updated successfully!');
      
      // Show final state
      const updatedUser = await User.findById(user._id);
      console.log('\n📊 Final State:');
      console.log(`   storeUrl: ${updatedUser.storeUrl}`);
      console.log(`   storeName: ${updatedUser.storeName}`);
      console.log(`   isStoreSetup: ${updatedUser.isStoreSetup}`);
      console.log(`   Shopify Connected: ${updatedUser.shopify.isConnected}`);
      console.log(`   Shopify Domain: ${updatedUser.shopify.shopDomain}`);
    } else {
      console.log('\n✅ Store information is already set correctly!');
    }

    // Test the lookup
    console.log('\n🧪 Testing store lookup...');
    const testUrl = user.shopify.shopDomain || user.storeUrl;
    console.log(`   Testing with URL: ${testUrl}`);
    
    // Test normalized matching
    const normalizeUrl = (url) => {
      if (!url) return '';
      try {
        let normalized = url.trim().toLowerCase();
        normalized = normalized.replace(/^https?:\/\//, '');
        normalized = normalized.replace(/^www\./, '');
        normalized = normalized.replace(/\/$/, '');
        normalized = normalized.split('/')[0];
        return normalized;
      } catch (e) {
        return url.toLowerCase();
      }
    };

    const normalizedUrl = normalizeUrl(testUrl);
    console.log(`   Normalized URL: ${normalizedUrl}`);

    // Try to find user by storeUrl
    let foundUser = await User.findOne({ 
      storeUrl: testUrl,
      $or: [
        { isStoreSetup: true },
        { 'shopify.isConnected': true }
      ]
    });

    if (!foundUser) {
      foundUser = await User.findOne({ 
        'shopify.shopDomain': user.shopify.shopDomain,
        'shopify.isConnected': true
      });
    }

    if (foundUser) {
      console.log(`   ✅ Store lookup successful!`);
      console.log(`      Store Name: ${foundUser.storeName}`);
      console.log(`      Store URL: ${foundUser.storeUrl}`);
    } else {
      console.log(`   ❌ Store lookup failed!`);
    }

    await mongoose.connection.close();
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

fixReturnPortal();

