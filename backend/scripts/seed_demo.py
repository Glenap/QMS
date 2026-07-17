"""seed_demo.py — populate the live DB with a large, realistic demo workflow.

Builds a single project you can log into and click through, at demo scale:

  * a CLIENT org + admin, and **3 CONTRACTOR orgs** — each with its own admin, a
    Quality Engineer and a Supervisor — all created **already email-verified**
    (the OTP step is bypassed by inserting active users directly);
  * **one project with 3 towers** (floors generated), each tower run by one
    contractor; **10 RMC suppliers** and **5 testing labs** (a mix of third-party
    and in-house) spread across the contractors;
  * the real operational flow driven in-process through the actual API so every
    validation, the IS-456 quality engine and the auto-NCRs all run for real:
    **~100 dispatches → truck fill → gate accept/reject → cube samples →
    28-day strength tests (PASS / FAIL / CRITICAL → auto-NCR)**, plus a handful
    of NCRs worked through review → corrective action → NDT retest → close.

Run from the backend/ directory:   uv run python scripts/seed_demo.py

**Deletes all existing data first** (every table, CASCADE) and re-seeds the
global catalogs, so each run is a clean slate. Refuses to run when
ENVIRONMENT=production.
"""

import asyncio
import json
import sys
from datetime import UTC, date, datetime, timedelta

# The summary banner contains non-ASCII (— · →); force UTF-8 so it prints on a
# Windows cp1252 console instead of raising UnicodeEncodeError.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from httpx import ASGITransport, AsyncClient, Response
from sqlalchemy import select, text

import app.models  # noqa: F401 — registers every table on Base.metadata for the wipe
from app.config import settings
from app.core.security import hash_password
from app.database.base import Base
from app.database.seed import COMPONENTS, GRADES
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
from app.models.master import Component, Grade, ProjectContractor

API = "/api/v1"
PASSWORD = "Password123!"

CLIENT_ADMIN_EMAIL = "client@skyline-demo.com"
# Contractor #1 keeps the historic demo logins so the documented accounts work.
CONTRACTOR_ADMIN_EMAIL = "contractor@buildwell-demo.com"
QE_EMAIL = "qe@buildwell-demo.com"
SUPERVISOR_EMAIL = "supervisor@buildwell-demo.com"

# Each contractor runs one tower. (org_name, admin_email, admin_name, qe_email,
# qe_name, sup_email, sup_name).
CONTRACTORS = [
    ("BuildWell Constructions (Demo)", CONTRACTOR_ADMIN_EMAIL, "Vikram Shah",
     QE_EMAIL, "Priya Nair", SUPERVISOR_EMAIL, "Ramesh Iyer"),
    ("Metro Infra Builders (Demo)", "contractor@metro-demo.com", "Arjun Menon",
     "qe@metro-demo.com", "Sneha Kulkarni", "supervisor@metro-demo.com", "Imran Sheikh"),
    ("Apex Structures (Demo)", "contractor@apex-demo.com", "Rohit Verma",
     "qe@apex-demo.com", "Kavya Reddy", "supervisor@apex-demo.com", "Manoj Pillai"),
]

# 10 RMC suppliers + 5 labs, distributed across the 3 contractors.
SUPPLIER_NAMES = [
    "UltraTech RMC", "ACC Concrete", "Ambuja Readymix", "JK Cement RMC",
    "Dalmia Concrete", "Nuvoco Readymix", "Shree Concrete", "Ramco RMC",
    "Birla Readymix", "Prism Concrete",
]
SUPPLIERS_PER = [4, 3, 3]  # → 10 total
# (name, type). A mix of third-party and in-house so the Labs page split shows both.
LAB_SPECS = [
    ("ENVTECH Labs", "THIRD_PARTY"), ("BuildWell Site Lab", "IN_HOUSE"),
    ("SGS India", "THIRD_PARTY"), ("Metro On-site Lab", "IN_HOUSE"),
    ("Geo-Test Labs", "THIRD_PARTY"),
]
LABS_PER = [2, 2, 1]  # → 5 total

