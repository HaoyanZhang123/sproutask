# 芽问 SproutAsk 原生桌面壳（方案 B）

Windows 原生桌面壳：Rust + tao（窗口/事件循环）+ wry / WebView2（内嵌浏览器）。
产物是一个 `SproutAsk.exe`，取代原先 `launcher.cmd` 调 `msedge.exe --app=...` 的窗口形态。

```
education/desktop/host/
├─ Cargo.toml          # crate: sproutask-host / bin: SproutAsk
├─ build.rs            # 把 assets/sproutask.ico 与版本信息嵌进 exe（embed-resource）
├─ assets/
│  └─ sproutask.ico    # 图标唯一来源（exe 资源 + 窗口/任务栏图标都读它）
├─ src/main.rs         # 宿主实现
├─ .gitignore          # /target/ /dist/
└─ README.md
```

## 行为

1. **单实例**：命名互斥量 `Local\SproutAsk.Host`。第二次启动不会新起 node 服务，
   只会找到标题含「芽问」的已有窗口 `ShowWindow(SW_RESTORE)` + `SetForegroundWindow` 后退出。
   这修掉「重复打开 → 日志锁冲突 → 页面显示暂时不能同时进行」的问题。
2. **数据目录**：`SPROUTASK_DATA_ROOT`，否则 `%LOCALAPPDATA%\SproutAsk\data`。
   - `dsh-home\`：DSH profile（首次启动先跑 `setup-education-home.mjs --home <dshHome>`）
   - `logs\`：服务日志（`stdout.log` 里出现 `dsh web: <url>` 即就绪）
   - `webview2\`：WebView2 user data folder
   - `window.json`：窗口位置/大小
3. **启动服务**：用安装目录自带的 `node\node.exe` 运行
   `app\runtime\scripts\start-student-web.mjs --home <dshHome> --out <logs> --no-edge`，
   全程 `CREATE_NO_WINDOW`（不出现控制台黑窗），轮询 `logs\stdout.log` 最多 120 秒。
   子进程环境与 `launcher.cmd` 对齐：清空继承来的 `DEEPSEEK_* / DSH_* / ANTHROPIC_* / OPENAI_*`，
   显式注入 `SPROUTASK_DATA_ROOT / DSH_HOME / EDU_DATA_ROOT / EDU_RUNTIME_LOG`、
   `DSH_DISABLE_UPDATE_CHECK=1`、`DSH_TELEMETRY_DISABLED=1`。
   host 自己不读、不打印任何 API Key；密钥仍由 `start-student-web.mjs` 从
   `<dataRoot>\secrets\model-key.dat` 用 DPAPI 解密。
4. **窗口**：默认 1280×860（逻辑像素），最小 1024×720，标题「芽问」；标题栏/任务栏图标来自
   `assets/sproutask.ico`；`SetCurrentProcessExplicitAppUserModelID("SproutAsk.Desktop")` 保证
   任务栏用产品自己的图标与分组。等待服务期间先显示内嵌的「正在启动芽问」页面。
5. **退出**：关窗时 `taskkill /PID <nodePid> /T /F` 清理整棵 node 进程树，不留孤儿。
6. **失败提示**：安装不完整、首次初始化失败、服务提前退出、120 秒超时、WebView2 创建失败
   都会弹 `MessageBoxW` 中文提示（含日志目录），不会静默退出。

## 构建

本机工具链（已确认）：Rust 1.98.1 MSVC、VS2022 Build Tools（含 Windows SDK `rc.exe`）、
WebView2 Runtime 156、crates 走 rsproxy 镜像（`D:\Runtime\Rust\cargo\config.toml`）。

```powershell
$env:CARGO_HOME = 'D:\Runtime\Rust\cargo'
D:\Runtime\Rust\cargo\bin\cargo.exe build --release --manifest-path `
  E:\DSH\workspaces\ai4edu\education\desktop\host\Cargo.toml
```

产物：`education\desktop\host\target\release\SproutAsk.exe`（release 下 `windows_subsystem = "windows"`，
无控制台窗口；图标/版本信息由 `build.rs` 通过 Windows SDK 的 `rc.exe` 嵌入）。

- **版本号唯一来源是 `education/package.json` 的 `version`**（`build.rs` 读
  `CARGO_MANIFEST_DIR/../../package.json`，读不到才退回 Cargo.toml 的 `package.version`），
  会写进 exe 的 `FileVersion` / `ProductVersion`。`Cargo.toml` 的 `version` 只做 cargo 包版本。
- 打包输入：`education/desktop/host/dist/SproutAsk.exe`（`education/scripts/packaging/build-desktop-host.mjs`
  会把 `target/release/SproutAsk.exe` 复制到这里，NSIS/payload 引用它）。`dist/` 不进 git。

只跑单元测试（纯函数，不需要 GUI；`--release` 复用上面编译好的依赖，约 30s）：

```powershell
D:\Runtime\Rust\cargo\bin\cargo.exe test --release --manifest-path `
  E:\DSH\workspaces\ai4edu\education\desktop\host\Cargo.toml
