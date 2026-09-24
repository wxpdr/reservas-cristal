# Architecture

## High-level architecture

Browser
    ↓
Next.js
    ↓ REST
FastAPI
    ↓
SQLAlchemy
    ↓
PostgreSQL (Supabase)

The frontend never communicates directly with PostgreSQL.

## Repository

Monorepo:

/frontend
/backend
/docs

## Frontend

Next.js + TypeScript + Tailwind CSS.

Responsibilities:

- render UI
- collect user input
- call backend API
- handle loading/error states
- present server responses

The frontend must not be the authoritative source for business rules.

## Backend

FastAPI.

Responsibilities:

- authentication
- authorization
- validation
- reservation rules
- status transitions
- persistence
- auditing
- password invitation/reset flows

Use SQLAlchemy for persistence.

Use Alembic for every schema migration.

## Database

PostgreSQL hosted on Supabase.

Supabase is database infrastructure only.

Do not use Supabase Auth.

## Main entities

### users

id
name
email
password_hash nullable
role
active
created_at
updated_at

`password_hash = null` for a newly invited user that has not completed first access.

### reservations

id
customer_name
phone
party_size
reservation_date
reservation_time
table_label nullable
origin
notes nullable
status
checked_in_at nullable
cancelled_at nullable
cancellation_reason nullable
created_by
updated_by
created_at
updated_at

Use DATE for `reservation_date`.

Use TIME for `reservation_time`.

Operational event timestamps use timezone-aware timestamps.

### reservation_events

id
reservation_id
user_id
action
changes JSONB
created_at

### password_tokens

id
user_id
token_hash
purpose
expires_at
used_at
created_at

Purposes:

FIRST_ACCESS
PASSWORD_RESET

Tokens must be random, temporary and single-use.

Never store the raw token.

### sessions

id
user_id
token_hash
expires_at
created_at
last_used_at

## Authentication

Use email + password.

Passwords should use a modern password hashing algorithm such as Argon2id.

Use server-managed opaque sessions.

The browser stores only a secure session identifier in an HttpOnly cookie.

Production cookie:

HttpOnly
Secure
SameSite=Lax

Logout invalidates the server session.

## Authorization

ADMIN:
all operational actions + user management + audit history.

OPERATOR:
reservation operational actions.

Backend endpoints must enforce permissions.

Do not rely on hidden frontend buttons as authorization.

## Password invitation

Admin creates user.

User is persisted without a password.

Backend creates FIRST_ACCESS token.

Email contains temporary invitation link.

User defines password.

Token becomes used.

User can log in normally.

## Password reset

User requests reset.

The response must not reveal whether an email exists.

Backend creates temporary PASSWORD_RESET token.

User defines new password.

Existing sessions should be invalidated after successful reset.

## Auditing

Create an audit event for important actions:

CREATE
UPDATE
CHECK_IN
UNDO_CHECK_IN
CANCEL
TABLE_CHANGE

Historical `CONFIRM` events created before confirmation was removed remain readable in the audit
enum, but the application no longer generates them.

Store relevant before/after changes when appropriate.
