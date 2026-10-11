import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from '../components/Logo.jsx';

const POINTS = [
  { icon: TrendingUp, text: 'See what’s safe to spend each day' },
  { icon: ShieldCheck, text: 'Subscriptions never sneak up on you' },
  { icon: Users, text: 'Keep track of money lent to friends' },
];

export default function Login() {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-6 py-10" style={{ paddingBottom: 'calc(40px + env(safe-area-inset-bottom))' }}>
      <div className="pt-6">
        <Logo size="lg" />
        <h1 className="mt-10 text-[40px] font-medium leading-[1.05]">
          Your money,
          <br />
          <span className="text-accent-text">calmly in order.</span>
        </h1>
        <p className="mt-4 text-lg text-muted">Monthly balance, daily expenses, subscriptions and loans — in one quiet, fast place.</p>
        <ul className="mt-8 space-y-3">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[15px]">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent-text">
                <Icon size={19} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-12">
        <div className="card p-5">
          <p className="mb-4 text-center text-sm text-muted">Sign in or create your account with Google</p>
          <div className={`flex min-h-[44px] justify-center ${busy ? 'pointer-events-none opacity-60' : ''}`}>
            <GoogleLogin
              theme="outline"
              size="large"
              shape="pill"
              text="continue_with"
              width="280"
              onSuccess={async (res) => {
                setBusy(true);
                setError('');
                try {
                  await loginWithGoogle(res.credential);
                } catch (e) {
                  setError(e.message || 'Sign-in failed');
                  setBusy(false);
                }
              }}
              onError={() => setError('Google sign-in was cancelled or failed. Please try again.')}
            />
          </div>
          {error && (
            <p className="mt-3 text-center text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted">We only store your name, email and picture from Google.</p>
      </div>
    </div>
  );
}
