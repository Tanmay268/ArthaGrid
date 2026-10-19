const jwt = require('jsonwebtoken');
const  { User } = require('../models/User');
const ApiError = require('../utils/ApiError');

const { DEMO, LIVE, runWithTenant } = require('../config/tenant');
const { findRestriction } = require('../config/demoRestrictions');

const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if(!authHeader || !authHeader.startsWith('Bearer ')){
        throw ApiError.unauthorized('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Demo tokens are signed with demo:true and resolve against the separate
    // demo database; everything downstream inherits that tenant.
    const tenant = decoded.demo ? DEMO : LIVE;

    const user = await runWithTenant(tenant, () => User.findById(decoded.id).select('+isActive'));
    if(!user) throw ApiError.unauthorized('User no longer exist');
    if(!user.isActive) throw ApiError.forbidden('Account has beed deactivated');

    // Demo accounts see every feature, but a few critical ones stay locked
    // whatever the role (see config/demoRestrictions.js).
    if (tenant === DEMO) {
        const restricted = findRestriction(req.method, req.originalUrl);
        if (restricted) {
            throw new ApiError(
                403,
                `${restricted.label} is a restricted feature on demo accounts.`,
                [{ code: 'DEMO_RESTRICTED', feature: restricted.key }]
            );
        }
    }

    req.user = user;  //Attach to request for downstream use
    runWithTenant(tenant, () => next());
};

module.exports = authenticate;
