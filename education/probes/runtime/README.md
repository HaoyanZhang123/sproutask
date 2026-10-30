# T00 runtime probe

Isolated, reproducible probe for **fixing a DSH source/runtime and proving a minimal
education surface**. Everything here is probe scaffolding, not product code:

- it is **not** part of the `education` pnpm workspace and has its own lockfile;
- it never reads or writes the installed DSH desktop bundle, the user's
  `the user's DSH home`, or any user credential;
- it starts DSH from the official npm package at a pinned version, with a
  probe-owned `DSH_HOME`, loopback-only listeners and scripted (non-network) model
  responses.

The accepted facts live in [`docs/rebuild/runtime-lock.json`](../../../docs/rebuild/runtime-lock.json);
the run evidence lives in `education/.local/evidence/T00/` (git-ignored, local only).

## Fixed source

| item | value |
|---|---|
| route | official npm registry package, exact version (no dist-tag) |
| package | `@deepseek-ai/dsh@0.2.1-rc.3` |
| tarball | `https://registry.npmjs.org/@deepseek-ai/dsh/-/dsh-0.2.1-rc.3.tgz` |
| tarball SHA-256 | `9a8f9493bfab8218215a8ca38ab8821e76dff63dc4fcb65841ef87c0aa277141` |
| integrity | `sha512-H+E9HLnHf7fJqzen84Z9Bq8ggb5xbrcbyhZjXTJLE9NabHr3zteGvTRvdvGkxPl4ov80is4WLglFmSo+/olJjg==` |
| lockfile | `pnpm-lock.yaml` in this directory (558 packages) |
| Node / pnpm used | Node `v24.22.1`, pnpm `11.21.0` (runtime manifest declares Node `24.21.0`, pnpm `11.28.5`) |

The installed desktop bundle is only used as a static reference fingerprint
(`app.asar` SHA-256 `04b32e3a…eff1f0`, version `0.2.1-rc.3`,
`dshBuildCommit=be72761ee1a6736ebcdf4f3739363b083ae53c98`). It is never copied,
edited or used as a build input.

## Layout

```
probes/runtime/
  package.json            dependency pin for the probe only
  pnpm-lock.yaml          resolved dependency lock (committed)
  plugin/host/index.js    mock LLM route `edu-mock` + one education tool `edu_probe_echo`
  plugin/root/client.js   hand-authored client root occupant (replaces ui-layout root)
  scripts/setup-home.mjs  writes the isolated DSH_HOME profile dirs
  scripts/run-dsh.mjs     one-shot CLI run with sanitized env + captured evidence
  scripts/run-web.ps1     start the web profile on a free loopback port
  scripts/stop-web.ps1    stop it and verify the port is closed
  scripts/render-page.mjs headless Chrome over CDP: DOM text + screenshot
  scripts/license-inventory.mjs  license/NOTICE/binary inventory of the fixed closure
```

Profiles created under `$DSH_HOME/profiles`:

- `edu-headless` — `dsh-base` + `dsh-headless`; all privileged tools and every real
  model provider removed; scripted mock provider; one education tool.
- `edu-web` — `dsh-base` + `dsh-web-app`; the default layout root (`ui-layout`) and
  every client row that fills the default layout are removed; the probe root takes
  the single `root` slot.
- `edu-web-duplicate` — negative control: the default layout root is re-enabled in
  front of the probe root; the shell must refuse the second root occupant.

## Reproduce

```powershell
# 1. install the fixed runtime (isolated; --ignore-workspace keeps it out of education/)
pnpm install --ignore-workspace

# 2. generate the isolated DSH_HOME (absolute path; never the user's home)
node scripts/setup-home.mjs --home <abs>/.local/cache/T00/probe-home
foreach ($p in 'edu-headless','edu-web','edu-web-duplicate') {
  Push-Location "<abs>/.local/cache/T00/probe-home/profiles/$p"; pnpm install --force; Pop-Location
}

# 3. headless agent turn (mock model, no network)
node scripts/run-dsh.mjs --home <probe-home> --work <probe-work> --out <evidence>/20-headless `
  -- --profile edu-headless "try the allowlisted tool and the forbidden shell/file/PTC tools"

