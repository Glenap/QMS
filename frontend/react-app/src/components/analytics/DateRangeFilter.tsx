// A small period picker shared by the dashboard + analytics filter bars:
// Last 7 / 15 / 30 days, or a custom from/to range. Default is last 7 days.
// Controlled — the parent owns the preset + custom dates and derives the actual
// {date_from, date_to} range with `presetRange` (see ./dateRange).

import React from 'react';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { DATE_PRESET_OPTIONS, type DatePreset } from './dateRange';

interface Props {
  preset: DatePreset;
  from: string;
  to: string;
  onPreset: (p: DatePreset) => void;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}

export const DateRangeFilter: React.FC<Props> = ({ preset, from, to, onPreset, onFrom, onTo }) => (
  <>
    <Select
      label="Period"
      fullWidth={false}
      value={preset}
      onChange={(e) => onPreset(e.target.value as DatePreset)}
      options={DATE_PRESET_OPTIONS}
    />
    {preset === 'custom' && (
      <>
        <Input label="From" type="date" fullWidth={false} value={from} onChange={(e) => onFrom(e.target.value)} />
        <Input label="To" type="date" fullWidth={false} value={to} onChange={(e) => onTo(e.target.value)} />
      </>
    )}
  </>
);
