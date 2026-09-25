import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { refreshAccessToken, api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { ApiEnvelope, User } from '@/types/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Toaster } from '@/components/ui/toaster';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ApiDocsRedirect } from '@/pages/ApiDocsRedirect';
import { Spinner } from '@/components/ui/state';

// Pages load on demand so the first paint (login) doesn't download the chart
// library and every screen up front — matters on a phone connection.
const OverviewPage = lazy(() => import('@/pages/overview/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const BudgetsPage = lazy(() => import('@/pages/budgets/BudgetsPage').then((m) => ({ default: m.BudgetsPage })));
const ForecastPage = lazy(() => import('@/pages/forecast/ForecastPage').then((m) => ({ default: m.ForecastPage })));
const InsightsPage = lazy(() => import('@/pages/insights/InsightsPage').then((m) => ({ default: m.InsightsPage })));
const CopilotPage = lazy(() => import('@/pages/copilot/CopilotPage').then((m) => ({ default: m.CopilotPage })));
const TransactionsPage = lazy(() => import('@/pages/transactions/TransactionsPage').then((m) => ({ default: m.TransactionsPage })));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const AdminPage = lazy(() => import('@/pages/admin/AdminPage').then((m) => ({ default: m.AdminPage })));

// The access token only lives in memory (see authStore.ts), so a full page
// reload starts with none. This restores the session on boot by trading the
// httpOnly refresh cookie for a fresh access token, then fetching the
// profile it belongs to — the same "silent refresh" pattern any
// cookie-backed SPA needs.
function useSessionBootstrap() {
  const { status, setSession, clearSession } = useAuthStore();

  useEffect(() => {
    if (status !== 'checking') return;

    (async () => {
      const token = await refreshAccessToken();
      if (!token) {
        clearSession();
        return;
      }

      try {
        const res = await api.get<ApiEnvelope<User>>('/api/v1/users/me');
        setSession(res.data, token);
      } catch {
        clearSession();
      }
    })();
  }, [status, setSession, clearSession]);
}

export function App() {
  useSessionBootstrap();
  const status = useAuthStore((s) => s.status);

  return (
    <>
      {status === 'checking' ? (
        <div className="flex min-h-screen items-center justify-center">
          <Spinner label="Loading ArthaGrid… (a free server that's been idle can take up to a minute to wake)" />
        </div>
      ) : (
        <BrowserRouter>
          <Suspense fallback={<div className="p-6"><Spinner /></div>}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/api-docs" element={<ApiDocsRedirect />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="budgets" element={<BudgetsPage />} />
                <Route path="transactions" element={<TransactionsPage />} />
                <Route path="settings" element={<SettingsPage />} />

                <Route element={<ProtectedRoute roles={['analyst', 'admin']} />}>
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="forecast" element={<ForecastPage />} />
                  <Route path="insights" element={<InsightsPage />} />
                  <Route path="copilot" element={<CopilotPage />} />
                </Route>

                <Route element={<ProtectedRoute roles={['admin']} />}>
                  <Route path="admin" element={<AdminPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      )}
      <Toaster />
    </>
  );
}
