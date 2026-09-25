const crypto = require('crypto');

// Timing-safe string comparison. crypto.timingSafeEqual throws on buffers of
// different lengths, so the length check comes first (it leaks only the
// length, which isn't the secret).
const safeEqual = (expected, provided) => {
    const a = Buffer.from(String(expected || ''));
    const b = Buffer.from(String(provided || ''));
    return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = safeEqual;
