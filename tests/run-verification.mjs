import { execFileSync } from 'node:child_process';
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run this check with npm run verify from the project root.');
for (const directory of ['server', 'client']) execFileSync(process.execPath, [npm, 'run', 'build', '--prefix', directory], { stdio: 'inherit' });
execFileSync(process.execPath, ['tests/request-policy.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['tests/business-flows.e2e.mjs'], { stdio: 'inherit', env: { ...process.env, QA_BROWSER: '1' } });
execFileSync(process.execPath, ['tests/inspect-pdfs.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['tests/inspect-downloads.mjs'], { stdio: 'inherit' });