```

## 本机联调（隔离数据根，不碰真实用户数据）

把安装目录的 `app / node / licenses` 用 junction 链进来，exe 放根目录，数据根指向临时目录：

> ⚠️ junction 测试根有一个已知副作用：`setup-education-home.mjs` 用
> `path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)` 判断是否作为 CLI 运行；
> 经 junction 调用时前者是链接路径、后者是真实路径，两者不等 → 脚本以 0 退出但什么都不做。
> 联调时先用**真实安装路径**跑一次初始化，再启动 host（host 会看到 profile 已存在而跳过 setup）：
>
> ```powershell
> & 'E:\芽问\current\node\node.exe' `
>   'E:\芽问\current\app\runtime\scripts\setup-education-home.mjs' `
>   --home 'E:\DSH\tmp\host-test\data\dsh-home'
> ```

```powershell
$root = 'E:\DSH\tmp\host-test'
New-Item -ItemType Directory -Force $root, "$root\data" | Out-Null
cmd /c mklink /J "$root\app"      'E:\芽问\current\app'
cmd /c mklink /J "$root\node"     'E:\芽问\current\node'
cmd /c mklink /J "$root\licenses" 'E:\芽问\current\licenses'
Copy-Item 'E:\DSH\workspaces\ai4edu\education\desktop\host\target\release\SproutAsk.exe' $root

$env:SPROUTASK_DATA_ROOT = "$root\data"
& "$root\SproutAsk.exe"
```

首次启动会先初始化 `$root\data\dsh-home`（可能需要几十秒，窗口内显示「正在启动芽问」），
日志在 `$root\data\logs\`。

验证点：

```powershell
# 1) 窗口标题
Get-Process SproutAsk | Select-Object Id, MainWindowTitle

# 2) 单实例：再点一次不会新起 node
(Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object CommandLine -like "*host-test*").Count

# 3) 关窗后无 node 残留（关闭 SproutAsk 主窗口后执行）
(Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object CommandLine -like "*host-test*").Count

# 4) 窗口状态文件
Get-Content "$root\data\window.json"
```

## 本机实测结果（2026-11-05，隔离数据根 E:\DSH\tmp\host-test）

- **构建**：`cargo build --release` 成功（最终 crate 4.38s），`dist/SproutAsk.exe` **997,888 字节（0.952 MB）**，
  SHA256 `F8883C142AFC53EE42725BA082863C545E51EA4AE089C153C992E04ACEFBD911`；
  `FileVersion`/`ProductVersion` = **0.4.1**，`FileDescription` = 芽问 SproutAsk（版本读自 `education/package.json`）。
- **窗口/学生界面**：原生窗口标题「芽问」，无控制台黑窗；`SPROUTASK_DATA_ROOT` 隔离根启动后
  `/edu/api/status` 返回 200、`conceptCount=43`、`packVersion=2.0.0`，页面正常渲染
  （截图：`E:\DSH\tmp\host-test\screenshots\host-final-0.4.1.png`）。
- **单实例**：第二次启动退出码 0，宿主进程仍为 1 个，node 进程数前后都是 2 个（没有新起服务）；
  实测已有窗口被 `ShowWindow(SW_RESTORE)`+聚焦（focused=True）。从后台脚本启动时 Windows 前台锁
  可能只允许短暂抢到前台，真实用户双击时不受此限制。
- **关闭清理**：关窗后 `taskkill /T` 生效，`node.exe` 归属进程数 0（多次实测）；宿主退出码正常。
- **失败路径**：把 exe 放进没有 `node\node.exe` 的目录启动 → 弹出中文 MessageBox
  「安装不完整：找不到内置的 Node 运行时。……」+ 确定按钮，关闭后进程退出码 1
  （截图：`screenshots\host-error-dialog.png`）。
- **window.json**：关窗写入 `{width,height,x,y}`（示例 `x=208,y=436,width=1187,height=765` 逻辑像素）；
  重启后 `GetWindowRect` 实测恢复到 `(208,436)` 物理位置、尺寸一致。
- **单元测试**：`cargo test --release` → 2 passed / 0 failed。

## 打包集成要点（Lead）

- 把 `SproutAsk.exe` 放在安装根（与 `launcher.cmd` 同级）；开始菜单/桌面快捷方式指向它，
  `launcher.cmd` 保留作兜底入口。打包脚本取 `desktop/host/dist/SproutAsk.exe`。
- 图标只需替换 `assets/sproutask.ico`，重新 `cargo build --release` 即可同时更新 exe 图标与窗口图标。
- **版本号唯一来源是 `education/package.json`**（见「构建」），改一处就能同步 exe 资源版本；
  NSIS 安装器版本请一并取自同一个值。
- `SetCurrentProcessExplicitAppUserModelID` 用的是 `SproutAsk.Desktop`；如果安装器给快捷方式写了
  别的 AppUserModelID，请同步，否则任务栏可能出现两个分组图标。
- 目标机需要 Microsoft Edge WebView2 Runtime（Win10/11 一般自带；NSIS 可检测
  `HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}`）。
- 单实例聚焦依次尝试 `ShowWindow(SW_RESTORE)` → `SetForegroundWindow` → `AttachThreadInput`
  附到当前前台线程再设前台 → `SwitchToThisWindow` 兜底。正常用户双击启动时 Windows 会给前台权限；
  若从后台脚本/计划任务启动，系统前台锁仍可能只允许"闪一下"，这是 Windows 的限制。

## 已知限制（后续可做）

- 如果用户在任务管理器里直接强杀 `SproutAsk.exe`（非关窗），当前实现依赖启动时把 node 进程树
  记为子进程、关窗时 `taskkill /T`；强杀宿主可能留下 node 子进程。后续可加 Windows Job Object
  （`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`）兜底。
- 页面导航失败/服务启动后中途崩溃不会额外弹原生框（页面自身会显示错误状态），本期只保证
  「服务启动阶段」失败有中文提示。
- 窗口位置/大小只在正常关窗时写盘；最小化/最大化状态不覆盖普通尺寸记录。
- `setup-education-home.mjs` 的 CLI 自检对"经 junction/符号链接调用"不健壮（见联调注意事项）：
  真实安装目录没有这个问题；若以后 payload 用链接方式部署，需要把它改成 `realpath` 比较或
  直接按 `--home` 参数执行。