# 4. web host + root replacement
powershell -File scripts/run-web.ps1 -DshHome <probe-home> -Work <probe-work> -Out <evidence>/30-web
node scripts/render-page.mjs --url "<printed token URL>" --out <evidence>/30-web/render
powershell -File scripts/stop-web.ps1 -Out <evidence>/30-web
```

`run-dsh.mjs` / `run-web.ps1` delete inherited `DEEPSEEK_*`, `DSH_*`, `ANTHROPIC_*`
and `OPENAI_*` variables, set `DSH_HOME` to the probe home and run with the isolated
work directory as cwd (so no repository `.env` is discovered).

## What the probe proved (run-01)

- headless: advertised tool list is exactly `["edu_probe_echo"]`; `bash`, `read_file`
  and `run_code` return `Error: unknown tool "…"`; the allowlisted tool executes.
- web: no token → `401`, token URL → `303` + signed `HttpOnly; SameSite=Strict`
  cookie, cookie → `200`; the probe root bundle is served (`200`) and the default
  layout bundle is not (`404`); the rendered DOM is `EDU PROBE ROOT`.
- duplicate root: `@deepseek-ai/dsh-client-ui-layout: failed` and the boot audit
  reports the conflict instead of rendering two roots.
- cleanup: both probe processes stopped, ports closed, no probe node process left,
  the current GUI on `127.0.0.1:29962` still answers.

## Addendum: real API-key route (2026-10-29)

The user explicitly **disallows** the DSH-specific PKCE/account route (recorded as
`NOT_ALLOWED`), and supplied a DeepSeek API key at
`education/.local/secrets/deepseek.key` (git-ignored, never echoed). With a small
budget cap (≤6 live calls, ≤¥0.5 for the addendum) the probe then verified:

- `GET https://api.deepseek.com/models` → 200, models `deepseek-flash`,
  `deepseek-v4-pro`;
- one minimal direct text turn and one direct `image_url` turn → both 200 (the
  route accepts images; visual quality is **not** assessed here);
- the DSH `edu-headless-apikey` profile (API-key adapter kept, title generation
  disabled) answered exactly `APIKEY-ROUTE-OK` with one billed model call and
  usage `256 in / 31 out / 256 cacheRead / 543 total`.

Run it with the credential only in the child environment:

```powershell
$env:DEEPSEEK_API_KEY = (Get-Content <key file> -Raw).Trim()
node scripts/run-dsh.mjs --home <home> --work <work> --out <evidence> --keep-env DEEPSEEK_API_KEY `
  -- --profile edu-headless-apikey "reply with the probe token"
Remove-Item Env:DEEPSEEK_API_KEY
```

The key is passed by environment name only; the runner records `keptEnvKeys` (names),
never values. Direct capability evidence comes from `scripts/apikey-probe.mjs`,
which reads the key file itself and writes only sanitized request/response summaries.

## Known limits

- The root occupant here is a static hand-written bundle; real education UI needs the
  monorepo client build (`tsdown`) recipe, which the published packages do not ship.
- The desktop shell package (`@deepseek-ai/dsh-desktop`) is **not** on npm; only the
  web/headless host is reproducible from the registry (T16 concern).
- `api.github.com` returns 403 in this environment, so no source checkout / commit
  verification was possible.
- Account PKCE route: **NOT_ALLOWED** by user decision — not a technical gap.
- API-key route: **PASS** for text (and image requests are accepted); image effect
  acceptance (A20/T11) and error-path coverage (A29) are still open.
- `deepseek-flash` is a reasoning model; a tiny `max_tokens` can be consumed entirely
  by reasoning tokens (observed `finish_reason=length`), so live prompts need a real
  output budget.
