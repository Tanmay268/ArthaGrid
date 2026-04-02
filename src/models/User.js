const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
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
            minLength: 8,
            select: false,
        },
        role: {
            type: String,
            enum: Object.values(ROLES),
            default: ROLES.VIEWER,
        },
        isActive: {
            type: boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

//Hashing password before saving
userSchema.pre('save', async function (next){
    if(!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

//Instance method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword){
    return bcrypt.compare(candidatePassword, this.password);
}

const User = mongoose.model('User', userSchema);
module.exports = { User, ROLES };