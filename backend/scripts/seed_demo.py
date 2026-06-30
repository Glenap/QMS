"""seed_demo.py — populate the live DB with one complete demo workflow.

Builds a single end-to-end scenario you can log into and click through:

  * a CLIENT org + admin, a CONTRACTOR org + admin, plus a Quality Engineer and
    a Supervisor — all created **already email-verified** (the OTP step is
    bypassed by inserting active users directly), so they log in immediately;
  * one project (2 towers, floors generated), 2 RMC suppliers + a testing lab;
  * the real operational flow driven in-process through the actual API so every
    validation, the IS-456 quality engine and the auto-NCR all run for real:
    pours → RMC dispatch → truck fill → gate accept/reject → cube samples →
    strength tests (PASS / FAIL / CRITICAL → auto-NCR) → one NCR worked through
    review + corrective action + penalty + close.

Run from the backend/ directory:   uv run python scripts/seed_demo.py

Refuses to run when ENVIRONMENT=production. Aborts (no changes) if the demo
client already exists — wipe first with `uv run python scripts/wipe_db.py --yes`.
"""

import asyncio
import sys
from datetime import UTC, datetime

# The summary banner contains non-ASCII (— · →); force UTF-8 so it prints on a
# Windows cp1252 console instead of raising UnicodeEncodeError.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from httpx import ASGITransport, AsyncClient, Response
from sqlalchemy import select

from app.config import settings
from app.core.security import hash_password
from app.database.session import AsyncSessionLocal
from app.main import app
from app.models.auth import (
    Organisation,
    OrgStatus,
    OrgType,
    ProjectMember,
    User,
    UserRole,
)
from app.models.master import ProjectContractor

API = "/api/v1"
PASSWORD = "Password123!"

CLIENT_ADMIN_EMAIL = "client@skyline-demo.com"
CONTRACTOR_ADMIN_EMAIL = "contractor@buildwell-demo.com"
QE_EMAIL = "qe@buildwell-demo.com"
SUPERVISOR_EMAIL = "supervisor@buildwell-demo.com"

PROJECT_PAYLOAD = {
    "project_name": "Skyline Heights — Demo",
    "project_type": "RESIDENTIAL",
    "project_code": "DEMO-SKY-01",
    "address_line1": "Survey 21, Sarjapur Road",
    "city": "Bengaluru",
    "state": "KA",
    "pin_code": "560035",
    "start_date": "2026-04-01",
    "end_date": "2028-06-30",
    "no_of_towers": 2,
    "max_floors": 24,
    "acceptance_criteria": "IS 456:2000",
    "final_test_age_days": 28,
    "towers": [
        {"tower_name": "Tower A", "tower_type": "Residential", "floors_total": 24},
        {"tower_name": "Tower B", "tower_type": "Residential", "floors_total": 22},
    ],
}

# (tower_index, floor_index, component_type, grade_name, supplier_key, outcome,
#  cast_date, test_date, truck) — outcome drives the observed strength relative
# to the grade's required strength; truck is 'accept' | 'reject' | None.
POUR_PLAN = [
    (0, 0, "RAFT", "M30", "s1", "PASS", "2026-05-02", "2026-05-30", "accept"),
    (0, 1, "COLUMN", "M35", "s1", "PASS", "2026-05-06", "2026-06-03", "accept"),
    (0, 2, "SLAB", "M30", "s2", "FAIL", "2026-05-10", "2026-06-07", "accept"),
    (1, 0, "RAFT", "M40", "s2", "PASS", "2026-05-14", "2026-06-11", "reject"),
    (1, 1, "BEAM", "M25", "s1", "CRITICAL", "2026-05-18", "2026-06-15", "accept"),
    (1, 2, "COLUMN", "M35", "s2", "PASS", "2026-05-22", "2026-06-19", "accept"),
    (0, 3, "SLAB", "M30", "s1", "PASS", "2026-06-01", "2026-06-22", None),
    (1, 3, "SHEAR_WALL", "M40", "s2", "FAIL", "2026-06-05", "2026-06-24", "accept"),
]

