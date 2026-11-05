//! Embed the SproutAsk icon and version information into `SproutAsk.exe`.
//!
//! The icon is also decoded at runtime for the window/taskbar icon; keep
//! `assets/sproutask.ico` as the single source of truth.

use std::{env, fs, path::PathBuf};

fn main() {
    println!("cargo:rerun-if-changed=assets/sproutask.ico");
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=../../package.json");

    if env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return;
    }

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR"));

    // 版本唯一来源：education/package.json（host → desktop → education）。
    // 读不到时退回 Cargo.toml 的 package.version。
    let version = education_version(&manifest_dir)
        .or_else(|| env::var("CARGO_PKG_VERSION").ok())
        .unwrap_or_else(|| "0.4.0".to_string());
    let mut parts = version.split('.').map(|part| part.parse::<u32>().unwrap_or(0));
    let major = parts.next().unwrap_or(0);
    let minor = parts.next().unwrap_or(0);
    let patch = parts.next().unwrap_or(0);

    let icon_path = manifest_dir.join("assets").join("sproutask.ico");
    let icon_literal = icon_path.display().to_string().replace('\\', "\\\\");

    let rc = format!(
        r#"#pragma code_page(65001)
1 ICON "{icon_literal}"

1 VERSIONINFO
FILEVERSION {major},{minor},{patch},0
PRODUCTVERSION {major},{minor},{patch},0
FILEOS 0x00040004L
FILETYPE 0x00000001L
BEGIN
  BLOCK "StringFileInfo"
  BEGIN
    BLOCK "080404b0"
    BEGIN
      VALUE "CompanyName", "SproutAsk"
      VALUE "FileDescription", "芽问 SproutAsk"
      VALUE "FileVersion", "{version}"
      VALUE "InternalName", "SproutAsk"
      VALUE "LegalCopyright", "Copyright (C) SproutAsk"
      VALUE "OriginalFilename", "SproutAsk.exe"
      VALUE "ProductName", "芽问 SproutAsk"
      VALUE "ProductVersion", "{version}"
    END
  END
  BLOCK "VarFileInfo"
  BEGIN
    VALUE "Translation", 0x0804, 1200
  END
END
"#
    );

    let rc_path = out_dir.join("sproutask.rc");
    fs::write(&rc_path, rc).expect("write generated .rc");
    embed_resource::compile(&rc_path, embed_resource::NONE)
        .manifest_optional()
        .expect("embed Windows icon/version resources");
}

/// 从 `education/package.json` 里读取 workspace 版本号（不引入额外依赖）。
fn education_version(manifest_dir: &PathBuf) -> Option<String> {
    let path = manifest_dir.parent()?.parent()?.join("package.json");
    let text = fs::read_to_string(path).ok()?;
    let key = "\"version\"";
    let after_key = &text[text.find(key)? + key.len()..];
    let after_colon = &after_key[after_key.find(':')? + 1..];
    let after_quote = &after_colon[after_colon.find('"')? + 1..];
    let end = after_quote.find('"')?;
    let version = after_quote[..end].trim();
    if version.is_empty() {
        None
    } else {
        Some(version.to_string())
    }
}
