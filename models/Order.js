import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    shopifyOrderId: {
      type: String,
      unique: true,
      sparse: true,
    },
    orderNumber: {
      type: String,
      required: true,
      // Store normalized order number (without # prefix) to ensure consistency
      index: true, // Index for faster queries
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customer: {
      name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
      },
    },
    items: [
      {
        productName: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],
    amount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['COD', 'Prepaid'],
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'In Transit', 'Delivered', 'Cancelled'],
      default: 'Processing',
    },
    placedDate: {
      type: Date,
      default: Date.now,
    },
    deliveredDate: {
      type: Date,
    },
    shippingAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model('Order', orderSchema);

export default Order;

