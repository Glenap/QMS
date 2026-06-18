# QMS — Quality Management System
## Complete Frontend Design Specification
**Version 1.0 | Based on workflow document + Figma form designs**

---

## 1. Design System

### Brand Identity
**Product name:** QMS — Quality Management System
**Tagline:** From order to result. Every pour, traced.
**Personality:** Professional, precise, trustworthy. Built for construction sites and boardrooms equally.

### Color Palette
| Token | Hex | Usage |
|---|---|---|
| `--primary` | `#1A56DB` | Primary actions, links, active states |
| `--primary-light` | `#EBF2FF` | Primary tinted backgrounds |
| `--success` | `#057A55` | Pass results, accepted, active |
| `--success-light` | `#DEF7EC` | Success backgrounds |
| `--danger` | `#C81E1E` | Fail results, rejected, critical |
| `--danger-light` | `#FDE8E8` | Danger backgrounds |
| `--warning` | `#C27803` | Borderline, pending, review needed |
| `--warning-light` | `#FDF6B2` | Warning backgrounds |
| `--neutral-900` | `#111928` | Primary text |
| `--neutral-700` | `#374151` | Secondary text |
| `--neutral-500` | `#6B7280` | Muted text, labels |
| `--neutral-300` | `#D1D5DB` | Borders |
| `--neutral-100` | `#F9FAFB` | Page background |
| `--white` | `#FFFFFF` | Card backgrounds |

### Typography
- **Font family:** Inter (all weights)
- **Display / Page title:** 24px, weight 600
- **Section heading:** 18px, weight 600
- **Subsection heading:** 16px, weight 500
- **Body:** 14px, weight 400
- **Label / caption:** 12px, weight 400
- **Micro / badge:** 11px, weight 500

### Spacing Scale
4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64px

### Component Defaults
- **Border radius:** 8px (inputs, cards), 6px (badges/pills), 4px (small elements)
- **Card:** white background, 1px `#E5E7EB` border, 8px radius, 20px padding
- **Input height:** 40px, 12px horizontal padding
- **Button height:** 40px (default), 36px (compact), 48px (large/CTA)
- **Shadow:** `0 1px 3px rgba(0,0,0,0.08)` for floating cards only

### Status Badges
```
PASS      → green bg #DEF7EC, text #057A55, dot ●
FAIL      → red bg #FDE8E8, text #C81E1E, dot ●
BORDERLINE → amber bg #FDF6B2, text #C27803, dot ●
PENDING   → grey bg #F3F4F6, text #6B7280, dot ○
IN REVIEW → blue bg #EBF2FF, text #1A56DB, dot ◐
```

---

## 2. Application Structure

### Navigation Architecture
```
QMS Platform
├── /dashboard              ← Super Admin home
├── /project/:id
│   ├── /overview           ← Project dashboard
│   ├── /team               ← Team management
│   ├── /suppliers          ← RMC suppliers
│   ├── /labs               ← Laboratories
│   ├── /gate               ← Gate scanning (guard view)
│   ├── /pours              ← Pour card list
│   ├── /pours/:id          ← Individual pour card
│   ├── /cubes              ← Cube sample tracker
│   ├── /results            ← Test results
│   ├── /trace/:id          ← Traceability chain view
│   ├── /ncr                ← NCR list
│   ├── /ncr/:id            ← Individual NCR
│   ├── /analytics          ← Analytics dashboard
│   └── /chatbot            ← RAG chatbot
└── /settings               ← Account & project settings
```

### Role-Based Layout Variants
Each role sees a different sidebar and different default landing page:

| Role | Landing page | Sidebar items |
|---|---|---|
| Super Admin | `/dashboard` (multi-project) | All items + Settings |
| Contractor Admin | `/project/:id/overview` | Overview, Team, Suppliers, Labs, Analytics |
| Project Manager | `/project/:id/overview` | Overview, Suppliers, Pours, Cubes, Results, NCR |
| Quality Head | `/project/:id/overview` | Overview, Pours, Results, NCR, Analytics |
| Supervisor | `/project/:id/pours` | Pours (create), Cubes |
| Guard | `/project/:id/gate` | Gate scan only (minimal UI) |

---

## 3. Screen-by-Screen Specifications

---

### SCREEN 1 — Login / Auth

**URL:** `/login`
**Layout:** Centered card on a white/light background. No sidebar.

