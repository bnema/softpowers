#!/usr/bin/env node

import { runCli } from './spec-docs.mjs';

await runCli(['create', ...process.argv.slice(2)]);
