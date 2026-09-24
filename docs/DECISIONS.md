# Technical and Product Decisions

This document records important decisions made during implementation.

Do not duplicate rules that are already clearly defined in PROJECT_SPEC.md or ARCHITECTURE.md.

Add a decision here when:

- multiple valid technical options existed;
- the selected option may be questioned later;
- changing the decision would significantly affect the architecture or product.

## Decision template

### ADR-XXX — Title

Date:

Status: Accepted

Context:

Decision:

Reason:

Consequences:

### ADR-001 — Opaque server-side sessions

Date: 2026-09-18

Status: Accepted

Context:

The architecture requires server-managed sessions and an HttpOnly cookie.

Decision:

Use a cryptographically random opaque token in the browser and persist only its SHA-256 hash in
the `sessions` table. Password invitation and reset tokens follow the same raw-token/hash split.

Reason:

Database-backed revocation is explicit, logout is immediate, and a database leak does not expose
usable session or password tokens.

Consequences:

Authentication requests perform a session lookup. Expired records can be cleaned up later as an
operational concern without changing the authentication protocol.

### ADR-002 — Email delivery boundary

Date: 2026-09-18

Status: Accepted

Context:

Invitation and password recovery need delivery, but the MVP does not select an email provider.

Decision:

Define a small `EmailSender` interface. An SMTP adapter with STARTTLS supports real delivery using
environment configuration. The logging adapter remains the fallback when SMTP is not configured,
and automated tests use an in-memory adapter.

Reason:

This keeps the domain independent from a vendor while making local first access and recovery
testable.

Consequences:

Authentication rules and token storage remain independent from email transport. SMTP credentials
are server-only secrets, and partial SMTP configuration prevents the backend from starting.

### ADR-003 — Status restored when undoing check-in

Date: 2026-09-21

Status: Superseded by ADR-004

Context:

The MVP requires undoing a check-in, but a reservation can reach `CHEGOU` directly from
`AGENDADA` or from `CONFIRMADA`.

Decision:

When check-in is undone, restore `CONFIRMADA` if `confirmed_at` records a prior confirmation;
otherwise restore `AGENDADA`. In both cases, clear `checked_in_at` and preserve the audit trail.

Reason:

The existing confirmation timestamp provides enough historical information to restore the state
that preceded check-in without adding schema or storing transient state.

Consequences:

Undo check-in is deterministic and preserves prior confirmation. The `UNDO_CHECK_IN` event records
the restored status and the cleared check-in timestamp.

### ADR-004 — Remove reservation confirmation

Date: 2026-09-24

Status: Accepted

Decision:

Reservations use only `AGENDADA`, `CHEGOU` and `CANCELADA`. Undoing check-in always restores
`AGENDADA`. Existing `CONFIRMADA` rows are migrated to `AGENDADA`; historical `CONFIRM` audit
events remain readable, but no new confirmation event can be created.
