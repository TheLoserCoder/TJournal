# ADR-0003: MVP boundary in the Electron renderer

## Status

Accepted.

## Decision

Renderer features follow Model-View-Presenter. React Views receive ViewModels and callbacks only. Presenters coordinate UI state and invoke narrow renderer gateway interfaces. `ElectronRendererGateway` is the sole renderer implementation allowed to access `window.tjournal`.

Business rules, persistence and command execution remain in journal application/domain and Electron main process.

Reusable Views such as `DataTable` render feature-provided ViewModels and callbacks only. TanStack Table, Radix interaction primitives, portal positioning and adaptive table rendering are renderer presentation mechanics; trade CRUD, settings persistence and history commands stay in the feature presenter and main process.

## Consequences

UI redesigns replace Views and, when necessary, presenters without rewriting SQLite adapters, IPC handlers or use cases. Tests can exercise presenter behaviour with a fake RendererGateway.

Portal-backed dropdowns, filters and dialogs are required when a scrollable renderer region could clip an overlay. The primitive layer owns focus and dismissal mechanics; feature presenters own the open state and user intent.

Interactive layout dialogs use presenter-owned draft ViewModels and apply changes only after an explicit confirmation. The table component renders selection, resizing and feature-provided visual cells, while selection actions and trade mutations remain in the workspace presenter. No dialog preview field may imply persistence until a dedicated domain/application slice exists.
