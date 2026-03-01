const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const AdmZip = require('adm-zip');

console.log('>>> GAMANOTE MAIN.JS LOADED AT:', new Date().toISOString());
let ptyProcess = null;
let watcher = null;

// Dynamically require node-pty (native module)
let pty;
try {
    pty = require('node-pty');
} catch (e) {
    console.error('node-pty failed to load:', e.message);
    pty = null;
}

const isDev = process.env.ELECTRON_DEV === 'true';

// ─── Persistent Settings ───
const settingsPath = path.join(app.getPath('userData'), 'gamanote-settings.json');

function loadSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        }
    } catch (e) { console.error('Failed to load settings:', e); }
    return {};
}

function saveSettings(data) {
    try {
        const current = loadSettings();
        const merged = { ...current, ...data };
        fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf-8');
    } catch (e) { console.error('Failed to save settings:', e); }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        frame: false,
        transparent: false,
        backgroundColor: '#0a0a0a',
        titleBarStyle: 'hidden',
        icon: path.join(__dirname, '..', 'assets', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webviewTag: true,
            sandbox: false,
        },
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        // جرب تغيير 'dist-react' إلى 'dist' إذا كان هذا هو اسم المجلد الناتج
        const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
        mainWindow.loadFile(indexPath);
    }
}

app.whenReady().then(() => {
    // Disable default menu (Ctrl+R, F5, etc.) in production
    Menu.setApplicationMenu(null);
    createWindow();
});

app.on('window-all-closed', () => {
    // Kill all terminal processes
    if (ptyProcesses && ptyProcesses.size > 0) {
        for (const [id, proc] of ptyProcesses) {
            try {
                if (proc.kill) proc.kill();
                else if (proc.terminate) proc.terminate();
            } catch (e) { }
        }
        ptyProcesses.clear();
    }

    if (watcher) {
        watcher.close();
        watcher = null;
    }

    if (process.platform !== 'darwin') {
        // Kill the app process and all sub-processes immediately
        app.exit(0);
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── Window Controls ───
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});
ipcMain.on('window:close', () => mainWindow?.close());

// ─── File Watcher ───
async function setupWatcher(projectPath) {
    if (watcher) watcher.close();

    try {
        const chokidar = await import('chokidar');

        watcher = chokidar.watch(projectPath, {
            ignored: [
                /(^|[\/\\])\../,
                '**/node_modules/**',
                '**/.gamanote/**',
                '**/.git/**',
                '**/dist/**',
                '**/build/**',
                '**/.next/**',
                '**/__pycache__/**',
                '**/.venv/**',
                '**/venv/**',
                '**/.expo/**'
            ],
            persistent: true,
            ignoreInitial: true,
            usePolling: false, // Performance: prefer native events
            interval: 100,
            binaryInterval: 300,
        });

        const notify = () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('fs:changed');
            }
        };

        watcher.on('all', (event, changedPath) => {
            console.log(`[Watcher] ${event}: ${changedPath}`);
            notify();
        });
    } catch (err) {
        console.error('Failed to setup watcher:', err);
    }
}

ipcMain.on('watcher:start', (event, folderPath) => { // حذفنا async هنا أيضاً
    console.log('[Main] Starting watcher for:', folderPath);
    setupWatcher(folderPath);
});

// ─── Dialog ───
ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
});

// ─── File System ───
ipcMain.handle('fs:readDir', async (_, dirPath) => {
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        return entries
            .filter((e) => !e.name.startsWith('.'))
            .map((e) => ({
                name: e.name,
                path: path.join(dirPath, e.name),
                isDirectory: e.isDirectory(),
            }))
            .sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });
    } catch (err) {
        console.error('fs:readDir error:', err);
        return [];
    }
});

ipcMain.handle('fs:readFile', async (_, filePath) => {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
        console.error('fs:readFile error:', err);
        return null;
    }
});

ipcMain.handle('fs:writeFile', async (_, filePath, content) => {
    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        return true;
    } catch (err) {
        console.error('fs:writeFile error:', err);
        return false;
    }
});

ipcMain.handle('fs:createFile', async (_, filePath) => {
    try {
        fs.writeFileSync(filePath, '', 'utf-8');
        return true;
    } catch (err) {
        console.error('fs:createFile error:', err);
        return false;
    }
});

ipcMain.handle('fs:createFolder', async (_, folderPath) => {
    try {
        fs.mkdirSync(folderPath, { recursive: true });
        return true;
    } catch (err) {
        console.error('fs:createFolder error:', err);
        return false;
    }
});

