# ADR-0003: MVP boundary in the Electron renderer

## Status

Accepted.

## Decision

Renderer features follow Model-View-Presenter. React Views receive ViewModels and callbacks only. Presenters coordinate UI state and invoke narrow renderer gateway interfaces. `ElectronRendererGateway` is the sole renderer implementation allowed to access `window.tjournal`.

Business rules, persistence and command execution remain in journal application/domain and Electron main process.

## Consequences

UI redesigns replace Views and, when necessary, presenters without rewriting SQLite adapters, IPC handlers or use cases. Tests can exercise presenter behaviour with a fake RendererGateway.
