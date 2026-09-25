import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useRegister } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { errorMessage } from '@/lib/utils';
import { AuthShell } from './AuthShell';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const register = useRegister();
  const status = useAuthStore((s) => s.status);

  if (status === 'authenticated') return <Navigate to="/" replace />;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register.mutate({ name, email, password });
  };

  return (
    <AuthShell title="Create your account" subtitle="You'll start as a Viewer — an admin can upgrade your role later.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="text-xs text-muted-foreground">At least 8 characters, with upper and lower case letters and a number.</p>
        </div>

        {register.isError && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(register.error)}
          </p>
        )}

        <Button type="submit" disabled={register.isPending} className="h-10">
          {register.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-foreground underline underline-offset-2">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
