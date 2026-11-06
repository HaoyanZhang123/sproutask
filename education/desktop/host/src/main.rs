//! 芽问 SproutAsk 原生桌面壳（Windows / WebView2）。
//!
//! 取代原先 `Edge --app` 窗口：
//! 1. 单实例互斥量：重复启动只把已有窗口抬到前台，不再起第二个 node 服务。
//! 2. 启动安装目录自带的 node 服务（首次先初始化 DSH profile），轮询日志拿到本地 URL。
//! 3. 用 WebView2 在原生窗口里显示学生端页面；窗口位置/大小写入 `<dataRoot>\window.json`。
//! 4. 关窗时清理 node 进程树；启动失败时弹中文错误框（含日志路径）。
//!
//! 本程序不读取、不打印任何 API Key；密钥由 `start-student-web.mjs` 从
//! `<dataRoot>\secrets\model-key.dat` 用 DPAPI 解密。

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    env, fs,
    io::Cursor,
    os::windows::process::CommandExt,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU32, Ordering},
        Arc, OnceLock,
    },
    thread,
    time::{Duration, Instant},
};

use tao::{
    dpi::{LogicalSize, PhysicalPosition},
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoopBuilder, EventLoopProxy},
    window::{Icon, Window, WindowBuilder},
};
use windows::{
    core::{BOOL, PCWSTR},
    Win32::{
        Foundation::{
            CloseHandle, GetLastError, SetLastError, ERROR_ALREADY_EXISTS, HANDLE, HWND, LPARAM,
            WIN32_ERROR,
        },
        System::{
            JobObjects::{
                AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
                SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
                JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
            },
            Threading::{
                AttachThreadInput, CreateMutexW, GetCurrentThreadId, OpenProcess, PROCESS_SET_QUOTA,
                PROCESS_TERMINATE,
            },
        },
        UI::{
            Shell::SetCurrentProcessExplicitAppUserModelID,
            WindowsAndMessaging::{
                BringWindowToTop, EnumWindows, GetForegroundWindow, GetSystemMetrics,
                GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible, MessageBoxW,
                SetForegroundWindow, ShowWindow, SwitchToThisWindow, MB_ICONERROR, MB_OK,
                SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
                SW_RESTORE,
            },
        },
    },
};
use wry::{WebContext, WebViewBuilder};

const APP_TITLE: &str = "芽问";
const APP_USER_MODEL_ID: &str = "SproutAsk.Desktop";
const SINGLE_INSTANCE_MUTEX: &str = "Local\\SproutAsk.Host";
const WINDOW_STATE_FILE: &str = "window.json";

const DEFAULT_WIDTH: f64 = 1280.0;
const DEFAULT_HEIGHT: f64 = 860.0;
const MIN_WIDTH: f64 = 1024.0;
const MIN_HEIGHT: f64 = 720.0;

/// CREATE_NO_WINDOW: 不给 node 子进程分配控制台窗口。
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const SERVICE_TIMEOUT: Duration = Duration::from_secs(120);
const POLL_INTERVAL: Duration = Duration::from_millis(250);
const MAX_LOG_TAIL_CHARS: usize = 1600;