GRADES_USED = ["M25", "M30", "M35", "M40"]
N_CUBES = 100          # accepted deliveries → pours → cube tests
N_REJECTS = 9          # extra dispatches rejected at the gate (no pour)
FLOORS_PER_TOWER = 8

PROJECT_PAYLOAD = {
    "project_name": "Skyline Heights — Demo",
    "project_type": "RESIDENTIAL",
    "project_code": "DEMO-SKY-01",
    "address_line1": "Survey 21, Sarjapur Road",
    "city": "Bengaluru",
    "state": "KA",
    "pin_code": "560035",
    "start_date": "2026-01-01",
    "end_date": "2028-06-30",
    "no_of_towers": 3,
    "max_floors": 24,
    "acceptance_criteria": "IS 456:2000",
    "final_test_age_days": 28,
    "towers": [
        {"tower_name": "Tower A", "tower_type": "Residential", "floors_total": 24},
        {"tower_name": "Tower B", "tower_type": "Residential", "floors_total": 22},
        {"tower_name": "Tower C", "tower_type": "Commercial", "floors_total": 18},
    ],
}

# observed = required(min_strength) * factor → PASS / FAIL (85–100%) / CRITICAL (<85%)
_FACTOR = {"PASS": 1.12, "FAIL": 0.92, "CRITICAL": 0.72}

TODAY = date.today()


def _outcome(i: int) -> str:
    """Deterministic outcome spread — mostly PASS, a steady trickle of failures
    (every 8th) and the occasional critical failure (every 15th)."""
    if (i + 1) % 15 == 0:
        return "CRITICAL"
    if (i + 1) % 8 == 0:
        return "FAIL"
    return "PASS"


def _dates(i: int) -> tuple[str, str]:
    """(cast_date, test_date) for cube #i, spread over the last 28 days so the run
    chart / CUSUM show a trend and the default 'last 7 days' window is populated."""
    test_off = i % 28
    cast = TODAY - timedelta(days=test_off + 1)
    test = TODAY - timedelta(days=test_off)
    return cast.isoformat(), test.isoformat()


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
    """Create the client + 3 contractor orgs and their verified users directly
    (OTP bypassed). Returns ids (client + a list of contractor id bundles)."""
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

        def user(org_id, email, name, role, admin=False):
            u = User(
                org_id=org_id, email=email, hashed_password=hash_password(PASSWORD),
                full_name=name, role=role, is_org_admin=admin,
                is_active=True, is_offboarded=False,
            )
            s.add(u)
            return u

        client_admin = user(
            client_org.org_id, CLIENT_ADMIN_EMAIL, "Anita Rao", UserRole.CLIENT_ADMIN, True
        )
        await s.flush()

        contractors = []
        for org_name, admin_email, admin_name, qe_email, qe_name, sup_email, sup_name in CONTRACTORS:
            org = Organisation(
                org_name=org_name, org_type=OrgType.CONTRACTOR, status=OrgStatus.ACTIVE,
                contact_email=admin_email, registered_by_org_id=client_org.org_id,
            )
            s.add(org)
            await s.flush()
            admin = user(org.org_id, admin_email, admin_name, UserRole.CONTRACTOR_ADMIN, True)
            # Team members are generic org users; their QE / Supervisor designation
            # is per-project (the ProjectMember rows), which drives capabilities.
            qe = user(org.org_id, qe_email, qe_name, UserRole.CONTRACTOR_USER)
            sup = user(org.org_id, sup_email, sup_name, UserRole.CONTRACTOR_USER)
            await s.flush()
            contractors.append({
                "org_id": org.org_id, "admin_id": admin.user_id,
                "qe_id": qe.user_id, "sup_id": sup.user_id,
                "admin_email": admin_email, "qe_email": qe_email, "sup_email": sup_email,
            })

        ids = {
            "client_org_id": client_org.org_id,
            "client_admin_id": client_admin.user_id,
            "contractors": contractors,
        }
        await s.commit()
        return ids


