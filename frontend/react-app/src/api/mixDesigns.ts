// Mix designs API — project-scoped wrappers over /projects/{id}/mix-designs and
// the supplier-scoped required-grades endpoints. See backend/app/routers/
// {mix_designs,suppliers}.py. Mix designs are RMC-owned now: the QE reviews them,
// the contractor names the grades it wants, the RMC submits via a token link.

import { api } from './client';
import type {
  GradeResponse,
  MixDesignResponse,
  MixDesignReview,
  RequiredGradeInfo,
} from '../types/master';

export const mixDesignsApi = {
  list(projectId: number): Promise<MixDesignResponse[]> {
    return api
      .get<MixDesignResponse[]>(`/projects/${projectId}/mix-designs`)
      .then((r) => r.data);
  },
  // Grades with an APPROVED mix design — the only grades a pour may use.
  approvedGrades(projectId: number): Promise<GradeResponse[]> {
    return api
      .get<GradeResponse[]>(`/projects/${projectId}/mix-designs/approved-grades`)
      .then((r) => r.data);
  },
  // QE decision on a submitted mix design.
  review(
    projectId: number,
    mixDesignId: number,
    data: MixDesignReview,
  ): Promise<MixDesignResponse> {
    return api
      .patch<MixDesignResponse>(
        `/projects/${projectId}/mix-designs/${mixDesignId}/review`,
        data,
      )
      .then((r) => r.data);
  },
  // Grades the contractor wants this supplier to submit mix designs for.
  requiredGrades(projectId: number, supplierId: number): Promise<RequiredGradeInfo[]> {
    return api
      .get<RequiredGradeInfo[]>(
        `/projects/${projectId}/suppliers/${supplierId}/required-grades`,
      )
      .then((r) => r.data);
  },
  setRequiredGrades(
    projectId: number,
    supplierId: number,
    gradeIds: number[],
  ): Promise<RequiredGradeInfo[]> {
    return api
      .put<RequiredGradeInfo[]>(
        `/projects/${projectId}/suppliers/${supplierId}/required-grades`,
        { grade_ids: gradeIds },
      )
      .then((r) => r.data);
  },
  forSupplier(projectId: number, supplierId: number): Promise<MixDesignResponse[]> {
    return api
      .get<MixDesignResponse[]>(
        `/projects/${projectId}/suppliers/${supplierId}/mix-designs`,
      )
      .then((r) => r.data);
  },
};
