import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { refreshAccessToken, api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { ApiEnvelope, User } from '@/types/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { OverviewPage } from '@/pages/overview/OverviewPage';
import { AnalyticsPage } from '@/pages/analytics/AnalyticsPage';
import { BudgetsPage } from '@/pages/budgets/BudgetsPage';
import { ForecastPage } from '@/pages/forecast/ForecastPage';
import { InsightsPage } from '@/pages/insights/InsightsPage';
import { CopilotPage } from '@/pages/copilot/CopilotPage';
import { TransactionsPage } from '@/pages/transactions/TransactionsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { Spinner } from '@/components/ui/state';

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

  if (status === 'checking') {
    return <Spinner label="Loading ArthaGrid…" />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

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
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
