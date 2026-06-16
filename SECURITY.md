# Security Policy

POS-Pulse is the Windows desktop POS terminal for the SmartDataPulse platform. It
keeps high-trust work in the Electron main process, exposes the renderer only through
a typed preload bridge, and treats local terminal state as operationally important.
We take the security of this repository and the terminals it ships to seriously.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report vulnerabilities privately through GitHub's built-in
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability):

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability**.
3. Describe the issue, the affected version or commit, and reproduction steps.

This routes the report to the maintainers privately and keeps the details out of the
public issue tracker until a fix is available. We will acknowledge the report and work
with you on a coordinated disclosure timeline.

## Secrets and configuration

- **No secrets are committed to this repository.** No API keys, tokens, passwords, or
  device credentials belong in source, tests, fixtures, or documentation. If you
  discover a committed secret, report it privately as above — do not open a public issue.
- **Sample environment values are placeholders only.** `.env.example` documents the
  available variables with non-routable placeholders (e.g. `https://example.invalid`).
  It is a template, never a source of real configuration.
- **Real configuration is supplied locally.** Production endpoints, credentials, and
  feature flags are provided through your local, untracked `.env` (ignored by Git) or
  the host environment — never through committed files. The active API base URL is
  resolved in the main process at runtime, not hardcoded in the example file.
- Local terminal secrets (device tokens, etc.) are stored through Electron `safeStorage`
  (DPAPI on Windows); a packaged build refuses to start without it.

## Integration boundary

POS-Pulse is the **edge** of the platform. It speaks only to the `Data-Pulse-2`
contracts and **must not call ERPNext (or any back-office system) directly** —
all integration flows through Data-Pulse-2. Keeping this boundary intact is part of
the security posture: the terminal never holds back-office credentials and never
reaches systems outside its contract surface.

## Supported versions

POS-Pulse is in active pre-release development. Security fixes are applied to the
`main` branch; there is no separate long-term-support line yet.
