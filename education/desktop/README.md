# SproutAsk 学生包（A1 payload）

构建命令：

```powershell
node education/scripts/packaging/build-student-payload.mjs --dsh-install education/.local/cache/T16/hoisted-test --clean
```

如需保留 DSH 原生图片上传（sharp/libvips，约 +19 MB），加 `--keep-sharp`：

```powershell
node education/scripts/packaging/build-student-payload.mjs --dsh-install education/.local/cache/T16/hoisted-test --clean --keep-sharp
```

默认（5A）裁掉 sharp；此时 DSH 原生图片附件 admission 会 `MODULE_NOT_FOUND`，A20 图片上传需走教育自有图片管线或回加 sharp。详见 `docs/rebuild/reports/T16.md`。

输出：`education/dist/student/`（构建产物，gitignored；安装器按此路径写死）。

## 目录契约（A3 按此复制）

```text
student/
  node/
    node.exe                 # Node 24.x，随包，不要求目标机安装 Node
    LICENSE
  app/
    node_modules/            # hoisted DSH runtime（无 symlink）
      @deepseek-ai/dsh/lib/bin.js
      ...
    runtime/
      host-plugin/lib/index.js           # @edu/education-host
      client-plugin/lib/{index.js,client.js}  # @edu/client-root
      scripts/setup-education-home.mjs   # 首次运行生成 DSH_HOME profiles（junction）
      scripts/start-student-web.mjs      # 启动服务 / 开 Edge / 退出清理
    content/biology-7a/
      pack.json
      source/source-refs.json
      source/course-edition.json
      source/block-index.json
    skills/biology/            # SKILL.md + references
  licenses/                    # A2 产物拷贝（education/licenses）
  launcher.cmd                 # 数据目录、profile 初始化、启动服务
  launcher.vbs                 # 隐藏控制台调用 launcher.cmd（快捷方式指向它）
  version.txt                  # 0.3.0 + git + builtAt + node/content 版本
```

## 裁剪（5A）

移除的包/目录：

- `@deepseek-ai/libreoffice-kit`、`@deepseek-ai/libreoffice-kit-win32-x64`（Office→PDF）
- `@deepseek-ai/dsh-office-to-pdf`、`@deepseek-ai/dsh-skill-office`（依赖 LibreOffice kit）
- `sherpa-onnx-node`、`sherpa-onnx-win-x64`（语音）
- `node-pty`（PTY 终端）
- `sharp`、`@img/*`（DSH 原生图片附件/缩略图）

保留 `@deepseek-ai/dsh-attachment-local`、`dsh-subprocess-local`：即使它们的原生依赖被裁掉，DSH 仍能启动；附件服务对**非图片文件**可用，图片 admission 在缺 `sharp` 时会报 `MODULE_NOT_FOUND`（见 `docs/rebuild/reports/T16.md` 的 sharp 结论）。G3 若必须保留 DSH 原生图片上传，应把 `sharp`/`@img/*` 加回（约 19 MB）或改走教育自有图片管线。

## 原生依赖/系统要求

- 当前裁剪后的 payload 只保留 `@vscode/ripgrep-win32-x64/rg.exe`、`@koromix/koffi-win32-x64/koffi.node`、`node-addon-require-builtin-win32-x64-msvc/prebuilt/win32-x64-msvc-napi-v9.node` 三个原生文件；PE 导入表没有 `VCRUNTIME140*.dll` / `MSVCP140*.dll`，不需要随包 VC++ 2015-2022 redist，只依赖 Windows 10/11 系统 DLL/UCRT。
- 需要 Microsoft Edge（Windows 10/11 自带）；`launcher.cmd` 用 `--app` 打开独立窗口。
- 若改用 `--keep-sharp` 保留 DSH 原生图片上传，需重新检查 sharp/libvips DLL 的 VC++ 导入；当前默认裁剪版不含 sharp。

## 运行数据（免管理员）
- 默认 `%LOCALAPPDATA%\SproutAsk\data`：
  - `dsh-home/`（DSH profiles、会话、凭据）
  - `learner-data/`（教育学习数据）
  - `logs/`（stdout/stderr/runtime.jsonl/launch-meta.json）
  - `edge-profile/`（Edge app 专用 profile）
- 安装目录只读，不写入；卸载删除 `%LOCALAPPDATA%\SproutAsk\current` 不影响 `data/`。
- 测试可用 `SPROUTASK_DATA_ROOT` 覆盖数据根（仅用于验证，不改变正常安装路径）。

## 启动

`launcher.vbs` → `launcher.cmd` → `node.exe app/runtime/scripts/start-student-web.mjs`：

1. 首次运行调用 `setup-education-home.mjs` 生成 `DSH_HOME/profiles/edu-web`（本地插件用 junction 链接到 `app/runtime`）。
2. 选未占用 loopback 端口（排除 Windows excludedportrange 后重试）。
3. 启动固定 DSH web，等待 `dsh web: http://127.0.0.1:<port>/?token=...`。
4. 请求 `/edu/api/status`，确认教育 host 插件与内容包已加载。
5. 用 `msedge.exe --app=<url> --user-data-dir=<data>\edge-profile` 打开窗口；Edge 退出时终止 DSH 子进程树。
6. 无 Key 时 status 为 `degraded`，UI 可离线浏览已有内容，模型调用不可用。

## 给 A3 的输入

- 复制整个 `education/dist/student/` 到 `%LOCALAPPDATA%\SproutAsk\current\`。
- 快捷方式目标：`%LOCALAPPDATA%\SproutAsk\current\launcher.vbs`（无则 `launcher.cmd`）。
- 卸载：删除 `current/`，询问是否保留 `data/`；不要删用户导入的教材原文件。
- 需要的 registry/ARP 显示信息：产品名 `SproutAsk`、版本 `0.3.0`、发布者（待用户/证书决定）。
- 不修改 `launcher.cmd` 的路径契约；A3 只复制，不重写。
