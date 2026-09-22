const mongoose = require('mongoose');

// We only ever store a SHA-256 hash of the refresh token, never the raw
// value — so a database leak alone can't be used to impersonate a session.
const refreshTokenSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        tokenHash: {
            type: String,
            required: true,
            unique: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        revokedAt: {
            type: Date,
            default: null,
        },
        replacedByHash: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
);

// TTL index — MongoDB automatically deletes the document once expiresAt has
// passed, so expired sessions clean themselves up with no cron job needed.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
module.exports = RefreshToken;
