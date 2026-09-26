# TJournal

Offline-first desktop trading journal for recording and analysing closed trades. Built with
Electron, React and a local SQLite vault. Windows is the first target; the architecture keeps
desktop, future mobile and optional server adapters separate from the domain.

## Status

The v1 feature set is implemented and the first public Windows release is published as an
unsigned installer on
[GitHub Releases](https://github.com/TheLoserCoder/TJournal/releases/tag/v1.0.0)
([ADR-0018](docs/adr/0018-unsigned-windows-v1-distribution.md)); Windows may show a SmartScreen
warning. Release acceptance and verification evidence live in
[Task Master](.taskmaster/tasks/tasks.json) (task #12).
[Product scope](docs/product/scope-v1.md) records what v1 deliberately does not include.

## What it does

- **Portable vault** — one folder holds `journal.sqlite`, a vault marker, `attachments/` and
  `backups/`; moving a journal is copying the folder.
- **Closed trades** — Long/Short with USD / % / R quick entry persisted as one authoritative
  exact-decimal `netResultUsd`, plus commissions, spread, executions, partial exits and
  instrument calculation profiles.
- **Accounts** — projected balance from opening balance, saved trade results, deposits and
  withdrawals; account-specific `1R, USD`; cash flow never enters trading P&L.
- **Catalogues** — instruments with lifecycle and categories, coloured tags with multi-assignment
  per trade.
- **Qualitative journal** — entry rationale and post-trade review notes with an explicit review
  status, searchable from the trade table.
- **Trade table** — keyset-paginated, virtualised, typed column filters, allowlisted sorting,
  resizable layout and reversible bulk deletion.
- **Undo/Redo** — session history whose inversion runs inside one SQLite transaction.
- **Statistics** — exact USD P&L, win rate, profit factor, average trade, absolute drawdown, time
  series and bounded breakdowns by account, instrument and category.
- **Recovery** — verified SQLite backups with checksum and integrity verification, restore into a
  new vault, and an offline recovery command for an unreadable source.
- **Presentation** — RU/EN, Light/Dark/Auto, accessible controls and responsive layouts.

## Requirements

Node.js 24+ and pnpm 11+ (pinned through Corepack).

## Commands

```bash
pnpm install          # install workspace dependencies
pnpm dev              # typecheck, then run Electron with Vite dev server
pnpm build            # typecheck, then production electron-vite build
pnpm check            # lint, typecheck, architecture guards and unit tests
pnpm test             # Vitest unit and integration tests
pnpm test:e2e         # build the app and run Playwright against real Electron
pnpm format           # write Prettier formatting
pnpm format:check     # verify Prettier formatting
pnpm architecture     # dependency-cruiser rules plus the guard self-test
pnpm make             # build the Windows NSIS installer
pnpm clean            # remove TypeScript build outputs
```

## Documentation

| Topic                             | Document                                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product vision and v1 boundaries  | [docs/product](docs/product)                                                                                                                          |
| Project map and data flow         | [docs/architecture/code-map.md](docs/architecture/code-map.md)                                                                                        |
| Renderer design system            | [docs/architecture/design-system.md](docs/architecture/design-system.md)                                                                              |
| Architecture decisions            | [docs/adr](docs/adr)                                                                                                                                  |
| Coding rules, testing, tooling    | [docs/engineering](docs/engineering)                                                                                                                  |
| Query and analytics performance   | [docs/engineering/query-performance.md](docs/engineering/query-performance.md), [analytics-performance.md](docs/engineering/analytics-performance.md) |
| Backup and disaster recovery      | [docs/engineering/backup-recovery.md](docs/engineering/backup-recovery.md)                                                                            |
| Current tasks and release status  | [Task Master](.taskmaster/tasks/tasks.json); [historical roadmap](docs/roadmap/tasks.md)                                                              |
| Confirmed defects and regressions | [docs/bugs/README.md](docs/bugs/README.md)                                                                                                            |

Read [AGENTS.md](AGENTS.md) before making changes.

## Vault data

A vault is a plain folder and stays readable without the application. Backups live inside it at
`backups/<backup-id>/` with a `manifest.json`; see
[docs/engineering/backup-recovery.md](docs/engineering/backup-recovery.md) before touching a
damaged vault. Application preferences and logs live outside the vault and are not backed up.
