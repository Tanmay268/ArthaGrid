// Single place deciding whether rate limiters are bypassed, so the global,
// auth, and copilot limiters can't drift apart.
//
// Tests always bypass. Load testing needs to as well (a 300-req/15-min cap
// makes any throughput measurement meaningless), via DISABLE_RATE_LIMIT=true
// — but that switch is ignored when NODE_ENV=production, so it can't be left
// on by accident on a real deployment.
const shouldSkipRateLimit = () => {
    if (process.env.NODE_ENV === 'test') return true;
    return process.env.DISABLE_RATE_LIMIT === 'true' && process.env.NODE_ENV !== 'production';
};

module.exports = { shouldSkipRateLimit };