const LOADING_HTML: &str = r#"<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>芽问</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; align-items: center; justify-content: center;
    background: #f7f8f4;
    color: #24402f;
    font-family: "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif;
    user-select: none;
  }
  .box { display: flex; flex-direction: column; align-items: center; gap: 18px; transform: translateY(-4vh); }
  .sprout { width: 54px; height: 54px; border-radius: 16px; background: #2f7a4f; position: relative; animation: breathe 1.6s ease-in-out infinite; }
  .sprout::before { content: ""; position: absolute; left: 24px; top: 13px; width: 6px; height: 27px; border-radius: 3px; background: #f6f8f2; }
  .sprout::after { content: ""; position: absolute; left: 13px; top: 17px; width: 13px; height: 17px; border-radius: 10px 3px 10px 3px; background: #d8ead9; transform: rotate(-26deg); }
  h1 { font-size: 20px; font-weight: 600; letter-spacing: 2px; margin: 0; }
  p { font-size: 13px; color: #6b7f70; margin: 0; }
  @keyframes breathe { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(.88); opacity: .82; } }
</style>
</head>
<body>
  <div class="box">
    <div class="sprout"></div>
    <h1>正在启动芽问</h1>
    <p>首次启动需要初始化本地学习环境，请稍候</p>
  </div>
</body>
</html>
"#;

const ICON_BYTES: &[u8] = include_bytes!("../assets/sproutask.ico");

fn main() {
    if let Err(error) = run() {
        show_error(&error.0);
        std::process::exit(1);
    }
}

struct AppError(String);

impl AppError {
    fn new(message: impl Into<String>) -> Self {
        Self(message.into())
    }
}

#[derive(Debug)]
enum UserEvent {
    ServiceReady(String),
    ServiceFailed(String),
}

// ---------------------------------------------------------------------------
// 单实例
// ---------------------------------------------------------------------------

struct InstanceMutex {
    /// 进程存活期间必须一直持有这个句柄（不 CloseHandle），互斥量才不会被释放。
    _handle: HANDLE,
    already_running: bool,
}

fn acquire_instance_mutex() -> InstanceMutex {
    let name = to_wide(SINGLE_INSTANCE_MUTEX);
    unsafe {
        // windows crate 的包装函数不会清 last error，先清掉再创建，避免误判。
        SetLastError(WIN32_ERROR(0));
        match CreateMutexW(None, true, PCWSTR(name.as_ptr())) {
            Ok(handle) => InstanceMutex {
                _handle: handle,
                already_running: GetLastError() == ERROR_ALREADY_EXISTS,
            },
            // 极少数情况下创建互斥量失败：不做单实例保护，但也不要因此挡住启动。
            Err(_) => InstanceMutex {
                _handle: HANDLE(std::ptr::null_mut()),
                already_running: false,
            },
        }
    }
}

/// 找到标题含「芽问」的可见顶层窗口，恢复并抬到前台。
fn activate_existing_window(timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    loop {
        if let Some(hwnd) = find_window_by_title(APP_TITLE) {
            force_window_to_front(hwnd);
            return true;
        }
        if Instant::now() >= deadline {
            return false;
        }
        thread::sleep(Duration::from_millis(200));
    }
}

/// 把已有窗口恢复并抬到前台。
///
/// Windows 的前台锁会拒绝后台进程直接 `SetForegroundWindow`，这里依次尝试
/// `SetForegroundWindow` → `AttachThreadInput`（临时附到当前前台线程）→
/// `SwitchToThisWindow`，尽量保证第二次启动真的把窗口带到用户眼前。
fn force_window_to_front(hwnd: HWND) {
    unsafe {
        let _ = ShowWindow(hwnd, SW_RESTORE);
        let _ = SetForegroundWindow(hwnd);

        if GetForegroundWindow() == hwnd {
            return;
        }

        let foreground = GetForegroundWindow();
        if !foreground.is_invalid() {
            let foreground_thread = GetWindowThreadProcessId(foreground, None);
            let current_thread = GetCurrentThreadId();
            if foreground_thread != 0 && foreground_thread != current_thread {
                if AttachThreadInput(current_thread, foreground_thread, true).as_bool() {
                    let _ = BringWindowToTop(hwnd);
                    let _ = SetForegroundWindow(hwnd);
                    let _ = AttachThreadInput(current_thread, foreground_thread, false);
                }
            }
        }

        if GetForegroundWindow() != hwnd {
            SwitchToThisWindow(hwnd, true);
        }
    }
}

fn find_window_by_title(needle: &str) -> Option<HWND> {
    struct Search {
        needle: String,
        found: HWND,
    }

    unsafe extern "system" fn callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let search = &mut *(lparam.0 as *mut Search);
        if IsWindowVisible(hwnd).as_bool() {
            let mut buffer = [0u16; 256];
            let len = GetWindowTextW(hwnd, &mut buffer);
            if len > 0 {
                let title = String::from_utf16_lossy(&buffer[..len as usize]);
                if title.contains(search.needle.as_str()) {
                    search.found = hwnd;
                    return BOOL(0); // 停止枚举
                }
            }
        }
        BOOL(1)
    }

    let mut search = Search {
        needle: needle.to_string(),
        found: HWND::default(),
    };
    unsafe {
        let _ = EnumWindows(Some(callback), LPARAM(&mut search as *mut Search as isize));
    }
    if search.found.is_invalid() {
        None
    } else {
        Some(search.found)
    }
}

// ---------------------------------------------------------------------------
// 安装/数据路径
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct Config {
    install_root: PathBuf,
    node_exe: PathBuf,
    setup_script: PathBuf,
    start_script: PathBuf,
    data_root: PathBuf,
    dsh_home: PathBuf,
    logs: PathBuf,
    webview_dir: PathBuf,
    window_json: PathBuf,
}

impl Config {
    fn discover() -> Result<Self, AppError> {
        let exe = env::current_exe()
            .map_err(|error| AppError::new(format!("无法定位程序自身路径：{error}")))?;
        let install_root = exe
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| AppError::new("无法定位程序所在目录。"))?;

        let node_exe = install_root.join("node").join("node.exe");
        let setup_script = install_root
            .join("app")
            .join("runtime")
            .join("scripts")
            .join("setup-education-home.mjs");
        let start_script = install_root
            .join("app")
            .join("runtime")
            .join("scripts")
            .join("start-student-web.mjs");

        if !node_exe.is_file() {
            return Err(AppError::new(format!(
                "安装不完整：找不到内置的 Node 运行时。\n\n{}\n\n请重新安装「芽问」。",
                node_exe.display()
            )));
        }
        if !start_script.is_file() {
            return Err(AppError::new(format!(
                "安装不完整：找不到本地服务启动脚本。\n\n{}\n\n请重新安装「芽问」。",
                start_script.display()
            )));
        }

        let data_root = match env::var("SPROUTASK_DATA_ROOT") {
            Ok(value) if !value.trim().is_empty() => PathBuf::from(value),
            _ => {
                let local_app_data = env::var("LOCALAPPDATA").map_err(|_| {
                    AppError::new("无法确定用户数据目录：环境变量 LOCALAPPDATA 不存在。")
                })?;
                PathBuf::from(local_app_data)
                    .join("SproutAsk")
                    .join("data")
            }
        };

        let dsh_home = data_root.join("dsh-home");
        let logs = data_root.join("logs");
        let webview_dir = data_root.join("webview2");
        for dir in [&data_root, &dsh_home, &logs, &webview_dir] {
            fs::create_dir_all(dir).map_err(|error| {
                AppError::new(format!("无法创建数据目录：\n{}\n\n{}", dir.display(), error))
            })?;
        }

        Ok(Self {
            install_root,
            node_exe,
            setup_script,
            start_script,
            data_root: data_root.clone(),
            dsh_home,
            logs,
            webview_dir,
            window_json: data_root.join(WINDOW_STATE_FILE),
        })
    }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

fn run() -> Result<(), AppError> {
    // 任务栏分组与图标：必须在建窗口前设置。
    unsafe {
        let app_id = to_wide(APP_USER_MODEL_ID);
        let _ = SetCurrentProcessExplicitAppUserModelID(PCWSTR(app_id.as_ptr()));
    }
    // 进程级 Job Object：宿主哪怕被任务管理器/崩溃强杀，node 子进程也会随句柄关闭被杀，
    // 不会再留下占着日志锁的孤儿进程（那会让下一次启动白屏）。
    init_service_job();

    let instance = acquire_instance_mutex();
    if instance.already_running {
        if activate_existing_window(Duration::from_secs(10)) {
            return Ok(());
        }
        return Err(AppError::new(
            "芽问已经在运行，但暂时找不到它的窗口。\n\n请稍候再试；如果界面一直没有出现，\
             可以在任务管理器中结束 SproutAsk.exe 后重新打开。",
        ));
    }

    let config = Config::discover()?;

    let event_loop = EventLoopBuilder::<UserEvent>::with_user_event().build();
    let proxy = event_loop.create_proxy();

    let saved_state = WindowState::load(&config.window_json);
    let window = build_window(&event_loop, saved_state)?;

    let mut web_context = WebContext::new(Some(config.webview_dir.clone()));
    let webview = WebViewBuilder::new_with_web_context(&mut web_context)
        .with_html(LOADING_HTML)
        .with_background_color((247, 248, 244, 255))
        .build(&window)
        .map_err(|error| {
            AppError::new(format!(
                "无法创建内嵌浏览器视图：{error}\n\n请确认这台电脑已安装 Microsoft Edge WebView2 运行时。"
            ))
        })?;

    let pid_slot = Arc::new(AtomicU32::new(0));
    let closing = Arc::new(AtomicBool::new(false));
    start_service_thread(
        proxy,
        config.clone(),
        Arc::clone(&pid_slot),
        Arc::clone(&closing),
    );

    let window_json = config.window_json.clone();
    let logs_dir = config.logs.clone();

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;

        // 让 WebContext 的存活期覆盖整个事件循环（wry 文档要求与 WebView 同时保留）。
        let _keep_context_alive = &web_context;

        match event {
            Event::UserEvent(UserEvent::ServiceReady(url)) => {
                let _ = webview.load_url(&url);
            }
            Event::UserEvent(UserEvent::ServiceFailed(message)) => {
                closing.store(true, Ordering::SeqCst);
                kill_process_tree(pid_slot.load(Ordering::SeqCst));
                show_error(&format!(
                    "芽问没能启动本地学习服务。\n\n{message}\n\n日志位置：{}",
                    logs_dir.display()
                ));
                *control_flow = ControlFlow::Exit;
            }
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => {
                closing.store(true, Ordering::SeqCst);
                WindowState::save(&window, &window_json);
                kill_process_tree(pid_slot.load(Ordering::SeqCst));
                *control_flow = ControlFlow::Exit;
            }
            _ => {}
        }
    });
}

