const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
    env: {
        webviewPreloadPath: `file://${path.join(__dirname, 'preload-webview.js').replace(/\\/g, '/')}`,
    },
    dialog: {
        openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
        saveAs: (name) => ipcRenderer.invoke('dialog:saveAs', name),
        createFolder: () => ipcRenderer.invoke('dialog:createFolder'),
    },
    settings: {
        load: () => ipcRenderer.invoke('settings:load'),
        save: (data) => ipcRenderer.invoke('settings:save', data),
    },
    fs: {
        readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
        readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
        writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
        createFile: (filePath) => ipcRenderer.invoke('fs:createFile', filePath),
        createFolder: (folderPath) => ipcRenderer.invoke('fs:createFolder', folderPath),
        delete: (targetPath) => ipcRenderer.invoke('fs:delete', targetPath),
        rename: (oldPath, newPath) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
        move: (oldPath, newPath) => ipcRenderer.invoke('fs:move', oldPath, newPath),
        copy: (sourcePath, targetPath) => ipcRenderer.invoke('fs:copy', sourcePath, targetPath),
        backup: (sourcePath) => ipcRenderer.invoke('fs:backup', sourcePath),
        restore: (projectRoot) => ipcRenderer.invoke('fs:restore', projectRoot),
        exportZIP: (sourcePath) => ipcRenderer.invoke('fs:exportZIP', sourcePath),
        stat: (filePath) => ipcRenderer.invoke('fs:stat', filePath),
        exists: (targetPath) => ipcRenderer.invoke('fs:exists', targetPath),
        moveToTrash: (targetPath, projectRoot) => ipcRenderer.invoke('fs:moveToTrash', targetPath, projectRoot),
        restoreFromTrash: (trashPath, originalPath) => ipcRenderer.invoke('fs:restoreFromTrash', trashPath, originalPath),
        startWatcher: (folderPath) => ipcRenderer.send('watcher:start', folderPath),
        onChanged: (callback) => {
            const handler = () => callback();
            ipcRenderer.on('fs:changed', handler);
            return () => ipcRenderer.removeListener('fs:changed', handler);
        },
    },
    pty: {
        spawn: (termId, cwd) => ipcRenderer.send('pty:spawn', termId, cwd),
        write: (termId, data) => ipcRenderer.send('pty:write', termId, data),
        resize: (termId, cols, rows) => ipcRenderer.send('pty:resize', termId, cols, rows),
        kill: (termId) => ipcRenderer.send('pty:kill', termId),
        onData: (termId, callback) => {
            const handler = (_, data) => callback(data);
            ipcRenderer.on(`pty:data:${termId}`, handler);
            return () => ipcRenderer.removeListener(`pty:data:${termId}`, handler);
        },
        onExit: (termId, callback) => {
            const handler = () => callback();
            ipcRenderer.on(`pty:exit:${termId}`, handler);
            return () => ipcRenderer.removeListener(`pty:exit:${termId}`, handler);
        },
    },
    shell: {
        openExternal: (url) => ipcRenderer.send('shell:openExternal', url),
    },
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close: () => ipcRenderer.send('window:close'),
        setZoomFactor: (f) => ipcRenderer.send('window:setZoomFactor', f),
    },
    git: {
        status: (cwd) => ipcRenderer.invoke('git:status', cwd),
        add: (cwd, file) => ipcRenderer.invoke('git:add', cwd, file),
        commit: (cwd, msg) => ipcRenderer.invoke('git:commit', cwd, msg),
        push: (cwd) => ipcRenderer.invoke('git:push', cwd),
        pull: (cwd) => ipcRenderer.invoke('git:pull', cwd),
        log: (cwd) => ipcRenderer.invoke('git:log', cwd),
        diff: (cwd, file) => ipcRenderer.invoke('git:diff', cwd, file),
        init: (cwd) => ipcRenderer.invoke('git:init', cwd),
    },
});