**Elements:**
- QMS logo (top center, 40px)
- Card: 440px max-width, centered vertically
- Heading: "Sign in to QMS"
- Sub: "Construction Quality Management Platform"
- Email input (full width)
- Password input with show/hide toggle
- "Forgot password?" link (right-aligned below input)
- Primary button: "Sign in" (full width, blue)
- Divider
- Secondary: "Accept an invitation" link (for contractor/team onboarding)
- Footer: "Having trouble signing in? Contact your project admin."

**States:**
- Default
- Loading (button shows spinner)
- Error: red inline message below inputs "Incorrect email or password"
- First login: redirect to password setup page

---

### SCREEN 2 — Super Admin Dashboard (Multi-Project View)

**URL:** `/dashboard`
**Who sees this:** Client / Super Admin only
**Layout:** Top navbar + main content area (no sidebar — they may have multiple projects)

**Top navbar:**
- QMS logo left
- "New Project" button top-right (blue)
- Bell notifications icon + avatar

**Main content:**
- Heading: "Your Projects"
- Sub: "Showing 3 active projects"

**Project Cards Grid (2 columns):**
Each card shows:
- Project name (large, bold)
- Location + project type badge
- Progress bar (% of pours completed / planned)
- 4 mini KPIs in a row: Total pours | Pass rate | Open NCRs | Pending cubes
- Status badge: Active / On Hold / Completed
- "Open Project" button (outline, right-aligned)
- "Created: DD-MMM-YYYY" caption

**Empty state:** Illustration + "Create your first project to get started" + "New Project" CTA

---

### SCREEN 3 — New Project Form (Project Master)

**URL:** `/projects/new`
**Who fills this:** Super Admin
**Layout:** Full-page stepped form. 6 steps shown as a progress indicator at the top.

**Progress indicator (top):**
Step 1: Project Info → Step 2: Location → Step 3: Timeline → Step 4: Towers → Step 5: Components → Step 6: Quality Rules

**Step 1 — Project Info:**
- Project Name* | text input
- Project Type* | dropdown: Residential / Commercial / Mixed-Use / Infrastructure
- Client Organisation* | text input
- Client Admin Name, Email, Phone* | 3-column row
- GST Number, Project Code/RERA | 2-column row
- "Next →" button

**Step 2 — Location:**
- Address Line 1, 2 | text inputs
- City*, State* dropdown, PIN Code* | 3-column row
- Geo-coordinates | text input (optional, with "Use current location" link)
- Site Area (sqm) | number input
- Map preview (static embed if available, else skip)
- "← Back" + "Next →"

**Step 3 — Timeline & Scope:**
- Project Start Date*, End Date* | date range picker
- Total BUA, No. of Towers*, No. of Basements, Max Floors* | 4-column row
- Project Status* | dropdown

**Step 4 — Tower Details:**
- Instruction: "Add each tower/block in your project"
- Repeatable tower form rows in a table:
  - Tower ID | Tower Name | Type | No. Floors | Basement Levels | Floor Height | Start Floor Label | Construction Start
  - "+ Add Tower" button (dashed row at bottom)

**Step 5 — Component Master:**
- Instruction: "Add structural components per floor"
- Repeatable rows: Tower > Floor > Zone > Grid > Component Type > Component ID > Grade > Volume
- "+ Add Component" button
- "Import from Excel" option (secondary)

**Step 6 — Quality Rules:**
- Min Cube Samples*, Acceptance Criteria*, Test Ages (7/14/28)*, Characteristic Strength %, NCR Trigger recipients
- Review summary panel on right (collapsible): shows all data filled in steps 1–5
- "Create Project" (large blue CTA)

**Confirmation screen:**
- ✓ checkmark animation
- "Project PRJ-2024-001 created"
- "Next step: Invite your contractor" button

---

### SCREEN 4 — Contractor Invitation & Onboarding

**URL:** `/project/:id/team/invite`
**Who does this:** Super Admin
**Layout:** Modal or drawer over the team page

**Invite modal:**
- "Invite Organisation" heading
- Organisation Type* | dropdown: Contractor / Consultant / PMC / Sub-Contractor
- Company Name* | text input with search (check if already in system)
- Contact Person Name*, Email*, Phone* | 3 inputs
- Scope of Work* | textarea
- Contract Start Date, End Date | date pickers
- Assigned Towers | multi-select chips
- "Send Invitation" button