# observed = required(min_strength) * factor  →  PASS / FAIL (85–100%) / CRITICAL (<85%)
_FACTOR = {"PASS": 1.12, "FAIL": 0.92, "CRITICAL": 0.72}


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _ok(resp: Response, what: str) -> Response:
    if resp.status_code >= 300:
        raise RuntimeError(f"{what} failed: {resp.status_code} {resp.text}")
    return resp


async def _login(c: AsyncClient, email: str) -> str:
    resp = _ok(
        await c.post(f"{API}/auth/login", json={"email": email, "password": PASSWORD}),
        f"login {email}",
    )
    return resp.json()["access_token"]


async def _create_people() -> dict:
    """Create the orgs + verified users directly (OTP bypassed). Returns ids."""
    async with AsyncSessionLocal() as s:
        exists = (
            await s.execute(select(User).where(User.email == CLIENT_ADMIN_EMAIL))
        ).scalar_one_or_none()
        if exists:
            return {}

        client_org = Organisation(
            org_name="Skyline Developers (Demo)", org_type=OrgType.CLIENT,
            status=OrgStatus.ACTIVE, contact_email=CLIENT_ADMIN_EMAIL,
        )
        s.add(client_org)
        await s.flush()

        contractor_org = Organisation(
            org_name="BuildWell Constructions (Demo)", org_type=OrgType.CONTRACTOR,
            status=OrgStatus.ACTIVE, contact_email=CONTRACTOR_ADMIN_EMAIL,
            registered_by_org_id=client_org.org_id,
        )
        s.add(contractor_org)
        await s.flush()

        def user(org_id, email, name, role, admin=False):
            u = User(
                org_id=org_id, email=email, hashed_password=hash_password(PASSWORD),
                full_name=name, role=role, is_org_admin=admin,
                is_active=True, is_offboarded=False,
            )
            s.add(u)
            return u

        client_admin = user(client_org.org_id, CLIENT_ADMIN_EMAIL, "Anita Rao", UserRole.CLIENT_ADMIN, True)
        contractor_admin = user(contractor_org.org_id, CONTRACTOR_ADMIN_EMAIL, "Vikram Shah", UserRole.CONTRACTOR_ADMIN, True)
        qe = user(contractor_org.org_id, QE_EMAIL, "Priya Nair", UserRole.QUALITY_ENGINEER)
        supervisor = user(contractor_org.org_id, SUPERVISOR_EMAIL, "Ramesh Iyer", UserRole.SUPERVISOR)
        await s.flush()

        ids = {
            "client_org_id": client_org.org_id,
            "contractor_org_id": contractor_org.org_id,
            "client_admin_id": client_admin.user_id,
            "contractor_admin_id": contractor_admin.user_id,
            "qe_id": qe.user_id,
            "supervisor_id": supervisor.user_id,
        }
        await s.commit()
        return ids


async def _link_contractor_and_members(pid: int, ids: dict) -> None:
    """Attach the contractor (ACCEPTED) + QE/Supervisor members to the project.

    Done directly to skip the email-token contractor-accept / invite flow; the
    result is identical to what those flows persist.
    """
    async with AsyncSessionLocal() as s:
        s.add(ProjectContractor(
            project_id=pid, contractor_org_id=ids["contractor_org_id"], tower_id=None,
            scope="Entire project", status="ACCEPTED",
            responded_at=datetime.now(UTC), assigned_by=ids["client_admin_id"],
        ))
        s.add(ProjectMember(
            project_id=pid, user_id=ids["qe_id"], org_id=ids["contractor_org_id"],
            project_role="QUALITY_ENGINEER", assigned_by=ids["contractor_admin_id"],
        ))
        s.add(ProjectMember(
            project_id=pid, user_id=ids["supervisor_id"], org_id=ids["contractor_org_id"],
            project_role="SUPERVISOR", assigned_by=ids["contractor_admin_id"],
        ))
        await s.commit()


