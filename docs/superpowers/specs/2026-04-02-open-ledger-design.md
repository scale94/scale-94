# SCALE94 — The Open Ledger

**Date:** 2026-04-02
**Status:** APPROVED
**Goal:** Win Ars Electronica Golden Nica (Interactive Art +) 2027
**Submission deadline:** ~March 2027

---

## Vision

Transform scale94.com from a sovereign computational terminal into a **public thermodynamic audit infrastructure**. Anyone can submit a river (or any ecological site). Anyone can run a permit ruling. Verdicts accumulate into an immutable planetary ledger that no government issued and no corporation controls.

Phase 2 (Q1 2027): open the **Kernel Commons** — a submission protocol where others compile their own theories into WASM kernels that inherit the Axiomatic Core.

---

## Phase 1: The Open Ledger

### 1.1 Structured Input Protocol

**What:** Replace CLI-only `run chrono --temp 28 --do 3.5 ...` with a structured submission interface accessible from a dedicated Ledger tab.

**Requirements:**
- New tab: **Ledger** (added to the 16-tab system, or replaces an existing slot — architect's call)
- Coordinates input: manual lat/lon entry OR interactive map picker (Leaflet with OpenStreetMap tiles — no Google dependency)
- Parameter form with validation:
  - Water temperature (°C)
  - Dissolved oxygen (mg/L)
  - BOD (mg/L)
  - Thermal discharge delta (°C)
  - Epilimnion depth (m)
  - Nitrate concentration (mg/L)
  - Flow rate (m³/s)
  - Optional: site name, watershed name, notes
- Dependency classification selector:
  - `sovereign` — user-supplied measurements
  - `external` — pulled from API (auto-set)
  - `attested` — uploaded dataset with provenance claim
- "Run Audit" dispatches to Chrono-Actuary WASM kernel
- Terminal aesthetic: high contrast, monospace, zero ornamentation. The form is functional, not decorative.
- CLI path remains fully functional (`run chrono --flags` still works)

### 1.2 Verdict Archive (CAS Extension)

**What:** Extend the existing SHA-256 Content-Addressable Storage pipeline to store audit verdicts as immutable, citable records.

**Requirements:**
- Each verdict produces a **verdict document** containing:
  - Verdict status: `APPROVED` / `CONDITIONAL` / `REJECTED` / `EMERGENCY_VETO`
  - Full input parameters as submitted
  - Dependency classification (`sovereign` / `external` / `attested`)
  - Kernel version + WASM binary SHA-256
  - Coordinates (lat/lon)
  - Timestamp (ISO 8601 UTC)
  - Full audit ledger (line-item breakdown from each Chrono-Actuary module)
  - IPCC correction applied
  - Effective thermal load
  - Ruling text
- Verdict document is SHA-256 hashed → stored as CAS chunk in `public/ledger/verdicts/`
- Verdict manifest: `public/ledger/manifest.json` — index of all verdicts, searchable by coordinates, date, verdict status
- Verdicts are append-only. No deletion. No mutation. Immutability is structural.
- Verdict count displayed on Ledger tab and optionally on boot sequence

### 1.3 Open API Ingest

**What:** Connect to open hydrological monitoring APIs so users can audit real rivers by coordinates.

**Target APIs:**
- **USGS NWIS** (National Water Information System) — US rivers, real-time + historical
- **EEA Waterbase** (European Environment Agency) — European water bodies
- Extensible connector pattern for future sources (national agencies)

**Requirements:**
- User enters coordinates or searches by river/station name
- Terminal queries API, displays available parameters
- User confirms → parameters auto-populate the submission form
- Dependency auto-set to `external` with source attribution (API name, station ID, retrieval timestamp)
- Graceful degradation: if API is unreachable, form falls back to manual entry with a clear notice
- API calls happen client-side (fetch from browser) where CORS allows; Vercel edge function proxy where it doesn't
- No caching of external data beyond the verdict itself — each audit is a point-in-time snapshot

### 1.4 Counter-Evidence Export

**What:** Make verdicts machine-readable and citable for use in journalism, legal filings, activism, and research.

**Export formats:**
- **JSON-LD** — structured linked data, embeddable in web pages
- **PDF audit report** — formatted verdict with full methodology disclosure, suitable for legal/regulatory submission
- **Embeddable widget** — `<iframe>` or `<script>` snippet that renders a verdict card on external sites
- **Permanent URL** — `scale94.com/ledger/verdict/{hash}` resolves to the full verdict

**Requirements:**
- Export buttons on each verdict view
- PDF generation runs client-side (jsPDF or similar — no server)
- Widget is a self-contained HTML snippet that fetches verdict data from CAS
- Permanent URLs are static routes served from CAS (Vercel rewrites)

---

## Phase 2: The Kernel Commons (Q1 2027)

### 2.1 Kernel Submission Protocol

**What:** Define how external contributors compile their own theories into WASM kernels and submit them to the terminal.

**Requirements:**
- Kernel specification format: Rust source with standardized entry point signature
- Parameter schema declaration (JSON Schema)
- Output schema declaration (must include verdict status + audit ledger format)
- Build pipeline: contributor compiles locally with wasm-pack → submits `.wasm` + metadata
- Submission review: architect reviews before inclusion (not automated — quality gate)
- CAS attribution: contributor identity recorded in manifest alongside kernel hash

### 2.2 Foreign Kernel Integration

**What:** Community-authored kernels inherit the same infrastructure.

**Requirements:**
- Foreign kernels appear in the command registry alongside native kernels (marked with contributor attribution)
- Foreign kernels can be dispatched from the Ledger tab if their parameter schema overlaps
- LatentCollider can collide foreign kernels with native kernels — producing chimeras from theories the architect didn't write
- Verdict archive stores foreign kernel verdicts with the same immutability guarantees

### 2.3 Governance

- The Axiomatic Core governs all kernels, native or foreign
- The architect retains curatorial authority (kernel inclusion is not automatic)
- Rejected submissions receive a written ruling (yes, the terminal audits its own submissions)

---

## Architecture Constraints

- **Sovereignty preserved:** All computation runs in the visitor's browser (WASM). No server-side processing of audits.
- **No database:** Verdict storage uses flat CAS chunks, same as kernel docs. No Postgres, no Firebase, no Supabase.
- **No accounts:** Users do not create accounts. Verdicts are anonymous unless the submitter chooses to attest identity.
- **No telemetry on verdicts:** Vercel Analytics tracks page loads, not audit content.
- **Dependency honesty:** Every verdict records its data supply chain. The ledger does not pretend external data is sovereign.
- **Aesthetic continuity:** The Ledger tab follows scale94's existing visual language. High contrast, monospace, zero ornamentation.

---

## Ars Electronica Submission Argument

> "This terminal has issued N thermodynamic verdicts on M rivers across K countries. None were requested by a government. None can be silently revised. The equations are the authority. The ledger is the evidence. And now — others are compiling their own theories into it."

The work shifts from "executable argument" to **"executable jurisdiction"** — a sovereign audit infrastructure that others wield, not a monument they admire.

---

## Out of Scope

- Physical installation (Direction B) — not pursued for this cycle
- Mobile-specific UI — the terminal is keyboard-first by design
- Blockchain/distributed ledger — CAS + Vercel CDN is sufficient; blockchain adds ideology without utility
- Real-time monitoring / alerting — the terminal issues point-in-time verdicts, not continuous surveillance
- User accounts, authentication, or social features