fn build_window(
    event_loop: &tao::event_loop::EventLoop<UserEvent>,
    saved_state: Option<WindowState>,
) -> Result<Window, AppError> {
    let mut builder = WindowBuilder::new()
        .with_title(APP_TITLE)
        .with_inner_size(LogicalSize::new(DEFAULT_WIDTH, DEFAULT_HEIGHT))
        .with_min_inner_size(LogicalSize::new(MIN_WIDTH, MIN_HEIGHT));

    if let Some(icon) = load_window_icon() {
        builder = builder.with_window_icon(Some(icon));
    }

    let restored = saved_state.filter(WindowState::is_usable);
    if let Some(state) = restored {
        builder = builder.with_inner_size(LogicalSize::new(state.width, state.height));
    }

    let window = builder
        .build(event_loop)
        .map_err(|error| AppError::new(format!("无法创建应用窗口：{error}")))?;

    match restored {
        Some(state) => {
            window.set_outer_position(PhysicalPosition::new(state.x, state.y));
        }
        None => center_window(&window),
    }

    Ok(window)
}

fn center_window(window: &Window) {
    let (monitor_x, monitor_y, monitor_width, monitor_height) = match window.current_monitor() {
        Some(monitor) => {
            let position = monitor.position();
            let size = monitor.size();
            (
                position.x,
                position.y,
                size.width as i32,
                size.height as i32,
            )
        }
        None => {
            let screen_width = unsafe {
                GetSystemMetrics(windows::Win32::UI::WindowsAndMessaging::SM_CXSCREEN)
            };
            let screen_height = unsafe {
                GetSystemMetrics(windows::Win32::UI::WindowsAndMessaging::SM_CYSCREEN)
            };
            (0, 0, screen_width, screen_height)
        }
    };

    let inner = window.inner_size();
    let x = monitor_x + (monitor_width - inner.width as i32) / 2;
    let y = monitor_y + (monitor_height - inner.height as i32) / 2;
    window.set_outer_position(PhysicalPosition::new(x, y));
}

