' SproutAsk silent launcher: starts launcher.cmd without a console window.
Option Explicit
Dim fso, shell, here, target
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
target = fso.BuildPath(here, "launcher.cmd")
If Not fso.FileExists(target) Then
  MsgBox "launcher.cmd is missing next to launcher.vbs.", vbCritical, "SproutAsk"
  WScript.Quit 2
End If
shell.CurrentDirectory = fso.GetSpecialFolder(2)
shell.Run """" & target & """", 0, False
