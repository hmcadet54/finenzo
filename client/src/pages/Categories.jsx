import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronLeft, Plus, Search, Tags, Trash2 } from 'lucide-react';
import Sheet from '../components/Sheet.jsx';
import SwipeRow from '../components/SwipeRow.jsx';
import { CategoryDot, EmptyState, ErrorState, Field, ListSkeleton, PageHeader } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { api, useApi, useCategories } from '../lib/queries.js';
import { useHiddenIds, useUndoDelete } from '../lib/undo.js';

const EMOJI_GROUPS = [
  {
    name: 'Food & Drink',
    icons: ['🍔', '🍕', '☕', '🍜', '🍣', '🍩', '🍺', '🍷', '🥗', '🥑', '🥐', '🥩', '🍦', '🍱', '🥪'],
  },
  {
    name: 'Home & Bills',
    icons: ['🏠', '💡', '💧', '📶', '🧹', '🛋️', '🔑', '🚿', '🔧', '🪴', '🛏️', '⚡'],
  },
  {
    name: 'Transport',
    icons: ['🚌', '⛽', '🚗', '🚕', '🚇', '✈️', '🚲', '🛵', '🚂', '🚢', '🅿️'],
  },
  {
    name: 'Shopping',
    icons: ['🛒', '🛍️', '👕', '👟', '💄', '💍', '🎁', '📦', '👓', '🎒'],
  },
  {
    name: 'Fun & Leisure',
    icons: ['🎬', '🎮', '🎵', '🎟️', '⚽', '🎳', '🏖️', '📚', '🎨', '🎪', '🍿'],
  },
  {
    name: 'Health & Self',
    icons: ['💊', '🏋️', '🧘', '🩺', '🦷', '🧖', '🍎', '🩹', '💈', '💅'],
  },
  {
    name: 'Tech & Work',
    icons: ['📱', '💻', '📺', '🎧', '📷', '💼', '🏧', '🧾', '💳', '💰', '📈', '🐾'],
  },
];

const ALL_ICONS = EMOJI_GROUPS.flatMap((g) => g.icons);

const COLORS = [
  '#D97757', '#E0894B', '#E05A47', '#E0A12B', '#EAB308', '#F59E0B',
  '#84CC16', '#6BA368', '#3FA796', '#2A9D9A', '#10B981', '#06B6D4',
  '#0EA5E9', '#3B82F6', '#5B8DEF', '#4F7DF0', '#6366F1', '#8E7CC3',
  '#8B5CF6', '#A855F7', '#D96C9B', '#EC4899', '#F43F5E', '#FB7185',
  '#8A8782', '#64748B', '#475569', '#334155',
];

