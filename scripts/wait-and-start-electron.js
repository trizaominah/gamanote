// Wait for Vite dev server to be ready, then start Electron
const { execSync, spawn } = require('child_process');
const http = require('http');

const VITE_URL = 'http://localhost:5173';
const MAX_RETRIES = 30;
const RETRY_DELAY = 1000;

let retries = 0;

function checkVite() {
    http.get(VITE_URL, (res) => {
        console.log('Vite dev server is ready! Starting Electron...');
        const electron = spawn('npx', ['electron', '.'], {
            shell: true,
            stdio: 'inherit',
            env: { ...process.env, ELECTRON_DEV: 'true' },
        });
        electron.on('close', () => process.exit());
    }).on('error', () => {
        retries++;
        if (retries > MAX_RETRIES) {
            console.error('Vite dev server failed to start.');
            process.exit(1);
        }
        console.log(`Waiting for Vite... (${retries}/${MAX_RETRIES})`);
        setTimeout(checkVite, RETRY_DELAY);
    });
}

checkVite();
