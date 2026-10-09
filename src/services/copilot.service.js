const dashboardService = require('./dashboard.service');
const analyticsService = require('./analytics.service');
const anomalyService = require('./anomaly.service');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

const DEFAULT_DEPLOYMENT = 'gpt-5-mini';
const DEFAULT_API_VERSION = '2025-04-01-preview';
const azureChatEndpoint = (endpoint, deployment, apiVersion) =>
    `${endpoint.replace(/\/+$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

const SYSTEM_INSTRUCTION = [
    "You are ArthaGrid's Financial Copilot, a plain-language assistant inside a personal-finance app.",
    'Answer the question using ONLY the numbers given to you in the JSON data below.',
    'Never invent, estimate, or assume a number that is not present in that data.',
    "If the data doesn't contain what's needed to answer, say so plainly instead of guessing.",
    'Keep the answer to 2-4 short sentences, friendly but factual. Amounts are in Indian Rupees (₹).',
].join(' ');

// ─────────────────────────────────────────────────────────────────────────────
// Builds the ONLY data that ever leaves the server for Azure OpenAI —
// pre-computed aggregate numbers, explicitly allow-listed field by field
// from what the existing analytics services already return. Never widen
// this to pass a raw transaction object through (its `description`/
// `merchant` are free text a user typed) — see decisions.md #19 for why
// that line is deliberate, not incidental.
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

const callAzureOpenAI = async (question, aggregates) => {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    if (!apiKey || !endpoint) {
        throw ApiError.serviceUnavailable('The AI Financial Copilot is not configured on this server.');
    }

    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || DEFAULT_DEPLOYMENT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || DEFAULT_API_VERSION;

    let response;
    try {
        response = await fetch(azureChatEndpoint(endpoint, deployment, apiVersion), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: SYSTEM_INSTRUCTION },
                    { role: 'user', content: `Question: ${question}\n\nData:\n${JSON.stringify(aggregates)}` },
                ],
                // gpt-5-mini is a reasoning-family model on Azure: it only accepts the
                // default temperature and caps output via max_completion_tokens, not
                // the older max_tokens/temperature knobs used by earlier chat models.
                max_completion_tokens: 1000,
            }),
        });
    } catch (err) {
        logger.error({ err }, 'Azure OpenAI request failed (network error)');
        throw ApiError.serviceUnavailable('The AI assistant is temporarily unavailable. Please try again shortly.');
    }

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        logger.error({ status: response.status, errorBody }, 'Azure OpenAI request failed');
        throw ApiError.serviceUnavailable('The AI assistant is temporarily unavailable. Please try again shortly.');
    }

    const data = await response.json();
    const answer = data?.choices?.[0]?.message?.content;
    if (!answer) {
        logger.error({ data }, 'Azure OpenAI returned no answer text');
        throw ApiError.serviceUnavailable('The AI assistant is temporarily unavailable. Please try again shortly.');
    }

    return answer.trim();
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/copilot/ask
// ─────────────────────────────────────────────────────────────────────────────

const askCopilot = async (question) => {
    const aggregates = await buildAggregates();
    const answer = await callAzureOpenAI(question, aggregates);
    return { question, answer, aggregates };
};

module.exports = { askCopilot, buildAggregates };
