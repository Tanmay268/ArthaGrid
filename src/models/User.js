const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
<<<<<<< HEAD
const { boolean } = require('joi');

const ROLES = {
    VIEWER: 'viewer',
    ANALYST: 'analyst',
    ADMIN: 'admin',
};

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minLength: 2,
            maxLength: 100,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minLength: 6,
            select: false,
        },
        role: {
            type: String,
            enum: Object.values(ROLES),
            default: ROLES.VIEWER,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        // Powers the admin dashboard's "active users" number.
        lastLoginAt: {
            type: Date,
            default: null,
        },
        preferences: {
            // Opt-in only — nobody gets an email they didn't ask for.
            weeklyReport: {
                type: Boolean,
                default: false,
            },
        },
    },
    {
        timestamps: true,
    }
);

//Hashing password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 12);
});

//Instance method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword){
    return bcrypt.compare(candidatePassword, this.password);
}
=======

const ROLES = {
  VIEWER:  'viewer',
  ANALYST: 'analyst',
  ADMIN:   'admin',
};

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.VIEWER,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Never return password in toJSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5

const User = mongoose.model('User', userSchema);
module.exports = { User, ROLES };