async def _link_contractors_and_members(pid: int, ids: dict, towers: list) -> None:
    """Attach each contractor (ACCEPTED, scoped to one tower) + its QE/Supervisor
    members to the project, directly (skipping the email-token accept / invite
    flow; the result is identical to what those flows persist)."""
    async with AsyncSessionLocal() as s:
        for i, ctr in enumerate(ids["contractors"]):
            tower = towers[i]
            s.add(ProjectContractor(
                project_id=pid, contractor_org_id=ctr["org_id"],
                tower_id=tower["tower_id"], scope=tower["tower_name"], status="ACCEPTED",
                responded_at=datetime.now(UTC), assigned_by=ids["client_admin_id"],
            ))
            s.add(ProjectMember(
                project_id=pid, user_id=ctr["qe_id"], org_id=ctr["org_id"],
                project_role="QUALITY_ENGINEER", assigned_by=ctr["admin_id"],
            ))
            s.add(ProjectMember(
                project_id=pid, user_id=ctr["sup_id"], org_id=ctr["org_id"],
                project_role="SUPERVISOR", assigned_by=ctr["admin_id"],
            ))
        await s.commit()


async def _run_truck(c, qe_tok, sup_tok, pid, *, supplier_id, grade_id, volume, mode):
    """Raise + drive one delivery. Returns the dispatch_id of an ACCEPTED delivery
    (ready to record a pour from), or None if it was rejected at the gate."""
    created = _ok(
        await c.post(
            f"{API}/projects/{pid}/dispatches",
            json={"supplier_id": supplier_id, "grade_id": grade_id,
                  "volume_ordered_cum": volume},
            headers=_bearer(qe_tok),
        ),
        "raise dispatch",
    ).json()
    dispatch_id, token = created["dispatch_id"], created["truck"]["token"]
    _ok(
        await c.post(
            f"{API}/external/dispatch?token={token}",
            json={
                "vehicle_number": f"KA01AB{1000 + dispatch_id}",
                "driver_name": "Suresh K.",
                "batch_number": f"BN-{dispatch_id:04d}",
                "challan_number": f"CH-{dispatch_id:04d}",
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
        return None
    _ok(
        await c.post(
            f"{API}/projects/{pid}/gate/{token}/arrive",
            json={"slump_at_site_mm": 110}, headers=_bearer(sup_tok),
        ),
        "arrive truck",
    )
    _ok(
        await c.post(f"{API}/projects/{pid}/gate/{token}/accept", headers=_bearer(sup_tok)),
        "accept truck",  # → PENDING_QE
    )
    _ok(
        await c.post(
            f"{API}/projects/{pid}/dispatches/{dispatch_id}/insitu",
            json={"measured_slump_mm": 105, "decision": "APPROVED"},
            headers=_bearer(qe_tok),
        ),
        "qe in-situ sign-off",  # → ACCEPTED
    )
    return dispatch_id


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
    # Results come from the lab through its tokenised link. Grab the link the QE
    # would share, then submit the 28-day report the way a lab would.
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
            files={"file": ("lab-report.pdf", b"%PDF-1.4 demo report", "application/pdf")},
        ),
        "lab: submit 28-day report",
    )


async def _work_one_ncr(c, qe_tok, pid) -> bool:
    """Take the first open NCR through the full lifecycle to CLOSED. Returns True
    if one was worked, False if none were open."""
    ncrs = _ok(await c.get(f"{API}/projects/{pid}/ncrs", headers=_bearer(qe_tok)), "list ncrs").json()
    target = next((n for n in ncrs if n["status"] != "CLOSED"), None)
    if not target:
        return False
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
                  "due_date": (TODAY + timedelta(days=7)).isoformat()},
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
    retest = _ok(
        await c.post(
            f"{API}/projects/{pid}/ncrs/{nid}/retests",
            json={"retest_type": "CORE_CUTTING",
                  "notes": "Core cut from the affected slab for in-situ verification"},
            headers=_bearer(qe_tok),
        ),
        "order retest",
    ).json()
    _ok(
        await c.patch(
            f"{API}/projects/{pid}/ncrs/{nid}/retests/{retest['retest_id']}",
            json={"result": "PASS", "observed_strength_mpa": 31.2,
                  "required_strength_mpa": 30.0, "test_date": TODAY.isoformat(),
                  "notes": "Core strength satisfies IS 456 — no demolition required"},
            headers=_bearer(qe_tok),
        ),
        "record retest result",
    )
    _ok(
        await c.post(
            f"{API}/projects/{pid}/ncrs/{nid}/notify-rmc",
            json={"subject": "NCR raised on your supply",
                  "message": "A 28-day strength failure was recorded on your concrete. "
                             "Please review the batch and plant records and respond "
                             "with corrective action."},
            headers=_bearer(qe_tok),
        ),
        "notify rmc",
    )
    _ok(
        await c.patch(
            f"{API}/projects/{pid}/ncrs/{nid}", json={"status": "CLOSED"},
            headers=_bearer(qe_tok),
        ),
        "close ncr",
    )
    return True


