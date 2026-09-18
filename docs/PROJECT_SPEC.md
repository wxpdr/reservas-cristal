# Reservas Cristal — Product Specification

## Overview

Reservas Cristal is an internal web application for managing reservations at Cristal Pizza.

The restaurant currently manages reservations through a physical annual agenda and manually creates a second operational list for the day.

Reservations arrive through phone calls, WhatsApp, in-person requests and Tagme.

The system replaces the paper agenda and centralizes reservation information for receptionists, cashiers, managers and the owner.

## Goal

Provide a simple daily operational agenda where staff can quickly identify reservations, register new bookings, confirm customers, record arrivals, cancel bookings and consult future dates.

This is an internal system.

There is no public customer booking flow in the MVP.

## Users

Admin:
- owner
- manager

Operator:
- cashier
- receptionist
- authorized employees

## Core flows

Reservation creation:
contact -> employee registers reservation -> reservation appears automatically in the selected day.

Daily operation:
agenda -> locate reservation -> confirm / open / check-in / cancel.

Future planning:
monthly view -> inspect reservation count and people count -> open selected day.

First access:
admin creates employee -> system sends invitation -> employee defines password -> account becomes usable.

Password recovery:
employee requests reset -> receives temporary link -> defines new password.

## Reservation rules

Required:
customer name, phone, party size, date, time and origin.

Optional:
table, notes and cancellation reason.

There is no automatic capacity limit.

There are no fixed reservation time slots.

Party size has no maximum.

Party size >= 20 receives visual emphasis.

Table is optional and may be assigned or changed later.

Cancellation never deletes the reservation.

Cancelled reservations remain available for history/audit.

## Statuses

AGENDADA:
reservation exists but has not been confirmed.

CONFIRMADA:
customer confirmation has been recorded.

CHEGOU:
customer arrival/check-in has been recorded.

CANCELADA:
reservation has been cancelled but remains stored.

Check-in may be undone.

## Origins

TELEFONE
WHATSAPP
PRESENCIAL
TAGME
OUTRO

## Daily agenda

The daily agenda is the main operational screen.

Reservations are ordered primarily by time.

The primary list shows only:

- number of people
- customer name
- time
- phone
- notes

Other information remains available in reservation details.

Cancelled reservations must receive strong red visual emphasis.

## Monthly view

Each day displays:

- number of active reservations
- total number of people

Cancelled reservations are excluded from monthly occupancy totals.

Selecting a date opens the daily agenda.

The system does not automatically classify a date as full.

## User administration

Only admins can manage users.

Admin can:
- create users
- edit users
- deactivate users
- resend pending invitations

A newly created user does not receive a password from the administrator.

The user defines their own password through the invitation link.

## Audit

Important reservation actions must identify:
- reservation
- user responsible
- action
- date/time
- relevant changes

Audit history is an administrative feature and is not part of the primary daily workflow.

## MVP exclusions

Not included:

- public booking website
- automatic Tagme integration
- payment
- table map
- table capacity management
- automatic table assignment
- automatic capacity blocking
- multiple restaurant units
- customer accounts
- marketing automation
- loyalty program
- analytics platform