fn load_window_icon() -> Option<Icon> {
    let directory = ico::IconDir::read(Cursor::new(ICON_BYTES)).ok()?;
    let entry = directory
        .entries()
        .iter()
        .max_by_key(|entry| entry.width())?;
    let image = entry.decode().ok()?;
    Icon::from_rgba(image.rgba_data().to_vec(), image.width(), image.height()).ok()
}

// ---------------------------------------------------------------------------
// 服务启动（后台线程）
// ---------------------------------------------------------------------------

fn start_service_thread(
    proxy: EventLoopProxy<UserEvent>,
    config: Config,
    pid_slot: Arc<AtomicU32>,
    closing: Arc<AtomicBool>,
) {
    thread::spawn(move || match run_service(&config, &pid_slot, &closing) {
        Ok(url) => {
            let _ = proxy.send_event(UserEvent::ServiceReady(url));
        }
        Err(message) => {
            if !closing.load(Ordering::SeqCst) {
                let _ = proxy.send_event(UserEvent::ServiceFailed(message));
            }
        }
    });
}

fn run_service(
    config: &Config,
    pid_slot: &AtomicU32,
    closing: &AtomicBool,
) -> Result<String, String> {
    ensure_profile(config, pid_slot, closing)?;
    if closing.load(Ordering::SeqCst) {
        return Err("启动已取消。".to_string());
    }

    // 清掉旧的 stdout.log，避免把上一次的 URL 当成这一次的。
    for name in ["stdout.log", "stderr.log", "launch-meta.json"] {
        let _ = fs::remove_file(config.logs.join(name));
    }

    let host_stdout = create_log_file(&config.logs.join("host-service.stdout.log"))?;
    let host_stderr = create_log_file(&config.logs.join("host-service.stderr.log"))?;

    let mut command = Command::new(&config.node_exe);
    command
        .arg(&config.start_script)
        .arg("--home")
        .arg(&config.dsh_home)
        .arg("--out")
        .arg(&config.logs)
        .arg("--no-edge")
        .current_dir(&config.data_root)
        .stdin(Stdio::null())
        .stdout(Stdio::from(host_stdout))
        .stderr(Stdio::from(host_stderr))
        .creation_flags(CREATE_NO_WINDOW);
    configure_child_env(&mut command, config);

    let mut child = command
        .spawn()
        .map_err(|error| format!("无法启动本地服务进程：{error}"))?;
    let pid = child.id();
    pid_slot.store(pid, Ordering::SeqCst);
    assign_service_job(pid);

    if closing.load(Ordering::SeqCst) {
        kill_process_tree(pid);
        pid_slot.store(0, Ordering::SeqCst);
        return Err("启动已取消。".to_string());
    }

    let stdout_log = config.logs.join("stdout.log");
    let deadline = Instant::now() + SERVICE_TIMEOUT;

    loop {
        if closing.load(Ordering::SeqCst) {
            kill_process_tree(pid);
            pid_slot.store(0, Ordering::SeqCst);
            return Err("启动已取消。".to_string());
        }

        if let Some(url) = read_web_url(&stdout_log) {
            // 成功后保留 pid：关窗时按它清理整棵进程树。
            return Ok(url);
        }

        if let Ok(Some(status)) = child.try_wait() {
            pid_slot.store(0, Ordering::SeqCst);
            let stderr_tail = tail_text(&config.logs.join("host-service.stderr.log"));
            let stdout_tail = tail_text(&stdout_log);
            let detail = if stderr_tail.is_empty() {
                stdout_tail
            } else {
                stderr_tail
            };
            let code = status
                .code()
                .map(|code| code.to_string())
                .unwrap_or_else(|| "未知".to_string());
            return Err(format!(
                "本地服务提前退出（退出码 {code}）。{}{}",
                if detail.is_empty() { "" } else { "\n\n" },
                detail
            ));
        }

        if Instant::now() >= deadline {
            kill_process_tree(pid);
            pid_slot.store(0, Ordering::SeqCst);
            return Err(format!(
                "等待本地服务就绪超时（{} 秒）。",
                SERVICE_TIMEOUT.as_secs()
            ));
        }

        thread::sleep(POLL_INTERVAL);
    }
}