async def _wipe_all() -> None:
    """Delete ALL existing data (every table, RESTART IDENTITY CASCADE) and
    re-seed the global reference catalogs, so the demo starts from a clean slate
    on every run. Mirrors scripts/wipe_db.py."""
    tables = ", ".join(
        f'"{t.schema}"."{t.name}"' for t in Base.metadata.sorted_tables
    )
    async with AsyncSessionLocal() as s:
        await s.execute(text(f"TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE"))
        await s.execute(Grade.__table__.insert(), GRADES)
        await s.execute(Component.__table__.insert(), COMPONENTS)
        await s.commit()


async def _setup_contractor(c, tower, *, admin_tok, qe_tok, pid, grade_ids, n_suppliers, lab_specs):
    """Register a contractor's suppliers + labs and get an APPROVED mix design for
    every used grade on every supplier. Returns (suppliers, labs, floors)."""
    # Suppliers (contractor side).
    suppliers = []
    for name in n_suppliers:
        slug = name.split()[0].lower()
        sup = _ok(
            await c.post(
                f"{API}/projects/{pid}/suppliers",
                json={"supplier_name": name,
                      "contact_email": f"plant@{slug}-demo.com",
                      "plant_location": "Industrial Area"},
                headers=_bearer(admin_tok),
            ),
            "create supplier",
        ).json()
        suppliers.append(sup)

    # Labs (contractor side) — mixed third-party / in-house.
    labs = []
    for lab_name, lab_type in lab_specs:
        slug = lab_name.split()[0].lower()
        lab = _ok(
            await c.post(
                f"{API}/projects/{pid}/labs",
                json={"lab_name": lab_name, "lab_type": lab_type,
                      "contact_email": f"lab@{slug}-demo.com"},
                headers=_bearer(admin_tok),
            ),
            "create lab",
        ).json()
        labs.append(lab)

    # Floors for this contractor's tower.
    floors = _ok(
        await c.post(
            f"{API}/projects/{pid}/towers/{tower['tower_id']}/floors/generate",
            json={"count": FLOORS_PER_TOWER}, headers=_bearer(admin_tok),
        ),
        "generate floors",
    ).json()

    # Every supplier gets an APPROVED mix design for each used grade (RMC-owned:
    # contractor requests → RMC submits via token → QE approves).
    for sup in suppliers:
        _ok(
            await c.put(
                f"{API}/projects/{pid}/suppliers/{sup['supplier_id']}/required-grades",
                json={"grade_ids": grade_ids}, headers=_bearer(admin_tok),
            ),
            "request mix grades",
        )
        sups = _ok(
            await c.get(f"{API}/projects/{pid}/suppliers", headers=_bearer(admin_tok)),
            "suppliers",
        ).json()
        token = next(s["mix_submission_token"] for s in sups if s["supplier_id"] == sup["supplier_id"])
        for gid in grade_ids:
            submitted = _ok(
                await c.post(
                    f"{API}/external/mix-design?token={token}",
                    data={"payload": json.dumps({"grade_id": gid, "wc_ratio": 0.45})},
                    files={"file": ("mix-design.pdf", b"%PDF-1.4 demo mix", "application/pdf")},
                ),
                "submit mix design",
            ).json()
            _ok(
                await c.patch(
                    f"{API}/projects/{pid}/mix-designs/{submitted['mix_design_id']}/review",
                    json={"approval_status": "APPROVED"}, headers=_bearer(qe_tok),
                ),
                "approve mix design",
            )
    return suppliers, labs, floors


