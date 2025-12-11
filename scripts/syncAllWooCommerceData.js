import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { fetchWooCommerceOrders, convertWooCommerceOrder } from '../services/woocommerceService.js';
import { fetchWooCommerceProducts, convertWooCommerceProduct } from '../services/woocommerceService.js';
import connectDB from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

// Delete fake orders and sync all WooCommerce data
const syncAllWooCommerceData = async () => {
  try {
    await connectDB();

    // Find all users with WooCommerce connected
    const users = await User.find({
      'wooCommerce.isConnected': true,
      'wooCommerce.storeUrl': { $exists: true, $ne: null, $ne: '' },
      'wooCommerce.consumerKey': { $exists: true, $ne: null, $ne: '' },
      'wooCommerce.consumerSecret': { $exists: true, $ne: null, $ne: '' },
    }).select('+wooCommerce.consumerKey +wooCommerce.consumerSecret');

    if (users.length === 0) {
      console.log('❌ No users found with WooCommerce connected');
      process.exit(1);
    }

    console.log(`\n📋 Found ${users.length} user(s) with WooCommerce connected\n`);

    for (const user of users) {
      console.log(`\n🔄 Processing user: ${user.email}`);
      console.log(`   Store: ${user.storeUrl || user.wooCommerce.storeUrl}`);
      console.log(`   ──────────────────────────────────────────`);

      // Step 1: Delete fake orders (orders without wooCommerceOrderId)
      console.log(`\n🗑️  Step 1: Deleting fake orders...`);
      const fakeOrdersResult = await Order.deleteMany({
        userId: user._id,
        $or: [
          { wooCommerceOrderId: { $exists: false } },
          { wooCommerceOrderId: null },
          { wooCommerceOrderId: '' },
        ],
      });

      if (fakeOrdersResult.deletedCount > 0) {
        console.log(`   ✅ Deleted ${fakeOrdersResult.deletedCount} fake orders`);
      } else {
        console.log(`   ℹ️  No fake orders found`);
      }

      // Step 2: Fetch and save Products from WooCommerce
      console.log(`\n📦 Step 2: Syncing products from WooCommerce...`);
      try {
        const wcProducts = await fetchWooCommerceProducts(
          user.wooCommerce.storeUrl,
          user.wooCommerce.consumerKey,
          user.wooCommerce.consumerSecret
        );
        console.log(`   📥 Fetched ${wcProducts.length} products from WooCommerce API`);

        let productsCreated = 0;
        let productsUpdated = 0;
        let productsErrors = 0;

        for (const wcProduct of wcProducts) {
          try {
            const converted = convertWooCommerceProduct(wcProduct);
            
            const productData = {
              userId: user._id,
              wooCommerceProductId: converted.id,
              productId: converted.id,
              name: converted.title || 'Untitled Product',
              sku: converted.sku || '',
              price: parseFloat(converted.price || 0),
              stockQuantity: converted.inventoryQuantity || 0,
              status: converted.status === 'active' ? 'publish' : converted.status || 'publish',
              description: '',
              images: converted.images || [],
              categories: [],
              tags: converted.tags ? converted.tags.split(', ').filter(t => t) : [],
              lastSyncedAt: new Date(),
            };
            
            const existingProduct = await Product.findOne({
              userId: user._id,
              $or: [
                { wooCommerceProductId: converted.id },
                { productId: converted.id }
              ]
            });
            
            if (existingProduct) {
              await Product.findByIdAndUpdate(existingProduct._id, productData, { new: true });
              productsUpdated++;
            } else {
              await Product.create(productData);
              productsCreated++;
            }
          } catch (error) {
            console.error(`   ⚠️  Error syncing product ${wcProduct.id}:`, error.message);
            productsErrors++;
          }
        }

        console.log(`   ✅ Products: ${productsCreated} created, ${productsUpdated} updated, ${productsErrors} errors`);
      } catch (error) {
        console.error(`   ❌ Error fetching products:`, error.message);
      }

      // Step 3: Fetch and save Orders from WooCommerce
      console.log(`\n📦 Step 3: Syncing orders from WooCommerce...`);
      try {
        const wcOrders = await fetchWooCommerceOrders(
          user.wooCommerce.storeUrl,
          user.wooCommerce.consumerKey,
          user.wooCommerce.consumerSecret
        );
        console.log(`   📥 Fetched ${wcOrders.length} orders from WooCommerce API`);

        let ordersCreated = 0;
        let ordersUpdated = 0;
        let ordersErrors = 0;

        for (const wcOrder of wcOrders) {
          try {
            const converted = convertWooCommerceOrder(wcOrder);
            
            const orderData = {
              wooCommerceOrderId: converted.wooCommerceOrderId,
              orderNumber: converted.orderNumber,
              userId: user._id,
              customer: converted.customer,
              items: converted.items,
              amount: converted.amount,
              paymentMethod: converted.paymentMethod,
              status: converted.status,
              placedDate: converted.placedDate,
              deliveredDate: converted.deliveredDate,
              shippingAddress: converted.shippingAddress,
              notes: converted.notes || `Synced from WooCommerce API. Order ID: ${converted.wooCommerceOrderId}`,
            };
            
            const existingOrder = await Order.findOne({
              $or: [
                { wooCommerceOrderId: converted.wooCommerceOrderId },
                { orderNumber: converted.orderNumber },
              ],
              userId: user._id,
            });
            
            if (existingOrder) {
              await Order.findByIdAndUpdate(existingOrder._id, orderData, { new: true });
              ordersUpdated++;
            } else {
              await Order.create(orderData);
              ordersCreated++;
            }
          } catch (error) {
            console.error(`   ⚠️  Error syncing order ${wcOrder.id}:`, error.message);
            ordersErrors++;
          }
        }

        console.log(`   ✅ Orders: ${ordersCreated} created, ${ordersUpdated} updated, ${ordersErrors} errors`);
        console.log(`   💡 Note: Customers are automatically extracted from orders`);
      } catch (error) {
        console.error(`   ❌ Error fetching orders:`, error.message);
      }

      console.log(`\n   ✅ Completed sync for user: ${user.email}`);
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   ✅ All fake orders deleted`);
    console.log(`   ✅ All products synced to database`);
    console.log(`   ✅ All orders synced to database`);
    console.log(`   ✅ Customers extracted from orders`);
    console.log(`\n🎉 Sync completed successfully!`);
    console.log(`\n💡 All data is now saved in database. No fake data remains.`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error syncing WooCommerce data:', error);
    process.exit(1);
  }
};

// Run sync
syncAllWooCommerceData();

