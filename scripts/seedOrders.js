import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Order from '../models/Order.js';
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
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Sample orders data - Different statuses for testing
const sampleOrders = [
  {
    orderNumber: 'ORD-1001',
    customer: {
      name: 'Ahmed Khan',
      email: 'ahmed@example.com',
      phone: '+92 300 1234567',
    },
    items: [
      {
        productName: 'Premium T-Shirt',
        quantity: 2,
        price: 1500,
      },
      {
        productName: 'Jeans Pants',
        quantity: 1,
        price: 3500,
      },
    ],
    amount: 6500,
    paymentMethod: 'Prepaid',
    status: 'Pending', // Pending status for testing
    placedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    deliveredDate: null, // Not delivered yet
    shippingAddress: {
      street: '123 Main Street',
      city: 'Karachi',
      state: 'Sindh',
      zipCode: '75000',
      country: 'Pakistan',
    },
  },
  {
    orderNumber: 'ORD-1002',
    customer: {
      name: 'Sara Ali',
      email: 'sara@example.com',
      phone: '+92 321 9876543',
    },
    items: [
      {
        productName: 'Cotton Shirt',
        quantity: 1,
        price: 2000,
      },
      {
        productName: 'Sneakers',
        quantity: 1,
        price: 5000,
      },
    ],
    amount: 7000,
    paymentMethod: 'COD',
    status: 'Processing', // Processing status for testing
    placedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    deliveredDate: null,
    shippingAddress: {
      street: '456 Park Avenue',
      city: 'Lahore',
      state: 'Punjab',
      zipCode: '54000',
      country: 'Pakistan',
    },
  },
  {
    orderNumber: 'ORD-1003',
    customer: {
      name: 'Hassan Raza',
      email: 'hassan@example.com',
      phone: '+92 333 5555555',
    },
    items: [
      {
        productName: 'Watch',
        quantity: 1,
        price: 8000,
      },
    ],
    amount: 8000,
    paymentMethod: 'Prepaid',
    status: 'In Transit', // In Transit status for testing
    placedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    deliveredDate: null,
    shippingAddress: {
      street: '789 Business Plaza',
      city: 'Islamabad',
      state: 'Capital',
      zipCode: '44000',
      country: 'Pakistan',
    },
  },
  {
    orderNumber: 'ORD-1004',
    customer: {
      name: 'Fatima Sheikh',
      email: 'fatima@example.com',
      phone: '+92 345 1111111',
    },
    items: [
      {
        productName: 'Handbag',
        quantity: 1,
        price: 4500,
      },
      {
        productName: 'Sunglasses',
        quantity: 2,
        price: 1500,
      },
    ],
    amount: 7500,
    paymentMethod: 'Prepaid',
    status: 'Delivered', // One delivered order
    placedDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
    deliveredDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    shippingAddress: {
      street: '321 Garden Road',
      city: 'Karachi',
      state: 'Sindh',
      zipCode: '75500',
      country: 'Pakistan',
    },
  },
  {
    orderNumber: 'ORD-1005',
    customer: {
      name: 'Usman Malik',
      email: 'usman@example.com',
      phone: '+92 322 2222222',
    },
    items: [
      {
        productName: 'Laptop Bag',
        quantity: 1,
        price: 3000,
      },
      {
        productName: 'USB Drive',
        quantity: 3,
        price: 500,
      },
    ],
    amount: 4500,
    paymentMethod: 'COD',
    status: 'Processing', // Another processing order
    placedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    deliveredDate: null,
    shippingAddress: {
      street: '654 Tech Street',
      city: 'Lahore',
      state: 'Punjab',
      zipCode: '54700',
      country: 'Pakistan',
    },
  },
  {
    orderNumber: 'ORD-1006',
    customer: {
      name: 'Ali Hassan',
      email: 'ali@example.com',
      phone: '+92 311 9999999',
    },
    items: [
      {
        productName: 'Sports Shoes',
        quantity: 1,
        price: 5500,
      },
      {
        productName: 'Sports Socks',
        quantity: 3,
        price: 300,
      },
    ],
    amount: 6400,
    paymentMethod: 'Prepaid',
    status: 'Delivered', // Another delivered order for testing
    placedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    deliveredDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    shippingAddress: {
      street: '789 Sports Avenue',
      city: 'Islamabad',
      state: 'Capital',
      zipCode: '44000',
      country: 'Pakistan',
    },
  },
];

// Seed function
const seedOrders = async () => {
  try {
    await connectDB();

    // Find the first user who has completed store setup
    const user = await User.findOne({ isStoreSetup: true });

    if (!user) {
      console.error('❌ No user found with store setup completed.');
      console.log('💡 Please complete store setup first, then run this script again.');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email}`);
    console.log(`✅ Store: ${user.storeName} (${user.storeUrl})`);

    // Delete existing test orders for this user (optional - comment out if you want to keep existing orders)
    // await Order.deleteMany({ userId: user._id, orderNumber: { $regex: '^ORD-1' } });
    // console.log('🗑️  Deleted existing test orders');

    // Create orders
    let createdCount = 0;
    let skippedCount = 0;

    for (const orderData of sampleOrders) {
      try {
        // Check if order already exists
        const existingOrder = await Order.findOne({
          orderNumber: orderData.orderNumber,
          userId: user._id,
        });

        if (existingOrder) {
          console.log(`⏭️  Skipped: ${orderData.orderNumber} (already exists)`);
          skippedCount++;
          continue;
        }

        // Create order
        await Order.create({
          ...orderData,
          userId: user._id,
        });

        console.log(`✅ Created: ${orderData.orderNumber} - ${orderData.customer.name}`);
        createdCount++;
      } catch (error) {
        console.error(`❌ Error creating order ${orderData.orderNumber}:`, error.message);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Created: ${createdCount} orders`);
    console.log(`   ⏭️  Skipped: ${skippedCount} orders`);
    console.log(`\n🎉 Seeding completed!`);
    console.log(`\n📝 Test with these orders:`);
    console.log(`   Order ID: ORD-1001, Email: ahmed@example.com (Status: Pending)`);
    console.log(`   Order ID: ORD-1002, Email: sara@example.com (Status: Processing)`);
    console.log(`   Order ID: ORD-1003, Email: hassan@example.com (Status: In Transit)`);
    console.log(`   ✅ Order ID: ORD-1004, Email: fatima@example.com (Status: Delivered - Ready for Return)`);
    console.log(`   Order ID: ORD-1005, Email: usman@example.com (Status: Processing)`);
    console.log(`   ✅ Order ID: ORD-1006, Email: ali@example.com (Status: Delivered - Ready for Return)`);
    console.log(`\n💡 Portal Test:`);
    console.log(`   1. Open: http://localhost:5173/return/YOUR_STORE_URL`);
    console.log(`   2. Enter Order ID: ORD-1004 or ORD-1006`);
    console.log(`   3. Enter Email: fatima@example.com or ali@example.com`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding orders:', error);
    process.exit(1);
  }
};

// Run seed function
seedOrders();

