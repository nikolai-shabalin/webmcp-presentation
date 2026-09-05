// Export uses an installed Chrome/Chromium, with a disposable isolated profile.
// No npm install, browser downloads, presentation server or build is needed.
import { access, mkdtemp, mkdir, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';
import { join, resolve, delimiter } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, process.argv[2] || 'output/pdf/webmcp-presentation.pdf');
// Prefer a preinstalled headless shell when available (e.g. Playwright caches).
// This is useful on managed machines where desktop Chrome cannot run headlessly.
const { readdir } = await import('node:fs/promises');
const cache = process.platform === 'darwin'
  ? join(homedir(), 'Library', 'Caches', 'ms-playwright')
  : join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'ms-playwright');
const shells = [];
try {
  for (const entry of (await readdir(cache)).filter(name => name.startsWith('chromium_headless_shell-')).sort().reverse()) {
    for (const folder of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64', 'chrome-linux', 'chrome-linux64']) {
      shells.push(join(cache, entry, folder, folder.startsWith('chrome-linux') ? 'headless_shell' : 'chrome-headless-shell'));
    }
  }
} catch { /* No optional browser cache. */ }
const candidates = [
  process.env.CHROME_PATH,
  ...shells,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ...[process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
    .filter(Boolean).map(path => join(path, 'Google', 'Chrome', 'Application', 'chrome.exe')),
  ...(process.env.PATH || '').split(delimiter).flatMap(path =>
    ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].map(name => join(path, name)))
].filter(Boolean);

let executable;
for (const path of candidates) {
  try { await access(path); executable = path; break; } catch { /* Try the next installation. */ }
}
if (!executable) {
  console.error('Chrome/Chromium не найден. Установите Chrome или задайте CHROME_PATH=/путь/к/браузеру.');
  process.exit(1);
}
await mkdir(fileURLToPath(new URL('.', pathToFileURL(output))), { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'scrolls-pdf-'));
const temporaryOutput = join(profile, 'presentation.pdf');
try {
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(executable, [
      '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-extensions', '--disable-background-networking',
      `--user-data-dir=${profile}`, '--no-pdf-header-footer', '--print-to-pdf-no-header',
      '--run-all-compositor-stages-before-draw', '--virtual-time-budget=3000',
      `--print-to-pdf=${temporaryOutput}`, pathToFileURL(join(root, 'index.html')).href
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let errors = '';
    const timeout = setTimeout(() => { child.kill('SIGKILL'); rejectRun(new Error('PDF export timed out after 60 seconds.')); }, 60_000);
    child.stderr.on('data', chunk => { errors = (errors + chunk.toString()).slice(-4000); });
    child.on('error', error => { clearTimeout(timeout); rejectRun(error); });
    child.on('close', code => {
      clearTimeout(timeout);
      if (code === 0) resolveRun();
      else rejectRun(new Error(`Chrome exited with ${code}. ${errors}`));
    });
  });
  const info = await stat(temporaryOutput);
  if (info.size < 1000) throw new Error('Chrome returned an empty PDF.');
  const { copyFile } = await import('node:fs/promises');
  await copyFile(temporaryOutput, output);
  console.log(`PDF saved: ${output}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
