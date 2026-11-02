<p align="center">
  <img src="docs/images/cover.png" alt="SproutAsk cover: dark banner with the 芽问 / SproutAsk wordmarks and a stylized 观察 → 推理 → 理解 panel" width="100%">
</p>
<p align="center"><sub>Design illustration — not a product screenshot.</sub></p>

<h1 align="center">SproutAsk · 芽问</h1>
<p align="center">A local-first biology learning agent built on the DSH runtime.</p>
<p align="center"><a href="README.zh.md">中文</a></p>

<p align="center">
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img alt="DSH" src="https://img.shields.io/badge/runtime-DSH%200.2.1--rc.3-1f6feb"></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178c6"></a>
  <a href="https://nodejs.org/"><img alt="Node.js" src="https://img.shields.io/badge/Node.js-24-3c873a"></a>
  <a href="https://pnpm.io/"><img alt="pnpm" src="https://img.shields.io/badge/pnpm-11-f69220"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-2ea44f"></a>
</p>

## Overview

SproutAsk is a study workspace for one student on one Windows PC. It pairs a real DSH agent session with a verified content pack for 人教版 2024 七年级上册生物学 (PEP Grade 7, Volume 1): the learner reads a concept, answers, receives explanation or correction with textbook citations, and keeps a local record of what was understood.

Two things matter more than feature count here — **the tutor runs on a real DSH runtime rather than a look-alike chat**, and **learning judgements rest on recorded evidence rather than on message counts**. Every explanation is bound to a source page in the textbook the student imported.

## Features

- **Concept map separated from the table of contents.** The directory tree and the prerequisite/related graph are different views; prerequisite edges carry a basis and are never derived from chapter order.
- **Three independent axes.** Learning progress, understanding evidence and review activity are stored and shown separately; self-report is kept apart and never written into a judgement.
- **Guided first, explicit when needed.** The tutor asks, hints and demonstrates, but may also explain, show a worked example, or state the answer — and marks answers it disclosed, so evidence stays honest.
- **Answers with citations.** Explanatory turns carry source id plus PDF page and printed page; the textbook text itself stays on the local machine.
- **Image answers behind a pre-model quality gate.** Blurry, tilted or blank photos are sent back for clarification before any model call; a graded image is persisted once, and repeated submissions do not re-grade.
- **Recoverable local journal.** Append-only event log with snapshots, crash recovery, stale-lock self-healing, export and confirmed deletion.

## Installation

Download from [Releases](https://github.com/HaoyanZhang123/sproutask/releases/tag/v0.3.0):

- `SproutAsk-Setup-0.3.0-x64.exe` — per-user installer, **no administrator rights**, installs to `%LOCALAPPDATA%\SproutAsk\current`
- `SproutAsk-0.3.0-x64-portable.zip` — unpack anywhere and run `launcher.cmd`

The installer is **not code-signed**, so Windows shows an "unknown publisher" prompt. `SHA256SUMS.txt` is included for verification.

## Usage

1. Start **SproutAsk** from the Start menu or the desktop shortcut.
2. Open `/account` and paste a DeepSeek API key. It is encrypted locally and never shown again. **Restart the app** — the key is loaded at process start by design.
3. Import your own copy of the textbook PDF, then pick a concept from the library or the map and start learning.
4. Without a key the app stays in local mode: materials, map and records are readable, cloud reasoning is explicitly unavailable.

## Configuration

| Item | Value |
|---|---|
| Model | DeepSeek official API, `deepseek-flash`; API key only (account sign-in is not offered) |
| Key storage | `%LOCALAPPDATA%\SproutAsk\data\secrets\model-key.dat`, DPAPI-encrypted, host side only |
| Learning data | `%LOCALAPPDATA%\SproutAsk\data` (journal, snapshots, imported materials) |
| Network | loopback only; the local service never binds a public interface |

## Project Structure

```
education/packages/   domain, storage, importer, knowledge, learner, tutor, visuals
education/client/     framework-free DOM UI: shell, library, map, study, visuals
education/runtime/    DSH host/client plugins, adapters, composition, launchers
education/content/    biology-7a pack: concepts, activities, rubrics, relations, sources
education/licenses/   third-party notices, incl. libvips LGPL-3.0 obligations
```

## Releases

See [v0.3.0 release notes](docs/releases/v0.3.0.md). `main` still carries the earlier Electron 0.2.x line; this DSH rebuild ships on branch `education-v0.3.0`.

## Current status and limits

This is a **frozen engineering build with known gaps**, not a finished student product.

- Gate status: G1 (first-section loop) PARTIAL · G2 (full volume and teaching) FAIL/PARTIAL · G3 (Windows artifact) PARTIAL · final acceptance **not reached**.
- Figure captions were visually checked only by sampling **8 of 73** (7 consistent, 1 undecidable); the remaining 65 await human review.
- Edition, printing run, price and ISBN-line fields are `unverified` in the content pack; ISBN-13 `978-7-107-38263-5` was read from the back cover.
- No clean-machine verification, no code signature, no learning-effect study — no claim of improved understanding or grades is made.
- The UI has DOM-level assertions but no browser visual review; image answers were not tested with real phone photos.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 HaoyanZhang123.
