// Mirrors the API's category lists (src/models/Transaction.js) — the API is
// the source of truth and validates every request, so a drift here can only
// cause a friendly "invalid category" error, never bad data.
export const INCOME_CATEGORIES = ['salary', 'freelance', 'investment', 'gift', 'other_income'];
export const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'housing',
  'utilities',
  'healthcare',
  'entertainment',
  'education',
  'shopping',
  'other_expense',
];
export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
