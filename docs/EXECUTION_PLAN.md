# Execution Plan

## Project status

Discovery: completed  
MVP specification: completed  
User flows: completed  
Desktop UI/UX: completed  
Mobile UI/UX: completed  
Base documentation: completed  

The project is now entering implementation.

---

## Implementation order

### Sprint 1 — Project foundation and authentication

Status: COMPLETED

Goals:

- initialize frontend and backend applications
- configure repository structure
- configure PostgreSQL connection
- configure SQLAlchemy and Alembic
- create initial database models
- create initial migration
- implement authentication
- implement authorization
- implement first-access invitation
- implement password reset
- implement server-side sessions
- create authentication tests
- document local development setup

Do not implement the reservation UI during this sprint.

---

### Sprint 2 — Reservation domain

Status: COMPLETED

Goals:

- reservation CRUD
- validation rules
- reservation statuses
- reservation origins
- confirmation
- cancellation
- check-in
- undo check-in
- reservation audit events
- backend tests for business rules

---

### Sprint 3 — Daily agenda

Status: COMPLETED

Current progress:

- authenticated application shell
- responsive daily agenda connected to the reservation API
- loading, empty, error and cancelled-reservation states
- responsive, read-only reservation details connected to the reservation API
- responsive reservation creation connected to the reservation API
- responsive reservation editing connected to the reservation API
- reservation confirmation with an accessible confirmation dialog
- check-in and undo check-in from mobile agenda and reservation details, with accessible confirmation dialogs
- reservation cancellation from details, with optional reason and an accessible confirmation dialog
- final integrated desktop/mobile review completed

Goals:

- implement the main daily agenda
- connect frontend to reservation API
- create reservation flow
- reservation details
- edit reservation
- operational actions
- responsive desktop/mobile implementation
- cancelled reservation visual state
- manual date blocking visibility and controls for ADMIN/OPERATOR

The daily agenda displays:

- number of people
- customer name
- time
- phone
- notes

---

### Sprint 4 — Monthly planning

Status: COMPLETED

Goals:

- monthly calendar
- reservation count per day
- total people per day
- navigation between month and daily agenda
- exclude cancelled reservations from occupancy totals
- identify manually blocked dates without changing occupancy totals

---

### Sprint 5 — Administration

Status: COMPLETED

Goals:

- user management
- pending invitations
- resend invitation
- deactivate users
- audit history interface

---

### Sprint 6 — Production readiness

Status: IN PROGRESS

Internal production readiness is complete. External deployment, client validation and production
release remain pending until a hosting destination, domains and provider credentials are supplied.

Goals:

- integration tests
- security review
- responsive review
- error handling
- loading and empty states
- accessibility review
- production environment configuration
- deployment
- client validation
- production release

---

## Working rule

Implement one sprint at a time.

Do not anticipate later features unless they are technically required by the current sprint.

The repository must remain runnable and testable after each sprint.