fn ensure_profile(
    config: &Config,
    pid_slot: &AtomicU32,
    closing: &AtomicBool,
) -> Result<(), String> {
    let profile_dir = config.dsh_home.join("profiles").join("edu-web");
    let marker = profile_dir.join("package.json");
    let fingerprint_file = profile_dir.join(".sproutask-setup");

    // 初始化脚本（以及随包版本）变了，就把 profile 重新生成一遍：
    // 老用户的 profile 可能是旧模板写的（例如 DSH 自带聊天 UI 没被禁用，会把
    // 状态栏/token 指标漏进学生界面）。只认"文件在"会永远不更新。
    let fingerprint = profile_fingerprint(config);
    if marker.is_file() {
        let stored = fs::read_to_string(&fingerprint_file).unwrap_or_default();
        if stored.trim() == fingerprint {
            return Ok(());
        }
    }

    fs::create_dir_all(&config.dsh_home).map_err(|error| {
        format!(
            "无法创建数据目录：{}\n{error}",
            config.dsh_home.display()
        )
    })?;

    if !config.setup_script.is_file() {
        return Err(format!(
            "安装不完整：找不到首次初始化脚本。\n{}",
            config.setup_script.display()
        ));
    }

    let setup_stdout_path = config.logs.join("setup.log");
    let setup_stderr_path = config.logs.join("setup.stderr.log");
    let setup_stdout = create_log_file(&setup_stdout_path)?;
    let setup_stderr = create_log_file(&setup_stderr_path)?;

    let mut command = Command::new(&config.node_exe);
    command
        .arg(&config.setup_script)
        .arg("--home")
        .arg(&config.dsh_home)
        .current_dir(&config.install_root)
        .stdin(Stdio::null())
        .stdout(Stdio::from(setup_stdout))
        .stderr(Stdio::from(setup_stderr))
        .creation_flags(CREATE_NO_WINDOW);
    configure_child_env(&mut command, config);

    let mut child = command
        .spawn()
        .map_err(|error| format!("无法启动首次初始化进程：{error}"))?;
    let pid = child.id();
    pid_slot.store(pid, Ordering::SeqCst);

    if closing.load(Ordering::SeqCst) {
        kill_process_tree(pid);
        pid_slot.store(0, Ordering::SeqCst);
        return Err("启动已取消。".to_string());
    }

    let status = child
        .wait()
        .map_err(|error| format!("首次初始化进程异常结束：{error}"))?;
    pid_slot.store(0, Ordering::SeqCst);

    if !status.success() {
        let stderr_tail = tail_text(&setup_stderr_path);
        let stdout_tail = tail_text(&setup_stdout_path);
        let detail = if stderr_tail.is_empty() {
            stdout_tail
        } else {
            stderr_tail
        };
        return Err(format!(
            "首次初始化失败（退出码 {}）。{}{}\n\n日志：{}",
            status
                .code()
                .map(|code| code.to_string())
                .unwrap_or_else(|| "未知".to_string()),
            if detail.is_empty() { "" } else { "\n\n" },
            detail,
            config.logs.display()
        ));
    }

    if !marker.is_file() {
        return Err(format!(
            "首次初始化结束，但没有生成学习环境配置：\n{}",
            marker.display()
        ));
    }

    // 记住这次 profile 是用哪版模板生成的；下次启动模板变了会自动重跑。
    let _ = fs::write(&fingerprint_file, format!("{fingerprint}\n"));

    Ok(())
}

