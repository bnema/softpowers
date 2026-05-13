#!/usr/bin/env node

import { runCli } from './spec-docs.mjs';

await runCli(['validate', ...process.argv.slice(2)]);
