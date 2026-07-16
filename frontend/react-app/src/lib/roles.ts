// Project-level role labels (app.models.auth.ProjectRole), used in the project
// workspace (Team tab, dashboards).

export const PROJECT_ROLE_LABELS: Record<string, string> = {
  CLIENT_LEAD: 'Client Lead',
  CONTRACTOR_LEAD: 'Contractor Lead',
  PROJECT_MANAGER: 'Project Manager',
  QUALITY_ENGINEER: 'Quality Engineer',
  SUPERVISOR: 'Supervisor',
};

export const projectRoleLabel = (role: string): string =>
  PROJECT_ROLE_LABELS[role] ?? role;

// The project's QE/PM designation, or the contractor admin, may block/unblock an
// RMC or lab. Mirrors backend `ensure_can_block_entities` (per-project now).
export const canBlockEntities = (
  access: { project_role: string | null; is_contractor_admin: boolean },
): boolean =>
  access.project_role === 'QUALITY_ENGINEER' ||
  access.project_role === 'PROJECT_MANAGER' ||
  access.is_contractor_admin;
