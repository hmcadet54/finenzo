import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Download, FileJson, FileSpreadsheet, Trash2, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/ui.jsx';
import Sheet from '../components/Sheet.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Row({ icon: Icon, title, text, onClick, danger, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2 disabled:opacity-50">
      <span className={`grid h-10 w-10 place-items-center rounded-full ${danger ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent-text'}`}><Icon size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className={`block font-medium ${danger ? 'text-danger' : ''}`}>{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
    </button>
  );
}

export default function DataSettings() {
  const { toast } = useToast();
  const { logout } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [confirm, setConfirm] = useState(null); // 'data' | 'account' | { backup }
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
    } catch (e) {
      toast(e.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (backup.app !== 'finenzo') throw new Error('Not a Finenzo backup');
      setConfirm({ backup });
    } catch (err) {
      toast(err.message || 'Could not read that file', { tone: 'error' });
    }
  };

  const close = () => {
    setConfirm(null);
    setTyped('');
  };

  return (
    <div className="space-y-6 pb-4">
      <PageHeader back={<Link to="/settings" className="-ml-2 mb-1 inline-flex min-h-[44px] items-center gap-1 px-2 text-sm text-muted"><ChevronLeft size={16} /> Settings</Link>} title="Your data" />

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted">Export &amp; import</h2>
        <div className="card divide-y divide-line overflow-hidden">
          <Row icon={FileSpreadsheet} title="Export CSV" text="Expenses and income, opens in Excel / Sheets" disabled={busy} onClick={() => run(async () => download(await api('/export', { query: { format: 'csv' }, blob: true }), 'finenzo-export.csv'), 'CSV downloaded')} />
          <Row icon={FileJson} title="Export JSON backup" text="Everything, restorable later" disabled={busy} onClick={() => run(async () => download(await api('/export', { blob: true }), 'finenzo-backup.json'), 'Backup downloaded')} />
          <Row icon={Upload} title="Import JSON backup" text="Replaces your current data" disabled={busy} onClick={() => fileRef.current?.click()} />
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} aria-label="Choose backup file" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-danger">Danger zone</h2>
        <div className="card divide-y divide-line overflow-hidden">
          <Row icon={Trash2} danger title="Delete all my data" text="Removes expenses, cycles, subscriptions and loans" onClick={() => setConfirm('data')} />
          <Row icon={Trash2} danger title="Delete account" text="Deletes everything, including your profile" onClick={() => setConfirm('account')} />
        </div>
      </section>

      <Sheet open={!!confirm} onClose={close} title={confirm?.backup ? 'Restore backup?' : confirm === 'account' ? 'Delete account?' : 'Delete all data?'}>
        {confirm?.backup ? (
          <div className="space-y-4 pb-2">
            <p className="text-sm text-muted">This replaces everything currently in Finenzo with the contents of the backup (exported {confirm.backup.exportedAt?.slice(0, 10)}).</p>
            <button className="btn btn-primary w-full" disabled={busy} onClick={() => run(async () => { await api('/import', { method: 'POST', body: confirm.backup }); await qc.invalidateQueries(); close(); }, 'Backup restored')}>
              <Download size={18} /> Replace my data
            </button>
          </div>
        ) : (
          confirm && (
            <div className="space-y-4 pb-2">
              <p className="text-sm text-muted">{confirm === 'account' ? 'Your account and all data will be permanently deleted.' : 'All your expenses, income, cycles, subscriptions, friends and loans will be permanently deleted.'} This can’t be undone. Export a backup first if unsure.</p>
              <label className="block">
                <span className="label">Type DELETE to confirm</span>
                <input className="field" value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" />
              </label>
              <button
                className="btn w-full bg-danger text-white"
                disabled={typed !== 'DELETE' || busy}
                onClick={() => run(async () => {
                  await api(confirm === 'account' ? '/me' : '/me/data', { method: 'DELETE' });
                  if (confirm === 'account') logout();
                  else { await qc.invalidateQueries(); close(); }
                }, confirm === 'account' ? 'Account deleted' : 'All data deleted')}
              >
                {confirm === 'account' ? 'Delete my account' : 'Delete all my data'}
              </button>
            </div>
          )
        )}
      </Sheet>
    </div>
  );
}
