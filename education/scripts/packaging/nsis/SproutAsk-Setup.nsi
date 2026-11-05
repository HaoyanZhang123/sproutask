; SproutAsk 学生版安装器（NSIS 3.10）
; 由 education/scripts/packaging/build-installer.mjs 调用：
;   makensis /DPAYLOAD_DIR=... /DOUTPUT_FILE=... /DVERSION=... /DBUILD_ID=... SproutAsk-Setup.nsi
;
; 设计约束（与 T16-feasibility 一致）：
; - 免管理员：RequestExecutionLevel user，安装到 %LOCALAPPDATA%\SproutAsk
; - 学习数据默认保留在 %LOCALAPPDATA%\SproutAsk\data，卸载时询问是否删除
; - 不捆绑教材原文/页图/密钥（打包白名单由 scan-payload 校验）
; - 未签名：Windows 会提示"未知发布者"，安装说明中如实告知

Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

!ifndef PAYLOAD_DIR
  !error "PAYLOAD_DIR is required"
!endif
!ifndef OUTPUT_FILE
  !define OUTPUT_FILE "SproutAsk-Setup-x64.exe"
!endif
!ifndef VERSION
  !define VERSION "0.0.0"
!endif
!ifndef BUILD_ID
  !define BUILD_ID "unknown"
!endif

!define APP_NAME "SproutAsk"
!define APP_DISPLAY "SproutAsk 生物学习"
!define APP_PUBLISHER "SproutAsk"
!define APP_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\SproutAsk"
!define INSTALL_ROOT "$LOCALAPPDATA\SproutAsk"
!define INSTALL_DIR "$LOCALAPPDATA\SproutAsk\current"
!define DATA_DIR "$LOCALAPPDATA\SproutAsk\data"

Name "${APP_DISPLAY} ${VERSION}"
OutFile "${OUTPUT_FILE}"
InstallDir "${INSTALL_DIR}"
InstallDirRegKey HKCU "${APP_KEY}" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "${APP_DISPLAY}（Powered by DSH）"

VIProductVersion "0.3.0.0"
VIAddVersionKey "ProductName" "${APP_DISPLAY}"
VIAddVersionKey "CompanyName" "${APP_PUBLISHER}"
VIAddVersionKey "FileDescription" "${APP_DISPLAY} 安装程序"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "见安装目录 licenses/NOTICE.md"

!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "${APP_DISPLAY} 安装"
!define MUI_WELCOMEPAGE_TEXT "本程序会把 SproutAsk 安装到你的用户目录（无需管理员权限）。$\r$\n$\r$\n安装完成后可从开始菜单或桌面启动。学习数据默认保存在：$LOCALAPPDATA\SproutAsk\data，卸载时不会自动删除。$\r$\n$\r$\n说明：本安装包未做代码签名，Windows 可能提示“未知发布者”。"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN_TEXT "立即启动 SproutAsk"
; 本版 payload 只带 launcher.cmd（VBS 会被本机 AV 拦，见下方注释）：
; 完成页"立即启动"必须指向真实存在的 launcher.cmd，否则点了静默失败。
!define MUI_FINISHPAGE_RUN "$INSTDIR\launcher.cmd"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  ; payload 结构：node/ app/ licenses/ launcher.cmd launcher.vbs.txt version.txt
  File /r "${PAYLOAD_DIR}\*.*"
  ; 说明：.vbs 会被本机 AV 拦截 makensis 读取，且 FileWrite 转义在 3.10 上易错，
  ; 因此本版不带 VBS，快捷方式直接指向 launcher.cmd（会短暂显示控制台窗口）。


  ; 快捷方式指向 launcher.cmd（本版不带 VBS）
  CreateShortcut "$SMPROGRAMS\SproutAsk.lnk" "$INSTDIR\launcher.cmd" "" "$INSTDIR\launcher.cmd" 0
  CreateShortcut "$DESKTOP\SproutAsk.lnk" "$INSTDIR\launcher.cmd" "" "$INSTDIR\launcher.cmd" 0

  ; 卸载信息（控制面板 → 程序和功能）
  WriteRegStr HKCU "${APP_KEY}" "DisplayName" "${APP_DISPLAY}"
  WriteRegStr HKCU "${APP_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${APP_KEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "${APP_KEY}" "InstallLocation" "$INSTDIR"
  ; 图标必须指向真实存在的文件；launcher.vbs 不在包内，指向它会让"应用和功能"里没有图标。
  WriteRegStr HKCU "${APP_KEY}" "DisplayIcon" "$INSTDIR\launcher.cmd"
  WriteRegStr HKCU "${APP_KEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKCU "${APP_KEY}" "QuietUninstallString" '"$INSTDIR\uninstall.exe" /S'
  WriteRegStr HKCU "${APP_KEY}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${APP_KEY}" "BuildId" "${BUILD_ID}"
  WriteRegDWORD HKCU "${APP_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${APP_KEY}" "NoRepair" 1

  ; 安装时创建数据目录，便于用户找到
  CreateDirectory "${DATA_DIR}"
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; 安装日志（便于核验）
  FileOpen $0 "$INSTDIR\install-info.txt" w
  FileWrite $0 "SproutAsk ${VERSION}$\r$\n"
  FileWrite $0 "build: ${BUILD_ID}$\r$\n"
  FileWrite $0 "installed-to: $INSTDIR$\r$\n"
  FileWrite $0 "data-dir: ${DATA_DIR}$\r$\n"
  FileWrite $0 "installer: NSIS (zlib/libpng)$\r$\n"
  FileWrite $0 "signed: no$\r$\n"
  FileClose $0
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\SproutAsk.lnk"
  Delete "$DESKTOP\SproutAsk.lnk"

  ; 先删程序文件（保留 data 目录）
  RMDir /r "$INSTDIR\node"
  RMDir /r "$INSTDIR\app"
  RMDir /r "$INSTDIR\licenses"
  Delete "$INSTDIR\launcher.cmd"
  Delete "$INSTDIR\launcher.vbs"
  Delete "$INSTDIR\version.txt"
  Delete "$INSTDIR\install-info.txt"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"

  DeleteRegKey HKCU "${APP_KEY}"

  ; 数据目录单独询问（默认保留）
  ${If} ${FileExists} "${DATA_DIR}\*.*"
    MessageBox MB_YESNO|MB_DEFBUTTON2 "是否删除学习数据（教材绑定、作答、证据、复习记录）？$\r$\n$\r$\n位置：${DATA_DIR}$\r$\n选择“否”将保留数据，重新安装后可继续使用。" IDYES deleteData IDNO keepData
    deleteData:
      RMDir /r "${DATA_DIR}"
      Goto dataDone
    keepData:
      DetailPrint "保留学习数据：${DATA_DIR}"
    dataDone:
  ${EndIf}
  ; 若 SproutAsk 根目录已空则删除
  RMDir "$LOCALAPPDATA\SproutAsk"
SectionEnd
