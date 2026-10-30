/**
 * Engine / binary / license inventory for T16 packaging (T03 step 5).
 *
 * The importer deliberately adds no third-party runtime dependencies: PDF
 * parsing uses Node built-ins, OCR uses Windows system components. This module
 * is the machine-readable list T16 must verify inside the packaged app and in
 * an environment without a developer PATH (A05 L5).
 */

import { PARSER_VERSION } from './import/types.js';
import type { OcrAvailability, OcrOptions } from './import/types.js';

export type MaterialKind = 'os-component' | 'node-builtin' | 'bundled-script' | 'os-language-pack';

export interface EngineMaterial {
  readonly name: string;
  readonly kind: MaterialKind;
  readonly required: boolean;
  readonly usedFor: string;
  readonly license: string;
  readonly redistributable: boolean;
  /** How T16/T17 can prove the component exists on the target machine. */
  readonly detection: string;
  readonly notes: string;
}

export const ENGINE_MATERIALS: readonly EngineMaterial[] = [
  {
    name: 'Windows.Data.Pdf (WinRT)',
    kind: 'os-component',
    required: true,
    usedFor: 'rendering PDF pages to images for scanned pages and page thumbnails',
    license: 'Windows OS component; usable by installed apps, not redistributable separately',
    redistributable: false,
    detection: 'powershell -NoProfile -Command "[Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType=WindowsRuntime] | Out-Null; \'ok\'"',
    notes: 'Available on Windows 10 1809+; no installer, no PATH entry.',
  },
  {
    name: 'Windows.Media.Ocr (WinRT)',
    kind: 'os-component',
    required: true,
    usedFor: 'OCR of scanned pages when no text layer exists',
    license: 'Windows OS component; not redistributable separately',
    redistributable: false,
    detection: 'scripts/winrt-ocr.ps1 -Probe -Language zh-Hans-CN (prints JSON availability)',
    notes: 'Engine presence is checked at runtime; a missing engine pauses the import with OCR_ENGINE_UNAVAILABLE.',
  },
  {
    name: 'OCR language pack zh-Hans-CN',
    kind: 'os-language-pack',
    required: true,
    usedFor: 'Chinese OCR of the textbook pages',
    license: 'Windows optional feature (per-machine); not redistributable',
    redistributable: false,
    detection: 'Get-WindowsCapability -Online -Name Language.OCR~~~zh-Hans* | Select Name,State',
    notes: 'Installed via Settings > Language > Chinese (Simplified) OCR (or DISM). T16 must check it and show a clear message when missing.',
  },
  {
    name: 'Windows PowerShell 5.1 (powershell.exe)',
    kind: 'os-component',
    required: true,
    usedFor: 'hosting the WinRT render/OCR script (one process per page batch)',
    license: 'Windows OS component',
    redistributable: false,
    detection: '%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe exists',
    notes: 'No PowerShell 7 requirement; the script is ASCII-only so Windows PowerShell 5.1 reads it correctly.',
  },
  {
    name: 'node:zlib / node:crypto / node:fs (Node built-ins)',
    kind: 'node-builtin',
    required: true,
    usedFor: 'Flate stream decoding, SHA-256 hashing, file access',
    license: 'Node.js license (MIT) — runtime supplied by the packaged app',
    redistributable: true,
    detection: 'the packaged Electron/Node runtime provides them; no extra module',
    notes: 'No native addons; nothing to rebuild per Electron version.',
  },
  {
    name: 'src/engines/scripts/winrt-ocr.ps1',
    kind: 'bundled-script',
    required: true,
    usedFor: 'render + OCR bridge; must be shipped inside the app resources',
    license: 'MIT',
    redistributable: true,
    detection: 'file present next to the packaged importer bundle',
    notes: 'T16 must include this script in the asar/files list; it is ASCII-only and contains no secrets.',
  },
  {
    name: 'Tesseract / Ghostscript / Poppler / Python',
    kind: 'os-component',
    required: false,
    usedFor: 'not used',
    license: 'not applicable',
    redistributable: false,
    detection: 'must not be required: the importer never invokes them',
    notes: 'Explicit non-dependency: no Python, no external OCR binary, no developer PATH entry.',
  },
];

export interface EngineStatus {
  readonly parserVersion: string;
  readonly backendId: string;
  readonly ocr: OcrAvailability;
  readonly ocrOptions: OcrOptions;
  readonly nodeVersion: string;
  readonly platform: string;
  readonly materials: readonly EngineMaterial[];
  /** True when the local pipeline can run without any cloud service. */
  readonly offlineCapable: boolean;
}

export function materialInventory(): readonly EngineMaterial[] {
  return ENGINE_MATERIALS;
}

export function buildEngineStatus(input: {
  readonly backendId: string;
  readonly ocr: OcrAvailability;
  readonly ocrOptions: OcrOptions;
}): EngineStatus {
  return {
    parserVersion: PARSER_VERSION,
    backendId: input.backendId,
    ocr: input.ocr,
    ocrOptions: input.ocrOptions,
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`,
    materials: ENGINE_MATERIALS,
    offlineCapable: true,
  };
}
