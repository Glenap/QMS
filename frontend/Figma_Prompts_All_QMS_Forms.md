# Figma Make AI — Construction QMS Forms
## Complete Prompt Set for All 8 Forms
---

> **How to use:** Copy one prompt at a time → paste into Figma Make AI → generate.
> Design system applied consistently across all forms:
> - Font: Inter
> - Primary colour: #1A56DB (blue)
> - Success: #057A55 (green), Error: #C81E1E (red), Warning: #E3A008 (amber)
> - Background: #F9FAFB, Card: #FFFFFF, Border: #E5E7EB
> - Mandatory fields marked with a red asterisk (★)
> - Auto-filled / read-only fields shown in a light grey (#F3F4F6) disabled input

---

## FORM 1 — Project Master Form

```
Design a full-page web form called "Project Master" for a Construction Quality Management System.

Design language: Clean enterprise SaaS. Font: Inter. Primary: #1A56DB. Background: #F9FAFB. Card: white with 1px #E5E7EB border, 8px radius. Section headers: bold 14px uppercase tracking-wide #6B7280. Input height: 40px. Red asterisk on all mandatory fields.

Page header:
- Title: "Project Master" (24px bold)
- Subtitle: "Filled by: Client Admin — Set up project, towers, floors and components before inviting contractors"
- Top-right: "Save Draft" (outline button) + "Submit" (filled blue button)

Organize into 6 collapsible sections with a chevron toggle. Show all sections expanded by default.

---
SECTION A — PROJECT IDENTITY (blue left border)
2-column grid:

Row 1:
- Project ID* | read-only grey input, placeholder "Auto-generated: PRJ-2024-001"
- Project Name* | text input, placeholder "e.g. Godrej Splendour Phase 2"

Row 2:
- Project Type* | dropdown: Residential / Commercial / Mixed-Use / Infrastructure
- Client Organisation* | text input, placeholder "e.g. Godrej Properties Ltd"

Row 3:
- Client Admin Name* | text input
- Client Admin Email* | email input

Row 4:
- Client Admin Phone* | phone input with +91 prefix
- GST Number | text input, placeholder "27AABCG1234A1Z5"

Row 5:
- Project Code / RERA | text input, placeholder "P51700049510"
- (empty)

---
SECTION B — PROJECT LOCATION
2-column grid:

Row 1:
- Address Line 1* | text input, placeholder "Plot / Survey number"
- Address Line 2 | text input, placeholder "Street / Road"

Row 2:
- City* | text input
- State* | dropdown: Maharashtra / Karnataka / Gujarat / Delhi / Tamil Nadu / Others

Row 3:
- PIN Code* | number input
- Geo-coordinates | text input, placeholder "12.9716, 77.5946"

Row 4:
- Site Area (sqm) | number input
- (empty)

---
SECTION C — PROJECT TIMELINE & SCOPE
2-column grid:

Row 1:
- Project Start Date* | date picker
- Project End Date* | date picker

Row 2:
- Total Built-up Area (sqm) | number input
- No. of Towers* | number input with stepper

Row 3:
- No. of Basements | number input with stepper
- No. of Floors (Max)* | number input with stepper

Row 4:
- Project Status* | dropdown: Planning / Foundation / Superstructure / Finishing / Completed
- (empty)

---
SECTION D — TOWER / BLOCK DETAILS
Label: "One row per tower. Click '+ Add Tower' to add more."

Repeatable table rows with columns:
Tower ID* (text) | Tower Name* (text) | Tower Type* (dropdown: Residential/Commercial/Podium/Basement) | No. of Floors* (number) | Basement Levels (number) | Floor Height (number) | Start Floor Label (text) | Construction Start (date) | [Delete icon]

Show 2 pre-filled example rows.
"+ Add Tower" button below table (dashed border, blue text).

---
SECTION E — FLOOR / ZONE / COMPONENT MASTER
Label: "One row per component. Click '+ Add Component' to add more."

Repeatable table rows with columns:
Tower ID* (ref dropdown) | Floor Label* (text) | Zone (text) | Grid Reference (text) | Component Type* (dropdown: Column/Beam/Slab/Wall/Footing/Pile Cap/Raft/Staircase/Shear Wall) | Component ID* (text) | Design Concrete Grade* (dropdown: M20–M60) | Volume m³ (number) | Reinforcement Grade (dropdown: Fe415/Fe500/Fe550/Fe600) | [Delete icon]

Show 3 pre-filled example rows.
"+ Add Component" button.

---
SECTION F — QUALITY PARAMETERS
2-column grid:

Row 1:
- Min Cube Samples* | text input, placeholder "3 per 50m³ or part thereof"
- Acceptance Criteria* | dropdown: IS 456:2000 / IS 1343 / ACI 318 / BS 8110

Row 2:
- Early Test Age (days)* | dropdown: 3 / 7
- Mid Test Age (days) | dropdown: 14

Row 3:
- Final Test Age (days)* | dropdown: 28
- Characteristic Strength % | number input, placeholder "65"

Row 4:
- NCR Trigger* | text input, placeholder "QA Manager + Project Manager + PMC"
- (empty)

---
FOOTER:
Left: "★ Mandatory field"
Right: "Save Draft" (grey outline) + "Submit for Approval" (blue filled)
```

---

## FORM 2 — Contractor / Organisation Registration Form

```
Design a full-page web form called "Contractor Registration" for a Construction Quality Management System.

Design language: Inter font. Primary: #1A56DB. Background: #F9FAFB. White card sections with 1px #E5E7EB border, 8px radius. Red asterisk on mandatory fields. Auto-filled fields shown in disabled grey (#F3F4F6) inputs.

Page header:
- Title: "Contractor Registration" (24px bold)
- Subtitle: "Filled by: Client Admin (sends invite) → Organisation fills own details | Purpose: Register Contractors, Consultants, PMC and Sub-Contractors"
- Top-right: "Save Draft" + "Submit" buttons

6 collapsible sections, all expanded by default.

---
SECTION A — LINKED PROJECT (read-only invitation info)
Show as a light blue #EFF6FF info banner:
- Project ID*: auto grey input "PRJ-2024-001"
- Project Name: auto grey input "Godrej Splendour Phase 2"
- Invitation ID: auto grey input "INV-2024-042"
- Invited By: auto grey input "Rajesh Sharma"
- Invitation Date: auto grey input "10-Apr-2024"
- Invitation Expiry: date input

---
SECTION B — ORGANISATION DETAILS
2-column grid:

Row 1:
- Organisation Type* | dropdown: Contractor / Sub-Contractor / Consultant / PMC / Structural Consultant / MEP Consultant
- Company Name* | text input, placeholder "Registered company name"

Row 2:
- Company Short Name* | text input, placeholder "e.g. L&T"
- Registration Number | text input, placeholder "CIN / Company reg. number"

Row 3:
- GST Number* | text input
- PAN Number | text input

Row 4:
- Website | url input, placeholder "www.company.com"
- (empty)

---
SECTION C — CONTACT DETAILS
2-column grid:

Row 1:
- Contact Person Name* | text input
- Designation* | text input

Row 2:
- Email ID* | email input
- Mobile Number* | phone input

Row 3:
- Alternate Phone | phone input
- Registered Address* | text input

Row 4:
- Site Office Address | text input
- (empty)

---
SECTION D — CONTRACT / SCOPE
2-column grid:

Row 1:
- Scope of Work* | full-width textarea (2 rows), placeholder "Brief description of contracted scope"

Row 2:
- Contract Value (INR) | number input
- Contract Start Date* | date picker

Row 3:
- Contract End Date* | date picker
- Assigned Towers* | text input, placeholder "e.g. T1, T2"

Row 4:
- Work Package / LOT | text input
- Parent Contractor | ref dropdown (visible + required only when Org Type = Sub-Contractor — show conditional note in amber)

---
SECTION E — DOCUMENTS & COMPLIANCE
2-column grid:

Row 1:
- Trade Licence Number | text input
- ISO Certification | text input

Row 2:
- EPF Registration | text input
- ESI Registration | text input

Row 3:
- Insurance Policy No. | text input
- Insurance Expiry | date picker

Row 4:
- Safety Certification | text input
- (empty)

---
SECTION F — STATUS & APPROVAL
2-column grid:

Row 1:
- Acceptance Status* | dropdown: Invited / Accepted / Rejected / Revoked
- Acceptance Date | date picker

Row 2:
- Approval Status* | dropdown: Pending Approval / Approved / On Hold / Blacklisted
- Approved By | text input

Row 3:
- Approval Date | date picker
- Active Status* | dropdown: Active / Inactive / Suspended

Row 4:
- Remarks | full-width textarea

---
FOOTER: "★ Mandatory field" left | "Save Draft" + "Submit" right
```

---

## FORM 3 — RMC Supplier & Mix Design Registration Form

```
Design a full-page web form called "RMC Supplier Registration" for a Construction Quality Management System.

Design language: Inter. Primary #1A56DB. Card sections white, 1px #E5E7EB border, 8px radius. Background #F9FAFB. Red asterisk mandatory. Disabled grey for auto-filled fields.

Page header:
- Title: "RMC Supplier & Mix Design Registration" (24px bold)
- Subtitle: "Filled by: Contractor | Purpose: Register RMC suppliers, batching plants, mix designs, rates and approvals"
- "Save Draft" + "Submit for Approval" top right

6 collapsible sections.

---
SECTION A — LINKED PROJECT & CONTRACTOR
Light blue #EFF6FF info banner, all read-only:
- Project ID* | auto: PRJ-2024-001
- Contractor ID* | auto: CON-001
- RMC Registration ID* | auto: RMC-2024-007
- Registration Date* | auto: today's date

---
SECTION B — SUPPLIER DETAILS
2-column grid:

Row 1:
- Supplier Name* | text input
- Supplier Short Code* | text input, placeholder "e.g. UTC-RMC"

Row 2:
- Supplier Category* | dropdown: Approved / Preferred / Trial
- Plant Name* | text input

Row 3:
- Plant Code | text input
- Plant Address* | text input

Row 4:
- Distance from Site (km)* | number input
- Contact Person* | text input

Row 5:
- Contact Phone* | phone input
- Contact Email* | email input

Row 6:
- Emergency Contact | phone input
- GST Number | text input

---
SECTION C — PLANT CAPABILITIES
2-column grid:

Row 1:
- Batching Plant Capacity (m³/hr) | number input
- Transit Mixer Count | number input

Row 2:
- Transit Mixer Volume (m³)* | dropdown: 6 / 7 / 7.5 / 8 / 9
- Pump Availability | dropdown: Yes / No

Row 3:
- BIS Certification (IS 4926)* | dropdown: Yes / No — if Yes, show BIS Cert Number and BIS Cert Expiry fields inline
- NABL Lab at Plant | dropdown: Yes / No

---
SECTION D — MIX DESIGN DETAILS
Label: "One row per grade. Click '+ Add Mix Design' to add more."

Repeatable card (white, bordered) per mix design with fields in 3-column grid:
Row 1: Mix Design ID* (text) | Concrete Grade* (dropdown M20–M60) | Mix Type* (dropdown: Normal/Pumpable/Self-Compacting/Fibre Reinforced/Waterproof)
Row 2: Exposure Condition (dropdown: Mild/Moderate/Severe/Very Severe/Extreme) | Cement Type* (dropdown: OPC 43/OPC 53/PPC/PSC/SRC/GGBS Blended) | Cement Content kg/m³* (number)
Row 3: Fly Ash Content kg/m³ (number) | GGBS Content kg/m³ (number) | Total Binder kg/m³* (number, auto-sum with blue highlight)
Row 4: w/c Ratio* (number) | Free Water lit/m³* (number) | Coarse Agg 20mm kg (number)
Row 5: Coarse Agg 10mm kg (number) | Fine Aggregate kg (number) | Admixture Type (dropdown: Plasticizer/Superplasticizer/Retarder/Accelerator/Air-entraining/None)
Row 6: Admixture Dosage % (number) | Target Mean Strength MPa* (number) | Max Aggregate Size* (dropdown: 10/12.5/20/40)
Row 7: Slump Range mm* (text, e.g. "100–150 mm") | Mix Design Approval Date* (date) | Approved By* (text)
Row 8: Mix Design Report Ref (text) — full width

"+ Add Mix Design" dashed button below.

---
SECTION E — COMMERCIAL & VALIDITY
2-column grid:

Row 1:
- Rate per m³ (INR)* | number input
- Pump Charge per m³ | number input

Row 2:
- Unloading Charge | text input, placeholder "500/hr beyond 30 min"
- Minimum Order Qty (m³) | number input

Row 3:
- Payment Terms | dropdown: Advance / Credit 15 days / Credit 30 days / Against Delivery
- Validity From* | date picker

Row 4:
- Validity To* | date picker
- Rate Escalation Clause | text input

---
SECTION F — STATUS & APPROVAL
2-column grid:

Row 1:
- Approval Status* | dropdown: Pending / Approved / Rejected / Suspended
- Approved By | text input

Row 2:
- Approval Date | date picker
- Active Status* | dropdown: Active / Inactive

Row 3:
- Blacklist Flag | dropdown: No / Yes – Reason required (if Yes, show reason text field)
- Remarks | text input

---
FOOTER: "★ Mandatory field" left | "Save Draft" + "Submit for Approval" right
```

---

## FORM 4 — Laboratory Registration Form

```
Design a full-page web form called "Laboratory Registration" for a Construction Quality Management System.

Design language: Inter. Primary #1A56DB. White cards with 1px #E5E7EB border, 8px radius. Background #F9FAFB. Mandatory fields marked with red asterisk. Auto-populated fields in disabled grey.

Page header:
- Title: "Laboratory Registration" (24px bold)
- Subtitle: "Filled by: Contractor | Purpose: Register testing laboratories – in-house or third party – with accreditation and scope"
- "Save Draft" + "Submit" top right

8 collapsible sections.

---
SECTION A — LINKED PROJECT & CONTRACTOR (read-only blue banner)
- Project ID*, Contractor ID*, Lab Registration ID*, Registration Date* — all auto grey inputs in a row

---
SECTION B — LAB IDENTITY
2-column grid:

Row 1:
- Lab Name* | text input, placeholder "Full name of the laboratory"
- Lab Short Code* | text input, placeholder "Used in reports and cube IDs"

Row 2:
- Lab Type* | dropdown: In-House / Third Party / Govt. Approved
- Lab Category* | dropdown: Concrete Testing / Soil Testing / Steel Testing / Water Testing / Multi-disciplinary

Row 3:
- Parent Organisation | text input, placeholder "Only for In-House labs" (show conditionally if Lab Type = In-House, amber conditional note)

---
SECTION C — NABL / ACCREDITATION
2-column grid:

Row 1:
- NABL Accredited* | dropdown: Yes / No / Applied / Expired
- NABL Certificate No. | text input

Row 2:
- NABL Scope of Tests | full-width textarea, placeholder "e.g. Concrete cubes, Fresh concrete tests"

Row 3:
- NABL Accreditation Date | date picker
- NABL Valid Till | date picker — if expired, show red warning badge "EXPIRED"

Row 4:
- Other Certification | text input, placeholder "ISO 17025:2017"
- Govt. Approval Ref | text input

---
SECTION D — CONTACT & LOCATION
2-column grid:

Row 1:
- Lab Address* | full-width text input
- Contact Person* | text input

Row 2:
- Designation* | text input
- Phone* | phone input

Row 3:
- Email* | email input
- Distance from Site (km) | number input

Row 4:
- Sample Collection | dropdown: Yes – Door-step pickup / No – Drop-off only
- Turnaround Time | text input, placeholder "e.g. 28-day: same day after 28 days"

---
SECTION E — SCOPE OF TESTING
Label: "Select all tests this laboratory can perform:"

Toggle switch grid (2 columns, each row = one test with Yes/No toggle):
- Concrete Cube Test (IS 516)* — toggle
- Slump Test (IS 1199) — toggle
- Rebound Hammer (IS 13311 Pt 2) — toggle
- UPV Test (IS 13311 Pt 1) — toggle
- Core Cutting & Test — toggle
- Water Permeability (IS 3085) — toggle
- Chloride / Sulphate Analysis — toggle
- Steel Tensile Test (IS 1786) — toggle
- Soil Tests (CBR, Compaction) — toggle
- Additional Tests | text input for "Any other tests"

---
SECTION F — EQUIPMENT & CAPACITY
2-column grid:

Row 1:
- Compression Testing Machine (CTM) | text input, placeholder "3000 kN – 2 Nos."
- CTM Calibration Date | date picker

Row 2:
- CTM Calibration Expiry | date picker — show red badge if expired
- Daily Cube Capacity | number input

Row 3:
- Curing Tank Capacity | number input
- Digital Reporting* | dropdown: Yes – PDF / Yes – Excel / No – Physical only

Row 4:
- Report Format | text input
- (empty)

---
SECTION G — COMMERCIAL
2-column grid:

Row 1:
- Cube Test Rate (INR per cube) | number input
- Slump Test Rate (INR) | number input

Row 2:
- Core Test Rate (INR per core) | number input
- Agreement Ref No. | text input

Row 3:
- Agreement Start Date | date picker
- Agreement End Date | date picker

---
SECTION H — STATUS & APPROVAL
2-column grid:

Row 1:
- Approval Status* | dropdown: Pending / Approved / Rejected
- Approved By | text input

Row 2:
- Approval Date | date picker
- Active Status* | dropdown: Active / Inactive

Row 3:
- Remarks | full-width textarea

---
FOOTER: "★ Mandatory field" | "Save Draft" + "Submit"
```

---

## FORM 5 — User Registration Form

```
Design a full-page web form called "User Registration" for a Construction Quality Management System.

Design language: Inter. Primary #1A56DB. White card sections, 1px #E5E7EB border, 8px radius. Background #F9FAFB. Red asterisk mandatory. Grey disabled inputs for auto-populated fields.

Page header:
- Title: "User Registration" (24px bold)
- Subtitle: "Filled by: Contractor Admin | Purpose: Register project personnel with roles, permissions and assignments"
- "Save Draft" + "Create User" (blue filled) top right

7 collapsible sections.

---
SECTION A — LINKED PROJECT & ORGANISATION (read-only blue banner)
- Project ID* | Contractor ID* | User ID* | Created Date* | Created By* — all auto grey inputs in a single row

---
SECTION B — USER IDENTITY
2-column grid:

Row 1:
- Full Name* | text input, placeholder "As per company ID"
- Employee ID* | text input, placeholder "e.g. EMP-LT-2019-04521"

Row 2:
- Designation* | text input, placeholder "Official job title"
- Organisation* | text input, placeholder "Employer company name"

Row 3:
- Department | dropdown: Quality / Planning / Safety / Civil / MEP / Management / Store
- Date of Joining | date picker, placeholder "Date joined this project"

---
SECTION C — CONTACT
2-column grid:

Row 1:
- Email ID* | email input, helper text "Used as login"
- Mobile Number* | phone input, helper text "OTP will be sent here"

Row 2:
- Alternate Email | email input
- Emergency Contact | text input, placeholder "Name & phone"

---
SECTION D — ROLE & ACCESS
2-column grid:

Row 1:
- System Role* | dropdown: Project Manager / Quality Manager / Consultant / PMC Inspector / Site Engineer / Supervisor / Lab Technician / Store Manager / Safety Engineer / Planning Engineer / Viewer
- Access Level* | dropdown: Admin / Full Edit / Approve Only / Data Entry / View Only

Row 2:
- Module Access* | multi-select checkbox group with chips:
  ✓ Pour Card | ✓ RMC | ✓ Lab Results | ✓ NCR | ✓ Dashboard | ✓ Reports | ✓ User Mgmt

Row 3:
- Can Approve Pour | toggle Yes/No
- Can Raise NCR | toggle Yes/No

Row 4:
- Can View Rates | toggle Yes/No
- Login Method* | dropdown: Email + Password / OTP / SSO

---
SECTION E — ASSIGNMENT
2-column grid:

Row 1:
- Assigned Towers* | text input with chip tags, placeholder "e.g. T1, T2 or ALL"
- Assigned Floors | text input, placeholder "e.g. 1F–15F or ALL"

Row 2:
- Assigned Zone | text input, placeholder "e.g. North Core"
- Shift | dropdown: Day / Night / Both

Row 3:
- Reporting To | text input, placeholder "Direct supervisor name and role"
- (empty)

---
SECTION F — NOTIFICATIONS
Row 1:
- Email Alerts* | toggle Yes/No
- SMS / WhatsApp Alerts* | toggle Yes/No

Row 2:
- Alert Types | multi-select checkbox group:
  Pour Card Created | Cube Result Uploaded | FAIL Result | NCR Raised | NCR Closed | Pour Approved

---
SECTION G — STATUS
2-column grid:

Row 1:
- Account Status* | dropdown: Active / Inactive / Suspended / Transferred Out
- Last Login | read-only grey input "Auto-updated by system"

Row 2:
- Exit Date | date picker
- Exit Reason | dropdown: Project Completed / Resigned / Transferred / Contract Ended

Row 3:
- Remarks | full-width textarea

---
FOOTER: "★ Mandatory field" | "Save Draft" + "Create User"
```

---

## FORM 6 — Pour Card Form

```
Design a full-page mobile-first web form called "Pour Card" for a Construction Quality Management System. This form is filled on-site by a Supervisor, often on tablet. Optimise for touch: large tap targets (min 44px), clear section separation, sticky bottom action bar.

Design language: Inter. Primary #1A56DB. Each section is a white card with 8px radius, 16px padding, stacked vertically. Background #F2F4F6. Red asterisk mandatory. Auto-filled fields in grey.

Page header (sticky):
- Back arrow | "Pour Card" (18px bold) | Pour ID: "PC-T1-5F-SLB-…" (auto, small grey) | Status badge: "In Progress" (amber)
- "Save" button top right

---
SECTION A — POUR IDENTIFICATION (blue top border)

- Pour ID* | read-only grey, "Auto-generated"
- Project ID* | read-only grey

Full-width select: Tower* → Floor* → Zone (3 dropdowns in a row on desktop, stacked on mobile)
- Tower*: T1 / T2 / T3 / T4
- Floor*: B2 / B1 / GF / 1F … 28F
- Zone: North / South / East / West / Core

- Grid Reference | text input, placeholder "e.g. C3-D5"
- Component Type* | dropdown: Slab / Column / Beam / Wall / Footing / Pile Cap / Raft / Staircase / Shear Wall / Plinth Beam
- Component ID* | ref selector with search, placeholder "Select from master list"
- Drawing Reference | text input, placeholder "STR-T1-5F-001 Rev B"

---
SECTION B — POUR SCHEDULE
2-column grid:
- Planned Pour Date* | date picker
- Planned Start Time* | time picker
- Planned Duration (hrs) | number input
- Actual Pour Date* | date picker
- Actual Start Time* | time picker
- Actual End Time* | time picker
- Delay Reason | text input (appears with amber highlight if actual vs planned differs)

---
SECTION C — PRE-POUR CHECKLIST
Checklist style — each item is a row with label left + Yes/No/NA segmented button right (pill style):
- Shuttering Inspection* — Yes | No | NA
- Reinforcement Inspection* — Yes | No
- Cover Block Check* — Yes | No
- Cleaning of Formwork* — Yes | No
- Electrical Conduits* — Yes | Yes-Partial | NA
- Pre-Pour Inspection By* | text input
- Pre-Pour Inspection Time* | time picker
- Pre-Pour Approval* | Approved | Not Approved (large segmented button, green/red)
- Approved By* | text input

---
SECTION D — CONCRETE SUPPLY
2-column grid:
- Concrete Grade* | dropdown M20–M50
- Supplier Name* | ref dropdown (from approved RMC list)
- Mix Design ID* | ref dropdown (from approved mix designs, filtered by grade)
- Total Quantity (m³)* | number input
- Actual Quantity (m³)* | number input
- No. of Truck Loads* | number input (auto-suggest based on TM volume)
- Pump Used* | dropdown: Yes – Boom Pump / Yes – Line Pump / No
- Pump Operator | text input
- Vibrator Nos. Used | number input

---
SECTION E — PER TRUCK RECORD
Label: "One row per transit mixer. Tap '+ Add Truck' after each arrival."

Repeatable card per truck with collapse/expand:
- Truck No. (TM)* | text input
- Delivery Challan No.* | text input
- Batch ID* | text input
- Batching Time* | time picker
- Departure Time | time picker
- Arrival Time (site)* | time picker
- Discharge Start* | time picker
- Discharge End* | time picker
- Load Volume (m³)* | number input
- Cumulative Vol. (m³) | read-only auto-sum
- Transit Time (min) | read-only auto-calc (Arrival – Departure) — show amber badge if > 90 min
- Water Added on Site* | No | Yes (if Yes show litres input)
- Admixture Added | No | Yes (if Yes show specify input)

"+ Add Truck" button (full-width dashed, blue text)

---
SECTION F — FRESH CONCRETE TESTS
Repeatable card per test set:
- Test Truck No.* | text input
- Test Time* | time picker
- Slump (mm)* | number input
- Slump Acceptance* | Pass | Fail (green/red badge auto-set based on slump range from mix design)
- Temperature (°C) | number input
- Air Content (%) | number input
- Density (kg/m³) | number input
- Flow (mm) | number input (for SCC only)
- Test Done By* | text input

"+ Add Test" button

---
SECTION G — CUBE SAMPLING
Card:
- Cube Sample Set ID* | text input, auto-suggested format
- Sampling Time* | time picker
- From Truck No.* | text input
- Mould Size* | dropdown: 150×150×150 / 100×100×100
- No. of Cubes Cast* | number input
- Cubes for 7 Day* | number input
- Cubes for 14 Day | number input
- Cubes for 28 Day* | number input
- Cube IDs* | tag/chip input (system generates, editable)
- Sampling Done By* | text input
- Lab Assigned* | ref dropdown (from registered labs)
- Cubes Dispatched Date | date picker
- Dispatch Reference | text input

---
SECTION H — SITE CONDITIONS & WEATHER
2-column grid:
- Weather Condition* | icon-based selector: ☀ Clear | ⛅ Partly Cloudy | ☁ Overcast | 🌧 Light Rain | ⛈ Heavy Rain | 🌡 Hot >38°C | 🥶 Cold <10°C
- Ambient Temp (°C) | number input
- Humidity (%) | number input
- Wind Condition | dropdown: Calm / Light Breeze / Moderate / Strong
- Curing Method* | dropdown: Water Ponding / Wet Gunny / Curing Compound / Membrane Curing
- Curing Start Time* | time picker
- Night Pour | Yes / No toggle

---
SECTION I — POUR SIGN-OFF
- Pour Status* | large status selector: Planned / In Progress / Completed / Incomplete / Cancelled (colour coded: grey/amber/green/red/grey)
- Supervisor Name* | text input
- Supervisor Sign-off* | Signed | Pending (large button)
- QA Engineer Review* | Reviewed & Approved | Under Review | Rejected (segmented)
- QA Engineer Name* | text input
- Consultant Check | Reviewed / Not Required toggle
- Consultant Name | text input
- Pour Approved Date | date picker (auto-set when status = Completed & Approved)
- NCR Linked | read-only, auto-linked if FAIL result exists
- Remarks | textarea

---
STICKY BOTTOM BAR:
"Save Draft" (outline) | "Submit Pour Card" (blue filled, full width on mobile)
```

---

## FORM 7 — Cube Result / Lab Test Report Form

```
Design a full-page web form called "Cube Test Result" for a Construction Quality Management System.

This form is filled by a Lab Technician. Most reference fields are auto-populated from the linked Pour Card. The most important output is the compressive strength result and the system's Pass/Fail verdict — make these visually prominent.

Design language: Inter. Primary #1A56DB. Success green #057A55. Failure red #C81E1E. Marginal amber #E3A008. White cards, 1px #E5E7EB border, 8px radius. Background #F9FAFB. Auto-populated fields in grey disabled inputs.

Page header:
- Title: "Cube Test Result" (24px bold)
- Subtitle: "Filled by: Lab Technician | Purpose: Record compressive strength with auto-traceability to Pour Card and Supplier"
- Result ID auto badge top right | "Save" + "Submit Result" buttons

---
SECTION A — LINKED REFERENCES (read-only — auto-populated)
Show as a light grey #F9FAFB info card with a blue left border:

2-column grid, all disabled grey inputs:
- Result ID* | "Auto: RES-2024-1045"
- Cube ID* | "C003"
- Cube Set ID* | "CUBE-T1-5F-20240601-001"
- Pour Card ID* | "PC-T1-5F-SLB-20240601-001"
- Tower* | "T1"
- Floor* | "5F"
- Component* | "Slab – T1-5F-SLB-01"
- Concrete Grade* | "M40"
- Supplier* | "UltraTech RMC Whitefield"
- Mix Design ID* | "MD-UTC-M40-001"
- Cast Date* | "01-Jun-2024"

---
SECTION B — TEST DETAILS
2-column grid:

Row 1:
- Lab ID* | ref dropdown (from registered labs)
- Tested By* | text input

Row 2:
- Test Date* | date picker
- Age at Test (days)* | number input (auto-calc from Cast Date)

Row 3:
- Test Age Type* | dropdown: 3 Day / 7 Day / 14 Day / 28 Day / 56 Day
- Cube Mass (kg) | number input

Row 4:
- Cube Dimensions (mm) | text input, placeholder "150.2 × 150.0 × 150.1"
- (empty)

---
SECTION C — STRENGTH CALCULATION (most important section — give prominent visual treatment)

Use a highlighted blue/white calculation card with larger font:

- Failure Load (kN)* | large number input, 48px height, bold
- Cross-Section Area (mm²)* | number input with helper "Calculated from measured dimensions"
- Compressive Strength (MPa) | READ-ONLY, auto-calculated formula field in blue highlight box: "Load ÷ Area × 1000" — show result in 28px bold
- Corrected Strength | number input, optional
- Failure Pattern | dropdown: Satisfactory (cone) / Column / Diagonal / Shear / Irregular

---
SECTION D — ACCEPTANCE CHECK (auto by system — show as result card)

Show as a prominent result banner:

Specified fck (MPa): [auto — e.g. 40]
Min Acceptance Strength: [auto — e.g. 38.5 MPa per IS 456]
Characteristic Strength %: [auto — e.g. 115.6%]

★ TEST RESULT — large badge occupying full width:
- PASS: green background, white text "✓ PASS — 48.3 MPa ≥ 40 MPa"
- FAIL: red background, white text "✗ FAIL — 37.2 MPa < 38.5 MPa (min acceptance)"
- MARGINAL: amber background "⚠ MARGINAL — Within range but below target"

Below result: Early Strength Indication (7-day): "PASS / FAIL / PENDING 28-day" small badge

---
SECTION E — REPORT UPLOAD
- Lab Report Number* | text input, placeholder "Lab's own report reference"
- Upload PDF Report* | drag-and-drop upload zone, max 5MB, accepts PDF only
- Report Upload Date | read-only auto-set on upload
- System Extracted Data | read-only info text: "System will auto-parse: Cube ID, Strength, Date, Grade, Lab ref from PDF"
- Discrepancy Flag | read-only badge — shows "⚠ Mismatch Detected" in amber if extracted ≠ entered

---
SECTION F — ACTION & TRACEABILITY (mostly read-only, auto-set by system)
Light grey info card:
- QA Manager Notified | auto badge: "Yes – Notified 29-Jun-2024 18:30" (only if FAIL)
- NCR Generated | auto ref link: "NCR-2024-015" in red clickable chip (only if FAIL)
- Retesting Required | dropdown: Yes / No
- Core Test Required | dropdown: Yes / No
- Investigation Status | dropdown: Not Required / Under Investigation / Closed – Accepted / Closed – Penalty Levied
- Remarks | textarea

---
FOOTER: "★ Mandatory field" | "Save Draft" + "Submit Result"
```

---

## FORM 8 — NCR (Non-Conformance Report) Form

```
Design a full-page web form called "Non-Conformance Report (NCR)" for a Construction Quality Management System.

This form is auto-generated by the system on a FAIL result, or raised manually by the QA Manager. It is a critical document — use a serious, professional tone with clear severity and status indicators.

Design language: Inter. Primary #1A56DB. Critical: #C81E1E, Major: #E3A008, Minor: #057A55. White cards, 1px border, 8px radius. Background #F9FAFB. Auto-populated fields in grey. Mandatory red asterisk.

Page header:
- Title: "Non-Conformance Report" (24px bold) with a red left accent bar
- Subtitle: "Filled by: System (auto on FAIL) or QA Manager (manual) | Purpose: Document, investigate and close quality failures"
- NCR ID badge (auto): "NCR-2024-015" | Severity badge: "CRITICAL" (red) / "MAJOR" (amber) / "MINOR" (green)
- NCR Status pill: "Open" | "Under Investigation" | "Closed" (colour coded)
- "Save" + "Submit NCR" top right

---
SECTION A — NCR IDENTIFICATION
2-column grid:

Row 1:
- NCR ID* | read-only auto grey "NCR-2024-015"
- NCR Date* | read-only auto grey "29-Jun-2024"

Row 2:
- NCR Type* | dropdown: Concrete Strength Failure / Slump Failure / Cube Sampling Gap / Supplier Default / Documentation / Safety / Workmanship
- Project ID* | read-only auto grey

Row 3:
- Source* | dropdown: Cube Test Result / Pour Card Review / Site Inspection / Audit / Complaint
- Triggered By* | read-only auto grey: "System (on FAIL)" or show "QA Manager – Manual" if manual

---
SECTION B — LINKED RECORDS
Show as a blue-bordered info card:
2-column grid, all ref chips/links:
- Pour Card ID* | clickable blue chip link to pour card
- Cube Result ID | clickable blue chip link to result
- Tower / Floor* | auto grey "T1 / 5F"
- Component* | auto grey "Slab – T1-5F-SLB-01"
- Supplier Linked* | auto grey "UltraTech RMC Whitefield"

---
SECTION C — NON-CONFORMANCE DESCRIPTION
Full-width card with red left border:

- Non-conformance Detail* | large textarea (4 rows), placeholder "Full description of the defect/failure"
  Example: "28-day cube strength = 37.2 MPa vs. specified M40 (40 MPa). Below IS 456 acceptance."

2-column grid:
- Specified Value* | text input, placeholder "What was required"
- Actual Value* | text input, placeholder "What was found"

Row:
- Severity* | large segmented button — CRITICAL (red) | MAJOR (amber) | MINOR (green) — selected state fills background
- Structural Impact* | dropdown: Yes – Immediate action / Yes – Monitor / No – Records only

Row:
- Photograph Attached | Yes / No toggle + file upload zone if Yes

---
SECTION D — RESPONSIBLE PARTY & NOTIFICATION
2-column grid:

Row 1:
- Responsible Org* | ref dropdown (from registered contractors/suppliers)
- Notified Persons* | read-only auto chips: "QA Manager + Project Manager + PMC"

Row 2:
- Notification Date* | read-only auto grey (auto-set on NCR creation)
- Response Deadline* | date picker

---
SECTION E — INVESTIGATION & CORRECTIVE ACTION
2-column grid:

Row 1:
- Root Cause | full-width textarea, placeholder "Investigation finding"

Row 2:
- Investigation By | text input
- Investigation Date | date picker

Row 3:
- Corrective Action | full-width textarea, placeholder "Action taken / proposed"

Row 4:
- Core Test Result (MPa) | number input, helper "Enter if core cutting was performed"
- Action Due Date | date picker

Row 5:
- Action Completed Date | date picker
- (empty)

---
SECTION F — PENALTY WORKFLOW
Show as amber-bordered card:

Row 1:
- Penalty Applicable* | Yes | No | Under Review — segmented button

(Show following fields only if Penalty = Yes):
Row 2:
- Penalty Clause Ref | text input, placeholder "e.g. Clause 14.3 – Quality Default"
- Penalty Amount (INR) | number input with INR prefix

Row 3:
- Penalty Basis | full-width textarea, placeholder "e.g. 0.5% of pour value per MPa below acceptance"
- Penalty Status | dropdown: Not Levied / Levied – Pending Recovery / Recovered / Waived

Row 4:
- Waiver Reason | text input, placeholder "Required if Waived" (conditional)

---
SECTION G — CLOSURE
NCR Status progression stepper at top of section:
Open → Under Investigation → Awaiting Core Test → Closed

- NCR Status* | large status dropdown: Open / Under Investigation / Awaiting Core Test / Closed – Accepted / Closed – Rejected / Closed – Waived
- Closed By | text input
- Closure Date | date picker
- Closure Remarks | textarea, placeholder "Summary of closure decision"
- Lessons Learned | textarea, placeholder "For future reference and training"

---
FOOTER: "★ Mandatory field" | "Save Draft" + "Submit NCR" (red filled button if status = Open/Critical)
```

---

## QUICK REFERENCE — All 8 Forms

| # | Form Name | Filled By | Sections | Key Output |
|---|-----------|-----------|----------|------------|
| 1 | Project Master | Client Admin | 6 | Project, Towers, Components, Quality params |
| 2 | Contractor Form | Client Admin + Org | 6 | Contractor/Consultant/PMC registration |
| 3 | RMC Form | Contractor | 6 | Supplier, plant, mix design, rates |
| 4 | Lab Form | Contractor | 8 | Lab accreditation, scope, equipment |
| 5 | User Form | Contractor Admin | 7 | User roles, access, assignments |
| 6 | Pour Card | Supervisor (on-site) | 9 | Every pour event, truck-wise, cube sampling |
| 7 | Cube Result | Lab Technician | 6 | Strength result, Pass/Fail verdict |
| 8 | NCR Form | System / QA Manager | 7 | Non-conformance, penalty, closure |
