import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const updateOrderStatuses = async () => {
  try {
    await connectDB();

    const user = await User.findOne({ isStoreSetup: true });
    if (!user) {
      console.error('❌ No user found with store setup completed.');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email}\n`);

    // Update orders with different statuses
    const statusUpdates = [
      { orderNumber: 'ORD-1001', status: 'Pending', deliveredDate: null },
      { orderNumber: 'ORD-1002', status: 'Processing', deliveredDate: null },
      { orderNumber: 'ORD-1003', status: 'In Transit', deliveredDate: null },
      { orderNumber: 'ORD-1004', status: 'Delivered', deliveredDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
      { orderNumber: 'ORD-1005', status: 'Processing', deliveredDate: null },
    ];

    let updatedCount = 0;

    for (const update of statusUpdates) {
      try {
        const order = await Order.findOne({ 
          orderNumber: update.orderNumber, 
          userId: user._id 
        });

        if (order) {
          await Order.findByIdAndUpdate(order._id, {
            status: update.status,
            deliveredDate: update.deliveredDate,
          });
          console.log(`✅ Updated: ${update.orderNumber} → ${update.status}`);
          updatedCount++;
        } else {
          console.log(`⏭️  Skipped: ${update.orderNumber} (not found)`);
        }
      } catch (error) {
        console.error(`❌ Error updating ${update.orderNumber}:`, error.message);
      }
    }

    console.log(`\n📊 Summary: ${updatedCount} orders updated`);
    console.log(`\n🎉 Status update completed!`);
    console.log(`\n📝 New Statuses:`);
    console.log(`   ORD-1001: Pending (can be confirmed)`);
    console.log(`   ORD-1002: Processing (can be confirmed)`);
    console.log(`   ORD-1003: In Transit (can be confirmed)`);
    console.log(`   ORD-1004: Delivered (already delivered)`);
    console.log(`   ORD-1005: Processing (can be confirmed)`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating orders:', error);
    process.exit(1);
  }
};

updateOrderStatuses();

