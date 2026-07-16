import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ErrorBox } from '../ui/ErrorBox';
import { getApiErrorMessage } from '../../api/client';
import { str } from '../../lib/coerce';
import type { LabResponse, PourResponse } from '../../types/master';
import { useCastSample } from './queries';

interface CastSampleFormProps {
  pid: number;
  pours: PourResponse[];
  labs: LabResponse[];
  onClose: () => void;
}

const schema = z.object({
  pour_id: z.string().min(1, 'Select a pour'),
  sample_reference: z.string(),
  cast_date: z.string().min(1, 'Pick a cast date'),
  no_of_cubes: z.string().min(1, 'Required').refine((v) => Number(v) > 0, 'Must be at least 1'),
  lab_id: z.string(),
});
type FormValues = z.infer<typeof schema>;

export const CastSampleForm: React.FC<CastSampleFormProps> = ({ pid, pours, labs, onClose }) => {
  const cast = useCastSample(pid);
  const [error, setError] = useState<string | null>(null);

  const {
    register, handleSubmit, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { pour_id: '', sample_reference: '', cast_date: '', no_of_cubes: '9', lab_id: '' },
  });

  const onSubmit = async (v: FormValues) => {
    setError(null);
    try {
      await cast.mutateAsync({
        pourId: Number(v.pour_id),
        data: {
          sample_reference: str(v.sample_reference) ?? null,
          cast_date: v.cast_date,
          no_of_cubes: Number(v.no_of_cubes),
          lab_id: v.lab_id ? Number(v.lab_id) : null,
        },
      });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to cast cube sample.'));
    }
  };

  return (
    <Card className="qms-form-section">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <h3 className="qms-section-heading">Cast a cube sample</h3>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="qms-grid-3">
          <Select
            label="Pour"
            required
            error={errors.pour_id?.message}
            {...register('pour_id')}
            options={[
              { label: pours.length ? 'Select pour…' : 'No pours yet — raise one first', value: '' },
              ...pours.map((p) => ({
                label: `${p.pour_reference ?? `PC-${p.pour_id}`} · ${p.grade_name ?? '—'} · ${[p.tower_name, p.floor_label].filter(Boolean).join(' ')}`,
                value: p.pour_id,
              })),
            ]}
          />
          <Input
            label="Sample reference"
            placeholder="e.g. CS-001"
            {...register('sample_reference')}
          />
          <Input
            label="Cast date"
            type="date"
            required
            error={errors.cast_date?.message}
            {...register('cast_date')}
          />
          <Input
            label="No. of cubes"
            type="number"
            min="1"
            required
            placeholder="9 (three sets for 7/14/28-day)"
            error={errors.no_of_cubes?.message}
            {...register('no_of_cubes')}
          />
          <Select
            label="Lab (optional)"
            {...register('lab_id')}
            options={[
              { label: 'Not assigned yet', value: '' },
              ...labs
                .filter((l) => !l.is_blocked && (l.approval_status === 'NOT_REQUIRED' || l.approval_status === 'ACCEPTED'))
                .map((l) => ({ label: l.lab_name, value: l.lab_id })),
            ]}
          />
        </div>
        <p className="qms-text-sm text-muted qms-cube-record-note">
          Choosing a lab with a contact email emails it the report link, so it can
          submit the 7/14/28-day strength reports directly.
        </p>
        <div className="qms-form-actions qms-cube-actions">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={cast.isPending}>
            {cast.isPending ? 'Saving…' : 'Cast sample'}
          </Button>
        </div>
      </form>
    </Card>
  );
};
