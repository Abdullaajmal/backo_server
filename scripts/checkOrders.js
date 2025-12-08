import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const checkOrders = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const user = await User.findOne({ isStoreSetup: true });
    if (!user) {
      console.log('❌ No user with store setup found');
      process.exit(1);
    }

    console.log(`📦 Store: ${user.storeName}`);
    console.log(`🔗 Store URL: ${user.storeUrl}\n`);

    const orders = await Order.find({ userId: user._id }).limit(5);
    console.log(`📋 Found ${orders.length} orders:\n`);
    
    orders.forEach((o, index) => {
      console.log(`${index + 1}. Order: ${o.orderNumber}`);
      console.log(`   Email: ${o.customer.email}`);
      console.log(`   Phone: ${o.customer.phone}`);
      console.log(`   Items: ${o.items.length}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

checkOrders();

