#!/usr/bin/env node

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');
const ENV_EXAMPLE = path.join(ROOT, '.env.example');

const SECRET_KEYS = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
const SECRET_BYTES = 64; // 128 hex chars — well above the 32-char minimum

function generateSecret() {
  return crypto.randomBytes(SECRET_BYTES).toString('hex');
}

function parseEnvFile(content) {
  const lines = content.split('\n');
  const result = { lines, map: new Map() };

  lines.forEach((line, idx) => {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)/);
    if (match) result.map.set(match[1], idx);
  });

  return result;
}

function applySecrets(parsed, secrets) {
  const updated = [...parsed.lines];

  for (const [key, value] of Object.entries(secrets)) {
    const idx = parsed.map.get(key);
    if (idx !== undefined) {
      updated[idx] = `${key}=${value}`;
    } else {
      updated.push(`${key}=${value}`);
    }
  }

  return updated.join('\n');
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  const forceFlag = process.argv.includes('--force') || process.argv.includes('-f');

  // Ensure .env exists (seed from .env.example if needed)
  if (!fs.existsSync(ENV_FILE)) {
    if (!fs.existsSync(ENV_EXAMPLE)) {
      console.error('Error: neither .env nor .env.example found.');
      process.exit(1);
    }
    fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
    console.log('Created .env from .env.example');
  }

  const content = fs.readFileSync(ENV_FILE, 'utf8');
  const parsed = parseEnvFile(content);

  // Check which keys already have real (non-placeholder) values
  const keysToGenerate = [];
  const keysToSkip = [];

  for (const key of SECRET_KEYS) {
    const idx = parsed.map.get(key);
    const currentValue = idx !== undefined ? parsed.lines[idx].split('=').slice(1).join('=') : '';
    const isPlaceholder =
      !currentValue || currentValue.startsWith('change_me') || currentValue.length < 32;

    if (isPlaceholder) {
      keysToGenerate.push(key);
    } else {
      keysToSkip.push(key);
    }
  }

  if (keysToSkip.length > 0 && !forceFlag) {
    console.log(`\nThe following keys already have values and will be skipped:`);
    keysToSkip.forEach((k) => console.log(`  - ${k}`));
    console.log('\nUse --force to regenerate all secrets (this will overwrite existing values).\n');
  }

  const targets = forceFlag ? SECRET_KEYS : keysToGenerate;

  if (targets.length === 0) {
    console.log('All secret keys are already set. Nothing to do.');
    return;
  }

  if (forceFlag && keysToSkip.length > 0) {
    const answer = await confirm(
      `--force will overwrite existing secrets for: ${keysToSkip.join(', ')}.\nThis will invalidate active sessions. Continue? [y/N] `,
    );
    if (answer !== 'y' && answer !== 'yes') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  const secrets = {};
  for (const key of targets) {
    secrets[key] = generateSecret();
  }

  const newContent = applySecrets(parsed, secrets);
  fs.writeFileSync(ENV_FILE, newContent, 'utf8');

  console.log('\nGenerated and written to .env:');
  for (const [key, value] of Object.entries(secrets)) {
    console.log(`  ${key}=${value.slice(0, 8)}...(${value.length} chars)`);
  }
  console.log('\nDone. Keep .env out of version control.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
