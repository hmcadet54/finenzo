import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Database, LogOut, Palette, Tags, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { ACCENT_PALETTE, applyAccent } from '../lib/theme.js';
import { CURRENCIES } from '../lib/money.js';
import { PageHeader, Segmented, Toggle, UserAvatar } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

function Section({ title, children, icon: Icon }) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 px-1 text-sm font-semibold uppercase tracking-wide text-muted">
        {Icon && <Icon size={15} />} {title}
      </h2>
      <div className="card divide-y divide-line overflow-hidden">{children}</div>
    </section>
  );
}

function NavRow({ to, icon: Icon, title, text }) {
  return (
    <Link to={to} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent-text"><Icon size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block truncate text-sm text-muted">{text}</span>
      </span>
      <ChevronRight size={18} className="text-muted" />
    </Link>
  );
}

export default function Settings() {
  const { user, logout, updateSettings } = useAuth();
  const { toast } = useToast();
  const s = user.settings;
  const [hex, setHex] = useState(s.accent);
  const [day, setDay] = useState(String(s.cycleStartDay));

  const update = async (patch) => {
    try {
      await updateSettings({ settings: patch });
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };
  const setAccent = (value) => {
    setHex(value);
    applyAccent(value); // instant preview + localStorage mirror
    if (/^#[0-9a-fA-F]{6}$/.test(value)) update({ accent: value.toUpperCase() });
  };
  const isCustom = !ACCENT_PALETTE.some((p) => p.hex.toLowerCase() === s.accent.toLowerCase());

  return (
    <div className="space-y-6 pb-4">
      <PageHeader title="Settings" />

      <section className="card flex items-center gap-4 p-4">
        <UserAvatar user={user} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-medium">{user.name}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
          <p className="text-xs text-muted">Signed in with Google</p>
        </div>
      </section>

      <Section title="Appearance" icon={Palette}>
        <div className="p-4">
          <p className="mb-3 font-medium">Accent colour</p>
          <div className="flex flex-wrap gap-3" role="group" aria-label="Accent colour">
            {ACCENT_PALETTE.map((p) => {
              const active = s.accent.toLowerCase() === p.hex.toLowerCase();
              return (
                <button key={p.hex} onClick={() => setAccent(p.hex)} aria-label={p.name} aria-pressed={active} title={p.name} className={`grid h-11 w-11 place-items-center rounded-full ring-offset-2 ring-offset-surface transition active:scale-95 ${active ? 'ring-2 ring-ink' : ''}`} style={{ background: p.hex }}>
                  {active && <Check size={18} className="text-white mix-blend-difference" />}
                </button>
              );
            })}
            <label className={`relative grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-dashed border-muted text-xs font-semibold text-muted ring-offset-2 ring-offset-surface ${isCustom ? 'ring-2 ring-ink' : ''}`} style={isCustom ? { background: s.accent, color: 'white' } : undefined} title="Custom colour">
              <span aria-hidden>#</span>
              <input type="color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#D97757'} onChange={(e) => setAccent(e.target.value)} aria-label="Custom accent colour" />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="label">Custom hex</span>
            <input className="field num uppercase" value={hex} maxLength={7} onChange={(e) => setAccent(e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`)} aria-label="Custom hex colour" />
          </label>
          <p className="mt-2 text-xs text-muted">Text on buttons switches between light and dark automatically for readable contrast.</p>
        </div>
        <div className="p-4">
          <p className="mb-2 font-medium">Number format</p>
          <Segmented label="Number format" value={s.compactNumbers ? 'compact' : 'full'} onChange={(v) => update({ compactNumbers: v === 'compact' })} options={[{ value: 'compact', label: '182k' }, { value: 'full', label: '182,000' }]} />
        </div>
        <div className="p-4">
          <label className="block">
            <span className="mb-2 block font-medium">Currency</span>
            <select className="field" value={s.currency} onChange={(e) => update({ currency: e.target.value })}>
              {Object.entries(CURRENCIES).map(([code, sym]) => (
                <option key={code} value={code}>{code} ({sym})</option>
              ))}
            </select>
          </label>
        </div>
      </Section>

      <Section title="Budget cycle">
        <div className="p-4">
          <label className="block">
            <span className="mb-1 block font-medium">Cycle starts on day</span>
            <span className="mb-2 block text-sm text-muted">Set this to your pay day. Short months use their last day.</span>
            <div className="flex gap-2">
              <input className="field" type="number" min={1} max={31} inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} />
              <button className="btn btn-primary" disabled={+day === s.cycleStartDay || +day < 1 || +day > 31} onClick={() => update({ cycleStartDay: +day })}>Save</button>
            </div>
          </label>
        </div>
        <Toggle checked={s.autoPostSubscriptions} onChange={(v) => update({ autoPostSubscriptions: v })} label="Auto-post subscriptions on due date" description="Creates the expense automatically instead of waiting for “Mark paid”." />
      </Section>

      <Section title="Manage">
        <NavRow to="/settings/categories" icon={Tags} title="Categories" text="Add, edit, pick icons and colours" />
        <NavRow to="/settings/friends" icon={Users} title="Friends & lending" text="Loans, repayments and reminders" />
        <NavRow to="/settings/data" icon={Database} title="Your data" text="Export, import, delete" />
      </Section>

      <button className="btn btn-ghost w-full" onClick={logout}>
        <LogOut size={18} /> Log out
      </button>
      <p className="pb-2 text-center text-xs text-muted">Finenzo v1.0.0</p>
    </div>
  );
}
