# Construction Quality Management System — Backend

## Tech Stack
- **Python 3.11.9**
- **FastAPI 0.111.0** — async web framework
- **SQLAlchemy 2.0.30** — async ORM
- **asyncpg** — PostgreSQL async driver
- **Alembic** — database migrations
- **PostgreSQL 16** — database (port 5433)
- **passlib + bcrypt 4.0.1** — password hashing
- **python-jose** — JWT tokens
- **fastapi-mail + Jinja2** — email sending
- **pytest + pytest-asyncio** — testing

---

## Project Structure

```
backend/
├── app/
│   ├── core/
│   │   ├── security.py        # JWT create/verify, bcrypt hashing
│   │   ├── dependencies.py    # get_current_user, role guards
│   │   ├── exceptions.py      # HTTP error handlers
│   │   └── email.py           # SMTP email sender
│   ├── models/
│   │   ├── auth.py            # Organisation, User, ProjectTeam,
│   │   │                      # OrgInvitation, TokenBlacklist
│   │   ├── master.py          # Project, Tower, Floor, Grade,
│   │   │                      # Supplier, MixDesign, TestingLab,
│   │   │                      # ProjectContractor
│   │   ├── transaction.py     # Pour, RMCDispatch, TruckDispatch,
│   │   │                      # PourDispatchLink, CubeSample
│   │   ├── quality.py         # CubeTest, NCR, Penalty,
│   │   │                      # CorrectiveAction, AISuggestion
│   │   └── audit.py           # AuditLog, IngestionLog, Embedding
│   ├── schemas/
│   │   └── auth.py            # Pydantic request/response models
│   ├── repositories/
│   │   └── auth_repo.py       # DB queries for auth
│   ├── services/
│   │   └── auth_service.py    # Auth business logic
│   ├── routers/
│   │   └── auth.py            # /auth/* endpoints
│   ├── template/
│   │   └── email/
│   │       ├── invitation.html
│   │       ├── truck_dispatch.html
│   │       ├── truck_result.html
│   │       └── lab_reminder.html
│   ├── database/
│   │   ├── base.py            # DeclarativeBase
│   │   ├── engine.py          # async engine
│   │   └── session.py         # get_db() dependency
│   ├── config.py              # pydantic-settings, reads .env
│   └── main.py                # FastAPI app, routers registered
├── alembic/
│   ├── env.py                 # multi-schema aware async env
│   └── versions/              # migration files
├── tests/
│   ├── test_db_connection.py  # Phase 1 exit condition
│   └── test_models.py         # Phase 2 exit condition
├── alembic.ini
├── pytest.ini
├── requirements.txt
└── .env                       # never commit this
```

---

## Database Schemas

Five PostgreSQL schemas:

| Schema | Purpose |
|--------|---------|
| `auth` | Organisations, users, invitations, token blacklist |
| `master` | Projects, towers, floors, grades, suppliers, mix designs, labs |
| `transaction` | Pours, dispatches, truck verification, cube samples |
| `quality` | Cube tests, NCRs, penalties, corrective actions, AI suggestions |
| `audit` | Audit logs, ingestion logs, embeddings |

---

## User Roles & Hierarchy

```
CLIENT_ADMIN
  └── registers CONTRACTOR org → sends activation email
        │
        CONTRACTOR_ADMIN (activates via email)
          └── invites PROJECT_MANAGER
                │
                PROJECT_MANAGER
                  └── invites QUALITY_ENGINEER, SUPERVISOR
```

| Role | Can Do |
|------|--------|
| CLIENT_ADMIN | Create projects, register contractors, assign contractors to towers |
| CONTRACTOR_ADMIN | Invite PMs, add suppliers/labs, upload mix designs |
| PROJECT_MANAGER | Invite QE/Supervisor, add towers/floors, approve mix designs |
| QUALITY_ENGINEER | Create pours, dispatches, cube tests, NCRs |
| SUPERVISOR | Create pours, mark trucks arrived/accepted/rejected |

---

## Setup

### Prerequisites
- Python 3.11.9
- PostgreSQL 16 (running on port 5433)
- Gmail account with App Password enabled

### 1. Create virtual environment
```bash
py -3.11 -m venv .venv
.venv\Scripts\activate        # Windows
python --version               # must show 3.11.9
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure environment
```bash
cp .env.sample .env
# Fill in all values in .env
```

Required `.env` values:
```
DATABASE_URL=postgresql+asyncpg://postgres:yourpassword@localhost:5433/construction_db
DB_ECHO=False
SECRET_KEY=your_64char_random_key
ENVIRONMENT=development
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
JWT_ALGORITHM=HS256
MAIL_USERNAME=your_gmail@gmail.com
MAIL_PASSWORD=your_16char_app_password
MAIL_FROM=your_gmail@gmail.com
MAIL_FROM_NAME=Construction QMS
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
MAIL_STARTTLS=True
MAIL_SSL_TLS=False
FRONTEND_URL=http://localhost:3000
```

Generate SECRET_KEY:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Gmail App Password:
```
myaccount.google.com → Security → App passwords
→ Create → Copy 16-char code → paste as MAIL_PASSWORD
```

### 4. Create database
```bash
psql -U postgres -p 5433 -c "CREATE DATABASE construction_db;"
```

### 5. Run migrations
```bash
$env:PYTHONPATH = "C:\Users\vikas\Desktop\QMS\backend"
alembic upgrade head
```

### 6. Start server
```bash
uvicorn app.main:app --reload
```

---

## API Endpoints

Base URL: `http://localhost:8000/api/v1`

