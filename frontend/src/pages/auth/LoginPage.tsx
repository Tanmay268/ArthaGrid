import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLogin } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/lib/api';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'authenticated') {
    const from = (location.state as { from?: Location })?.from?.pathname ?? '/';
    return <Navigate to={from} replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Log in to ArthaGrid</CardTitle>
          <p className="text-sm text-muted-foreground">Track, analyze, and understand your money.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {login.isError && (
              <p className="text-sm text-destructive">
                {login.error instanceof ApiError ? login.error.message : 'Something went wrong. Please try again.'}
              </p>
            )}

            <Button type="submit" disabled={login.isPending}>
              {login.isPending ? 'Logging in…' : 'Log in'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-foreground underline underline-offset-2">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
