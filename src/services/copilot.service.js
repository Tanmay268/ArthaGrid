const dashboardService = require('./dashboard.service');
const analyticsService = require('./analytics.service');
const anomalyService = require('./anomaly.service');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

const DEFAULT_MODEL = 'gemini-3.8-flash';
const geminiEndpoint = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const SYSTEM_INSTRUCTION = [
    "You are ArthaGrid's Financial Copilot, a plain-language assistant inside a personal-finance app.",
    'Answer the question using ONLY the numbers given to you in the JSON data below.',
    'Never invent, estimate, or assume a number that is not present in that data.',
    "If the data doesn't contain what's needed to answer, say so plainly instead of guessing.",
    'Keep the answer to 2-4 short sentences, friendly but factual. Amounts are in Indian Rupees (₹).',
].join(' ');

// ─────────────────────────────────────────────────────────────────────────────
// Builds the ONLY data that ever leaves the server for Gemini — pre-computed
// aggregate numbers, explicitly allow-listed field by field from what the
// existing analytics services already return. Never widen this to pass a
// raw transaction object through (its `description`/`merchant` are free
// text a user typed) — see decisions.md #19 for why that line is
// deliberate, not incidental.
// ─────────────────────────────────────────────────────────────────────────────

const buildAggregates = async () => {
    const [summary, categoryGrowth, anomalies] = await Promise.all([
        dashboardService.getSummary(),
        analyticsService.getCategoryGrowth(),
        anomalyService.getAnomalies(),
    ]);

    return {
        totalIncome: summary.totalIncome,
        totalExpenses: summary.totalExpenses,
        netBalance: summary.netBalance,
        savingsRate: summary.savingsRate,
        topCategoryChanges: categoryGrowth.slice(0, 5).map((c) => ({
            category: c.category,
            thisMonth: c.thisMonth,
            lastMonth: c.lastMonth,
            changePercent: c.changePercent,
        })),
        unusualTransactionCount: anomalies.length,
        topUnusualTransactions: anomalies.slice(0, 3).map((a) => ({
            category: a.category,
            amount: a.amount,
            zScore: a.zScore,
        })),
    };
};

const callGemini = async (question, aggregates) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw ApiError.serviceUnavailable('The AI Financial Copilot is not configured on this server.');
    }

    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    let response;
    try {
        response = await fetch(`${geminiEndpoint(model)}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
                contents: [
                    { role: 'user', parts: [{ text: `Question: ${question}\n\nData:\n${JSON.stringify(aggregates)}` }] },
                ],
                generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
            }),
        });
    } catch (err) {
        logger.error({ err }, 'Gemini API request failed (network error)');
        throw ApiError.serviceUnavailable('The AI assistant is temporarily unavailable. Please try again shortly.');
    }

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        logger.error({ status: response.status, errorBody }, 'Gemini API request failed');
        throw ApiError.serviceUnavailable('The AI assistant is temporarily unavailable. Please try again shortly.');
    }

    const data = await response.json();
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!answer) {
        logger.error({ data }, 'Gemini API returned no answer text');
        throw ApiError.serviceUnavailable('The AI assistant is temporarily unavailable. Please try again shortly.');
    }

    return answer.trim();
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/copilot/ask
// ─────────────────────────────────────────────────────────────────────────────

const askCopilot = async (question) => {
    const aggregates = await buildAggregates();
    const answer = await callGemini(question, aggregates);
    return { question, answer, aggregates };
};

module.exports = { askCopilot, buildAggregates };
