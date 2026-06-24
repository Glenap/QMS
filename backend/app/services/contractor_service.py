"""contractor_service.py — bring contractors onto projects + accept/decline.

A client lead/admin links a contractor to a project (existing contractor org, or
a brand-new one which also triggers a CONTRACTOR_ADMIN invitation). The link
starts PENDING; the contractor admin accepts or declines it.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AlreadyExistsError,
    NotFoundError,
    PermissionDeniedError,
)
from app.core.project_access import ensure_can_manage_client_side
from app.core.security import create_invitation_token
from app.models.auth import OrgType, User, UserRole
from app.models.master import Project, ProjectContractor, Tower
from app.repositories.auth_repo import AuthRepository
from app.repositories.contractor_repo import ContractorRepository
from app.schemas.master import (
    AssignedProjectResponse,
    AvailableContractorResponse,
    ContractorEngagement,
    ProjectContractorCreate,
    ProjectContractorResponse,
)
from app.services.auth_service import _try_send_invitation_email


class ContractorService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ContractorRepository(session)
        self.auth = AuthRepository(session)

    async def add_to_project(
        self, project: Project, data: ProjectContractorCreate, actor: User
    ) -> ProjectContractorResponse:
        await ensure_can_manage_client_side(self.session, actor, project)

        if data.contractor_org_id:
            org = await self.auth.get_org_by_id(data.contractor_org_id)
            if not org or org.org_type != OrgType.CONTRACTOR:
                raise NotFoundError("Contractor")
            # Only contractor orgs this client originally brought on may be
            # re-used — can't attach another client's contractor by id.
            if org.registered_by_org_id != project.org_id:
                raise PermissionDeniedError("That contractor isn't available to your organisation")
            contractor_org_id = org.org_id
        else:
            if not (data.org_name and data.contact_email):
                raise PermissionDeniedError(
                    "Provide contractor_org_id, or org_name + contact_email"
                )
            if await self.auth.email_exists(data.contact_email):
                raise AlreadyExistsError("Email")
            org = await self.auth.create_org(
                org_name=data.org_name,
                org_type=OrgType.CONTRACTOR,
                contact_email=data.contact_email,
                contact_phone=data.contact_phone,
                registered_by_org_id=project.org_id,
            )
            contractor_org_id = org.org_id
            token = create_invitation_token()
            expires_at = datetime.now(UTC) + timedelta(hours=72)
            await self.auth.create_invitation(
                org_id=org.org_id,
                invited_email=data.contact_email,
                role=UserRole.CONTRACTOR_ADMIN,
                invited_by=actor.user_id,
                token=token,
                expires_at=expires_at,
            )
            client_org = await self.auth.get_org_by_id(project.org_id)
            await _try_send_invitation_email(
                invited_email=data.contact_email,
                invited_by_name=client_org.org_name if client_org else actor.full_name,
                org_name=data.org_name,
                role="Contractor Admin",
                token=token,
            )

        if await self.repo.get_existing_link(project.project_id, contractor_org_id):
            raise AlreadyExistsError("Contractor assignment")

        scope = await self._scope_from_towers(project, data.tower_ids, data.scope)

        pc = await self.repo.add(
            ProjectContractor(
                project_id=project.project_id,
                contractor_org_id=contractor_org_id,
                scope=scope,
                status="PENDING",
                assigned_by=actor.user_id,
            )
        )
        return await self._to_response(pc)

    async def _scope_from_towers(
        self, project: Project, tower_ids: list[int], fallback: str | None
    ) -> str:
        """Turn the selected towers into a readable scope label stored verbatim
        in ``ProjectContractor.scope``. No towers selected = the whole project.
        A tower already assigned to another (non-declined) contractor is rejected
        so two contractors never share a tower."""
        if not tower_ids:
            return fallback or "Entire project"

        result = await self.session.execute(
            select(Tower)
            .where(
                Tower.project_id == project.project_id,
                Tower.tower_id.in_(tower_ids),
            )
            .order_by(Tower.tower_id)
        )
        towers = list(result.scalars().all())
        if len(towers) != len(set(tower_ids)):
            raise NotFoundError("Tower")

        names = [t.tower_name for t in towers]
        await self._reject_taken_towers(project, names)
        return ", ".join(names)

    async def _reject_taken_towers(
        self, project: Project, selected_names: list[str]
    ) -> None:
        """Block towers already allotted to another contractor on this project.
        Uses the readable ``scope`` label of existing assignments (the same
        comma-joined tower names this service writes)."""
        existing = await self.repo.list_for_project(project.project_id)
        taken: set[str] = set()
        whole_project_taken = False
        for pc in existing:
            if pc.status == "DECLINED":
                continue
            if not pc.scope or pc.scope == "Entire project":
                whole_project_taken = True
                continue
            taken.update(name.strip() for name in pc.scope.split(","))

        clashes = [n for n in selected_names if whole_project_taken or n in taken]
        if clashes:
            raise PermissionDeniedError(
                f"Already assigned to another contractor: {', '.join(clashes)}"
            )

    async def list_for_project(self, project: Project) -> list[ProjectContractorResponse]:
        pcs = await self.repo.list_for_project(project.project_id)
        return [await self._to_response(pc) for pc in pcs]

    async def list_available_for_project(
        self, project: Project, actor: User
    ) -> list[AvailableContractorResponse]:
        """Contractor orgs this client previously brought on that aren't already
        linked to *this* project — each annotated with the other projects they're
        currently engaged on (PENDING/ACCEPTED) so the UI can warn before reuse."""
        await ensure_can_manage_client_side(self.session, actor, project)

        orgs = await self.repo.contractor_orgs_registered_by(project.org_id)
        existing = await self.repo.list_for_project(project.project_id)
        already_linked = {pc.contractor_org_id for pc in existing}

        out: list[AvailableContractorResponse] = []
        for org in orgs:
            if org.org_id in already_linked:
                continue
            engagements: list[ContractorEngagement] = []
            for pc in await self.repo.list_for_contractor_org(org.org_id):
                if pc.status == "DECLINED" or pc.project_id == project.project_id:
                    continue
                other = await self._get_project(pc.project_id)
                if not other:
                    continue
                engagements.append(
                    ContractorEngagement(
                        project_id=other.project_id,
                        project_name=other.project_name,
                        start_date=other.start_date,
                        end_date=other.end_date,
                        status=pc.status,
                    )
                )
            out.append(
                AvailableContractorResponse(
                    contractor_org_id=org.org_id,
                    org_name=org.org_name,
                    contact_email=org.contact_email,
                    engagements=engagements,
                )
            )
        return out

    async def list_assigned_for_user(self, user: User) -> list[AssignedProjectResponse]:
        """Project links for the caller's contractor org (the accept screen)."""
        pcs = await self.repo.list_for_contractor_org(user.org_id)
        out: list[AssignedProjectResponse] = []
        for pc in pcs:
            project = await self._get_project(pc.project_id)
            if not project:
                continue
            out.append(
                AssignedProjectResponse(
                    pc_id=pc.pc_id,
                    project_id=project.project_id,
                    project_name=project.project_name,
                    project_code=project.project_code,
                    city=project.city,
                    state=project.state,
                    status=pc.status,
                    scope=pc.scope,
                    assigned_at=pc.assigned_at,
                )
            )
        return out

    async def respond(
        self, pc_id: int, accept: bool, user: User
    ) -> ProjectContractorResponse:
        pc = await self.repo.get_by(ProjectContractor.pc_id == pc_id)
        if not pc:
            raise NotFoundError("Contractor assignment")
        if not (
            user.role == UserRole.CONTRACTOR_ADMIN
            and user.org_id == pc.contractor_org_id
        ):
            raise PermissionDeniedError("Only the contractor admin can respond")
        pc.status = "ACCEPTED" if accept else "DECLINED"
        pc.responded_at = datetime.now(UTC)
        await self.session.flush()
        await self.session.refresh(pc)
        return await self._to_response(pc)

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _to_response(self, pc: ProjectContractor) -> ProjectContractorResponse:
        org = await self.auth.get_org_by_id(pc.contractor_org_id)
        return ProjectContractorResponse(
            pc_id=pc.pc_id,
            project_id=pc.project_id,
            contractor_org_id=pc.contractor_org_id,
            contractor_org_name=org.org_name if org else "",
            status=pc.status,
            scope=pc.scope,
            assigned_at=pc.assigned_at,
            responded_at=pc.responded_at,
        )

    async def _get_project(self, project_id: int) -> Project | None:
        res = await self.session.execute(
            select(Project).where(Project.project_id == project_id)
        )
        return res.scalar_one_or_none()