**Team page — invitation status list:**
Each invited org shows a row with:
- Company name + type badge
- Contact person + email
- Status badge: Invited (amber) / Accepted (green) / Rejected (red)
- Date invited + expiry date
- "Resend" or "Revoke" action buttons

**Contractor acceptance flow (contractor sees):**
- Email link → "View Invitation" page
- Shows: project name, client, scope, towers assigned
- "Accept Invitation" (green) + "Decline" (ghost) buttons
- After acceptance → redirected to platform to set up team

---

### SCREEN 5 — Contractor Team Setup (User Registration)

**URL:** `/project/:id/team/users`
**Who does this:** Contractor Admin
**Form design:** Based on your Figma design (pants-slate-03667863.figma.site)

**Page layout:**
- Left: team member list (sidebar list with avatar, name, role, status)
- Right: "Add User" form panel

**Add User Form:**
Section A — Auto-linked info (read-only banner):
- Project ID | Contractor ID | Created By — displayed as pill chips, not editable inputs

Section B — User Identity (2-col):
- Full Name*, Employee ID*, Designation*, Organisation*, Department dropdown, Date of Joining

Section C — Contact (2-col):
- Email (login)*, Mobile* (OTP), Alternate Email, Emergency Contact

Section D — Role & Access:
- System Role* | large dropdown with role descriptions on hover
- Access Level* | dropdown with descriptions
- Module Access | checkbox grid with icons per module
- Can Approve Pour? | Can Raise NCR? | Can View Rates? → 3 toggle switches

Section E — Assignment:
- Assigned Towers | chip-select (shows tower names)
- Assigned Floors | text with helper "e.g. 1F–15F or ALL"
- Shift | toggle: Day / Night / Both
- Reporting To | user search input

Section F — Notifications:
- Email Alerts | SMS/WhatsApp Alerts → toggles
- Alert Types | multi-checkbox: Pour Created / Result Uploaded / FAIL / NCR Raised / NCR Closed

Section G — Status:
- Account Status dropdown

**Bottom bar:** "Save Draft" (outline) + "Create User" (blue filled)

**User list view (after creation):**
Table columns: Name | Role | Assigned Towers | Status | Last Login | Actions
Filter bar: by role / tower / status

---

### SCREEN 6 — RMC Supplier Registration

**URL:** `/project/:id/suppliers/new`
**Who does this:** Project Manager
**Reference:** Figma form pascal-finder-90410874.figma.site

**Page layout:** Full-page form with 6 collapsed sections, auto-save on field blur

Section A — Linked Project (blue info banner, read-only):
Project ID | Contractor ID | RMC Registration ID (auto) | Registration Date (auto)

Section B — Supplier Details (2-col):
- Supplier Name* | Supplier Short Code*
- Supplier Category* (dropdown: Approved/Preferred/Trial) | Plant Name*
- Plant Code | Plant Address* (full width)
- Distance from Site (km)* | Contact Person*
- Contact Phone* | Contact Email*
- Emergency Contact | GST Number

Section C — Plant Capabilities:
- Batching capacity, TM Count, TM Volume (dropdown), Pump Availability
- BIS Certification toggle → if Yes: Cert No. + Cert Expiry date fields appear inline
- NABL Lab at Plant toggle

Section D — Mix Design Details:
- Repeatable mix design cards (add/remove)
- Each card: Grade, Mix Type, Cement Type, w/c Ratio, Slump Range, Approval Date, Approved By
- Full props accessible via "Expand" chevron per card
- "+ Add Mix Design" button (dashed border)

Section E — Commercial:
- Rate/m³, Pump Charge, Unloading Charge, Min Order Qty
- Payment Terms dropdown
- Validity From → Validity To | date range picker
- Escalation Clause textarea

Section F — Status:
- Approval Status | Approved By | Approval Date | Active Status | Blacklist Flag | Remarks

**Supplier list page:**
Table: Supplier Name | Plant | Grades Registered | Status | Contract Valid Till | Actions
Action buttons: View | Edit | Deactivate | View Pours

---

### SCREEN 7 — Laboratory Registration (External Form)

**URL:** `/labs/register?token=XYZ` (public-facing, token-gated)
**Who fills this:** Lab agency (external, no platform account)
**Design note:** Clean, minimal. Feels like a professional external form, not a full app.

**Page:**
- QMS logo + "Laboratory Registration" header
- Project name banner: "Registering for: Godrej Splendour Phase 2"
- Progress bar (4 steps)

