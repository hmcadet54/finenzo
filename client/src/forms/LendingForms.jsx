import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import Sheet from '../components/Sheet.jsx';
import AmountInput from '../components/AmountInput.jsx';
import { Field, Segmented, Toggle } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { api, useApi } from '../lib/queries.js';
import { parseAmount } from '../lib/money.js';
import { todayStr } from '../lib/dates.js';
import { useUndoDelete } from '../lib/undo.js';
import { useNavigate } from 'react-router-dom';

function FriendForm({ friend, onClose }) {
  const { toast } = useToast();
  const undo = useUndoDelete();
  const navigate = useNavigate();
  const [name, setName] = useState(friend?.name ?? '');
  const [phone, setPhone] = useState(friend?.phone ?? '');
  const [note, setNote] = useState(friend?.note ?? '');
  const save = useApi((b) => (friend ? api.patch(`/friends/${friend.id}`, b) : api.post('/friends', b)), {
    onSuccess: () => {
      toast(friend ? 'Friend updated' : 'Friend added');
      onClose();
    },
    onError: (e) => toast(e.message, { tone: 'error' }),
  });
  return (
    <form
      className="space-y-4 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) save.mutate({ name: name.trim(), phone: phone.trim(), note });
      }}
    >
      <Field label="Name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus={!friend} /></Field>
      <Field label="Phone (optional)" hint="Used to open WhatsApp reminders. Include country code, e.g. 923001234567."><input className="field" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} /></Field>
      <Field label="Note (optional)"><input className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
      <div className="flex gap-2">
        {friend && (
          <button
            type="button"
            className="btn btn-danger"
            aria-label="Delete friend"
            onClick={() => {
              onClose();
              undo(friend.id, `Deleted ${friend.name} and their loans`, async () => {
                await api.del(`/friends/${friend.id}`);
                navigate('/settings/friends', { replace: true });
              });
            }}
          >
            <Trash2 size={18} />
          </button>
        )}
        <button className="btn btn-primary flex-1" disabled={!name.trim() || save.isPending}>{friend ? 'Save changes' : 'Add friend'}</button>
      </div>
    </form>
  );
}

export function FriendSheet({ open, onClose, friend }) {
  return (
    <Sheet open={open} onClose={onClose} title={friend ? 'Edit friend' : 'Add friend'}>
      <FriendForm friend={friend} onClose={onClose} />
    </Sheet>
  );
}

function LoanForm({ friendId, loan, onClose }) {
  const { toast } = useToast();
  const undo = useUndoDelete();
  const editing = !!loan;
  const [direction, setDirection] = useState(loan?.direction ?? 'lent');
  const [amount, setAmount] = useState(loan ? String(loan.amount) : '');
  const [dateLent, setDateLent] = useState(loan?.dateLent ?? todayStr());
  const [expected, setExpected] = useState(loan?.expectedReturnDate ?? '');
  const [note, setNote] = useState(loan?.note ?? '');
  const [linked, setLinked] = useState(false);
  const save = useApi((b) => (editing ? api.patch(`/loans/${loan.id}`, b) : api.post('/loans', { ...b, friendId, createLinked: linked })), {
    onSuccess: () => {
      toast(editing ? 'Loan updated' : 'Loan added');
      onClose();
    },
    onError: (e) => toast(e.message, { tone: 'error' }),
  });
  const ok = parseAmount(amount) > 0;
  return (
    <form
      className="space-y-4 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) save.mutate({ direction, amount, dateLent, expectedReturnDate: expected || null, note });
      }}
    >
      <Segmented label="Direction" value={direction} onChange={setDirection} options={[{ value: 'lent', label: 'I lent' }, { value: 'borrowed', label: 'I borrowed' }]} />
      <AmountInput value={amount} onChange={setAmount} autoFocus={!editing} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={direction === 'lent' ? 'Date lent' : 'Date borrowed'}><input type="date" className="field" value={dateLent} onChange={(e) => setDateLent(e.target.value)} /></Field>
        <Field label="Expected return"><input type="date" className="field" value={expected} min={dateLent} onChange={(e) => setExpected(e.target.value)} /></Field>
      </div>
      <Field label="Note (optional)"><input className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
      {!editing && (
        <div className="card overflow-hidden">
          <Toggle checked={linked} onChange={setLinked} label={direction === 'lent' ? 'Also record as an expense' : 'Also record as income'} description={direction === 'lent' ? 'Subtracts it from this cycle’s balance' : 'Adds it to this cycle’s balance'} />
        </div>
      )}
      <div className="flex gap-2">
        {editing && (
          <button
            type="button"
            className="btn btn-danger"
            aria-label="Delete loan"
            onClick={() => {
              onClose();
              undo(loan.id, 'Deleted loan', () => api.del(`/loans/${loan.id}`));
            }}
          >
            <Trash2 size={18} />
          </button>
        )}
        <button className="btn btn-primary flex-1" disabled={!ok || save.isPending}>{editing ? 'Save changes' : 'Add loan'}</button>
      </div>
    </form>
  );
}

export function LoanSheet({ open, onClose, friendId, loan }) {
  return (
    <Sheet open={open} onClose={onClose} title={loan ? 'Edit loan' : 'New loan'}>
      <LoanForm friendId={friendId} loan={loan} onClose={onClose} />
    </Sheet>
  );
}

function RepaymentForm({ loan, onClose }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(String(loan.outstanding));
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [linked, setLinked] = useState(false);
  const lent = loan.direction === 'lent';
  const save = useApi((b) => api.post(`/loans/${loan.id}/repayments`, b), {
    onSuccess: () => {
      toast('Repayment recorded');
      onClose();
    },
    onError: (e) => toast(e.message, { tone: 'error' }),
  });
  const v = parseAmount(amount);
  const ok = v > 0 && v <= loan.outstanding;
  return (
    <form
      className="space-y-4 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) save.mutate({ amount, date, note, createLinked: linked });
      }}
    >
      <AmountInput label={lent ? 'Amount received' : 'Amount repaid'} value={amount} onChange={setAmount} autoFocus />
      {v > loan.outstanding && <p className="text-sm text-danger" role="alert">That’s more than the outstanding {loan.outstanding.toLocaleString()}.</p>}
      <Field label="Date"><input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Note (optional)"><input className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
      <div className="card overflow-hidden">
        <Toggle checked={linked} onChange={setLinked} label={lent ? 'Add to my balance as income' : 'Record as an expense'} description={lent ? 'The money is credited back into this cycle' : 'Subtracts it from this cycle’s balance'} />
      </div>
      <button className="btn btn-primary w-full" disabled={!ok || save.isPending}>Record repayment</button>
    </form>
  );
}

export function RepaymentSheet({ open, onClose, loan }) {
  return (
    <Sheet open={open && !!loan} onClose={onClose} title="Record repayment">
      {loan && <RepaymentForm loan={loan} onClose={onClose} />}
    </Sheet>
  );
}
