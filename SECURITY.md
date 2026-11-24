# Security policy

## Reporting a vulnerability

Do not open a public issue for a security problem.

Use GitHub's private vulnerability reporting:

https://github.com/6yte96/grapheway/security/advisories/new

Include:

- the affected version;
- the surface (CLI, runtime, probe, hosted demo, MCP, website);
- a minimal reproduction;
- the impact;
- any suggested fix.

You will get an acknowledgement as soon as possible. Please give time for a
fix and a release before public disclosure.

## Scope

In scope:

- the `grapheway` npm package;
- the CLI;
- the runtime and MCP endpoints;
- the probe crawler;
- the hosted MCP demo;
- the website and its generated files.

Out of scope:

- vulnerabilities in third-party clients;
- social engineering;
- denial of service through unrealistic resource use;
- reports that require access to a private network or a user's machine.

## Defaults

- The runtime only exposes what the site configures.
- Actions are opt-in.
- The hosted demo rejects localhost, private ranges and metadata hosts.
- The probe respects `robots.txt`, stays same-origin and uses a page budget.
- There is no telemetry or visitor tracking.

## Secrets

Never put tokens, private URLs or personal data in an issue, discussion or pull
request. If a secret is exposed, rotate it first, then report the exposure
privately.