/// 初始化模板指纹：setup 脚本内容 + 随包版本号。只看"package.json 存在"
/// 会让旧模板生成的 profile 永远不更新（漏禁用的 UI 插件就一直在）。
fn profile_fingerprint(config: &Config) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    if let Ok(bytes) = fs::read(&config.setup_script) {
        bytes.hash(&mut hasher);
    }
    let version_file = config.install_root.join("version.txt");
    if let Ok(text) = fs::read_to_string(&version_file) {
        text.hash(&mut hasher);
    }
    format!("{:016x}", hasher.finish())
}

/// 和 `launcher.cmd` 对齐：清理开发环境里的内部变量，并显式注入产品需要的环境。
fn configure_child_env(command: &mut Command, config: &Config) {
    for (name, _) in env::vars_os() {
        if let Some(name) = name.to_str() {
            let internal = ["DEEPSEEK_", "DSH_", "ANTHROPIC_", "OPENAI_"]
                .iter()
                .any(|prefix| name.starts_with(prefix));
            if internal {
                command.env_remove(name);
            }
        }
    }

    command
        .env("SPROUTASK_DATA_ROOT", &config.data_root)
        .env("DSH_HOME", &config.dsh_home)
        .env("EDU_DATA_ROOT", config.data_root.join("learner-data"))
        .env("EDU_RUNTIME_LOG", config.logs.join("runtime.jsonl"))
        .env("DSH_DISABLE_UPDATE_CHECK", "1")
        .env("DSH_TELEMETRY_DISABLED", "1");
}