Swagger UI: `http://localhost:8000/docs`

### Auth endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | None | Client self-registers |
| POST | `/auth/login` | None | Login, returns tokens |
| POST | `/auth/refresh` | None | Get new access token |
| POST | `/auth/accept-invitation` | None | Accept invite, create account |
| POST | `/auth/logout` | Bearer | Blacklist token |
| GET | `/auth/me` | Bearer | Current user + org |
| POST | `/auth/register-contractor` | CLIENT_ADMIN | Register contractor org + send email |
| POST | `/auth/invite` | Any role | Invite user to org |

---

## Authentication

JWT Bearer tokens. Include in every authenticated request:
```
Authorization: Bearer <access_token>
```

Access token expires in 30 minutes.
Use `/auth/refresh` with your refresh token to get a new access token.

---

## Testing the Flow (Swagger)

Since the frontend (Phase 7) is not built yet, use Swagger to test:

### Full registration flow:

**Step 1 — Register as client:**
```json
POST /auth/register
{
  "org_name": "Godrej Properties",
  "contact_email": "client@example.com",
  "contact_phone": "9999999999",
  "full_name": "Admin Name",
  "password": "password123",
  "confirm_password": "password123"
}
```
Copy the `access_token` → click Authorize in Swagger → paste token.

**Step 2 — Register contractor (auto-sends email):**
```json
POST /auth/register-contractor
{
  "org_name": "L&T Construction",
  "contact_email": "contractor@example.com",
  "contact_phone": "8888888888"
}
```
Contractor receives activation email.

**Step 3 — Get token from email:**
Copy the token from the invitation link in the email.

**Step 4 — Accept invitation:**
```json
POST /auth/accept-invitation
{
  "token": "paste-token-from-email",
  "full_name": "Contractor Admin",
  "password": "password123",
  "confirm_password": "password123"
}
```

**Step 5 — Login as contractor:**
```json
POST /auth/login
{
  "email": "contractor@example.com",
  "password": "password123"
}
```
Authorize with new token.

**Step 6 — Contractor invites PM:**
```json
POST /auth/invite
{
  "invited_email": "pm@example.com",
  "role": "PROJECT_MANAGER"
}
```

**Step 7 — PM accepts, invites QE, and so on.**

---

## Known Issues & Notes

### Enum migrations
When adding new values to existing PostgreSQL enums, Alembic autogenerate
produces an empty migration. Always manually add:
```python
op.execute("ALTER TYPE schema.enumname ADD VALUE IF NOT EXISTS 'NEW_VALUE'")
```

### Email template folder
Templates live at `app/template/email/` (note: singular `template`).
The path is configured in `app/core/email.py`.

### bcrypt version
Must use `bcrypt==4.0.1`. Higher versions break passlib compatibility.
The warning `(trapped) error reading bcrypt version` is harmless.

### PYTHONPATH
Always set before running alembic:
```bash
$env:PYTHONPATH = "C:\Users\yadav\OneDrive\Desktop\backend"
```

---

## Phase Progress

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | DB foundation — engine, session, Alembic, 5 schemas | ✅ Done |
| Phase 2 | SQLAlchemy models — all 26 tables across 5 schemas | ✅ Done |
| Phase 3 (auth) | JWT auth, roles, invitations, email | ✅ Done |
| Phase 3 (services) | Pour, dispatch, quality engine, NCR | 🔄 Next |
| Phase 4 | Excel/PDF ingestion pipeline | ⏳ Pending |
| Phase 5 | Qwen2-VL fine-tuning on Kaggle | ⏳ Pending |
| Phase 6 | Ollama RAG — failure AI suggestions | ⏳ Pending |
| Phase 7 | React/Next.js frontend dashboard | ⏳ Pending |

---

## Next Steps (Phase 3 continued)

Build in this order:
1. `schemas/` — project, pour, cube_test, ncr Pydantic schemas
2. `repositories/` — base_repo, pour_repo, cube_test_repo, ncr_repo
3. `services/` — project_service, pour_service, quality_engine
4. `routers/` — projects, pours, cube_tests, ncr, reports
5. `tasks/` — NCR auto-raise, email notifications, lab reminders