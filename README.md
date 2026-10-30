<p align="center">
  <img src="docs/images/cover.png" alt="SproutAsk cover: an abstract leaf mark next to the SproutAsk and 芽问 wordmarks on a dark background" width="100%">
</p>

<h1 align="center">SproutAsk</h1>
<p align="center">A local-first biology study agent for lower-secondary students, built on the DeepSeek Harness kernel.</p>
<p align="center"><a href="README.zh.md">中文</a></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@deepseek-ai/dsh"><img src="https://img.shields.io/badge/DSH-0.2.1--rc.3-3B5BDB?style=flat-square" alt="DSH 0.2.1-rc.3"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&amp;logo=typescript&amp;logoColor=white" alt="TypeScript"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%E2%89%A524-5FA04E?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white" alt="Node.js 24 or newer"></a>
  <a href="https://learn.microsoft.com/windows/"><img src="https://img.shields.io/badge/Windows-10%20%2F%2011%20x64-0078D4?style=flat-square" alt="Windows 10 or 11, x64"></a>
  <a href="https://pnpm.io/"><img src="https://img.shields.io/badge/pnpm-11.21.0-F69220?style=flat-square&amp;logo=pnpm&amp;logoColor=white" alt="pnpm 11.21.0"></a>
</p>

## Overview

