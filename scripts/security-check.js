import {execFileSync} from 'node:child_process';
import {readFile, readdir} from 'node:fs/promises';
import {join, relative, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

/**
 * High-signal credential patterns. Keep these specific: a scanner that cries
 * wolf gets disabled, which is worse than no scanner.
 */
export const RULES = [
  {id: 'private-key', label: 'Private key material', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/},
  {id: 'aws-access-key', label: 'AWS access key ID', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/},
  {id: 'github-token', label: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/},
  {id: 'github-fine-grained-token', label: 'GitHub fine-grained token', pattern: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/},
  {id: 'api-secret-key', label: 'API secret key (sk-…)', pattern: /\bsk-[A-Za-z0-9_-]{24,}\b/},
  {id: 'slack-token', label: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/},
  {id: 'google-api-key', label: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/},
  {id: 'stripe-live-key', label: 'Stripe live key', pattern: /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}\b/},
  {id: 'credentialed-database-url', label: 'Database URL containing a password', pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@/]+:[^\s@/]{6,}@/i}
];

const PLACEHOLDER = /(example|placeholder|your[_-]?|change[_-]?me|testpassword|local-password|dummy|sample|redacted|notreal|xxxx|\*\*\*|<[^>\n]{1,40}>)/i;

const FORBIDDEN_PATHS = [
  {id: 'env-file', label: 'Environment file containing secrets', test: p => /(^|\/)\.env($|\.)/.test(p) && !p.endsWith('.env.example') && !p.endsWith('.env.sample')},
  {id: 'ssh-key', label: 'SSH private key', test: p => /(^|\/)id_(?:rsa|dsa|ecdsa|ed25519)$/.test(p)},
  {id: 'key-bundle', label: 'Private key or certificate bundle', test: p => /\.(?:pem|p12|pfx|key)$/i.test(p)},
  {id: 'vendored-deps', label: 'Vendored dependencies', test: p => /(^|\/)node_modules\//.test(p)}
];

const SKIP_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'coverage', '__pycache__', '.venv']);

export function isPlaceholder(line) {
  return PLACEHOLDER.test(line);
}

/** Scan text and return findings with 1-based line numbers. */
export function scanText(text, file = '<text>') {
  const findings = [];
  const lines = String(text).split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line || line.length > 4000) continue;
    // Inline allowlist for deliberate documentation and test fixtures.
    if (/security-check:\s*ignore/i.test(line)) continue;
    if (isPlaceholder(line)) continue;
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        findings.push({file, line: index + 1, rule: rule.id, label: rule.label});
      }
    }
  }
  return findings;
}

async function trackedFiles(root) {
  try {
    const output = execFileSync('git', ['ls-files', '-z'], {cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
    return output.split('\0').filter(Boolean);
  } catch {
    const files = [];
    async function walk(dir) {
      for (const entry of await readdir(dir, {withFileTypes: true})) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) await walk(path);
        else if (entry.isFile()) files.push(relative(root, path).split('\\').join('/'));
      }
    }
    await walk(root);
    return files;
  }
}

export async function scanRepository(root = process.cwd()) {
  const findings = [];
  const files = await trackedFiles(root);
  for (const file of files) {
    for (const rule of FORBIDDEN_PATHS) {
      if (rule.test(file)) findings.push({file, line: 0, rule: rule.id, label: rule.label});
    }
    let text;
    try {
      text = await readFile(resolve(root, file), 'utf8');
    } catch {
      continue;
    }
    if (text.includes('\u0000')) continue;
    findings.push(...scanText(text, file));
  }
  let ignore = '';
  try {
    ignore = await readFile(resolve(root, '.gitignore'), 'utf8');
  } catch {}
  if (!/^\.env$/m.test(ignore)) findings.push({file: '.gitignore', line: 0, rule: 'missing-env-ignore', label: '.gitignore must ignore .env'});
  if (!/^node_modules\/$/m.test(ignore)) findings.push({file: '.gitignore', line: 0, rule: 'missing-node-modules-ignore', label: '.gitignore must ignore node_modules/'});
  return {filesScanned: files.length, findings};
}

function report(result) {
  if (!result.findings.length) {
    console.log(`Security check passed: ${result.filesScanned} tracked files scanned, no credential material or forbidden paths found.`);
    return 0;
  }
  console.error(`Security check failed: ${result.findings.length} finding(s).`);
  for (const finding of result.findings) {
    const where = finding.line ? `${finding.file}:${finding.line}` : finding.file;
    console.error(`  ${where}  ${finding.label} (${finding.rule})`);
  }
  console.error('Remove the file or credential, rotate it if it was ever pushed, and load secrets from the environment instead.');
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await scanRepository();
  process.exitCode = report(result);
}
