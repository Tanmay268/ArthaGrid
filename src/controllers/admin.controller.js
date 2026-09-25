const adminService = require('../services/admin.service');

const getStats = async (req, res) => {
  const data = await adminService.getAdminStats();
  res.status(200).json({ success: true, data });
};

module.exports = { getStats };
