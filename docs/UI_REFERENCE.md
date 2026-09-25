# UI Reference

Figma:

https://www.figma.com/design/aJjjAJLRROLOt0VCETNEcb/Reservas-Cristal-Pizza

The Figma file is the visual source of truth.

Important principles:

- desktop and mobile are responsive adaptations, not separate products
- Portuguese UI
- high readability
- large touch targets
- low digital-literacy friendly
- operational actions should require few steps
- daily operation takes priority over administrative information

Main visual language:

- dark charcoal/green navigation
- warm off-white background
- white cards
- terracotta primary actions
- green arrival/check-in actions
- red cancellation state

Cancelled reservations must be strongly visible using a pale red card/row, red accent and explicit Cancelada indicator.

Arrived reservations use a pale green card/row, green accent and an explicit `Chegou` indicator.

The daily agenda is visually ordered by operational state: scheduled reservations first,
arrived reservations next, and cancelled reservations last. Time remains ascending inside each group.
Scheduled reservations expose the compact `Chegada` action directly in the agenda.

The daily agenda shows a manual-block banner when the selected date is blocked. ADMIN users see
`Bloquear dia` or `Desbloquear dia` and may provide an optional reason in the blocking dialog.
OPERATOR users only see the blocked state and its reason when present. Existing reservations and
their operational actions remain visible and usable.

The daily agenda only exposes:

people
name
time
phone
table
notes

Table is an operational field in the primary reservation list. An undefined table remains valid and
is shown discreetly.

The monthly view marks manually blocked dates with a lock and `Bloqueado`, without changing active
reservation or people totals. The day remains selectable. Reservation forms warn when a newly
selected date is blocked, retain other entered values, and disable saving until an open date is
selected.
