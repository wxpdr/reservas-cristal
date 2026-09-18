# Reservas Cristal — Agent Instructions

## Project

Reservas Cristal is an internal reservation-management system for Cristal Pizza.

This is a real production project, not a tutorial or demo.

The goal is to replace the restaurant's paper reservation agenda with a simple operational system used by receptionists, cashiers, managers and the owner.

The MVP scope is frozen.

Do not add features that are not described in the project documentation.

## Source of truth

Before implementing a task, read the relevant documentation:

- `docs/PROJECT_SPEC.md` — product requirements and business rules
- `docs/ARCHITECTURE.md` — technical architecture and data model
- `docs/UI_REFERENCE.md` — Figma and UX decisions
- `docs/EXECUTION_PLAN.md` — implementation order
- `docs/DECISIONS.md` — architectural/product decisions already made

If documentation and code conflict, do not silently choose one.

Explain the conflict and preserve the documented MVP unless explicitly instructed otherwise.

## Stack

Frontend:
- Next.js
- TypeScript
- Tailwind CSS

Backend:
- Python
- FastAPI
- SQLAlchemy
- Alembic

Database:
- PostgreSQL
- Supabase is used only as managed PostgreSQL infrastructure.

Do NOT introduce Supabase Auth, Supabase Storage, Edge Functions or the Supabase JavaScript SDK unless explicitly requested.

## Architecture rules

The frontend must never access PostgreSQL directly.

Flow:

User -> Next.js -> REST API -> FastAPI -> SQLAlchemy -> PostgreSQL

Business rules belong in the backend.

React components must not contain authoritative business logic.

Do not trust values coming from the browser when the backend can determine or validate them.

Database schema changes must use Alembic migrations.

Never modify production schema manually.

Do not store secrets in source code.

Use environment variables and maintain `.env.example`.

## Domain rules

Roles:
- `admin`
- `operator`

Reservation statuses:
- `AGENDADA`
- `CONFIRMADA`
- `CHEGOU`
- `CANCELADA`

Reservation origins:
- `TELEFONE`
- `WHATSAPP`
- `PRESENCIAL`
- `TAGME`
- `OUTRO`

Required reservation data:
- customer name
- phone
- party size
- reservation date
- reservation time
- origin

Optional:
- table
- notes
- cancellation reason

There is no fixed reservation capacity per time.

The system must never automatically block a reservation because a time is considered full.

There is no maximum party size.

Groups with 20 or more people receive visual emphasis only.

Reservation time is free-form and is not based on fixed slots.

Table assignment is optional.

Tables are simple identifiers, not managed resources.

Do not implement:
- table map
- table availability engine
- table capacity
- automatic table allocation

Cancelled reservations must never be hard-deleted.

Cancellation must preserve historical information.

Confirmation, check-in, cancellation and edits must be auditable.

Any authorized operator may edit reservations.

Only administrators manage users.

## Authentication

Users are created by an administrator.

The administrator does not choose the employee's password.

New users receive a first-access invitation and define their own password.

Users with no password configured are displayed as `Convite pendente`.

Password recovery uses a temporary single-use reset token.

Passwords must only be stored as secure password hashes.

Authentication/session details are defined in `docs/ARCHITECTURE.md`.

## UI

The Figma design is the visual source of truth.

Do not redesign screens unless explicitly requested.

The primary operational screen is the daily agenda.

The daily reservation list shows:

- party size
- customer name
- time
- phone
- notes

Do not add table, origin or regular status as columns/cards on the main agenda.

Cancelled reservations must have strong visual emphasis:
- pale red background
- red border/accent
- visible `Cancelada` indication

Operational actions such as opening a reservation or checking in may remain visible.

UI text must be in Brazilian Portuguese.

Code identifiers should preferably be in English.

## Engineering principles

Prefer simple, explicit code over clever abstractions.

Do not create abstractions before they are needed.

Do not add dependencies without a concrete need.

Do not refactor unrelated code while implementing a task.

Avoid duplicate business rules.

Do not hide errors with broad exception handling.

Return meaningful API errors.

Keep modules small and responsibilities clear.

## Tests

Every business rule added to the backend should have automated tests when practical.

Critical flows must be covered before production:

- login
- first access
- password reset
- create reservation
- edit reservation
- confirm reservation
- check-in
- undo check-in
- cancel reservation

After changes, run the relevant tests, lint and type checks.

Do not declare a task finished while known checks are failing.

## Documentation

When a technical or product decision changes, update the relevant documentation.

Do not allow implementation and documentation to silently diverge.

## Definition of done

A task is complete only when:

- implementation satisfies the documented requirement
- business rules remain respected
- relevant tests pass
- lint/type checks pass
- migrations are included when necessary
- no secret is committed
- documentation is updated when behavior changed