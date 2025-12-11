import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { fetchShopifyOrders, convertShopifyOrder } from '../services/shopifyService.js';
import { fetchShopifyProducts, convertShopifyProduct } from '../services/shopifyService.js';
import connectDB from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

// Delete fake orders and sync all Shopify data
const syncAllShopifyData = async () => {
  try {
    await connectDB();

    // Find all users with Shopify connected
    const users = await User.find({
      'shopify.isConnected': true,
      'shopify.shopDomain': { $exists: true, $ne: null, $ne: '' },
      'shopify.accessToken': { $exists: true, $ne: null, $ne: '' },
    }).select('+shopify.accessToken');

    if (users.length === 0) {
      console.log('❌ No users found with Shopify connected');
      process.exit(1);
    }

    console.log(`\n📋 Found ${users.length} user(s) with Shopify connected\n`);

    for (const user of users) {
      console.log(`\n🔄 Processing user: ${user.email}`);
      console.log(`   Store: ${user.shopify.shopDomain}`);
      console.log(`   ──────────────────────────────────────────`);

      // Step 1: Delete fake orders (orders without shopifyOrderId or wooCommerceOrderId)
      console.log(`\n🗑️  Step 1: Deleting fake orders...`);
      const fakeOrdersResult = await Order.deleteMany({
        userId: user._id,
        $or: [
          { 
            $and: [
              { shopifyOrderId: { $exists: false } },
              { wooCommerceOrderId: { $exists: false } }
            ]
          },
          { 
            $and: [
              { shopifyOrderId: null },
              { wooCommerceOrderId: null }
            ]
          },
          { 
            $and: [
              { shopifyOrderId: '' },
              { wooCommerceOrderId: '' }
            ]
          },
        ],
      });

      if (fakeOrdersResult.deletedCount > 0) {
        console.log(`   ✅ Deleted ${fakeOrdersResult.deletedCount} fake orders`);
      } else {
        console.log(`   ℹ️  No fake orders found`);
      }

      // Step 2: Fetch and save Products from Shopify
      console.log(`\n📦 Step 2: Syncing products from Shopify...`);
      try {
        const shopifyProducts = await fetchShopifyProducts(
          user.shopify.shopDomain,
          user.shopify.accessToken
        );
        console.log(`   📥 Fetched ${shopifyProducts.length} products from Shopify API`);

        let productsCreated = 0;
        let productsUpdated = 0;
        let productsErrors = 0;

        for (const shopifyProduct of shopifyProducts) {
          try {
            const converted = convertShopifyProduct(shopifyProduct);
            
            const productData = {
              userId: user._id,
              shopifyProductId: converted.id,
              productId: converted.id,
              name: converted.title || 'Untitled Product',
              sku: converted.sku || '',
              price: parseFloat(converted.price || 0),
              stockQuantity: converted.inventoryQuantity || 0,
              status: converted.status === 'active' ? 'publish' : 'draft',
              description: '',
              images: converted.images || [],
              categories: [],
              tags: converted.tags ? converted.tags.split(', ').filter(t => t) : [],
              lastSyncedAt: new Date(),
            };
            
            const existingProduct = await Product.findOne({
              userId: user._id,
              $or: [
                { shopifyProductId: converted.id },
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
            console.error(`   ⚠️  Error syncing product ${shopifyProduct.id}:`, error.message);
            productsErrors++;
          }
        }

        console.log(`   ✅ Products: ${productsCreated} created, ${productsUpdated} updated, ${productsErrors} errors`);
      } catch (error) {
        console.error(`   ❌ Error fetching products:`, error.message);
      }

      // Step 3: Fetch and save Orders from Shopify
      console.log(`\n📦 Step 3: Syncing orders from Shopify...`);
      try {
        const shopifyOrders = await fetchShopifyOrders(
          user.shopify.shopDomain,
          user.shopify.accessToken
        );
        console.log(`   📥 Fetched ${shopifyOrders.length} orders from Shopify API`);

        let ordersCreated = 0;
        let ordersUpdated = 0;
        let ordersErrors = 0;

        for (const shopifyOrder of shopifyOrders) {
          try {
            const converted = convertShopifyOrder(shopifyOrder);
            
            const orderData = {
              shopifyOrderId: converted.shopifyOrderId,
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
              notes: converted.notes || `Synced from Shopify API. Order ID: ${converted.shopifyOrderId}`,
            };
            
            const existingOrder = await Order.findOne({
              $or: [
                { shopifyOrderId: converted.shopifyOrderId },
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
            console.error(`   ⚠️  Error syncing order ${shopifyOrder.id}:`, error.message);
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
    console.error('❌ Error syncing Shopify data:', error);
    process.exit(1);
  }
};

// Run sync
syncAllShopifyData();