async def seed() -> None:
    if settings.is_production:
        print("Refusing to seed a PRODUCTION database. Aborting.")
        sys.exit(1)

    print("Wiping existing data…")
    await _wipe_all()

    ids = await _create_people()
    if not ids:
        print(f"Demo client '{CLIENT_ADMIN_EMAIL}' unexpectedly still exists after wipe.")
        return

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://demo", timeout=60.0) as c:
        client_tok = await _login(c, CLIENT_ADMIN_EMAIL)

        project = _ok(
            await c.post(f"{API}/projects", json=PROJECT_PAYLOAD, headers=_bearer(client_tok)),
            "create project",
        ).json()
        pid = project["project_id"]
        towers = _ok(
            await c.get(f"{API}/projects/{pid}/towers", headers=_bearer(client_tok)), "list towers"
        ).json()

        await _link_contractors_and_members(pid, ids, towers)

        # Catalog lookups (any member token works).
        first_admin_tok = await _login(c, ids["contractors"][0]["admin_email"])
        components = _ok(await c.get(f"{API}/components", headers=_bearer(first_admin_tok)), "components").json()
        grades = _ok(await c.get(f"{API}/grades", headers=_bearer(first_admin_tok)), "grades").json()
        grade_by = {g["grade_name"]: g for g in grades}
        used_grades = [grade_by[n] for n in GRADES_USED if n in grade_by] or grades[:4]
        grade_ids = [g["grade_id"] for g in used_grades]

        # Set up each contractor: tokens, suppliers, labs, floors, approved mixes.
        print("Setting up 3 contractors, 10 suppliers, 5 labs, mix designs…")
        sup_offset, lab_offset = 0, 0
        ctxs = []
        for i, ctr in enumerate(ids["contractors"]):
            admin_tok = first_admin_tok if i == 0 else await _login(c, ctr["admin_email"])
            qe_tok = await _login(c, ctr["qe_email"])
            sup_tok = await _login(c, ctr["sup_email"])
            names = SUPPLIER_NAMES[sup_offset:sup_offset + SUPPLIERS_PER[i]]
            specs = LAB_SPECS[lab_offset:lab_offset + LABS_PER[i]]
            sup_offset += SUPPLIERS_PER[i]
            lab_offset += LABS_PER[i]
            suppliers, labs, floors = await _setup_contractor(
                c, towers[i], admin_tok=admin_tok, qe_tok=qe_tok, pid=pid,
                grade_ids=grade_ids, n_suppliers=names, lab_specs=specs,
            )
            ctxs.append({
                "tower": towers[i], "qe_tok": qe_tok, "sup_tok": sup_tok,
                "suppliers": suppliers, "labs": labs, "floors": floors,
            })

        # 100 accepted deliveries → pours → cube tests, round-robin across the 3
        # contractors/towers.
        print(f"Driving {N_CUBES} deliveries → pours → cube tests…")
        pours_created = 0
        ncr_pours = 0
        for i in range(N_CUBES):
            ctx = ctxs[i % len(ctxs)]
            j = i // len(ctxs)
            supplier = ctx["suppliers"][j % len(ctx["suppliers"])]
            lab = ctx["labs"][j % len(ctx["labs"])]
            grade = used_grades[i % len(used_grades)]
            floor = ctx["floors"][j % len(ctx["floors"])]
            component = components[i % len(components)]
            outcome = _outcome(i)
            volume = 20.0 + (i % 20)
            cast, test = _dates(i)

            dispatch_id = await _run_truck(
                c, ctx["qe_tok"], ctx["sup_tok"], pid,
                supplier_id=supplier["supplier_id"], grade_id=grade["grade_id"],
                volume=volume, mode="accept",
            )
            tower_letter = ctx["tower"]["tower_name"].split()[-1]
            comp_type = component["component_type"]
            pour = _ok(
                await c.post(
                    f"{API}/projects/{pid}/pours",
                    json={
                        "dispatch_id": dispatch_id,
                        "tower_id": ctx["tower"]["tower_id"],
                        "floor_id": floor["floor_id"],
                        "component_id": component["component_id"],
                        "pour_date": cast,
                        "pour_reference": f"PC-{tower_letter}-{floor['floor_label']}-{comp_type[:3]}-{i + 1:03d}",
                    },
                    headers=_bearer(ctx["qe_tok"]),
                ),
                "record pour",
            ).json()
            pours_created += 1

            await _run_cube(
                c, ctx["qe_tok"], pid,
                pour_id=pour["pour_id"], grade_min=float(grade["min_strength_mpa"]),
                outcome=outcome, cast_date=cast, test_date=test, lab_id=lab["lab_id"],
                ref=f"CUBE-{i + 1:03d}",
            )
            if outcome != "PASS":
                ncr_pours += 1

        # A handful of rejected deliveries (no pour) for gate realism.
        for k in range(N_REJECTS):
            ctx = ctxs[k % len(ctxs)]
            supplier = ctx["suppliers"][k % len(ctx["suppliers"])]
            grade = used_grades[k % len(used_grades)]
            await _run_truck(
                c, ctx["qe_tok"], ctx["sup_tok"], pid,
                supplier_id=supplier["supplier_id"], grade_id=grade["grade_id"],
                volume=25.0, mode="reject",
            )

        # Work a few NCRs through to CLOSED (via the first contractor's QE).
        worked = 0
        qe0 = ctxs[0]["qe_tok"]
        for _ in range(3):
            if await _work_one_ncr(c, qe0, pid):
                worked += 1

        _print_summary(pid, pours_created, ncr_pours, worked)


