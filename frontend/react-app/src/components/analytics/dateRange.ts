// Date-range preset helpers, shared by the dashboard + analytics filter bars.
// (Kept in a plain module so the DateRangeFilter component file exports only a
// component — react-refresh requires that.)

export type DatePreset = '7' | '15' | '30' | 'all' | 'custom';

export const DATE_PRESET_OPTIONS = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 15 days', value: '15' },
  { label: 'Last 30 days', value: '30' },
  { label: 'All time', value: 'all' },
  { label: 'Custom range', value: 'custom' },
];

// Resolve a preset (relative to today) to a concrete date range. 'all' is
// unbounded (no date filter); 'custom' uses the caller's own from/to inputs
// (blank → unbounded on that side).
export const presetRange = (
  preset: DatePreset,
  from = '',
  to = '',
): { date_from?: string; date_to?: string } => {
  if (preset === 'all') return {};
  if (preset === 'custom') return { date_from: from || undefined, date_to: to || undefined };
  const iso = (d: Date): string => d.toISOString().slice(0, 10);
  const start = new Date();
  start.setDate(start.getDate() - Number(preset));
  return { date_from: iso(start), date_to: iso(new Date()) };
};