async def _run_truck(c, qe_tok, sup_tok, pid, *, pour_id, supplier_id, grade_id, volume, mode):
    created = _ok(
        await c.post(
            f"{API}/projects/{pid}/dispatches",
            json={"pour_id": pour_id, "supplier_id": supplier_id,
                  "grade_id": grade_id, "volume_ordered_cum": volume},
            headers=_bearer(qe_tok),
        ),
        "raise dispatch",
    ).json()
    token = created["truck"]["token"]
    _ok(
        await c.post(
            f"{API}/external/dispatch?token={token}",
            json={
                "vehicle_number": f"KA01AB{1000 + pour_id}",
                "driver_name": "Suresh K.",
                "batch_number": f"BN-{pour_id:04d}",
                "challan_number": f"CH-{pour_id:04d}",
                "volume_cum": volume,
                "wc_ratio_actual": 0.45,
                "slump_at_plant_mm": 120,
            },
        ),
        "fill truck",
    )
    if mode == "reject":
        _ok(
            await c.post(
                f"{API}/projects/{pid}/gate/{token}/reject",
                json={"rejection_reason": "Slump out of range on arrival"},
                headers=_bearer(sup_tok),
            ),
            "reject truck",
        )
    else:
        _ok(
            await c.post(
                f"{API}/projects/{pid}/gate/{token}/arrive",
                json={"slump_at_site_mm": 110}, headers=_bearer(sup_tok),
            ),
            "arrive truck",
        )
        _ok(
            await c.post(f"{API}/projects/{pid}/gate/{token}/accept", headers=_bearer(sup_tok)),
            "accept truck",
        )


async def _run_cube(c, qe_tok, pid, *, pour_id, grade_min, outcome, cast_date, test_date, lab_id, ref):
    sample = _ok(
        await c.post(
            f"{API}/projects/{pid}/pours/{pour_id}/samples",
            json={"cast_date": cast_date, "no_of_cubes": 3,
                  "sample_reference": ref, "lab_id": lab_id},
            headers=_bearer(qe_tok),
        ),
        "cast sample",
    ).json()
    # Results now come from the lab through its tokenised link. Grab the link the
    # QE would share, then submit the 28-day report the way a lab would.
    link = _ok(
        await c.post(
            f"{API}/projects/{pid}/samples/{sample['sample_id']}/report-link",
            headers=_bearer(qe_tok),
        ),
        "get lab report link",
    ).json()
    token = link["token"]
    _ok(
        await c.post(
            f"{API}/external/lab-report/start?token={token}",
            json={"testing_started_on": cast_date},
        ),
        "lab: start testing",
    )
    observed = round(grade_min * _FACTOR[outcome], 1)
    _ok(
        await c.post(
            f"{API}/external/lab-report?token={token}",
            data={"test_age_days": "28", "test_date": test_date,
                  "observed_strength_mpa": str(observed)},
        ),
        "lab: submit 28-day report",
    )


async def _work_one_ncr(c, qe_tok, pid) -> None:
    """Take the first open NCR through the full lifecycle to a CLOSED state."""
    ncrs = _ok(await c.get(f"{API}/projects/{pid}/ncrs", headers=_bearer(qe_tok)), "list ncrs").json()
    target = next((n for n in ncrs if n["status"] != "CLOSED"), None)
    if not target:
        return
    nid = target["ncr_id"]
    _ok(
        await c.patch(
            f"{API}/projects/{pid}/ncrs/{nid}",
            json={"status": "UNDER_REVIEW",
                  "root_cause": "Low cement content + curing delay on the affected pour"},
            headers=_bearer(qe_tok),
        ),
        "ncr → review",
    )
    action = _ok(
        await c.post(
            f"{API}/projects/{pid}/ncrs/{nid}/corrective-actions",
            json={"action_description": "Recalibrate moisture probe; retrain batching crew",
                  "due_date": "2026-07-10"},
            headers=_bearer(qe_tok),
        ),
        "add corrective action",
    ).json()
    _ok(
        await c.patch(
            f"{API}/projects/{pid}/ncrs/{nid}/corrective-actions/{action['action_id']}",
            json={"status": "COMPLETED"}, headers=_bearer(qe_tok),
        ),
        "complete corrective action",
    )
    _ok(
        await c.post(
            f"{API}/projects/{pid}/ncrs/{nid}/penalties",
            json={"penalty_type": "RATE_REDUCTION", "amount": 25000,
                  "description": "5% rate reduction on the affected pour"},
            headers=_bearer(qe_tok),
        ),
        "apply penalty",
    )
    _ok(
        await c.patch(
            f"{API}/projects/{pid}/ncrs/{nid}", json={"status": "CLOSED"},
            headers=_bearer(qe_tok),
        ),
        "close ncr",
    )


