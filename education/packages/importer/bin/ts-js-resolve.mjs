/**
 * Entry point for `node --import ./bin/ts-js-resolve.mjs <script.ts>`
 * (used by bin/ocr-baseline.mjs; vitest/tsc do not need it).
 */

import { register } from 'node:module';

register('./ts-js-resolve-hooks.mjs', import.meta.url);
