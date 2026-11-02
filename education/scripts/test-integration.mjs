#!/usr/bin/env node
/** Real local integration suite (T13): real knowledge/storage/learner + rule grading. */
import { educationPath, runVitest } from './lib/workspace.mjs';
const code = runVitest(educationPath('tests', 'integration'));
console.log(`[test:integration] exit=${code}`);
process.exit(code);
