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
    <div
      className="mx-auto flex h-dvh max-h-dvh w-full max-w-md flex-col justify-between overflow-y-auto sm:overflow-visible px-4 py-3 sm:px-6 sm:py-8"
      style={{
        paddingTop: 'max(14px, env(safe-area-inset-top))',
        paddingBottom: 'max(24px, calc(16px + env(safe-area-inset-bottom)))',
      }}
    >
      <div className="pt-1 sm:pt-4">
        <Logo className="scale-90 origin-left sm:scale-100" />
        <h1 className="mt-3 sm:mt-6 text-[25px] sm:text-[38px] font-medium leading-[1.1] tracking-tight">
          Your money,
          <br />
          <span className="text-accent-text">calmly in order.</span>
        </h1>
        <p className="mt-1.5 sm:mt-3 text-xs sm:text-base text-muted leading-relaxed">
          Monthly balance, daily expenses, subscriptions and loans — in one quiet, fast place.
        </p>
        <ul className="mt-3 sm:mt-6 space-y-2 sm:space-y-3">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5 sm:gap-3 text-xs sm:text-[15px]">
              <span className="grid h-7 w-7 sm:h-9 sm:w-9 place-items-center rounded-full bg-accent-soft text-accent-text shrink-0">
                <Icon size={14} className="sm:hidden" />
                <Icon size={18} className="hidden sm:block" />
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 sm:mt-8">
        <div className="card p-3.5 sm:p-5">
          <p className="mb-2.5 sm:mb-4 text-center text-xs sm:text-sm text-muted">
            Sign in or create your account with Google
          </p>
          <div className={`flex min-h-[40px] justify-center ${busy ? 'pointer-events-none opacity-60' : ''}`}>
            <GoogleLogin
              theme="outline"
              size="large"
              shape="pill"
              text="continue_with"
              width="260"
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
            <p className="mt-2 text-center text-xs sm:text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
        <p className="mt-2 sm:mt-3 text-center text-[11px] sm:text-xs text-muted">
          We only store your name, email and picture from Google.
        </p>
      </div>
    </div>
  );
}
