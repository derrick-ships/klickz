# Local CLI Companion Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
**Goal:** Run user-requested text work through official local Claude/Codex processes.
**Architecture:** Standalone loopback-only Node UI and runner; the hosted app links to a setup page and source download. No subscription token reaches the hosted backend.
**Tech Stack:** Node built-ins, HTML/CSS/JS, existing Next.js.
**Spec:** docs/superpowers/specs/2026-11-07-local-companion-design.md

## Global Constraints
Node 22+. No dependencies, credential reads, arbitrary executables from HTTP, shell interpolation, paid smoke calls or autostart. Fixed loopback port 48763. Preserve red/dark identity and keyboard access. Existing user approval allows direct execution and publication.

## Review Focus
1. Cross-origin and rebinding requests must fail before any process starts.
2. Login output and credentials must remain in the official process.
3. Unknown auth, missing binaries, invalid tasks and excessive inputs must fail clearly.
4. Cancellation, timeout and overlapping runs must not leave a second paid process.
5. Generated text must render as text, including hostile markup.

## Task 1: Local companion
Files: local-companion/{core,server,login}.mjs, local-companion/{index.html,ui.js}, local-companion/tests.test.mjs; src/app/local-companion/page.tsx; account.tsx; scripts/build-companion.py.
Interfaces: inspect(provider) -> {installed,authenticated,method}; run(provider,task,brief,signal) -> text. createCompanion(options) -> HTTP server.
- [x] Write core/HTTP tests and run node --test local-companion/tests.test.mjs; expect missing feature.
- [x] Implement runner, loopback server and branded accessible UI.
- [x] Package source with launchers; add hosted setup and correct subscription copy.
- [x] Run companion tests, app checks and browser visual checks.
- [x] Obtain independent review, fix important findings, publish main and deploy.

## Execution record
Native execution under standing user approval; no additional permission gate. Official local binary approach supplied by the user. Existing main workspace retained because the user explicitly approved main edits/publication. Independent reviewer local_companion_review identified three issues, all fixed RED→GREEN. Additional local capability hardening verified RED→GREEN. Source package, mobile views and provider fixtures are distinguished from real Mac account validation. Publication verification is recorded in release evidence.
