import Return from '../models/Return.js';
import User from '../models/User.js';
import connectDB from '../config/database.js';

// Delete fake returns (returns without orderId or storeUrl - these are test/fake returns)
const deleteFakeReturns = async () => {
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
      // Delete returns that don't have orderId or storeUrl (fake/test returns)
      // Real returns from portal always have orderId and storeUrl
      const result = await Return.deleteMany({
        userId: user._id,
        $or: [
          { orderId: { $exists: false } },
          { orderId: null },
          { orderId: '' },
          { storeUrl: { $exists: false } },
          { storeUrl: null },
          { storeUrl: '' },
        ],
      });

      if (result.deletedCount > 0) {
        console.log(`✅ Deleted ${result.deletedCount} fake returns for user: ${user.email}`);
        totalDeleted += result.deletedCount;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   🗑️  Total fake returns deleted: ${totalDeleted}`);
    console.log(`\n🎉 Cleanup completed!`);
    console.log(`\n💡 Only real returns (with orderId and storeUrl from return portal) remain in database.`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting fake returns:', error);
    process.exit(1);
  }
};

// Run cleanup
deleteFakeReturns();

