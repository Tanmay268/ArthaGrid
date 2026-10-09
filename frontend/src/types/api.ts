// Types mirroring the shapes ArthaGrid's API actually returns — see
// ../../docs/openapi.yaml in the main repo for the source of truth.

export type Role = 'viewer' | 'analyst' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive?: boolean;
  preferences?: { weeklyReport: boolean };
}

export interface AuthResponseData {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  _id: string;
  amount: number;
  type: TransactionType;
  category: string;
  merchant?: string | null;
  date: string;
  description?: string;
  /** Running balance (all income − all expenses) right after this transaction, in date order. */
  balanceAfter?: number;
  createdBy?: { _id: string; name: string; email: string; role: Role } | string;
  updatedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  pagination: Pagination;
}

export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  transactionCount: number;
  avgTransactionAmount: number;
  largestIncome: number;
  largestExpense: number;
  savingsRate: number;
}

export interface TrendPoint {
  period: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CategoryBreakdownRow {
  category: string;
  type: TransactionType;
  total: number;
  count: number;
  avg: number;
  min: number;
  max: number;
}

export interface CategoryBreakdown {
  income: CategoryBreakdownRow[];
  expense: CategoryBreakdownRow[];
}

export interface Budget {
  id: string;
  category: string;
  monthlyLimit: number;
  isActive: boolean;
  spent: number;
  remaining: number;
  percentage: number;
  isOverBudget: boolean;
}

export interface WeekdayVsWeekend {
  weekday: { total: number; avgPerDay: number };
  weekend: { total: number; avgPerDay: number };
}

export interface CategoryGrowthRow {
  category: string;
  thisMonth: number;
  lastMonth: number;
  changePercent: number;
}

export interface AnalyticsMetrics {
  burnRate: number;
  expenseToIncomeRatio: number | null;
  avgDailySpending: number;
  avgMonthlySpending: number;
  mostExpensiveCategory: string | null;
  mostFrequentCategory: string | null;
  weekdayVsWeekend: WeekdayVsWeekend;
  categoryGrowth: CategoryGrowthRow[];
}

export interface ForecastPoint {
  monthsAhead: number;
  linearRegression: number;
  movingAverage: number;
}

export interface ForecastResponse {
  method: string;
  source?: 'postgres_rollup' | 'mongodb_live';
  metric: 'income' | 'expenses' | 'net';
  history: TrendPoint[];
  forecast: ForecastPoint[];
  message?: string;
}

export interface AnomalyTransaction {
  _id: string;
  amount: number;
  category: string;
  merchant?: string | null;
  date: string;
  description?: string;
  zScore: number;
}

export interface RecurringExpense {
  merchant: string | null;
  category: string;
  averageAmount: number;
  interval: 'weekly' | 'monthly';
  occurrences: number;
  lastDate: string;
}

export interface HealthScore {
  score: number;
  rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS ATTENTION';
  components: {
    savingsRate: number;
    cashFlowStability: number;
    spendingConsistency: number;
    budgetAdherence: number;
    emergencyReserve: number;
  };
  methodology: string;
}

export interface Insight {
  type: 'spending' | 'category' | 'budget' | 'forecast' | 'anomaly' | 'recurring';
  text: string;
  data: Record<string, unknown>;
}

export interface CopilotResponse {
  question: string;
  answer: string;
  aggregates: Record<string, unknown>;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface CategorySuggestion {
  suggestion: { category: string; score: number } | null;
  alternatives: { category: string; score: number }[];
  reason?: 'no_known_words' | 'low_confidence' | 'no_candidates';
  basedOn: { seedExamples: number; ledgerExamples: number };
}

export interface WeeklyReport {
  period: { start: string; end: string };
  income: number;
  expenses: number;
  savings: number;
  vsLastWeek: { incomeChangePercent: number | null; expensesChangePercent: number | null };
  topCategory: { category: string; total: number } | null;
  categoryChanges: { category: string; total: number; previous: number; changePercent: number | null }[];
  unusualTransactions: { count: number; top: { category: string; amount: number }[] };
  budgets: { total: number; withinLimit: number; overBudget: string[] };
}

export interface AdminStats {
  users: {
    total: number;
    active: number;
    newThisMonth: number;
    activeLast30Days: number;
    byRole: Record<string, number>;
  };
  transactions: {
    total: number;
    dailyAverage: number;
    popularExpenseCategories: { category: string; count: number; sharePercent: number }[];
  };
  system: {
    http: {
      totalRequests: number;
      avgLatencyMs: number;
      p50Ms: number;
      p95Ms: number;
      p99Ms: number;
      serverErrorRatePercent: number;
      clientErrorRatePercent: number;
    };
    since: string;
    uptimeSeconds: number;
    memoryMb: { rss: number; heapUsed: number };
    nodeVersion: string;
    services: { mongodb: string; postgres: string; copilot: string; email: string };
  };
}
