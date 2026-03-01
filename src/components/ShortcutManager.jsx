import React, { useEffect } from 'react';
import useAppStore from '../store/useAppStore';

export default function ShortcutManager() {
    const toggleExplorer = useAppStore((s) => s.toggleExplorer);
    const toggleTerminal = useAppStore((s) => s.toggleTerminal);
    const toggleBrowser = useAppStore((s) => s.toggleBrowser);
    const toggleProblems = useAppStore((s) => s.toggleProblems);
    const toggleEditorSplit = useAppStore((s) => s.toggleEditorSplit);

    useEffect(() => {
        const handleKeyDown = (e) => {
            const key = e.key.toLowerCase();
            const ctrl = e.ctrlKey || e.metaKey;
            const shift = e.shiftKey;
            const state = useAppStore.getState();

            // Ctrl+B: Toggle Explorer
            if (ctrl && !shift && key === 'b') {
                e.preventDefault();
                toggleExplorer();
            }

            // Ctrl+`: Toggle Terminal
            if (ctrl && !shift && e.key === '`') {
                e.preventDefault();
                toggleTerminal();
            }

            // Ctrl+Shift+M: Toggle Problems
            if (ctrl && shift && key === 'm') {
                e.preventDefault();
                toggleProblems();
            }

            // Ctrl+\: Toggle Editor Split
            if (ctrl && !shift && e.key === '\\') {
                e.preventDefault();
                toggleEditorSplit();
            }

            // Ctrl+W: Prevent closing program (repurpose for closing active tab if needed, or just prevent)
            if (ctrl && !shift && key === 'w') {
                e.preventDefault();
                const active = state.focusedEditor === 'primary' ? state.activeFile : state.activeFileSecondary;
                if (active) {
                    state.closeFile(active);
                }
            }

            // Ctrl+N: New File
            if (ctrl && !shift && key === 'n') {
                e.preventDefault();
                const node = state.selectedNode || state.rootPath;
                if (node) {
                    window.electronAPI.fs.stat(node).then(stat => {
                        const targetDir = stat?.isDirectory ? node : node.substring(0, node.lastIndexOf('\\'));
                        state.setCreating({ type: 'file', path: targetDir });
                    });
                }
            }

            // Ctrl+Shift+N: New Folder
            if (ctrl && shift && key === 'n') {
                e.preventDefault();
                const node = state.selectedNode || state.rootPath;
                if (node) {
                    window.electronAPI.fs.stat(node).then(stat => {
                        const targetDir = stat?.isDirectory ? node : node.substring(0, node.lastIndexOf('\\'));
                        state.setCreating({ type: 'folder', path: targetDir });
                    });
                }
            }

            // Ctrl+O: Open Folder
            if (ctrl && !shift && key === 'o') {
                e.preventDefault();
                window.electronAPI.dialog.openFolder().then(folder => {
                    if (folder) {
                        state.setRootPath(folder);
                        state.setSelectedNode(folder);
                    }
                });
            }

            // Ctrl+P: Quick Open placeholder
            if (ctrl && !shift && key === 'p') {
                e.preventDefault();
                console.log('Quick Open triggered');
            }

            // Ctrl+X: Close All Tabs (Repurposed as requested)
            if (ctrl && !shift && key === 'x' && !window.getSelection().toString()) {
                e.preventDefault();
                state.closeAllFiles();
            }

            // Ctrl+S: Save
            if (ctrl && !shift && key === 's') {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('ide-save'));
            }

            // Ctrl+C: Copy File
            if (ctrl && !shift && key === 'c' && !window.getSelection().toString()) {
                if (state.selectedNode) {
                    state.setClipboard({ type: 'copy', path: state.selectedNode });
                }
            }

            // Ctrl+V: Paste File
            if (ctrl && !shift && key === 'v' && !e.target.closest('input, textarea')) {
                const clipboard = state.clipboard;
                if (clipboard) {
                    const node = state.selectedNode || state.rootPath;
                    window.electronAPI.fs.stat(node).then(stat => {
                        const targetDir = stat?.isDirectory ? node : node.substring(0, node.lastIndexOf('\\'));
                        if (targetDir) {
                            const fileName = clipboard.path.split(/[\\/]/).pop();
                            const targetPath = targetDir + '\\' + fileName;

                            if (clipboard.type === 'copy') {
                                window.electronAPI.fs.copy(clipboard.path, targetPath).then(() => state.triggerRefresh());
                            } else {
                                window.electronAPI.fs.move(clipboard.path, targetPath).then(() => {
                                    state.triggerRefresh();
                                    state.clearClipboard();
                                });
                            }
                        }
                    });
                }
            }

            // Ctrl+D: Delete File
            if (ctrl && !shift && key === 'd') {
                e.preventDefault();
                if (state.selectedNode) {
                    state.setDialog({
                        title: 'Confirm Deletion',
                        message: `Delete "${state.selectedNode.split(/[\\/]/).pop()}"?`,
                        onConfirm: async () => {
                            await window.electronAPI.fs.delete(state.selectedNode);
                            state.triggerRefresh();
                            state.setDialog(null);
                        }
                    });
                }
            }

            // Ctrl + / - : Zoom
            if (ctrl && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                const newZoom = Math.min(state.zoom + 0.1, 3.0);
                state.setZoom(newZoom);
                window.electronAPI.zoom.setZoomFactor(newZoom);
            }
            if (ctrl && e.key === '-') {
                e.preventDefault();
                const newZoom = Math.max(state.zoom - 0.1, 0.5);
                state.setZoom(newZoom);
                window.electronAPI.zoom.setZoomFactor(newZoom);
            }

            // Ctrl+F: Find placeholder
            if (ctrl && !shift && key === 'f') {
                e.preventDefault();
                console.log('Search triggered');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleExplorer, toggleTerminal, toggleBrowser, toggleProblems, toggleEditorSplit]);

    return null;
}
