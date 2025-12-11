import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Delete fake orders (orders without wooCommerceOrderId)
const deleteFakeOrders = async () => {
  try {
    await connectDB();

    // Find all users
    const users = await User.find({});
    
    if (users.length === 0) {
      console.log('❌ No users found');
      process.exit(1);
    }

    let totalDeleted = 0;

    for (const user of users) {
      // Delete orders that don't have wooCommerceOrderId (fake/seeded orders)
      const result = await Order.deleteMany({
        userId: user._id,
        $or: [
          { wooCommerceOrderId: { $exists: false } },
          { wooCommerceOrderId: null },
          { wooCommerceOrderId: '' },
        ],
      });

      if (result.deletedCount > 0) {
        console.log(`✅ Deleted ${result.deletedCount} fake orders for user: ${user.email}`);
        totalDeleted += result.deletedCount;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   🗑️  Total fake orders deleted: ${totalDeleted}`);
    console.log(`\n🎉 Cleanup completed!`);
    console.log(`\n💡 Only real WooCommerce orders (with wooCommerceOrderId) remain in database.`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting fake orders:', error);
    process.exit(1);
  }
};

// Run cleanup
deleteFakeOrders();