def _print_summary(pid: int, pours: int, ncrs: int, worked: int) -> None:
    line = "=" * 64
    print(f"\n{line}\n  STRATA DEMO DATA SEEDED\n{line}")
    print(f"  Project: 'Skyline Heights — Demo'  (project_id={pid})")
    print("  3 contractors · 3 towers · 10 RMC suppliers · 5 labs")
    print(f"  {pours} pours + cube tests · ~{ncrs} auto-NCRs ({worked} worked → closed)")
    print(f"  {N_REJECTS} gate-rejected deliveries.\n")
    print("  Log in at the frontend (default http://localhost:3000) as:\n")
    print(f"    CLIENT ADMIN   {CLIENT_ADMIN_EMAIL:<28}  (project, analytics, team)")
    for org_name, admin_email, _an, qe_email, _qn, sup_email, _sn in CONTRACTORS:
        print(f"    {org_name}")
        print(f"      contractor   {admin_email:<28}  (suppliers, labs, mix designs)")
        print(f"      QE           {qe_email:<28}  (pours, dispatches, cube tests, NCRs)")
        print(f"      supervisor   {sup_email:<28}  (gate scan)")
    print(f"\n  Password for ALL accounts:  {PASSWORD}\n{line}\n")


if __name__ == "__main__":
    asyncio.run(seed())
