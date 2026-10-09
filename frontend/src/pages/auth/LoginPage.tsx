import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useLogin } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { errorMessage } from '@/lib/utils';
import { AuthShell } from './AuthShell';

const DEMO_ACCOUNTS = [
  { role: 'analyst', email: 'analyst@test.com', password: 'Password123' },
  { role: 'viewer', email: 'viewer@test.com', password: 'Password123' },
];

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'authenticated') {
    const requestedPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    const from = requestedPath && requestedPath !== '/login' && requestedPath !== '/register' ? requestedPath : '/';
    return <Navigate to={from} replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to see where your money stands.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {login.isError && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(login.error)}
          </p>
        )}

        <Button type="submit" disabled={login.isPending} className="h-10">
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
        {login.isPending && (
          // A free-tier server that's been idle takes up to a minute to wake — say so instead of leaving people guessing.
          <p className="text-center text-xs text-muted-foreground">First request after a quiet period can take up to a minute while the free server wakes up.</p>
        )}
      </form>

      <div className="mt-6 rounded-md border border-border p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Demo accounts</p>
        <ul className="flex flex-col gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.role} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium capitalize">{account.role}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {account.email} / {account.password}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
              >
                Use
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{' '}
        <Link to="/register" className="font-medium text-foreground underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
