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
    customer: {
      name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
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
    },
    status: {
      type: String,
      enum: ['Pending Approval', 'Awaiting Receipt', 'In Inspection', 'Refund Pending', 'Completed', 'Rejected'],
      default: 'Pending Approval',
    },
    reason: {
      type: String,
      enum: ['Wrong Size', 'Defective', 'Not as Described', 'Changed Mind', 'Damaged'],
      required: true,
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
  },
  {
    timestamps: true,
  }
);

const Return = mongoose.model('Return', returnSchema);

export default Return;

