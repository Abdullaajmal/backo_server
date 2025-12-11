import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    wooCommerceProductId: {
      type: String,
      index: true,
    },
    shopifyProductId: {
      type: String,
      index: true,
    },
    productId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      default: 0,
    },
    stockQuantity: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      default: 'publish',
    },
    description: {
      type: String,
      default: '',
    },
    images: [{
      src: String,
      alt: String,
    }],
    categories: [String],
    tags: [String],
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
productSchema.index({ userId: 1, wooCommerceProductId: 1 });
productSchema.index({ userId: 1, shopifyProductId: 1 });
productSchema.index({ userId: 1, productId: 1 });

export default mongoose.model('Product', productSchema);