**Step 1 — Lab Identity:**
- Lab Name*, Lab Short Code*, Lab Type* (In-House/Third Party/Govt), Lab Category*
- Parent Organisation (conditional: only for In-House)

**Step 2 — NABL & Accreditation:**
- NABL Accredited* (Yes/No/Applied/Expired)
- If Yes: NABL Cert No., NABL Scope, Accreditation Date, Valid Till
- Other certs (ISO 17025, Govt approval)

**Step 3 — Contact & Scope:**
- Lab Address*, Contact Person*, Designation*, Phone*, Email*
- Scope of testing: toggle grid (Concrete Cube, Slump, Rebound Hammer, UPV, Core Cutting, etc.)
- Equipment: CTM capacity, calibration dates, digital reporting capability

**Step 4 — Commercial & Submit:**
- Test rates (cube, slump, core)
- Agreement reference
- Submit button → "Details submitted. Our team will review and activate your account within 24 hours."

**After submission → auto-syncs to platform lab list** with status "Pending Approval"

---

### SCREEN 8 — Gate Scanning (Guard View)

**URL:** `/project/:id/gate`
**Who uses this:** Site Guard / Gate Officer
**Design note:** Extremely simple. Must work on mobile/tablet. Large tap targets. High contrast.

**Layout:** Near-fullscreen on mobile. Two states: Idle and Scanned.

**Idle state:**
- Large QR scan icon (center)
- "Scan Challan QR" (24px bold)
- Sub: "Point camera at the QR code on the delivery challan"
- "Scan Now" button (large, blue, full-width)
- OR "Enter Challan Number Manually" (below)

**After scan — Truck Arrival Card:**
- ✓ checkmark animation
- "Truck Arrived" in large green text
- Challan details card:
  - Supplier name | Truck No | Grade | Quantity (m³)
  - Batch ID | Dispatch time | Expected pour location
- "Confirm Arrival" button (large green)
- "Report Issue / Reject" button (outline red)

**Auto-notifications sent on Confirm:**
- In-app + email to: Project Manager, Quality Head, Supervisor
- Notification shows: Truck No, Supplier, Grade, Quantity, Arrival Time, Gate Officer name

**Notifications sidebar (guard can see):**
- List of today's arrivals with timestamps
- Status: Awaiting acceptance / Accepted / Rejected

---

### SCREEN 9 — RMC Order & Dispatch Management

**URL:** `/project/:id/orders`
**Who uses this:** Project Manager

**Two-panel layout:**
- Left: Order list (scrollable)
- Right: Order detail / Create Order form

