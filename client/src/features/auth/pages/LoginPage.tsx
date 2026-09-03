import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, AuthUser } from '../stores/useAuthStore.js';
import { api } from '../../../lib/api.js';
import { Button } from '../../../components/ui/Button.js';
import { Input } from '../../../components/ui/Input.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../../components/ui/Card.js';
import { ShieldCheck, AlertCircle } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('admin@gmail.com');
  const [password, setPassword] = useState('12345678');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.post<{
        success: boolean;
        data: { user: AuthUser; accessToken: string };
        error?: string;
      }>('/auth/login', { email, password });

      if (response.data.success && response.data.data) {
        setAuth(response.data.data.user, response.data.data.accessToken);
        navigate('/');
      }
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } } };
      setError(anyErr.response?.data?.error || 'Failed to login. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-950">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 mb-2">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Rozain & Ghuman Textile ERP</h1>
          <p className="text-xs text-zinc-400">Single Operator Unified Operations, Job-Work & Financial Accounting</p>
        </div>

        <Card className="border-zinc-800 bg-zinc-900/90 shadow-xl">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your operator or administrator credentials to proceed.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 text-xs rounded-md bg-red-500/10 border border-red-500/30 text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Input
                id="email"
                type="email"
                label="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="operator@domain.com"
              />

              <Input
                id="password"
                type="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />

              <div className="p-2.5 rounded-md bg-zinc-950/60 border border-zinc-800 text-[11px] text-zinc-400">
                <span className="font-semibold text-zinc-300">Default Superuser:</span> <br />
                Email: <code className="text-emerald-400">admin@gmail.com</code> | Password: <code className="text-emerald-400">12345678</code>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Sign In to System
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
