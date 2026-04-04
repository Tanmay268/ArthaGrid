const { AuditLog, AUDIT_ACTIONS } = require('../models/AuditLog');

/**
 * Fire-and-forget audit logger.
 * Never awaited — audit logging must not block the main request cycle.
 */
const log = ({
  action,
  performedBy = null,
  targetResource = null,
  targetId = null,
  changes = null,
  req = null,
  status = 'success',
  reason = null,
}) => {
  const metadata = req
    ? {
        ip:        req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
        endpoint:  req.path,
        method:    req.method,
        requestId: req.id,
      }
    : {};

  AuditLog.create({
    action,
    performedBy,
    targetResource,
    targetId,
    changes,
    metadata,
    status,
    reason,
  }).catch(err => {
    console.error('[AuditLog] Write failed:', err.message);
  });
};

module.exports = { log, AUDIT_ACTIONS };
