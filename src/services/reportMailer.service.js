const { User } = require('../models/User');
const { getWeeklyReport } = require('./report.service');
const { sendEmail, isConfigured } = require('./email.service');
const logger = require('../config/logger');

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const label = (c) => String(c).replace(/_/g, ' ');
const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const pct = (n) => (n === null ? '—' : `${n > 0 ? '+' : ''}${n}%`);

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// ─── Rendering ──────────────────────────────────────────────────────────────
// Inline styles + tables only: email clients ignore <style> blocks and most
// modern CSS. Every dynamic value is escaped.

const renderText = (r, name) =>
    [
        `Hi ${name},`,
        '',
        `Your ArthaGrid week (${formatDate(r.period.start)} – ${formatDate(r.period.end)})`,
        '',
        `Income:    ${inr(r.income)}   (${pct(r.vsLastWeek.incomeChangePercent)} vs last week)`,
        `Expenses:  ${inr(r.expenses)}   (${pct(r.vsLastWeek.expensesChangePercent)} vs last week)`,
        `Savings:   ${inr(r.savings)}`,
        r.topCategory ? `Top category: ${label(r.topCategory.category)} — ${inr(r.topCategory.total)}` : 'No expenses this week.',
        `Unusual transactions: ${r.unusualTransactions.count}`,
        `Budgets: ${r.budgets.withinLimit}/${r.budgets.total} within limit`,
        '',
        'You get this because you turned on weekly reports in ArthaGrid → Settings. Turn it off there any time.',
    ].join('\n');

const row = (name, value, note = '') =>
    `<tr><td style="padding:6px 0;color:#6b7280">${escapeHtml(name)}</td>` +
    `<td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(value)}</td>` +
    `<td style="padding:6px 0 6px 12px;color:#6b7280;font-size:12px">${escapeHtml(note)}</td></tr>`;

const renderHtml = (r, name) => `<!doctype html>
<html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:24px">
<tr><td>
<h2 style="margin:0 0 4px;font-size:18px">Your weekly financial report</h2>
<p style="margin:0 0 16px;color:#6b7280;font-size:13px">Hi ${escapeHtml(name)} — ${escapeHtml(formatDate(r.period.start))} to ${escapeHtml(formatDate(r.period.end))}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid #e5e7eb">
${row('Income', inr(r.income), `${pct(r.vsLastWeek.incomeChangePercent)} vs last week`)}
${row('Expenses', inr(r.expenses), `${pct(r.vsLastWeek.expensesChangePercent)} vs last week`)}
${row('Savings', inr(r.savings))}
${row('Top category', r.topCategory ? `${label(r.topCategory.category)} · ${inr(r.topCategory.total)}` : 'none')}
${row('Unusual transactions', String(r.unusualTransactions.count))}
${row('Budgets within limit', `${r.budgets.withinLimit} of ${r.budgets.total}`, r.budgets.overBudget.length ? `over: ${r.budgets.overBudget.map(label).join(', ')}` : '')}
</table>
<p style="margin:20px 0 0;color:#9ca3af;font-size:11px">You're receiving this because you turned on weekly reports in ArthaGrid → Settings. You can turn it off there at any time.</p>
</td></tr></table></td></tr></table></body></html>`;

// ─── Sending ────────────────────────────────────────────────────────────────

// Optional safety net: when set, only these addresses can ever be emailed.
// Registration doesn't verify email ownership, so without this anyone could
// sign up with someone else's address and opt them into reports.
const allowedRecipients = () => {
    const raw = process.env.REPORT_ALLOWED_RECIPIENTS;
    if (!raw) return null;
    return new Set(raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
};

const sendWeeklyReports = async () => {
    if (!isConfigured()) return { skipped: true, reason: 'RESEND_API_KEY not configured' };

    const allowed = allowedRecipients();
    const users = await User.find({ isActive: true, 'preferences.weeklyReport': true }).select('name email').lean();
    const recipients = allowed ? users.filter((u) => allowed.has(u.email.toLowerCase())) : users;

    if (recipients.length === 0) {
        return { skipped: false, recipients: 0, sent: 0, failed: 0, excludedByAllowlist: users.length - recipients.length };
    }

    const report = await getWeeklyReport(); // computed once — same for everyone
    let sent = 0;
    let failed = 0;

    // Sequential on purpose: providers' free tiers rate-limit bursts, and this
    // runs off the request path in a scheduled job, so speed isn't the goal.
    for (const user of recipients) {
        try {
            await sendEmail({
                to: user.email,
                subject: `Your ArthaGrid weekly report — ${inr(report.savings)} saved`,
                html: renderHtml(report, user.name),
                text: renderText(report, user.name),
            });
            sent += 1;
        } catch (err) {
            failed += 1;
            logger.warn({ err: err.message }, 'Weekly report failed for one recipient');
        }
    }

    // Counts only — never echo email addresses back through the HTTP response.
    return { skipped: false, recipients: recipients.length, sent, failed, excludedByAllowlist: users.length - recipients.length };
};

module.exports = { sendWeeklyReports, renderHtml, renderText };
