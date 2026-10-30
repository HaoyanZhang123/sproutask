#!/usr/bin/env node
/**
 * T16/A2 payload scanner.
 *
 * Scans a candidate Windows payload directory and rejects material that must
 * never ship to students:
 *   - PDFs and textbook page scans/images;
 *   - `.env`, key/secret files, credential directories;
 *   - learning journals / session logs / learner-data or evidence directories;
 *   - development/source/docs trees, logs and build caches;
 *   - symbolic links/junctions (the Windows payload uses a plain hoisted tree).
 *
 * Also reports the largest images so a human can review borderline assets.
 *
 * Usage:
 *   node education/scripts/packaging/scan-payload.mjs <payload-dir> [--json]
 *        [--max-image-bytes <n>] [--allow-image <glob>]
 *
 * Exit: 0 = clean, 1 = violations, 2 = usage/IO error.
 */

import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const USAGE =
  'usage: node education/scripts/packaging/scan-payload.mjs <payload-dir> [--json] [--max-image-bytes <n>] [--allow-image <substring>]';

function parseArgs(argv) {
  const args = { root: null, json: false, maxImageBytes: 256 * 1024, allowImages: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') args.json = true;
    else if (value === '--max-image-bytes') {
      const next = argv[index + 1];
      if (next === undefined || !/^\d+$/.test(next)) throw new Error('--max-image-bytes needs an integer');
      args.maxImageBytes = Number(next);
      index += 1;
    } else if (value === '--allow-image') {
      const next = argv[index + 1];
      if (next === undefined) throw new Error('--allow-image needs a substring');
      args.allowImages.push(next);
      index += 1;
    } else if (value === '--help' || value === '-h') {
      args.help = true;
    } else if (value.startsWith('--')) {
      throw new Error(`unknown argument ${value}`);
    } else if (args.root === null) {
      args.root = value;
    } else {
      throw new Error(`unexpected argument ${value}`);
    }
  }
  return args;
}

const IMAGE_EXT = /\.(png|jpe?g|webp|bmp|tiff?|gif)$/i;
const SOURCE_EXT = /\.(ts|tsx|jsx|mts|cts|scss|sass|less|vue|svelte)$/i;

function normalise(relative) {
  return relative.split(path.sep).join('/');
}

function checkFile(relative, absolute, stats, options) {
  const name = path.basename(absolute);
  const lower = name.toLowerCase();
  const rel = normalise(relative);
  const violations = [];
  const push = (code, reason) => violations.push({ code, path: rel, bytes: stats.size, reason });

  if (/\.pdf$/i.test(lower)) push('PDF_FILE', 'PDF/教材原件不得进入 payload');
  if (lower === '.env' || lower.startsWith('.env.')) push('ENV_FILE', '.env 不得进入 payload');
  if (/\.(key|pem|pfx|p12|jks|keystore)$/i.test(lower)) push('SECRET_FILE', '密钥/证书文件不得进入 payload');
  if (/^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i.test(lower)) push('SECRET_FILE', 'SSH 私钥不得进入 payload');
  if (/\.jsonl$/i.test(lower)) push('JOURNAL_FILE', '学习 journal/session 日志不得进入 payload');
  if (/\.log$/i.test(lower)) push('LOG_FILE', '运行日志不得进入 payload');
  if (/\.tsbuildinfo$/i.test(lower)) push('BUILD_CACHE', '构建缓存不得进入 payload');

  if (/^(secrets?|credentials?|learner-data|edu-data|journal|journals|sessions?|session-logs?|evidence)$/i.test(name)) {
    push('PRIVATE_DIR', '秘密/学习记录目录不得进入 payload');
  }
  // 第三方 npm 包自带 src/ 与 .ts 源文件属正常内容；本项目源码/文档/记录目录才禁止。
  const inNodeModules = /(^|\/)node_modules(\/|$)/i.test(rel);
  if (
    !inNodeModules &&
    /(^|\/)(secrets?|credentials?|learner-data|edu-data|journals?|sessions?|session-logs?|evidence|docs|\.git|src)(\/|$)/i.test(rel)
  ) {
    push('FORBIDDEN_PATH', '秘密/学习记录/源码/文档目录不得进入 payload');
  }
  if (/(^|\/)node_modules\/\.cache(\/|$)/i.test(rel)) push('BUILD_CACHE', 'node_modules/.cache 不得进入 payload');
  if (SOURCE_EXT.test(lower) && !inNodeModules && !/(^|\/)licenses(\/|$)/i.test(rel)) {
    push('SOURCE_FILE', '产品 payload 不包含项目源码（插件构建产物除外）');
  }

  if (IMAGE_EXT.test(lower)) {
    const allowed = options.allowImages.some((needle) => rel.includes(needle));
    const looksLikePage =
      /(^|\/)(pages?|page-images?|scans?|ocr|textbook)(\/|$)/i.test(rel) ||
      /page[-_]?\d+/i.test(name) ||
      /(^|\/)\d{1,3}\.(png|jpe?g)$/i.test(rel);
    if (!allowed && (stats.size > options.maxImageBytes || looksLikePage)) {
      push(
        'PAGE_IMAGE',
        `图片 ${stats.size} B > ${options.maxImageBytes} B 或路径/文件名像教材页扫描；如确为产品图请用 --allow-image 显式放行`,
      );
    }
  }
  return violations;
}

function scan(root, options) {
  const violations = [];
  const images = [];
  let files = 0;
  let bytes = 0;
  const walk = (current) => {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(root, absolute);
      let stats;
      try {
        stats = lstatSync(absolute);
      } catch {
        violations.push({ code: 'UNREADABLE', path: normalise(relative), bytes: null, reason: '无法读取' });
        continue;
      }
      if (stats.isSymbolicLink()) {
        violations.push({
          code: 'SYMLINK',
          path: normalise(relative),
          bytes: null,
          reason: 'payload 不允许符号链接/junction；Windows 标准用户解包不可靠',
        });
        continue;
      }
      if (stats.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!stats.isFile()) continue;
      files += 1;
      bytes += stats.size;
      const found = checkFile(relative, absolute, stats, options);
      violations.push(...found);
      if (IMAGE_EXT.test(entry.name)) {
        images.push({ path: normalise(relative), bytes: stats.size });
      }
    }
  };
  walk(root);
  images.sort((a, b) => b.bytes - a.bytes);
  return {
    root,
    scannedFiles: files,
    scannedBytes: bytes,
    limits: {
      maxImageBytes: options.maxImageBytes,
      allowImages: options.allowImages,
    },
    violations,
    largestImages: images.slice(0, 20),
  };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    process.exit(2);
  }
  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }
  if (args.root === null) {
    console.error(USAGE);
    process.exit(2);
  }
  const root = path.resolve(args.root);
  let stats;
  try {
    stats = lstatSync(root);
  } catch {
    console.error(`payload directory not found: ${root}`);
    process.exit(2);
  }
  if (!stats.isDirectory()) {
    console.error(`payload path is not a directory: ${root}`);
    process.exit(2);
  }
  const result = scan(root, args);
  result.ok = result.violations.length === 0;
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log(
      `scan-payload: OK (${result.scannedFiles} files, ${result.scannedBytes} bytes, no forbidden payload material)`,
    );
  } else {
    console.log(`scan-payload: REJECTED (${result.violations.length} violation(s))`);
    for (const violation of result.violations.slice(0, 100)) {
      console.log(`  [${violation.code}] ${violation.path}: ${violation.reason}`);
    }
    if (result.violations.length > 100) console.log(`  ... and ${result.violations.length - 100} more`);
  }
  process.exit(result.ok ? 0 : 1);
}

main();
