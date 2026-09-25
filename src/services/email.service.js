const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

// Sends through Resend's HTTPS API with plain fetch (no SDK), not SMTP:
// Render's free tier blocks outbound SMTP ports (25/465/587), so an SMTP
// library would work locally and silently fail once deployed. HTTPS always
// gets through. See docs/decisions.md #24.
//
// Optional like Postgres and Gemini: without RESEND_API_KEY the reporting
// job reports "skipped" instead of failing.

const RESEND_URL = 'https://api.resend.com/emails';
const isConfigured = () => Boolean(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html, text }) => {
    if (!isConfigured()) throw ApiError.serviceUnavailable('Email is not configured on this server.');

    let res;
    try {
        res = await fetch(RESEND_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                // Resend's shared sandbox sender only delivers to the account owner's own
                // address until you verify a domain — fine for a portfolio demo.
                from: process.env.REPORT_FROM_EMAIL || 'ArthaGrid <onboarding@resend.dev>',
                to: [to],
                subject,
                html,
                text,
            }),
        });
    } catch (err) {
        logger.error({ err }, 'Email provider request failed (network error)');
        throw ApiError.serviceUnavailable('Email provider unreachable.');
    }

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        logger.error({ status: res.status, body }, 'Email provider rejected the request');
        throw ApiError.serviceUnavailable('Email provider rejected the request.');
    }
};

module.exports = { sendEmail, isConfigured };
