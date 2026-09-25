const mongoose = require('mongoose');

const AUDIT_ACTIONS = {
  USER_REGISTER:      'USER_REGISTER',
  USER_LOGIN:         'USER_LOGIN',
  USER_LOGIN_FAIL:    'USER_LOGIN_FAIL',
  USER_DEACTIVATE:    'USER_DEACTIVATE',
  USER_ACTIVATE:      'USER_ACTIVATE',
  USER_ROLE_CHANGE:   'USER_ROLE_CHANGE',
  TRANSACTION_CREATE: 'TRANSACTION_CREATE',
  TRANSACTION_UPDATE: 'TRANSACTION_UPDATE',
  TRANSACTION_DELETE: 'TRANSACTION_DELETE',
};

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: Object.values(AUDIT_ACTIONS),
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    targetResource: { type: String, default: null },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    changes: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: {
      ip:        { type: String },
      userAgent: { type: String },
      endpoint:  { type: String },
      method:    { type: String },
      requestId: { type: String },
    },
    status: {
      type: String,
      enum: ['success', 'failure'],
      default: 'success',
    },
    reason: { type: String, default: null },
  },
  { timestamps: true }
);

auditLogSchema.index({ performedBy: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetId: 1 });
auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = { AuditLog, AUDIT_ACTIONS };
