import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRegister } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/lib/api';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const register = useRegister();
  const status = useAuthStore((s) => s.status);

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register.mutate({ name, email, password });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Create your ArthaGrid account</CardTitle>
          <p className="text-sm text-muted-foreground">Starts you off as a Viewer — an admin can upgrade your role later.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            </div>
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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters, mixed case + a number"
              />
            </div>

            {register.isError && (
              <p className="text-sm text-destructive">
                {register.error instanceof ApiError
                  ? register.error.message
                  : 'Something went wrong. Please try again.'}
              </p>
            )}

            <Button type="submit" disabled={register.isPending}>
              {register.isPending ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-foreground underline underline-offset-2">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
