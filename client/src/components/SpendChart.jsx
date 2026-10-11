import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { eachDayOfInterval, format, min, parseISO } from 'date-fns';
import { formatMoney } from '../lib/money.js';

/** Daily spend bars. Loaded lazily so recharts stays out of the first-load bundle. */
export default function SpendChart({ daily, startDate, endDate, today, compact }) {
  const end = min([parseISO(endDate), parseISO(today)]);
  const byDate = Object.fromEntries(daily.map((d) => [d.date, d.amount]));
  const data = eachDayOfInterval({ start: parseISO(startDate), end: end < parseISO(startDate) ? parseISO(startDate) : end }).map((d) => {
    const key = format(d, 'yyyy-MM-dd');
    return { key, day: format(d, 'd'), amount: byDate[key] ?? 0 };
  });
  return (
    <div className="h-36 w-full" role="img" aria-label="Daily spending bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="day" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fontSize: 11, fill: 'rgb(112 108 100)' }} />
          <Tooltip
            cursor={{ fill: 'rgb(var(--surface-2))' }}
            contentStyle={{ borderRadius: 12, border: '1px solid rgb(232 229 220)', fontSize: 13 }}
            formatter={(v) => [formatMoney(v, { compact }), 'Spent']}
            labelFormatter={(_, p) => (p?.[0] ? format(parseISO(p[0].payload.key), 'EEE d MMM') : '')}
          />
          <Bar dataKey="amount" fill="rgb(var(--accent))" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