**Create Order form:**
- Supplier* (dropdown from approved list)
- Grade* (from supplier's approved mix designs)
- Quantity (m³)* | Delivery Date* | Delivery Time*
- Pour Location: Tower → Floor → Zone → Component (cascading dropdowns)
- Special Instructions | textarea
- "Place Order" button

**Order → system generates:**
- Order reference number
- QR code (emailed to supplier to paste on challan)
- Order status: Ordered → Dispatched → In Transit → Arrived → Accepted/Rejected

**Order list table:**
Order ID | Supplier | Grade | Qty | Delivery Date | Status | Pour Location | Actions

---

### SCREEN 10 — Pour Card (Create + View)

**URL:** `/project/:id/pours/new` and `/project/:id/pours/:id`
**Who fills this:** Supervisor (on-site, mobile-optimised)
**Note:** This is your most used, most critical field-level form. Mobile first.

**Top sticky header:**
- "Pour Card" | Pour ID (auto) | Status badge (large): IN PROGRESS
- "Save" button (always visible)

**Section A — Pour Identification:**
- Tower* + Floor* + Zone (3 cascading large dropdowns, big tap targets)
- Component Type* (large radio grid: Slab / Column / Beam / Wall / etc.)
- Component ID* (auto-populated from Tower+Floor+Component selection)
- Drawing Reference (text)

**Section B — Schedule:**
- Planned Date + Start Time → Actual Date + Start Time + End Time
- If actual vs planned differs > 1hr: amber warning + "Delay reason" field auto-expands

**Section C — Pre-Pour Checklist:**
- List of 5 items, each with Yes / No / NA segmented buttons (pill style, large)
- Pre-Pour Approval: large green "APPROVED" / red "NOT APPROVED" toggle
- Approved By: text input

**Section D — Concrete Supply:**
- Grade (auto from Component Master) | Supplier (from order) | Mix Design ID
- Total Quantity* | Actual Quantity* | No. of Trucks*
- Pump Used | Pump Operator

**Section E — Per Truck Record:**
- Collapsible truck cards, one per arrival
- Each: Truck No, Challan No, Batch ID, Batch Time, Arrival Time, Discharge Start/End, Load Volume
- Cumulative volume auto-sums (shown prominently)
- Transit time auto-calculated: shown in red if > 90 minutes
- Water Added on Site: No / Yes (if Yes → Litres field expands with red warning)
- "+ Add Truck" dashed button

**Section F — Fresh Concrete Tests:**
- Per test set: Truck No, Test Time, Slump (mm), Slump Result (Pass/Fail auto)
- Temperature, Air Content, Density
- "SLUMP FAIL" → red badge auto-appears, triggers Quality Head notification

**Section G — Cube Sampling:**
- Cube Sample Set ID (auto-generated)
- Sampling time, From Truck No, Mould Size
- No. of Cubes Cast, breakdown by 7/14/28 day
- Cube IDs (system-generated chips, editable)
- Lab Assigned (dropdown from registered labs)
- Dispatch date

**QR Code Generation (after cube sampling saved):**
- System generates QR code per cube/set
- "Print QR Labels" button → generates printable PDF with cube labels
- Each label: Cube ID, Pour ID, Grade, Tower/Floor/Component, Cast Date

**Section H — Site Conditions:**
- Weather: icon selector (sunny/cloudy/rain/hot/cold)
- Temp, Humidity, Wind, Curing Method, Curing Start Time
- Night Pour toggle

**Section I — Sign-Off:**
- Supervisor Sign-off: large "SIGN OFF" button
- QA Engineer Review: Reviewed & Approved / Under Review / Rejected
- Pour Status: Planned / In Progress / Completed / Incomplete / Cancelled

**Bottom sticky bar:**
"Save Draft" | "Submit Pour Card" (large blue, full width on mobile)

---

### SCREEN 11 — Quality Acceptance (Quality Head View)

**URL:** Notification → opens Pour Card with QA panel active
**Who uses this:** Quality Head / Quality Manager

**QA Panel (shown prominently in pour card for QH role):**
- Arrives after truck arrival notification
- Shows: Supplier, Grade, Batch ID, Transit Time, Slump results
- Decision: "Accept Pour" (green) | "Conditional Accept" (amber) | "Reject Pour" (red)
- Each decision requires notes field
- On Accept: supplier receives email "Your RMC has been received and accepted at [Project, Tower, Floor]"
- On Reject: Rejection reason sent to supplier + NCR auto-raised

---

### SCREEN 12 — Cube Test Results Upload (Lab External View)

**URL:** `/labs/submit?token=ABC&cube_set=CUBE-T1-5F-001` (public, token-gated)
**Who fills this:** Laboratory (external, no platform account)
**Trigger:** Email sent when cubes are dispatched to lab

**Email received by lab contains:**
- Cube Set ID, No. of cubes, Pour details, Expected test dates (7/14/28 day)
- "Upload 7-Day Results" button link (active after 7 days)
- "Upload 14-Day Results" button link
- "Upload 28-Day Results" button link

**Result upload page:**
- Header: "Cube Test Result Submission — [Cube Set ID]"
- Auto-populated (read-only): Cube Set ID, Pour Card ID, Project, Tower/Floor, Grade, Cast Date
- Per cube row (table):
  - Cube ID | Failure Load (kN) | Dimensions | Calculated Strength (auto MPa) | Failure Pattern
- Lab Report No.* | PDF Upload* (drag and drop)
- Tested By* | Test Date*
- "Submit Results" button → "Results submitted. They will appear in QMS within minutes."

**After submission:**
- System calculates strength (kN ÷ area × 1000)
- Compares vs grade threshold (IS 456)
- Classifies PASS / BORDERLINE / FAIL / CRITICAL
- Triggers dashboard update + notifications

---

### SCREEN 13 — Cube Result (In-Platform View)

**URL:** `/project/:id/results/:id`
**Who sees this:** Project Manager, Quality Head, Contractor Admin

**Layout:** Result card at top, full trace chain below

**Result Card (most prominent element on screen):**
- Large result badge occupying top 120px:
  - PASS: green gradient header, white text "✓ PASS — 48.3 MPa (M40 specified)"
  - FAIL: red gradient header, white "✗ FAIL — 37.2 MPa (min 38.5 required)"
  - BORDERLINE: amber "⚠ BORDERLINE — 39.1 MPa (within range, below target)"
- Cube ID | Cast Date | Test Age | Lab Name
- Specified fck | Actual Strength | % of Characteristic Strength

**Linked references section:**
- Clickable trace path: Result → Pour Card → Batch → Supplier → Tower/Floor/Component

**Timeline of all ages (if multiple tests):**
- Horizontal timeline: 7-day result → 14-day → 28-day
- Each shows: date, strength MPa, Pass/Fail badge, test status (uploaded / pending / overdue)

**On FAIL — Action Panel (shown in red card):**
- "NCR auto-raised: NCR-2024-015" link
- "View Traceability Chain" button
- "Ask Chatbot: Who is responsible?" button (opens chatbot with pre-filled query)

---

### SCREEN 14 — Full Traceability Chain View

**URL:** `/project/:id/trace/:cube_id`
**Who uses this:** Project Manager, Quality Head, Contractor Admin, Super Admin

**Layout:** Left: trace chain visual | Right: detail panel

**Trace Chain (left, vertical):**
Visual step-by-step chain with connecting arrows:

```
[Cube Test Result: RES-2024-1045]
    ↓ (FAIL — 37.2 MPa)
[Cube Sample: CUBE-T1-5F-20240601-001]
    ↓ Cast: 01-Jun-2024, 07:00
[Pour Card: PC-T1-5F-SLB-20240601-001]
    ↓ Poured: 01-Jun-2024, 06:15–14:30
[Batch: BATCH-20240601-042]
    ↓ Transit: 35 min ✓
[Dispatch: Challan UC/WF/2024/14567]
    ↓
[Supplier: UltraTech RMC Whitefield]
    ↓
[Location: Tower T1 > Floor 5F > Slab T1-5F-SLB-01]
```

Each node is clickable → shows detail on right panel.
Confidence badge on each link: 100% exact / 82% fuzzy / etc.

**Detail panel (right):**
Shows full details of whichever node is clicked.

**Responsibility Analysis Section (below chain):**
- "Probable responsibility signals" — card with amber border
- List of signals with indicators:
  - ✓ Transit time: 35 min (within 90 min limit) — Not a factor
  - ⚠ Supplier failure history: 2 failures in last 30 days (same grade) — Possible factor
  - ✓ Water addition on site: None recorded — Not a factor
  - ⚠ w/c ratio from batch ticket: 0.42 (specified 0.38) — Likely factor
- Summary: "Probable cause: Supplier batch quality. Recommend: mix design audit + batch record review."
- "Raise NCR" button | "Ask Chatbot" button

---

### SCREEN 15 — NCR Management

**URL:** `/project/:id/ncr`
**Layout:** List page + detail drawer/page

**NCR List:**
- Header KPIs: Open NCRs | Under Investigation | Closed This Month | Pending > 7 Days
- Filter bar: By type / severity / supplier / status / tower / date range
- Table columns: NCR ID | NCR Type | Severity | Tower/Floor | Component | Supplier | Status | Raised On | Due Date | Days Open | Actions

**Severity colour coding:**
- Critical: red left border on row
- Major: amber left border
- Minor: grey left border

**NCR Detail page (URL: `/project/:id/ncr/:id`):**

Section A — Identity (auto-generated, read-only banner):
NCR ID | Date | Type | Source | Triggered By

Section B — Linked Records (chips):
Pour Card | Cube Result | Tower/Floor | Component | Supplier

Section C — Non-Conformance Description:
- Full description (editable by QH)
- Specified vs Actual value (2-col highlight boxes)
- Severity selector: CRITICAL / MAJOR / MINOR (large segmented)
- Structural Impact dropdown
- Photo attachment

Section D — Notification (auto):
- Responsible Org | Notified Persons (chips) | Notification Date | Response Deadline

Section E — Investigation:
- Root Cause (textarea)
- Corrective Action | Core Test Result | Action Due Date | Completion Date

Section F — Penalty Workflow:
- Penalty Applicable: Yes / No / Under Review
- If Yes: Clause Ref, Amount (INR), Basis, Penalty Status
- If Waived: Waiver Reason

Section G — Closure:
- NCR Status progress stepper: Open → Under Investigation → Awaiting Core Test → Closed
- Closed By | Closure Date | Closure Remarks | Lessons Learned

---

### SCREEN 16 — Analytics Dashboard

**URL:** `/project/:id/analytics`
**Who sees this:** All internal roles (data varies by role)

**Layout:** KPI row → Chart row → Table section

**KPI Row (5 cards):**
- Total Pours (this month) | vs last month delta
- Overall Pass Rate % | trend arrow
- Open NCRs | urgent count badge
- Pending Cube Tests | overdue count
- Suppliers Active | flagged count

**Charts Row:**
1. Monthly Pass Rate Trend (line chart, last 6 months) — by grade
2. Supplier Performance Comparison (bar chart) — pass rate per supplier
3. Tower-wise Failure Heatmap (grid: towers × floors, colour = fail rate)
4. Cube Test Volume (area chart) — tests performed vs pending by week

**Filters (global for page):**
Tower | Floor Range | Supplier | Grade | Date Range | Component Type

**Table Section:**
- Recent Failures (last 14 days): Grade, Location, Supplier, Strength, NCR status
- Top Suppliers (by pass rate this month)
- Pending Results (cubes with no result yet, overdue flagged in red)

**Export:**
"Download Report" dropdown: Monthly Quality Summary PDF / Supplier Performance Excel / NCR Status Report / Tower-wise Concrete Usage

---

### SCREEN 17 — RAG Chatbot

**URL:** `/project/:id/chatbot`
**Who uses this:** All internal roles

**Layout:** Split — left chat panel (60%), right context panel (40%)

**Left — Chat Panel:**
- Header: "QMS Assistant" | "Powered by your project data" sub
- Chat history (scrollable)
- Each bot response shows:
  - Answer text
  - Source citations below: clickable chips "Pour Card PC-001" / "Cube Result RES-045" / "NCR-012"
- "Thinking..." animated indicator during processing
- Input box (bottom): text input + send button + mic button
- Suggested queries (shown initially before any chat):
  - "Which supplier provided M40 for Tower T1, Floor 5?"
  - "What was the 28-day strength of cube C003?"
  - "Which batches failed this month?"
  - "Is there an unresolved penalty from last quarter?"
  - "Who is responsible for the failure at T1-5F-SLB-01?"

**Right — Context Panel:**
- Shows supporting data for the last chatbot answer
- E.g. after a traceability question: shows the trace chain
- After a quality question: shows the result card
- After a supplier question: shows supplier stats table
- Collapses to icon on mobile

**Intent detection badges (shown on bot response):**
Small pill indicating query type: Traceability | Quality | Analytics | Supplier | Compliance | Execution

---

### SCREEN 18 — Notification Centre

**All roles — accessible via bell icon in header**

**Bell icon:**
- Shows unread count badge
- Click opens notification drawer (slides in from right)

**Notification Drawer:**
- "Notifications" heading | "Mark all read" link
- Filter tabs: All | Urgent | Today | Mentions
- Notification list (grouped by date)

**Notification types with distinct icons + colour left borders:**
- 🔵 Truck Arrived — "Truck KA-05-AB-1234 (M40, 7m³) arrived at gate" — PM + QH + Supervisor
- 🟢 Pour Accepted — "Pour at T1-5F-SLB-01 accepted by QA team" — Supplier notified
- 🟡 Cube Result: Borderline — "C003 at 39.1 MPa — borderline M40. Review recommended." — QH
- 🔴 Cube Result: FAIL — "FAIL: C005 at 37.2 MPa. NCR-2024-015 raised." — PM + QH + Contractor
- 🟠 NCR Due — "NCR-2024-012 response deadline tomorrow (15-Jul)" — NCR Owner
- ⚫ Cube Due for Testing — "Cube set CUBE-T1-5F-001 due for 28-day test today" — PM + Lab

Each notification:
- Icon | Title | Detail text | Time ago (e.g. "32 min ago")
- "View" link → jumps to relevant record
- Mark-read X button

---

### SCREEN 19 — Settings

**URL:** `/settings`
**Accessible to:** Super Admin, Contractor Admin

**Tabs:**
1. Project Settings (grades, thresholds, acceptance criteria)
2. Notification Rules (who gets what, escalation timers)
3. Alias Management (map supplier name variants to canonical names)
4. User Management (all users, roles, active/inactive)
5. Audit Log (all system actions, filterable)
6. Integrations (WhatsApp, email SMTP settings)
7. Billing / Subscription (Super Admin only)

---

## 4. Mobile-Specific Screens

### Guard Scan App (Mobile)
- Full-screen camera scan view
- Large confirm/reject buttons
- No sidebar, no extra nav
- Works offline (queues arrival event if no internet, syncs when connected)

### Supervisor Pour Card (Mobile)
- Stacked sections, large tap targets
- "Save" button always visible (sticky top)
- Camera integration for photo attachments
- Works in low connectivity (auto-saves locally, syncs when connected)

### PM Dashboard (Mobile)
- 2-column KPI cards
- Single-chart view (swipe to switch charts)
- Notification banner prominently at top if any urgent alert

---

## 5. Empty States & Edge Cases

| Screen | Empty State |
|---|---|
| No projects (Super Admin) | Illustration + "Create your first project" |
| No pours yet | "No pours recorded yet. Create the first pour card." |
| No cube results | "Cube results will appear here once the lab uploads them." |
| No NCRs | "No non-conformances recorded. All tests passing." ✓ |
| No suppliers registered | "Register your RMC supplier to start placing orders." |
| Chatbot — no query yet | Suggested query chips (see Screen 17) |
| Chatbot — no data match | "I couldn't find data for that query in this project. Try rephrasing or check if the pour records have been entered." |

---

## 6. Key Interaction Patterns

### Cascading Dropdowns
Tower → Floor → Zone → Component: each selection narrows the next dropdown. Always show "Select Tower first" placeholder in dependent dropdowns.

### Conditional Field Expansion
- BIS Certification: Yes → Cert No + Expiry appear inline (no page jump)
- Water Added on Site: Yes → Litres input + red warning expands
- Penalty Applicable: Yes → full penalty section expands
- Sub-Contractor org type → Parent Contractor field appears

### Auto-Save
All pour cards auto-save on field blur. Banner shows "Saved 2 minutes ago."

### Confidence Scoring Display
In traceability view: each trace link shows a confidence bar:
- 100% (exact match): solid blue bar
- 70–99%: green with label "fuzzy match"
- 50–69%: amber with "inferred"
- <50%: red with "review required"

### QR Code Printing
"Print QR Labels" generates A6-sized labels per cube:
- Cube ID (large, bold)
- QR code (large, scannable)
- Pour ID | Grade | Tower/Floor | Cast Date | Lab
- Print CSS: hide all nav, show only label grid

---

## 7. Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| < 640px (mobile) | Single column, stacked nav as bottom bar |
| 640–1024px (tablet) | Sidebar collapses to icon rail, 2-col forms |
| > 1024px (desktop) | Full sidebar + multi-column layout |

### Sidebar behaviour:
- Desktop: always visible, 240px wide
- Tablet: icon-only rail, 64px wide, hover to expand
- Mobile: hidden by default, hamburger toggle → full-width overlay

---

## 8. Page-by-Page Handoff Summary

| # | Screen | URL | Priority | Who uses |
|---|---|---|---|---|
| 1 | Login | /login | P0 | All |
| 2 | Super Admin Dashboard | /dashboard | P0 | Super Admin |
| 3 | New Project (6-step form) | /projects/new | P0 | Super Admin |
| 4 | Contractor Invitation | /project/:id/team/invite | P0 | Super Admin |
| 5 | User Registration | /project/:id/team/users | P0 | Contractor Admin |
| 6 | RMC Supplier Registration | /project/:id/suppliers/new | P0 | Project Manager |
| 7 | Lab Registration (external) | /labs/register | P0 | Lab (external) |
| 8 | Gate Scanning | /project/:id/gate | P0 | Guard (mobile) |
| 9 | RMC Order Management | /project/:id/orders | P1 | Project Manager |
| 10 | Pour Card | /project/:id/pours/new | P0 | Supervisor |
| 11 | Quality Acceptance | (in pour card) | P0 | Quality Head |
| 12 | Cube Result Upload (external) | /labs/submit | P0 | Lab (external) |
| 13 | Cube Result View | /project/:id/results/:id | P0 | PM, QH |
| 14 | Traceability Chain | /project/:id/trace/:id | P1 | PM, QH, SA |
| 15 | NCR Management | /project/:id/ncr | P1 | QH, PM |
| 16 | Analytics Dashboard | /project/:id/analytics | P1 | All internal |
| 17 | RAG Chatbot | /project/:id/chatbot | P2 | All internal |
| 18 | Notification Centre | (drawer, all pages) | P1 | All internal |
| 19 | Settings | /settings | P2 | SA, Contractor Admin |