function CategoryForm({ category, onClose }) {
  const { toast } = useToast();
  const undo = useUndoDelete();
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? '📦');
  const [color, setColor] = useState(category?.color ?? COLORS[0]);
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [emojiSearch, setEmojiSearch] = useState('');

  const displayedIcons = useMemo(() => {
    if (selectedGroup === 'All') return ALL_ICONS;
    const group = EMOJI_GROUPS.find((g) => g.name === selectedGroup);
    return group ? group.icons : ALL_ICONS;
  }, [selectedGroup]);

  const save = useApi((b) => (category ? api.patch(`/categories/${category.id}`, b) : api.post('/categories', b)), {
    onSuccess: () => {
      toast(category ? 'Category updated' : 'Category added');
      onClose();
    },
    onError: (e) => toast(e.message, { tone: 'error' }),
  });

  const isCustomColor = !COLORS.includes(color);

  return (
    <form
      className="space-y-4 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) save.mutate({ name: name.trim(), icon, color });
      }}
    >
      <div className="flex items-center gap-3">
        <CategoryDot category={{ icon, color }} size={56} />
        <div className="flex-1">
          <Field label="Name">
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Groceries, Coffee, Tech"
              maxLength={40}
              autoFocus={!category}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="label !mb-0">Icon</span>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Custom emoji:
            <input
              type="text"
              maxLength={4}
              className="h-7 w-12 rounded-lg border border-line bg-surface text-center text-sm font-semibold text-ink outline-none focus:border-accent"
              value={icon}
              onChange={(e) => {
                if (e.target.value.trim()) setIcon(e.target.value.trim());
              }}
              placeholder="📦"
            />
          </label>
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar" role="group" aria-label="Icon groups">
          <button
            type="button"
            className="chip !min-h-[32px] !px-2.5 !py-1 text-xs"
            aria-pressed={selectedGroup === 'All'}
            onClick={() => setSelectedGroup('All')}
          >
            All
          </button>
          {EMOJI_GROUPS.map((g) => (
            <button
              key={g.name}
              type="button"
              className="chip !min-h-[32px] !px-2.5 !py-1 text-xs"
              aria-pressed={selectedGroup === g.name}
              onClick={() => setSelectedGroup(g.name)}
            >
              {g.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-7 sm:grid-cols-8 gap-2 max-h-48 overflow-y-auto pr-1" role="group" aria-label="Icon choices">
          {displayedIcons.map((i) => (
            <button
              type="button"
              key={i}
              aria-pressed={icon === i}
              onClick={() => setIcon(i)}
              className={`grid h-10 place-items-center rounded-xl border text-xl transition-transform active:scale-90 ${
                icon === i
                  ? 'border-accent bg-accent-soft shadow-sm scale-105 ring-1 ring-accent'
                  : 'border-line/70 bg-surface hover:bg-surface-2'
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="label !mb-0">Colour</span>
          <span className="text-xs text-muted font-mono uppercase">{color}</span>
        </div>
        <div className="flex flex-wrap gap-2.5 max-h-36 overflow-y-auto pr-1" role="group" aria-label="Colour choices">
          {COLORS.map((c) => (
            <button
              type="button"
              key={c}
              aria-label={`Colour ${c}`}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={`grid h-9 w-9 place-items-center rounded-full ring-offset-2 ring-offset-bg active:scale-95 ${
                color === c ? 'ring-2 ring-ink' : ''
              }`}
              style={{ background: c }}
            >
              {color === c && <Check size={15} className="text-white mix-blend-difference" />}
            </button>
          ))}
          <label
            className={`relative grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-dashed border-muted text-xs font-semibold text-muted ring-offset-2 ring-offset-bg ${
              isCustomColor ? 'ring-2 ring-ink' : ''
            }`}
            style={isCustomColor ? { background: color, color: 'white' } : undefined}
            title="Custom colour"
          >
            <span aria-hidden>#</span>
            <input
              type="color"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              value={color}
              onChange={(e) => setColor(e.target.value.toUpperCase())}
              aria-label="Custom hex colour"
            />
          </label>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
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
        back={
          <Link to="/settings" className="-ml-2 mb-1 inline-flex min-h-[44px] items-center gap-1 px-2 text-sm text-muted">
            <ChevronLeft size={16} /> Settings
          </Link>
        }
        title="Categories"
        right={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={18} /> Add
          </button>
        }
      />
      {isLoading && <ListSkeleton rows={6} />}
      {error && !data && <ErrorState error={error} onRetry={refetch} />}
      {data && items.length === 0 && <EmptyState icon={Tags} title="No categories" text="Create one to organise your spending." />}
      <ul className="card divide-y divide-line overflow-hidden">
        {items.map((c) => (
          <li key={c.id}>
            <SwipeRow
              onTap={() => setEditing(c)}
              onEdit={() => setEditing(c)}
              onDelete={() => undo(c.id, `Deleted ${c.name}`, () => api.del(`/categories/${c.id}`))}
            >
              <div className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 lg:pr-14">
                <CategoryDot category={c} />
                <span className="flex-1 font-medium">{c.name}</span>
              </div>
            </SwipeRow>
          </li>
        ))}
      </ul>
      <Sheet open={creating} onClose={() => setCreating(false)} title="New category">
        <CategoryForm onClose={() => setCreating(false)} />
      </Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit category">
        {editing && <CategoryForm category={editing} onClose={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}
