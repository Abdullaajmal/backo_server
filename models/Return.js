import mongoose from 'mongoose';

const returnSchema = new mongoose.Schema(
  {
    returnId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderId: {
      type: String,
      required: true,
    },
    storeUrl: {
      type: String,
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
    product: {
      name: {
        type: String,
        required: true,
      },
      sku: {
        type: String,
      },
      price: {
        type: Number,
      },
      quantity: {
        type: Number,
        default: 1,
      },
    },
    status: {
      type: String,
      enum: ['Pending Approval', 'Awaiting Receipt', 'In Inspection', 'Refund Pending', 'Completed', 'Rejected'],
      default: 'Pending Approval',
    },
    reason: {
      type: String,
      enum: ['Wrong Size', 'Defective / Damaged', 'Not as Described', 'Changed Mind', 'Received Wrong Item', 'Other'],
      required: true,
    },
    preferredResolution: {
      type: String,
      enum: ['refund', 'exchange', 'store-credit'],
      default: 'refund',
    },
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    refundMethod: {
      type: String,
      enum: ['Bank Transfer', 'Digital Wallet', 'Store Credit'],
    },
    notes: {
      type: String,
    },
    photos: [{
      type: String, // Path to uploaded file
    }],
    returnAddress: {
      type: String,
    },
    timeline: [{
      step: String,
      date: Date,
      description: String,
      completed: {
        type: Boolean,
        default: false,
      },
    }],
  },
  {
    timestamps: true,
  }
);

const Return = mongoose.model('Return', returnSchema);

export default Return;

