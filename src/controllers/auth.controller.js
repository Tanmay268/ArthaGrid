const authService = require('../services/auth.service');
const { setRefreshCookie, clearRefreshCookie } = require('../utils/cookies');

const register = async (req, res) => {
    const result = await authService.register(req.body);
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({
        success: true,
        data: result,
    });
};

const login = async (req, res) => {
    const result = await authService.login(req.body);
    setRefreshCookie(res, result.refreshToken);
    res.status(200).json({
        success: true,
        data: result,
    });
};

const refresh = async (req, res) => {
    const result = await authService.refresh(req.refreshToken);
    setRefreshCookie(res, result.refreshToken);
    res.status(200).json({
        success: true,
        data: result,
    });
};

const logout = async (req, res) => {
    await authService.logout(req.refreshToken);
    clearRefreshCookie(res);
    res.status(200).json({
        success: true,
        data: { message: 'Logged out successfully' },
    });
};

module.exports = { register, login, refresh, logout };
