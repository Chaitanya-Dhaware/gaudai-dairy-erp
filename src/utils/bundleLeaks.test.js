import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Production Bundle Leak Sentinel Verification', () => {
  const distDir = path.resolve(__dirname, '../../dist');

  // Ensure dist exists; if not, build it with sentinel values
  if (!fs.existsSync(distDir) || fs.readdirSync(distDir).length === 0) {
    execSync('npm run build', {
      cwd: path.resolve(__dirname, '../..'),
      env: {
        ...process.env,
        VITE_GEMINI_API_KEY: 'SENTINEL_GEMINI_TEST_VALUE',
        VITE_APPS_SCRIPT_URL: 'SENTINEL_GAS_TEST_VALUE'
      },
      stdio: 'pipe'
    });
  }

  function getDistFiles(dir) {
    const results = [];
    for (const item of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...getDistFiles(fullPath));
      } else if (/\.(js|html|css|json)$/.test(item)) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const files = getDistFiles(distDir);

  it('contains zero occurrences of direct Google Apps Script macro URLs in dist/', () => {
    const violations = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('script.google.com/macros')) {
        violations.push(`${path.relative(distDir, file)} contains direct Apps Script macro URL`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('contains zero occurrences of direct Google Gemini AI API endpoints in dist/', () => {
    const violations = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('generativelanguage.googleapis.com')) {
        violations.push(`${path.relative(distDir, file)} contains direct Gemini API endpoint`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('contains zero occurrences of sentinel environment variables in dist/', () => {
    const violations = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('SENTINEL_GEMINI') || content.includes('SENTINEL_GAS')) {
        violations.push(`${path.relative(distDir, file)} contains leaked sentinel environment variable`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('contains zero occurrences of real secret patterns (AQ., EAA) in dist/', () => {
    const violations = [];
    const secretRegex = /AQ\.[a-zA-Z0-9_-]{20,}|EAA[a-zA-Z0-9_-]{20,}/;
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (secretRegex.test(content)) {
        violations.push(`${path.relative(distDir, file)} contains pattern matching leaked secret`);
      }
    }
    expect(violations).toEqual([]);
  });
});
