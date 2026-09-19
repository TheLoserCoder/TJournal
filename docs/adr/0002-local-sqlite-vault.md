# ADR-0002: SQLite vault as the local journal boundary

## Status

Accepted.

## Context

The desktop journal must work without a server, keep attachments next to the user's data, survive application restarts, and later be accessible through an API suitable for a mobile client.

## Decision

Each journal is one user-selected vault folder. Its marker, SQLite file, attachments and backups stay together. The main process owns filesystem access and SQLite. The journal module exposes vault/instrument `JournalStorage`; the trade module owns `TradeStore`. Their domains have no Electron, SQLite, Drizzle or filesystem imports.

`node:sqlite` provides the embedded database. Drizzle is restricted to the database adapter. Migrations execute inside an SQLite transaction and are recorded in `tjournal_migrations`.

## Consequences

- A vault moves by copying its entire folder; no separate data export is needed for the initial release.
- The app never initializes a non-empty selected folder.
- Renderer code only receives typed DTOs through preload, so a future HTTP/mobile adapter can call the same use cases.
