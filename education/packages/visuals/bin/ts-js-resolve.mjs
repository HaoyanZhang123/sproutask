/** Entry point for `node --import ./bin/ts-js-resolve.mjs <script.ts>`. */

import { register } from 'node:module';

register('./ts-js-resolve-hooks.mjs', import.meta.url);