SproutAsk (芽问) turns one textbook volume into a guided study loop: read a section in the library, follow the concept map, work through a concept in the workspace, answer, and get feedback that points back to the exact page it came from. It is built for students studying *Biology, Grade 7, Volume 1* (People's Education Press, 2024 edition) on their own Windows computer.

Learning records live on the student's machine. The single cloud dependency is the DeepSeek API for inference; without a key the application still opens and works as a local reader for the library, the map and past records.

v0.3.0 is the **DSH education rebuild line**: the application now runs on the real DeepSeek Harness kernel as a local background service plus an application window, and no longer ships an Electron shell. The earlier Electron 0.2.x line is not the product of this line.

## Features

- **One full volume, curated and published.** 1 volume / 2 units / 7 chapters / 22 sections / 43 concepts / 88 activities / 43 rubrics / 44 relations, with 193 distinct textbook source anchors (281 reference entries). The content pack is `status=published` after a human curator pass.
- **Answers carry page anchors.** Feedback references the textbook location as both PDF page and printed page, so a student can find the sentence on paper.
- **Three-axis learning state.** Concept-level state moves through the study flow, and review is recorded with `finish-review` rather than inferred from page visits.
- **Misconceptions are handled explicitly.** A missed concept surfaces the specific misconception, its correction, and the source it rests on.
- **Hints are labelled honestly.** After a hint, an answer is marked as `assisted` and is not counted as independent evidence.
- **Photo answers are gated before inference.** Blurred, rotated and blank images are rejected with a clarification request before any model call; accepted images score idempotently.
- **Records stay local and survive a crash.** Learning data is written as JSONL under the local data directory, with a journal that self-heals from a stale lock and degrades safely on half-written lines.
- **The API key never leaves the machine.** It is entered in the app, encrypted with Windows DPAPI, never echoed back to the client, and applied after a restart.
- **No administrator rights, no Electron.** Installed per user, started as a local service with an application window.

## Installation

**Requirements:** Windows 10 or 11, x64.

v0.3.0 is distributed as two Windows artifacts. They are build outputs and are not stored in this Git repository; obtain them from the maintainer or from the Releases page, and verify the hash before running.

| Artifact | Size | SHA-256 |
|---|---:|---|
| `SproutAsk-Setup-0.3.0-x64.exe` (one-click installer) | 56.7 MB | `0fc5df1828265d0ed74e20f89cc7ddc0d3c55f5ac83e6de3df39a2e042d9c014` |
| `SproutAsk-0.3.0-x64-portable.zip` (portable) | 117.4 MB | `6a0852cd186e27db861d1fc80cdc9c19800e76ce186fbf750397ec9df9bfaa7b` |

1. Run the installer. It installs per user into `%LOCALAPPDATA%\SproutAsk\current` and does not need administrator rights.
2. The binaries are **not code-signed**, so Windows SmartScreen will show an "unknown publisher" prompt. No signing certificate has been purchased.
3. Verify before running:

```powershell
Get-FileHash .\SproutAsk-Setup-0.3.0-x64.exe -Algorithm SHA256
# expect 0FC5DF1828265D0ED74E20F89CC7DDC0D3C55F5AC83E6DE3DF39A2E042D9C014
```

**From source (development):** Node.js 24 or newer and pnpm 11.21.0.

```powershell
cd education
pnpm install
pnpm typecheck
pnpm test
pnpm dev          # builds, prints a loopback URL, stays in the foreground
```

`pnpm dev` runs against an isolated profile under `education/.local/`; it does not touch an existing harness installation. The development runtime reads its API key from `education/.local/secrets/deepseek.key`, a local-only file that is not in this repository.

## Usage

1. Start **SproutAsk** from the Start menu. On first launch the local data directory `%LOCALAPPDATA%\SproutAsk\data` is created.
2. Open `/account`, paste a DeepSeek API key, save. The key is encrypted locally and is not displayed again. **Restart the application** for it to take effect.
3. Choose a section in `/library`, or open `/map` to move by concept instead of by page order.
4. In `/workspace`, answer a concept. Feedback names the misconception when the answer misses, and shows the textbook page.
5. Use `/records` to revisit what has been studied and to finish a review.
6. Without a key the app stays in local mode: the library, the map and past records work, cloud inference does not.

## Configuration

| Setting | Where | Notes |
|---|---|---|
| DeepSeek API key | In-app `/account` page | Encrypted with Windows DPAPI, stored on the local machine, never echoed to the client. Requires an application restart. |
| Learning data | `%LOCALAPPDATA%\SproutAsk\data` | JSONL records plus review and journal state. Created on first launch. |
| Installation | `%LOCALAPPDATA%\SproutAsk\current` | Per-user; uninstall keeps learning data unless you choose to delete it. |
| Data root override | Environment variable `SPROUTASK_DATA_ROOT` | Advanced: relocates the data root, used for isolated test profiles. |
| Development key | `education/.local/secrets/deepseek.key` | Development runtime only. Local file, never committed. |

## Releases

The current release is **v0.3.0 — DSH education rebuild**. Release notes: [docs/releases/v0.3.0.md](docs/releases/v0.3.0.md).

### Known limitations in v0.3.0

These are stated because they are real and unresolved, not as a formality:

1. **Not code-signed.** SmartScreen warns about an unknown publisher.
2. **Figure meaning was only sampled.** Visual verification of figure captions covers **8 of 73** figures (7 consistent, 1 undecidable); the remaining 65 were not checked. That judgement came from a vision model in-session, not from a human sign-off.
3. **Edition, printing, price and trim size were not verified.** The OCR pass did not read the copyright-page fine print. Known facts are the ISBN-13 `978-7-107-38263-5` and the publisher, People's Education Press.
4. **No clean-machine validation.** A close approximation (no development PATH, isolated data root) passed, but there is no second Windows machine.
5. **No UI visual walkthrough.** Interface behaviour has offline assertions, but no real browser or device screenshots exist.
6. **Photo capture was not tested on a real phone.** JPEG from a phone, canvas compression, and the retry-after-clarification path are unverified.
7. **No learning-outcome experiment.** This release does not claim improved understanding or improved grades.
8. **The harness has no turn-cancellation interface.** On budget overrun the app stops waiting, but the abandoned model turn keeps running in the background.
9. **Gate status, stated plainly:** G1 = PARTIAL, G2 = FAIL/PARTIAL, G3 = PARTIAL, and the top-level `finalAccepted` gate is **not reachable**.

### Not included in this release

Teacher-facing features, class aggregation, multi-device sync, auto-update, telemetry, public network exposure, and any promise of equal quality for other textbooks.

## License

**MIT.** SproutAsk is released under the MIT License. The full text is in [`LICENSE`](LICENSE) at the repository root: MIT License, Copyright (c) 2026 HaoyanZhang123. `education/package.json` declares `"license": "MIT"`.

Third-party dependencies keep their own licenses; the license texts bundled with the app are under `education/licenses/texts/`.