async def seed() -> None:
    if settings.is_production:
        print("Refusing to seed a PRODUCTION database. Aborting.")
        sys.exit(1)

    ids = await _create_people()
    if not ids:
        print(
            f"Demo client '{CLIENT_ADMIN_EMAIL}' already exists — nothing changed.\n"
            "Wipe first to reseed:  uv run python scripts/wipe_db.py --yes"
        )
        return

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://demo") as c:
        client_tok = await _login(c, CLIENT_ADMIN_EMAIL)

        project = _ok(
            await c.post(f"{API}/projects", json=PROJECT_PAYLOAD, headers=_bearer(client_tok)),
            "create project",
        ).json()
        pid = project["project_id"]
        towers = _ok(
            await c.get(f"{API}/projects/{pid}/towers", headers=_bearer(client_tok)), "list towers"
        ).json()

        await _link_contractor_and_members(pid, ids)

        contractor_tok = await _login(c, CONTRACTOR_ADMIN_EMAIL)
        qe_tok = await _login(c, QE_EMAIL)
        sup_tok = await _login(c, SUPERVISOR_EMAIL)

        # Floors per tower.
        floors = {}
        for tower in towers:
            floors[tower["tower_id"]] = _ok(
                await c.post(
                    f"{API}/projects/{pid}/towers/{tower['tower_id']}/floors/generate",
                    json={"count": 6}, headers=_bearer(contractor_tok),
                ),
                "generate floors",
            ).json()

        # Suppliers + lab (contractor side).
        suppliers = {}
        for key, name, email, loc in [
            ("s1", "UltraTech RMC", "plant@ultratech-demo.com", "Whitefield"),
            ("s2", "ACC Concrete", "plant@acc-demo.com", "Hoskote"),
        ]:
            suppliers[key] = _ok(
                await c.post(
                    f"{API}/projects/{pid}/suppliers",
                    json={"supplier_name": name, "contact_email": email, "plant_location": loc},
                    headers=_bearer(contractor_tok),
                ),
                "create supplier",
            ).json()
        lab = _ok(
            await c.post(
                f"{API}/projects/{pid}/labs",
                json={"lab_name": "ENVTECH Labs", "lab_type": "THIRD_PARTY",
                      "contact_email": "lab@envtech-demo.com"},
                headers=_bearer(contractor_tok),
            ),
            "create lab",
        ).json()
        lab_id = lab["lab_id"]

        # Catalog lookups.
        components = _ok(await c.get(f"{API}/components", headers=_bearer(qe_tok)), "components").json()
        grades = _ok(await c.get(f"{API}/grades", headers=_bearer(qe_tok)), "grades").json()
        comp_by = {c2["component_type"]: c2 for c2 in components}
        grade_by = {g["grade_name"]: g for g in grades}
        fallback_grade = grades[0]

        # A pour may only use a grade with an APPROVED mix design. Mix designs are
        # RMC-owned now: the contractor requests the grades it needs from each
        # supplier → the RMC submits one per grade via its tokenised link → the QE
        # approves. Group the plan's grades per supplier, then drive that flow.
        grades_by_supplier: dict[int, set[int]] = {}
        for _ti, _fi, _comp, gname, skey, *_rest in POUR_PLAN:
            grade = grade_by.get(gname) or fallback_grade
            supplier = suppliers[skey]
            grades_by_supplier.setdefault(supplier["supplier_id"], set()).add(
                grade["grade_id"]
            )

        for sup_id, grade_ids in grades_by_supplier.items():
            _ok(
                await c.put(
                    f"{API}/projects/{pid}/suppliers/{sup_id}/required-grades",
                    json={"grade_ids": sorted(grade_ids)},
                    headers=_bearer(contractor_tok),
                ),
                "request mix grades",
            )
            sups = _ok(
                await c.get(f"{API}/projects/{pid}/suppliers", headers=_bearer(contractor_tok)),
                "suppliers",
            ).json()
            token = next(
                s["mix_submission_token"] for s in sups if s["supplier_id"] == sup_id
            )
            for gid in sorted(grade_ids):
                submitted = _ok(
                    await c.post(
                        f"{API}/external/mix-design?token={token}",
                        json={"grade_id": gid, "wc_ratio": 0.45},
                    ),
                    "submit mix design",
                ).json()
                _ok(
                    await c.patch(
                        f"{API}/projects/{pid}/mix-designs/{submitted['mix_design_id']}/review",
                        json={"approval_status": "APPROVED"},
                        headers=_bearer(qe_tok),
                    ),
                    "approve mix design",
                )

        ncr_pours = 0
        for seq, (ti, fi, comp, gname, skey, outcome, cast, test, truck) in enumerate(POUR_PLAN, 1):
            tower = towers[ti]
            tower_floors = floors[tower["tower_id"]]
            floor = tower_floors[min(fi, len(tower_floors) - 1)]
            component = comp_by.get(comp) or components[0]
            grade = grade_by.get(gname) or fallback_grade
            supplier = suppliers[skey]
            volume = 30.0 + seq

            pour = _ok(
                await c.post(
                    f"{API}/projects/{pid}/pours",
                    json={
                        "tower_id": tower["tower_id"],
                        "floor_id": floor["floor_id"],
                        "component_id": component["component_id"],
                        "grade_id": grade["grade_id"],
                        "supplier_horizontal_id": supplier["supplier_id"],
                        "pour_date": cast,
                        "volume_cum": volume,
                        "pour_reference": f"PC-{tower['tower_name'].split()[-1]}-{floor['floor_label']}-{comp[:3]}-{seq:03d}",
                    },
                    headers=_bearer(qe_tok),
                ),
                "create pour",
            ).json()

            if truck:
                await _run_truck(
                    c, qe_tok, sup_tok, pid,
                    pour_id=pour["pour_id"], supplier_id=supplier["supplier_id"],
                    grade_id=grade["grade_id"], volume=volume, mode=truck,
                )

            await _run_cube(
                c, qe_tok, pid,
                pour_id=pour["pour_id"], grade_min=float(grade["min_strength_mpa"]),
                outcome=outcome, cast_date=cast, test_date=test, lab_id=lab_id,
                ref=f"CUBE-{seq:03d}",
            )
            if outcome != "PASS":
                ncr_pours += 1

        await _work_one_ncr(c, qe_tok, pid)

        _print_summary(pid, len(POUR_PLAN), ncr_pours)


def _print_summary(pid: int, pours: int, ncrs: int) -> None:
    line = "=" * 64
    print(f"\n{line}\n  STRATA DEMO DATA SEEDED\n{line}")
    print(f"  Project: 'Skyline Heights — Demo'  (project_id={pid})")
    print(f"  {pours} pours · {ncrs} auto-NCRs (1 worked through review→closed)")
    print("  2 suppliers, 1 lab, RMC dispatches + gate scans, cube tests.\n")
    print("  Log in at the frontend (default http://localhost:3000) as:\n")
    print(f"    CLIENT ADMIN   {CLIENT_ADMIN_EMAIL:<24}  (project, analytics, team)")
    print(f"    CONTRACTOR     {CONTRACTOR_ADMIN_EMAIL:<24}  (suppliers, labs, mix designs)")
    print(f"    QUALITY ENGR   {QE_EMAIL:<24}  (pours, dispatches, cube tests, NCRs)")
    print(f"    SUPERVISOR     {SUPERVISOR_EMAIL:<24}  (gate scan)")
    print(f"\n  Password for ALL accounts:  {PASSWORD}\n{line}\n")


if __name__ == "__main__":
    asyncio.run(seed())