ipcMain.handle('fs:delete', async (_, targetPath) => {
    try {
        const stat = fs.statSync(targetPath);
        if (stat.isDirectory()) {
            fs.rmSync(targetPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(targetPath);
        }
        return true;
    } catch (err) {
        console.error('fs:delete error:', err);
        return false;
    }
});

// Move to .gamanote/trash for undo support
ipcMain.handle('fs:moveToTrash', async (_, targetPath, projectRoot) => {
    try {
        const trashDir = path.join(projectRoot, '.gamanote', 'trash');
        if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir, { recursive: true });

        const timestamp = Date.now();
        const baseName = path.basename(targetPath);
        const trashName = `${timestamp}_${baseName}`;
        const trashPath = path.join(trashDir, trashName);

        fs.renameSync(targetPath, trashPath);
        return { trashPath, originalPath: targetPath, baseName };
    } catch (err) {
        console.error('fs:moveToTrash error:', err);
        return null;
    }
});

// Restore from .gamanote/trash
ipcMain.handle('fs:restoreFromTrash', async (_, trashPath, originalPath) => {
    try {
        // Ensure original parent exists
        const parentDir = path.dirname(originalPath);
        if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

        fs.renameSync(trashPath, originalPath);
        return true;
    } catch (err) {
        console.error('fs:restoreFromTrash error:', err);
        return false;
    }
});

// Check if a path exists
ipcMain.handle('fs:exists', async (_, targetPath) => {
    return fs.existsSync(targetPath);
});

ipcMain.handle('fs:rename', async (_, oldPath, newPath) => {
    try {
        fs.renameSync(oldPath, newPath);
        return true;
    } catch (err) {
        console.error('fs:rename error:', err);
        return false;
    }
});

ipcMain.handle('fs:move', async (_, oldPath, newPath) => {
    try {
        fs.renameSync(oldPath, newPath);
        return true;
    } catch (err) {
        console.error('fs:move error:', err);
        return false;
    }
});

ipcMain.handle('fs:copy', async (_, sourcePath, targetPath) => {
    try {
        if (fs.statSync(sourcePath).isDirectory()) {
            fs.cpSync(sourcePath, targetPath, { recursive: true });
        } else {
            fs.copyFileSync(sourcePath, targetPath);
        }
        return true;
    } catch (err) {
        console.error('fs:copy error:', err);
        return false;
    }
});

ipcMain.handle('fs:backup', async (_, sourcePath) => {
    try {
        const backupDir = path.join(sourcePath, '.gamanote', 'backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const targetPath = path.join(backupDir, `backup-${timestamp}`);

        fs.cpSync(sourcePath, targetPath, {
            recursive: true,
            filter: (src) => !src.includes('.gamanote') && !src.includes('node_modules') && !src.includes('.git')
        });
        return targetPath;
    } catch (err) {
        console.error('Backup error:', err);
        return null;
    }
});

ipcMain.handle('fs:restore', async (_, projectRoot) => {
    try {
        const backupDir = path.join(projectRoot, '.gamanote', 'backups');
        if (!fs.existsSync(backupDir)) {
            console.error('No backup directory found at:', backupDir);
            return false;
        }

        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Backup Folder to Restore',
            defaultPath: backupDir,
            properties: ['openDirectory', 'showHiddenFiles']
        });

        if (!filePaths || filePaths.length === 0) return false;

        const sourcePath = filePaths[0];
        fs.cpSync(sourcePath, projectRoot, {
            recursive: true,
            filter: (src) => !src.includes('.gamanote')
        });
        return true;
    } catch (err) {
        console.error('Restore error:', err);
        return false;
    }
});

ipcMain.handle('fs:exportZIP', async (_, sourcePath) => {
    try {
        const projectName = path.basename(sourcePath);
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Project as ZIP',
            defaultPath: path.join(os.homedir(), `${projectName}.zip`),
            filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
        });

        if (!filePath) return false;

        const zip = new AdmZip();
        // Exclude heavy folders
        const excludeDirs = ['node_modules', '.git', '.gamanote', 'dist', '.next', '__pycache__', '.venv', 'venv'];

        function addFolderFiltered(folderPath, zipPath) {
            const entries = fs.readdirSync(folderPath, { withFileTypes: true });
            for (const entry of entries) {
                if (excludeDirs.includes(entry.name)) continue;
                const fullPath = path.join(folderPath, entry.name);
                const entryZipPath = zipPath ? `${zipPath}/${entry.name}` : entry.name;
                if (entry.isDirectory()) {
                    addFolderFiltered(fullPath, entryZipPath);
                } else {
                    zip.addLocalFile(fullPath, zipPath || '');
                }
            }
        }

        addFolderFiltered(sourcePath, '');
        zip.writeZip(filePath);
        return true;
    } catch (err) {
        console.error('ZIP export error:', err);
        return false;
    }
});

ipcMain.handle('fs:stat', async (_, filePath) => {
    try {
        const stat = fs.statSync(filePath);
        return {
            isDirectory: stat.isDirectory(),
            isFile: stat.isFile(),
            size: stat.size,
            modified: stat.mtimeMs,
        };
    } catch (err) {
        return null;
    }
});

// ─── PTY (Terminal) ───
const ptyProcesses = new Map();

