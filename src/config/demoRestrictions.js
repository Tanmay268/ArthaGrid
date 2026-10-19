// Features that stay locked on demo accounts no matter the role — even a demo
// admin. Everything else (reading every page, and creating/editing/deleting
// transactions and budgets) works, because demo data lives in its own
// database and can't affect real accounts.
//
// Single source of truth: the authenticate middleware enforces it, and the
// labels are sent to the frontend so it can tell visitors exactly what is
// restricted.

const RESTRICTED = [
    {
        key: 'profile_settings',
        label: 'Editing the profile, password and email-report settings',
        method: 'PATCH',
        pattern: /^\/api\/v1\/users\/me$/,
    },
    {
        key: 'user_management',
        label: 'Changing other users’ roles or details',
        method: 'PATCH',
        pattern: /^\/api\/v1\/users\/[^/]+$/,
    },
    {
        key: 'user_deactivation',
        label: 'Deactivating users',
        method: 'PATCH',
        pattern: /^\/api\/v1\/users\/[^/]+\/deactivate$/,
    },
];

// Catch-all: ANY write under /users is locked for demo accounts (name, email,
// password, role, status…), so a profile field can never slip through via a
// route or field added later. Checked after the specific entries above so
// they keep their own, more precise messages.
const ANY_USER_WRITE = {
    key: 'profile_changes',
    label: 'Changing account or profile details (name, email, password)',
    pattern: /^\/api\/v1\/users(\/.*)?$/,
};
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const findRestriction = (method, originalUrl) => {
    const path = originalUrl.split('?')[0].replace(/\/+$/, '');
    const specific = RESTRICTED.find((r) => r.method === method && r.pattern.test(path));
    if (specific) return specific;
    if (!SAFE_METHODS.has(method) && ANY_USER_WRITE.pattern.test(path)) return ANY_USER_WRITE;
    return null;
};

const demoRestrictionLabels = () => [...RESTRICTED, ANY_USER_WRITE].map((r) => r.label);

module.exports = { findRestriction, demoRestrictionLabels, RESTRICTED };
