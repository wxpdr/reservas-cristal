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

Define a small `EmailSender` interface. Development uses a logging adapter that prints generated
links; production must provide another adapter without changing authentication rules.

Reason:

This keeps the domain independent from a vendor while making local first access and recovery
testable.

Consequences:

Production deployment is not complete until a delivery adapter is selected and configured.