fn create_log_file(path: &Path) -> Result<fs::File, String> {
    fs::File::create(path)
        .map_err(|error| format!("无法写入日志文件：{}\n{error}", path.display()))
}

fn read_web_url(path: &Path) -> Option<String> {
    let bytes = fs::read(path).ok()?;
    parse_web_url(&String::from_utf8_lossy(&bytes))
}

fn parse_web_url(text: &str) -> Option<String> {
    text.lines().find_map(|line| {
        let line = line.trim();
        let rest = line.strip_prefix("dsh web:")?.trim();
        if rest.starts_with("http://") || rest.starts_with("https://") {
            Some(rest.to_string())
        } else {
            None
        }
    })
}

fn tail_text(path: &Path) -> String {
    let Ok(bytes) = fs::read(path) else {
        return String::new();
    };
    let text = String::from_utf8_lossy(&bytes);
    let chars: Vec<char> = text.chars().collect();
    let start = chars.len().saturating_sub(MAX_LOG_TAIL_CHARS);
    chars[start..].iter().collect::<String>().trim().to_string()
}

// ---------------------------------------------------------------------------
// 子进程兜底：Job Object（宿主被强杀时一起杀掉 node）
// ---------------------------------------------------------------------------

static SERVICE_JOB: OnceLock<isize> = OnceLock::new();

/// Job Object 的 KILL_ON_JOB_CLOSE 只在最后一个句柄关闭时生效；句柄挂在静态里，
/// 进程无论怎么退出（正常关窗、崩溃、任务管理器强杀）都会关闭它并杀掉 node 子树。
fn init_service_job() {
    unsafe {
        let Ok(job) = CreateJobObjectW(None, PCWSTR::null()) else {
            return;
        };
        let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let configured = SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const core::ffi::c_void,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        if configured.is_ok() {
            let _ = SERVICE_JOB.set(job.0 as isize);
        }
    }
}

fn assign_service_job(pid: u32) {
    let Some(raw) = SERVICE_JOB.get().copied() else {
        return;
    };
    let job = HANDLE(raw as *mut core::ffi::c_void);
    unsafe {
        let Ok(process) = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, false, pid) else {
            return;
        };
        let _ = AssignProcessToJobObject(job, process);
        let _ = CloseHandle(process);
    }
}

