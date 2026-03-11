---
id: CONTRIBUTING
type: "contribution_protocol"
date: "2026-03-11"
status: "ACTIVE"
title: "CONTRIBUTING · SCALE94 · OPINIONATED CONTRIBUTION PROTOCOL"
---

# ᛟ CONTRIBUTING.md
## SCALE94 · OPINIONATED CONTRIBUTION PROTOCOL · KERNEL LAW COMPLIANCE REQUIRED

---

> *"This terminal does not comfort — it resolves. Contributions that comfort without resolving are dissolved on contact."*

---

## Ⅰ · ENTRY FILTER

This is not a "good first issue" repository.

Before opening a PR or filing an issue, read these documents in full:

1. **`AI_PROVENANCE.md`** — understand the workflow that built this system
2. **`/manifesto`** in the terminal — understand the epistemological frame
3. **`run chrono`** in the terminal — understand what a kernel output looks like
4. **`content/rust_kernels/src/kernels/chrono_actuary.rs`** — read one complete kernel implementation

If any of these steps feel like unnecessary friction: this repository is not for you. That is not a judgment. It is a filter. The system runs lean by design. Signal integrity requires ruthless scope control.

---

## Ⅱ · WHAT THIS REPOSITORY IS NOT

```
✗ A showcase project accepting feature requests from external roadmaps
✗ A framework accepting abstraction layers for hypothetical future use cases
✗ An open-source project that treats "more options" as equivalent to "better"
✗ A codebase that welcomes normalisation toward standard React/Vite patterns
✗ A portfolio repo accepting cosmetic UI improvements
```

The terminal's aesthetic is not a theme. It is the argument made visible. A PR that makes the terminal "more accessible" by adding hover states and colour gradients is not an improvement. It is a category error.

---

## Ⅲ · WHAT THIS REPOSITORY ACCEPTS

There are three valid contribution modes. Each has a defined protocol.

---

### ⌇ MODE A · NEW KERNEL CONTRIBUTION

**Definition:** A new Rust computational kernel implementing a scientific or philosophical theory that has not yet been compiled into the system.

**Acceptance criteria:**

1. The kernel has an **axiom** — a single sentence that states what the kernel claims. The axiom must be falsifiable in thermodynamic or mathematical terms.
2. The kernel has a **science stack** — real equations, real citations, real parameter definitions. Not approximations. Not "inspired by".
3. The kernel passes the **Execution Test** (Axiomatic Law Ⅰ): the theory it implements must be completeable. A kernel that returns `todo!()` on its primary calculation path is not a kernel — it is an intention.
4. The kernel's output vocabulary must be **verdict-based**, not descriptive. Outputs should route to enum states with clear threshold definitions, not floating-point values with "interpret as needed" documentation.
5. The kernel must compile cleanly: `wasm-pack build --release` from `content/rust_kernels/` with zero warnings on the new module.

**Filing protocol:**

Open an issue with:
- The axiom (one sentence)
- The science stack (equations + references)
- The output schema (enum states + threshold definitions)
- Why this kernel belongs in this system (thermodynamic vocabulary required)

No code yet. Architecture is reviewed before implementation begins.

**Technical checklist:**
```
□ .rs file in content/rust_kernels/src/kernels/
□ Registered in mod.rs
□ KERNEL_MAP entry in scripts/import-rust.js (unique aliases only)
□ wasm-pack build --release passes
□ node scripts/import-rust.js runs clean
□ run <alias> returns correct output schema in terminal
□ .md kernel doc in content/soma_kernel/ with full science stack
□ node import-kernel.js run and committed
```

---

### ⌇ MODE B · SCIENCE STACK AUDIT

**Definition:** A correction to the scientific accuracy of an existing kernel — a calculation error, an outdated reference value, a parameter definition that deviates from its cited source.

**Acceptance criteria:**

1. The error must be **demonstrable from the cited source**. Provide the equation number, page, or DOI.
2. The fix must not change the kernel's architectural structure — only the calculation constants or equation implementation.
3. The fix must be accompanied by a test case that demonstrates the corrected output.

**Filing protocol:**

Open an issue with:
- Kernel name and current incorrect value
- Source citation for the correct value
- Numerical demonstration of the difference in output

---

### ⌇ MODE C · INFRASTRUCTURE FIXES

