# ADR-0018: Public Windows v1 distributed without code signing

## Status

Accepted by the owner for the first public Windows v1 release (2026-09-26).

## Context

The desktop package targets Windows x64 NSIS. The project does not currently have a Windows code-signing certificate or signing service. The owner chose a public v1 release through the repository's GitHub Releases without waiting for one. An unsigned executable may prompt Windows SmartScreen, and a published SHA-256 checksum is useful for detecting an accidental mismatch but does not establish the publisher's identity.

## Decision

- Release the verified Windows x64 NSIS installer as an **unsigned** artifact on GitHub Releases. Do not describe it as signed, trusted by Windows, or warning-free.
- Publish the exact installer version, SHA-256 checksum and release notes alongside the artifact. The release notes explicitly explain the absence of a digital signature and the possible SmartScreen warning; users must obtain the installer from the project's GitHub release page.
- Build and test the installed artifact before publishing; download the attached artifact again and compare it with the tested artifact. The release task in Task Master (#12) records the acceptance evidence. Keep certificate material and publishing credentials outside the repository.

## Consequences

- Users can receive Windows warnings and may choose not to install the application. A checksum cannot replace Authenticode or a trusted publisher identity.
- Code signing remains a separate decision for a future release; adding it should not change the journal vault or domain model.
- Publication still requires the functional, recovery, accessibility and installed-package acceptance gates in Task Master #12. This ADR does not waive those gates.

## Alternatives considered

- Postpone public v1 until a signing certificate is available: best for publisher identity and fewer platform warnings, but rejected by the owner for this release.
- Distribute only to a limited test audience: rejected because the owner selected a public Windows v1.