fn kill_process_tree(pid: u32) {
    if pid == 0 {
        return;
    }

    let system_root = env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
    let taskkill = Path::new(&system_root)
        .join("System32")
        .join("taskkill.exe");
    let taskkill = if taskkill.is_file() {
        taskkill
    } else {
        PathBuf::from("taskkill")
    };

    let _ = Command::new(taskkill)
        .arg("/PID")
        .arg(pid.to_string())
        .arg("/T")
        .arg("/F")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW)
        .status();
}

// ---------------------------------------------------------------------------
// 窗口位置/大小
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, Debug)]
struct WindowState {
    /// 逻辑像素（与 DPI 无关），适合跨不同缩放比例恢复。
    width: f64,
    height: f64,
    /// 物理像素屏幕坐标。
    x: i32,
    y: i32,
}

impl WindowState {
    fn load(path: &Path) -> Option<Self> {
        let text = fs::read_to_string(path).ok()?;
        let value: serde_json::Value = serde_json::from_str(&text).ok()?;

        let width = number(value.get("width")?)?;
        let height = number(value.get("height")?)?;
        let x = number(value.get("x")?)? as i32;
        let y = number(value.get("y")?)? as i32;

        if !(MIN_WIDTH..=6000.0).contains(&width) || !(MIN_HEIGHT..=6000.0).contains(&height) {
            return None;
        }

        Some(Self {
            width,
            height,
            x,
            y,
        })
    }

    /// 越界（比如换了显示器/分辨率）时回正到居中。
    fn is_usable(&self) -> bool {
        let (vx, vy, vw, vh) = virtual_screen();
        let min_x = vx - self.width as i32 + 200;
        let max_x = vx + vw - 200;
        let min_y = vy - 20;
        let max_y = vy + vh - 120;
        self.x > min_x && self.x < max_x && self.y > min_y && self.y < max_y
    }

    fn save(window: &Window, path: &Path) {
        if window.is_minimized() || window.is_maximized() {
            return;
        }

        let Ok(position) = window.outer_position() else {
            return;
        };
        let size = window.inner_size();
        let scale = window.scale_factor();

        let value = serde_json::json!({
            "schemaVersion": 1,
            "width": round2(size.width as f64 / scale),
            "height": round2(size.height as f64 / scale),
            "x": position.x,
            "y": position.y,
        });

        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(text) = serde_json::to_string_pretty(&value) {
            let _ = fs::write(path, format!("{text}\n"));
        }
    }
}

fn number(value: &serde_json::Value) -> Option<f64> {
    value
        .as_f64()
        .or_else(|| value.as_i64().map(|number| number as f64))
}

fn round2(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn virtual_screen() -> (i32, i32, i32, i32) {
    unsafe {
        (
            GetSystemMetrics(SM_XVIRTUALSCREEN),
            GetSystemMetrics(SM_YVIRTUALSCREEN),
            GetSystemMetrics(SM_CXVIRTUALSCREEN),
            GetSystemMetrics(SM_CYVIRTUALSCREEN),
        )
    }
}

// ---------------------------------------------------------------------------
// Win32 小工具
// ---------------------------------------------------------------------------

fn to_wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}

fn show_error(message: &str) {
    let text = to_wide(message);
    let caption = to_wide(APP_TITLE);
    unsafe {
        MessageBoxW(
            None,
            PCWSTR(text.as_ptr()),
            PCWSTR(caption.as_ptr()),
            MB_OK | MB_ICONERROR,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_web_url_from_launcher_log() {
        let log = "booting\nsome line\ndsh web: http://127.0.0.1:51234/?token=abc\n";
        assert_eq!(
            parse_web_url(log).as_deref(),
            Some("http://127.0.0.1:51234/?token=abc")
        );
        assert_eq!(parse_web_url("dsh web: not-a-url\n"), None);
        assert_eq!(parse_web_url("no url here\n"), None);
    }

    #[test]
    fn rejects_window_states_with_absurd_sizes() {
        let state = WindowState {
            width: 200.0,
            height: 200.0,
            x: 10,
            y: 10,
        };
        assert!(!(MIN_WIDTH..=6000.0).contains(&state.width));
    }
}
