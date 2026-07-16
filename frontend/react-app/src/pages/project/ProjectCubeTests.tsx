import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { useProject } from '../../components/layout/ProjectLayout';
import { getApiErrorMessage } from '../../api/client';
import { CastSampleForm } from '../../components/cube/CastSampleForm';
import { CubeSampleList } from '../../components/cube/CubeSampleList';
import { useCubeSamples, useLabs, usePours } from '../../components/cube/queries';
import '../../components/cube/cube.css';

export const ProjectCubeTests: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;
  const isQE = project.access.project_role === 'QUALITY_ENGINEER';

  const samplesQuery = useCubeSamples(pid);
  const poursQuery = usePours(pid);
  const labsQuery = useLabs(pid);

  const [showCast, setShowCast] = useState(false);

  const loadError = samplesQuery.error ?? poursQuery.error ?? labsQuery.error;

  return (
    <div>
      {isQE && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowCast((s) => !s)}>
            Cast sample
          </Button>
        </div>
      )}

      {loadError && <ErrorBox>{getApiErrorMessage(loadError, 'Unable to load cube tests.')}</ErrorBox>}

      {isQE && showCast && (
        <CastSampleForm
          pid={pid}
          pours={poursQuery.data ?? []}
          labs={labsQuery.data ?? []}
          onClose={() => setShowCast(false)}
        />
      )}

      <CubeSampleList
        samples={samplesQuery.data ?? []}
        loading={samplesQuery.isPending}
        isQE={!!isQE}
        pid={pid}
      />
    </div>
  );
};
