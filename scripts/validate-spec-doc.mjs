#!/usr/bin/env node

import { runCli } from './spec-docs.mjs';

try {
  await runCli(['validate', ...process.argv.slice(2)]);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