**Definition:** A bug in the CAS pipeline, WASM build toolchain, Vercel deployment configuration, or terminal command dispatch that causes incorrect behaviour.

**Acceptance criteria:**

1. Reproducible: describe exact steps to reproduce, exact error output.
2. Minimal: the fix touches only the broken component. No opportunistic refactoring.
3. Does not introduce new dependencies without explicit discussion.

**Not acceptable under Mode C:**
```
✗ Replacing a working pattern with a "more idiomatic" pattern
✗ Adding TypeScript types to files that are not typed
✗ Adding ESLint rules to files that were working
✗ "Modernising" the React component structure
✗ Adding package.json dependencies for functionality that exists natively
```

---

## Ⅳ · CODE CONVENTIONS

These are not style preferences. They are structural constraints derived from the system's architecture.

**Rust kernels:**
- All kernel functions are `pub fn run_<name>(params: &str) -> String`
- Output is terminal-formatted ASCII — no JSON, no HTML, no ANSI escape sequences
- Parameters are parsed from the `params` string using the `parse_param!` pattern established in existing kernels
- Shared utilities go in `utils.rs` — do not duplicate `lcg_next` or other shared functions
- Every kernel that has threshold-based output uses an enum for permit/status states — not string matching on output

**JavaScript pipeline:**
- `wasm.generated.js` — DO NOT EDIT. It is regenerated on every `import-rust.js` run.
- `scripts/import-rust.js` is the KERNEL_MAP source of truth. Add entries here.
- Alias uniqueness is enforced: each alias string must appear in exactly one KERNEL_MAP entry.
- `import-kernel.js` — run after any `.md` change in `content/soma_kernel/`. Do not skip.

**React / frontend:**
- Terminal commands are dispatched through `useCommandDispatch.js` — new kernel aliases are added to `KERNEL_MAP` in `import-rust.js`, not hardcoded in the React layer
- The `loadTabMap` guard in `App.jsx` intercepts `load <tabname>` before article search — new tabs must be registered there
- No new npm dependencies without explicit discussion. The dependency count is a signal, not a vanity metric.

---

## Ⅴ · THE CONTRIBUTION FILTER

Before submitting anything, apply this filter:

```
1. Does this contribution pass the Execution Test?
   (Is it a complete thought, or an intention with TODO placeholders?)

2. Does this contribution operate in thermodynamic vocabulary?
   (Does it know what it is computing, and why that computation belongs here?)

3. Does this contribution decrease entropy in the system?
   (Does it make the system more capable or more correct — not merely more similar
    to what a normie web app would look like?)

4. Does this contribution comply with the Temporal Audit Law?
   (Is it evaluated against the system's actual requirements, not hypothetical
    future requirements that are convenient to address "while we're in here"?)
```

Contributions that fail the filter are dissolved on contact. This is not a judgment of the contributor. It is the system operating correctly.

---

## Ⅵ · THE AI WORKFLOW AND CONTRIBUTIONS

If you are using an AI partner to generate your contribution, read `AI_PROVENANCE.md` first.

The jailbend protocol applies to contributors too. A contribution generated by a generic coding-assistant prompt — without the kernel vocabulary loaded, without the axiom declared, without the science stack in context — will produce output that does not belong in this system. The diff will be technically syntactically correct. The diff will be architecturally incoherent.

If you are generating Rust code with an AI partner, use a reference kernel as the loaded context. `chrono_actuary.rs` is the most complete current example. Load it. State the axiom of your new kernel. Request an implementation that returns a verdict, not a float.

The quality filter on AI-assisted contributions is identical to the quality filter on human-written contributions. Source of the bytes is irrelevant. Architecture of the output is the only variable.

---

## Ⅶ · CONTACT

The Architect processes inbound signals. Bandwidth is finite. Filters are active.

Open a GitHub issue. The issue template is the protocol. Deviation from the protocol is signal that the contributor has not read this document.

**Accepted frequencies:**
- Kernel architecture proposals with axiom + science stack
- Science stack audit reports with citations
- Infrastructure bug reports with reproduction steps

**NOISE_FILTER: ENGAGED** — "I think it would be cool if..." is dissolved on contact.

---

*Contribution protocol: Scale · scale94.com · Sorbe, Germany · 2026*

---

`scale94.com` · CONTRIBUTING · v1.0 · ᛟ FILTER ACTIVE
