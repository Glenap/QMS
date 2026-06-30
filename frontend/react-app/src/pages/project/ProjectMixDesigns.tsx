// Project-wide mix designs. Mix designs are RMC-owned now: suppliers submit them
// via a tokenised link (see SupplierDetail to request grades + share the link).
// The quality engineer reviews each here (Approve / Reject / In progress).

import React from 'react';
import { Card } from '../../components/ui/Card';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { MixDesignsPanel } from '../../components/mix/MixDesignsPanel';
import { useProject } from '../../components/layout/ProjectLayout';
import { useAuth } from '../../hooks/useAuth';
import { getApiErrorMessage } from '../../api/client';
import { useMixDesigns } from '../../queries/mixDesigns';

export const ProjectMixDesigns: React.FC = () => {
  const { project } = useProject();
  const { user } = useAuth();
  const pid = project.project_id;
  const canReview = user?.role === 'QUALITY_ENGINEER';

  const { data: rows = [], isPending, error: loadError } = useMixDesigns(pid);

  return (
    <div>
      {loadError && <ErrorBox>{getApiErrorMessage(loadError, 'Unable to load mix designs.')}</ErrorBox>}

      <Card className="qms-form-section" padding="none">
        <div className="qms-card-header">
          <h3 className="qms-section-heading-plain">Mix designs</h3>
        </div>
        <div className="qms-p-4">
          {isPending ? (
            <p className="text-muted qms-text-sm">Loading…</p>
          ) : (
            <MixDesignsPanel
              pid={pid}
              designs={rows}
              canReview={canReview}
              emptyText="No mix designs submitted yet. Request grades from a supplier to invite them to submit."
            />
          )}
        </div>
      </Card>
    </div>
  );
};
