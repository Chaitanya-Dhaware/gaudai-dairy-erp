/* global process */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate JDK 21+
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

console.log('Starting Firebase Emulators (Auth on 9099, Firestore on 8080)...');

const emulatorProcess = spawn(`node "${firebaseBin}" emulators:start --only auth,firestore`, {
  env,
  stdio: 'inherit',
  shell: true
});

emulatorProcess.on('exit', (code) => {
  console.log(`Emulator process exited with code ${code}`);
  process.exit(code || 0);
});
