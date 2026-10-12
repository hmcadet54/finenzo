import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Database, LogOut, Moon, Palette, Sun, Tags, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  ACCENT_PALETTE,
  THEME_PRESETS,
  applyAccent,
  applyFontSize,
  applyPreset,
  applyTheme,
  getStoredBg,
  getStoredFontSize,
  getStoredPreset,
  getStoredThemeMode,
} from '../lib/theme.js';
import { CURRENCIES } from '../lib/money.js';
import { PageHeader, Segmented, ThemedSelect, Toggle, UserAvatar } from '../components/ui.jsx';
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
    <Link to={to} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent-text">
        <Icon size={19} />
      </span>
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

  const [themeMode, setThemeMode] = useState(getStoredThemeMode);
  const [presetId, setPresetId] = useState(getStoredPreset);
  const [bgHex, setBgHex] = useState(() => s.bg || getStoredBg());
  const [hex, setHex] = useState(s.accent);
  const [day, setDay] = useState(String(s.cycleStartDay));
  const [fontSize, setFontSize] = useState(getStoredFontSize);

  const update = async (patch) => {
    try {
      await updateSettings({ settings: patch });
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };

  const handleModeChange = (mode) => {
    setThemeMode(mode);
    applyTheme({ mode });
    update({ themeMode: mode });
  };

  const handlePresetSelect = (p) => {
    setPresetId(p.id);
    setBgHex(p.bg);
    setHex(p.accent);
    setThemeMode(p.mode);
    applyPreset(p.id);
    update({ accent: p.accent, bg: p.bg, themeMode: p.mode });
    toast(`Applied ${p.name} theme`);
  };

  const handleCustomBgChange = (val) => {
    setBgHex(val);
    setPresetId('');
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      applyTheme({ bg: val.toUpperCase() });
      update({ bg: val.toUpperCase() });
    }
  };

  const handleResetBg = () => {
    setBgHex('');
    setPresetId('');
    applyTheme({ bg: '' });
    update({ bg: '' });
    toast('Reset background to theme default');
  };

  const setAccent = (value) => {
    setHex(value);
    setPresetId('');
    applyAccent(value);
    if (/^#[0-9a-fA-F]{6}$/.test(value)) update({ accent: value.toUpperCase() });
  };

  const isCustomAccent = !ACCENT_PALETTE.some((p) => p.hex.toLowerCase() === hex.toLowerCase());

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
        {/* Light / Dark Mode Toggle */}
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium">Mode</p>
            <span className="text-xs text-muted">Adapts contrast & surface automatically</span>
          </div>
          <Segmented
            label="Theme mode"
            value={themeMode}
            onChange={handleModeChange}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
          />
        </div>

        {/* Predefined Themes */}
        <div className="p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <div>
              <p className="font-medium">Theme presets</p>
              <p className="text-xs text-muted">Curated palettes with clay styling</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {THEME_PRESETS.map((p) => {
              const active = presetId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePresetSelect(p)}
                  className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                    active
                      ? 'border-accent bg-accent-soft ring-1 ring-accent shadow-sm'
                      : 'border-line bg-surface hover:bg-surface-2'
                  }`}
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line shadow-xs text-xs"
                    style={{ backgroundColor: p.bg }}
                  >
                    <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: p.accent }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">{p.name}</p>
                    <p className="truncate text-[11px] text-muted">{p.mode}</p>
                  </div>
                  {active && <Check size={15} className="shrink-0 text-accent-text" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Background Color */}
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="font-medium">Custom background colour</p>
              <p className="text-xs text-muted">Choose any colour — cards and text calculate readable contrast</p>
            </div>
            {bgHex && (
              <button
                type="button"
                className="text-xs font-semibold text-accent hover:underline"
                onClick={handleResetBg}
              >
                Reset
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label
              className="relative grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-line ring-offset-2 ring-offset-surface active:scale-95"
              style={{ backgroundColor: bgHex || (themeMode === 'dark' ? '#161615' : '#FAF9F5') }}
              title="Pick background colour"
            >
              <span className="text-xs font-bold mix-blend-difference text-white">🎨</span>
              <input
                type="color"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                value={bgHex && /^#[0-9a-f]{6}$/i.test(bgHex) ? bgHex : '#FAF9F5'}
                onChange={(e) => handleCustomBgChange(e.target.value.toUpperCase())}
                aria-label="Pick background colour"
              />
            </label>
            <div className="flex-1">
              <input
                className="field num uppercase text-sm"
                placeholder={themeMode === 'dark' ? '#161615' : '#FAF9F5'}
                value={bgHex}
                maxLength={7}
                onChange={(e) => {
                  const raw = e.target.value;
                  const val = raw.startsWith('#') ? raw : `#${raw}`;
                  handleCustomBgChange(val);
                }}
                aria-label="Custom background hex"
              />
            </div>
          </div>
        </div>

        {/* Accent Color */}
        <div className="p-4">
          <p className="mb-3 font-medium">Accent colour</p>
          <div className="flex flex-wrap gap-3" role="group" aria-label="Accent colour">
            {ACCENT_PALETTE.map((p) => {
              const active = hex.toLowerCase() === p.hex.toLowerCase();
              return (
                <button
                  key={p.hex}
                  onClick={() => setAccent(p.hex)}
                  aria-label={p.name}
                  aria-pressed={active}
                  title={p.name}
                  className={`grid h-11 w-11 place-items-center rounded-full ring-offset-2 ring-offset-surface transition active:scale-95 ${
                    active ? 'ring-2 ring-ink' : ''
                  }`}
                  style={{ background: p.hex }}
                >
                  {active && <Check size={18} className="text-white mix-blend-difference" />}
                </button>
              );
            })}
            <label
              className={`relative grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-dashed border-muted text-xs font-semibold text-muted ring-offset-2 ring-offset-surface ${
                isCustomAccent ? 'ring-2 ring-ink' : ''
              }`}
              style={isCustomAccent ? { background: hex, color: 'white' } : undefined}
              title="Custom colour"
            >
              <span aria-hidden>#</span>
              <input
                type="color"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#D97757'}
                onChange={(e) => setAccent(e.target.value)}
                aria-label="Custom accent colour"
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="label">Custom accent hex</span>
            <input
              className="field num uppercase"
              value={hex}
              maxLength={7}
              onChange={(e) => setAccent(e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`)}
              aria-label="Custom hex colour"
            />
          </label>
          <p className="mt-2 text-xs text-muted">
            Text on clay buttons switches between light and dark automatically for high-contrast readability.
          </p>
        </div>

        {/* Font size */}
        <div className="p-4">
          <p className="mb-2 font-medium">Text size</p>
          <Segmented
            label="Text size"
            value={fontSize}
            onChange={(v) => {
              setFontSize(v);
              applyFontSize(v);
            }}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'normal', label: 'Normal' },
              { value: 'large', label: 'Large' },
            ]}
          />
        </div>

        {/* Number format */}
        <div className="p-4">
          <p className="mb-2 font-medium">Number format</p>
          <Segmented
            label="Number format"
            value={s.compactNumbers ? 'compact' : 'full'}
            onChange={(v) => update({ compactNumbers: v === 'compact' })}
            options={[
              { value: 'compact', label: '182k' },
              { value: 'full', label: '182,000' },
            ]}
          />
        </div>

        {/* Currency */}
        <div className="p-4">
          <span className="mb-2 block font-medium">Currency</span>
          <ThemedSelect
            value={s.currency}
            onChange={(val) => update({ currency: val })}
            options={Object.entries(CURRENCIES).map(([code, sym]) => ({
              value: code,
              label: `${code} (${sym})`,
              badge: sym,
            }))}
            ariaLabel="Currency"
          />
        </div>
      </Section>

      <Section title="Budget cycle">
        <div className="p-4">
          <label className="block">
            <span className="mb-1 block font-medium">Cycle starts on day</span>
            <span className="mb-2 block text-sm text-muted">Set this to your pay day. Short months use their last day.</span>
            <div className="flex gap-2">
              <input
                className="field"
                type="number"
                min={1}
                max={31}
                inputMode="numeric"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
              <button
                className="btn btn-primary"
                disabled={+day === s.cycleStartDay || +day < 1 || +day > 31}
                onClick={() => update({ cycleStartDay: +day })}
              >
                Save
              </button>
            </div>
          </label>
        </div>
        <Toggle
          checked={s.autoPostSubscriptions}
          onChange={(v) => update({ autoPostSubscriptions: v })}
          label="Auto-post subscriptions on due date"
          description="Creates the expense automatically instead of waiting for “Mark paid”."
        />
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