ipcMain.on('pty:spawn', (event, termId, cwd) => {
    if (ptyProcesses.has(termId)) {
        const existing = ptyProcesses.get(termId);
        if (existing.kill) existing.kill();
        else if (existing.terminate) existing.terminate();
        ptyProcesses.delete(termId);
    }

    const shellPath = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');
    const startCwd = cwd || os.homedir();

    if (pty) {
        try {
            const proc = pty.spawn(shellPath, [], {
                name: 'xterm-256color',
                cols: 100,
                rows: 30,
                cwd: startCwd,
                env: { ...process.env, TERM: 'xterm-256color' },
                // Enable ConPTY on Windows for full terminal emulation (interactive apps, colors, etc.)
                useConpty: true,
                handleFlowControl: true,
            });

            proc.onData((data) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send(`pty:data:${termId}`, data);
                }
            });

            proc.onExit(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send(`pty:exit:${termId}`);
                }
                ptyProcesses.delete(termId);
            });

            ptyProcesses.set(termId, proc);
        } catch (err) {
            console.error(`node-pty spawn failed for ${termId}, falling back:`, err.message);
            spawnFallback(termId, shellPath, startCwd);
        }
    } else {
        spawnFallback(termId, shellPath, startCwd);
    }
});

function spawnFallback(termId, shellPath, cwd) {
    console.log(`[PTY_FALLBACK] id: ${termId} type: ${typeof termId} cwd: ${cwd}`);
    const proc = spawn(shellPath, [], {
        cwd: cwd || os.homedir(),
        env: process.env,
        shell: true, // Use shell for better interop in fallback
        stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(`pty:data:${termId}`, data.toString());
        }
    });

    proc.stderr.on('data', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(`pty:data:${termId}`, data.toString());
        }
    });

    proc.on('exit', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(`pty:exit:${termId}`);
        }
        ptyProcesses.delete(termId);
    });

    proc._isFallback = true;
    ptyProcesses.set(termId, proc);
}

ipcMain.on('pty:write', (_, termId, data) => {
    const proc = ptyProcesses.get(termId);
    if (!proc) return;
    if (proc._isFallback) {
        try { proc.stdin.write(data); } catch (e) { }
    } else {
        try { proc.write(data); } catch (e) { }
    }
});

ipcMain.on('pty:resize', (_, termId, cols, rows) => {
    const proc = ptyProcesses.get(termId);
    if (proc && !proc._isFallback) {
        try { proc.resize(cols, rows); } catch (e) { }
    }
});

ipcMain.on('pty:kill', (_, termId) => {
    const proc = ptyProcesses.get(termId);
    if (proc) {
        if (proc.kill) proc.kill();
        else if (proc.terminate) proc.terminate();
        ptyProcesses.delete(termId);
    }
});

// ─── Shell ───
ipcMain.on('shell:openExternal', (_, url) => {
    shell.openExternal(url);
});

// ─── Git ───
function runGit(args, cwd) {
    return new Promise((resolve) => {
        const proc = spawn('git', args, { cwd, shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '', stderr = '';
        proc.stdout.on('data', d => stdout += d.toString());
        proc.stderr.on('data', d => stderr += d.toString());
        proc.on('close', code => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
        proc.on('error', () => resolve({ code: -1, stdout: '', stderr: 'git not found' }));
    });
}

ipcMain.handle('git:status', async (_, cwd) => runGit(['status', '--porcelain'], cwd));
ipcMain.handle('git:add', async (_, cwd, file) => runGit(['add', file || '.'], cwd));
ipcMain.handle('git:commit', async (_, cwd, msg) => runGit(['commit', '-m', msg], cwd));
ipcMain.handle('git:push', async (_, cwd) => runGit(['push'], cwd));
ipcMain.handle('git:pull', async (_, cwd) => runGit(['pull'], cwd));
ipcMain.handle('git:log', async (_, cwd) => runGit(['log', '--oneline', '-20'], cwd));
ipcMain.handle('git:diff', async (_, cwd, file) => runGit(['diff', file || ''], cwd));
ipcMain.handle('git:init', async (_, cwd) => runGit(['init'], cwd));

// ─── Zoom ───
ipcMain.on('window:setZoomFactor', (_, factor) => {
    if (mainWindow) mainWindow.webContents.setZoomFactor(factor);
});

// ─── Settings Persistence ───
ipcMain.handle('settings:load', async () => loadSettings());
ipcMain.handle('settings:save', async (_, data) => { saveSettings(data); return true; });

// ─── Save As Dialog ───
ipcMain.handle('dialog:saveAs', async (_, defaultName) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save File As',
        defaultPath: defaultName || 'untitled.txt',
    });
    if (result.canceled) return null;
    return result.filePath;
});

// ─── Create Folder Dialog ───
ipcMain.handle('dialog:createFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select location for your new project',
        buttonLabel: 'Select Projects Location',
        properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
});
