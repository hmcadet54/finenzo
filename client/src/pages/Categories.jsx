import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Plus, Tags, Trash2 } from 'lucide-react';
import Sheet from '../components/Sheet.jsx';
import SwipeRow from '../components/SwipeRow.jsx';
import { CategoryDot, EmptyState, ErrorState, Field, ListSkeleton, PageHeader } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { api, useApi, useCategories } from '../lib/queries.js';
import { useHiddenIds, useUndoDelete } from '../lib/undo.js';

const ICONS = ['🍔', '☕', '🛒', '🚌', '⛽', '🏧', '🛍️', '🔁', '🤝', '🏠', '💡', '📱', '🎬', '🎮', '💊', '📚', '✈️', '🎁', '👕', '🐾', '💼', '🧾', '💳', '📦'];
const COLORS = ['#E0894B', '#5B8DEF', '#8E7CC3', '#3FA796', '#D97757', '#D96C9B', '#E0A12B', '#6BA368', '#8A8782', '#4A6FA5'];

function CategoryForm({ category, onClose }) {
  const { toast } = useToast();
  const undo = useUndoDelete();
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? '📦');
  const [color, setColor] = useState(category?.color ?? COLORS[0]);
  const save = useApi((b) => (category ? api.patch(`/categories/${category.id}`, b) : api.post('/categories', b)), {
    onSuccess: () => {
      toast(category ? 'Category updated' : 'Category added');
      onClose();
    },
    onError: (e) => toast(e.message, { tone: 'error' }),
  });
  return (
    <form
      className="space-y-4 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) save.mutate({ name: name.trim(), icon, color });
      }}
    >
      <div className="flex items-center gap-3">
        <CategoryDot category={{ icon, color }} size={52} />
        <div className="flex-1">
          <Field label="Name">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus={!category} />
          </Field>
        </div>
      </div>
      <div>
        <span className="label">Icon</span>
        <div className="grid grid-cols-6 gap-2" role="group" aria-label="Icon">
          {ICONS.map((i) => (
            <button type="button" key={i} aria-pressed={icon === i} onClick={() => setIcon(i)} className={`grid h-11 place-items-center rounded-xl border text-xl ${icon === i ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}>
              {i}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Colour</span>
        <div className="flex flex-wrap gap-2.5" role="group" aria-label="Colour">
          {COLORS.map((c) => (
            <button type="button" key={c} aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className={`h-11 w-11 rounded-full ring-offset-2 ring-offset-bg ${color === c ? 'ring-2 ring-ink' : ''}`} style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        {category && (
          <button
            type="button"
            className="btn btn-danger"
            aria-label="Delete category"
            onClick={() => {
              onClose();
              undo(category.id, `Deleted ${category.name}`, () => api.del(`/categories/${category.id}`));
            }}
          >
            <Trash2 size={18} />
          </button>
        )}
        <button className="btn btn-primary flex-1" disabled={!name.trim() || save.isPending}>
          {category ? 'Save changes' : 'Add category'}
        </button>
      </div>
    </form>
  );
}

export default function Categories() {
  const hidden = useHiddenIds();
  const undo = useUndoDelete();
  const { data, isLoading, error, refetch } = useCategories();
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const items = (data ?? []).filter((c) => !hidden.has(c.id));
  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        back={<Link to="/settings" className="-ml-2 mb-1 inline-flex min-h-[44px] items-center gap-1 px-2 text-sm text-muted"><ChevronLeft size={16} /> Settings</Link>}
        title="Categories"
        right={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={18} /> Add</button>}
      />
      {isLoading && <ListSkeleton rows={6} />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {data && items.length === 0 && <EmptyState icon={Tags} title="No categories" text="Create one to organise your spending." />}
      <ul className="card divide-y divide-line overflow-hidden">
        {items.map((c) => (
          <li key={c.id}>
            <SwipeRow onTap={() => setEditing(c)} onEdit={() => setEditing(c)} onDelete={() => undo(c.id, `Deleted ${c.name}`, () => api.del(`/categories/${c.id}`))}>
              <div className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 lg:pr-14">
                <CategoryDot category={c} />
                <span className="flex-1 font-medium">{c.name}</span>
              </div>
            </SwipeRow>
          </li>
        ))}
      </ul>
      <Sheet open={creating} onClose={() => setCreating(false)} title="New category"><CategoryForm onClose={() => setCreating(false)} /></Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit category">{editing && <CategoryForm category={editing} onClose={() => setEditing(null)} />}</Sheet>
    </div>
  );
}
