import { useState, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, AuthUser } from '../stores/useAuthStore.js';
import { api } from '../../../lib/api.js';
import { Button } from '../../../components/ui/Button.js';
import { Input } from '../../../components/ui/Input.js';
import { FormFeedback } from '../../../components/ui/WorkflowForm.js';
import { ThemePicker } from '../../../components/ui/Theme.js';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';

const testingAdmin = { email: 'admin@gmail.com', password: '12345678' };
const showTestingAdmin = import.meta.env.DEV || import.meta.env.VITE_SHOW_TEST_CREDENTIALS === 'true';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    isSubmittingRef.current = true;
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
      isSubmittingRef.current = false;
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-canvas px-5 py-16">
      <div className="absolute right-5 top-5"><ThemePicker /></div>
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-white">rt.</span>
          <div><p className="text-base font-semibold text-strong">Rozain Textile</p><p className="mt-1 text-xs text-soft">Operations workspace</p></div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-strong">Welcome back</h1>
          <p className="mt-2 text-sm leading-relaxed text-soft">Sign in to manage your production, stock and accounts.</p>
          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <FormFeedback error={error} success={null} />
            <Input id="email" type="email" label="Email address" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus autoComplete="username" placeholder="name@example.com" />
            <div className="relative">
              <Input id="password" type={showPassword ? 'text' : 'password'} label="Password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" className="pr-12" />
              <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)} className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-lg text-soft hover:text-strong">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
            <Button type="submit" className="w-full" isLoading={isLoading}>Sign in<ArrowRight className="h-4 w-4" /></Button>
          </form>
          {showTestingAdmin && (
            <div className="mt-6 space-y-3 rounded-lg border border-line bg-subtle p-4">
              <p className="text-xs font-semibold text-strong">Testing admin account</p>
              <dl className="space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2"><dt className="text-soft">Email</dt><dd className="select-all break-all font-mono text-ink">{testingAdmin.email}</dd></div>
                <div className="flex flex-wrap items-center justify-between gap-2"><dt className="text-soft">Password</dt><dd className="select-all font-mono text-ink">{testingAdmin.password}</dd></div>
              </dl>
              <Button type="button" variant="outline" size="sm" className="w-full" disabled={isLoading} onClick={() => { setEmail(testingAdmin.email); setPassword(testingAdmin.password); setError(null); }}>Use testing admin</Button>
            </div>
          )}
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-soft">Use the account provided by your administrator.</p>
      </div>
    </div>
  );
}
