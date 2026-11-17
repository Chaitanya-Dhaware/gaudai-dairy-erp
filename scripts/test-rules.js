/* global process */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate JDK 21+ if current default is older (e.g. Java 8)
const knownJdkPaths = [
  'C:\\Program Files\\Java\\jdk-25.0.2',
  'C:\\Program Files\\Java\\jdk-21',
  'C:\\Program Files\\Eclipse Adoptium\\jdk-21'
];

let jdkPath = null;
for (const p of knownJdkPaths) {
  if (fs.existsSync(p)) {
    jdkPath = p;
    break;
  }
}

const env = { ...process.env };
if (jdkPath) {
  env.JAVA_HOME = jdkPath;
  env.PATH = `${path.join(jdkPath, 'bin')};${env.PATH || ''}`;
}

const firebaseBin = path.resolve(__dirname, '../node_modules/firebase-tools/lib/bin/firebase.js');
const vitestCmd = 'npx vitest run src/firestoreRules.test.js';

console.log('Starting Firestore Emulator and executing security rules test suite...');
const result = spawnSync(`node "${firebaseBin}" emulators:exec --only firestore "${vitestCmd}"`, {
  env,
  stdio: 'inherit',
  shell: true
});

process.exit(result.status || 0);
