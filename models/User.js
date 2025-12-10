import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 6,
      select: false, // Don't return password by default
    },
    storeName: {
      type: String,
      trim: true,
    },
    storeUrl: {
      type: String,
      trim: true,
    },
    storeLogo: {
      type: String, // Path to uploaded file
    },
    shopify: {
      shopDomain: {
        type: String,
        trim: true,
      },
      accessToken: {
        type: String,
        select: false, // Don't return by default
      },
      apiKey: {
        type: String,
        select: false,
      },
      apiSecretKey: {
        type: String,
        select: false,
      },
      isConnected: {
        type: Boolean,
        default: false,
      },
    },
    wooCommerce: {
      storeUrl: {
        type: String,
        trim: true,
      },
      consumerKey: {
        type: String,
        select: false, // Don't return by default
      },
      consumerSecret: {
        type: String,
        select: false,
      },
      secretKey: {
        type: String,
        select: false, // Portal generated secret key for plugin
      },
      isConnected: {
        type: Boolean,
        default: false,
      },
    },
    isStoreSetup: {
      type: Boolean,
      default: false,
    },
    returnPolicy: {
      returnWindow: {
        type: Number,
        default: 30,
      },
      automaticApprovalThreshold: {
        type: Number,
        default: 50,
      },
      refundMethods: {
        bankTransfer: {
          type: Boolean,
          default: true,
        },
        digitalWallet: {
          type: Boolean,
          default: true,
        },
        storeCredit: {
          type: Boolean,
          default: true,
        },
      },
    },
    branding: {
      primaryColor: {
        type: String,
        default: '#FF7F14',
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;

