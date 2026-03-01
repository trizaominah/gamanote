import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Folder, FolderOpen, File, ChevronRight, ChevronDown,
    FilePlus, FolderPlus, Trash2, Pencil, FolderOpenDot,
    FileCode, FileJson, FileText, FileImage, FileVideo,
    FileAudio, FileArchive, Settings, Coffee, Hash,
    Globe, Database, Terminal as TermIcon, Package,
    FileCode2, Code2, FileType2, Braces, BrainCircuit, Image as ImageIcon,
    Undo2, Clipboard, ClipboardPaste, Scissors, Clock
} from 'lucide-react';
import useAppStore from '../store/useAppStore';

// ─── File icon mapping ───
const EXT_ICONS = {
    // Web & Logic
    js: { icon: FileCode2, color: '#f7df1e' },
    jsx: { icon: FileCode2, color: '#61dafb' },
    ts: { icon: Code2, color: '#3178c6' },
    tsx: { icon: Code2, color: '#3178c6' },
    html: { icon: FileType2, color: '#e34f26' },
    css: { icon: FileType2, color: '#1572b6' },
    scss: { icon: Hash, color: '#c6538c' },

    // Languages
    py: { icon: TermIcon, color: '#3776ab' },
    cpp: { icon: Braces, color: '#00599c' },
    rs: { icon: Settings, color: '#dea584' },
    go: { icon: FileCode2, color: '#00add8' },

    // Data & Config
    json: { icon: FileJson, color: '#f9ca24' },
    yaml: { icon: Settings, color: '#cb171e' },
    yml: { icon: Settings, color: '#cb171e' },
    sql: { icon: Database, color: '#f29111' },
    toml: { icon: Coffee, color: '#a1a1aa' },
    lock: { icon: Package, color: '#71717a' },

    // AI (GammaNote Special)
    gguf: { icon: BrainCircuit, color: '#a29bfe' },
    model: { icon: BrainCircuit, color: '#6c5ce7' },

    // Media
    png: { icon: ImageIcon, color: '#fab1a0' },
    jpg: { icon: ImageIcon, color: '#fab1a0' },
    jpeg: { icon: ImageIcon, color: '#fab1a0' },
    svg: { icon: ImageIcon, color: '#ff7675' },
    gif: { icon: ImageIcon, color: '#fab1a0' },
    mp4: { icon: FileVideo, color: '#f472b6' },
    mp3: { icon: FileAudio, color: '#34d399' },

    // Others
    md: { icon: FileText, color: '#71717a' },
    txt: { icon: FileText, color: '#71717a' },
    zip: { icon: FileArchive, color: '#fbbf24' },
    gz: { icon: FileArchive, color: '#fbbf24' },
};

function getFileIcon(name, isDirectory) {
    if (isDirectory) return null;
    const ext = name.split('.').pop()?.toLowerCase();
    return EXT_ICONS[ext] || { icon: File, color: '#71717a' };
}

// ─── Unique Path Helper (collision avoidance) ───
async function getUniquePath(targetDir, fileName) {
    let candidate = targetDir + '\\' + fileName;
    let exists = await window.electronAPI.fs.exists(candidate);
    if (!exists) return candidate;

    // Split name and extension
    const dotIdx = fileName.lastIndexOf('.');
    const baseName = dotIdx > 0 ? fileName.substring(0, dotIdx) : fileName;
    const ext = dotIdx > 0 ? fileName.substring(dotIdx) : '';

    let counter = 1;
    while (exists) {
        candidate = targetDir + '\\' + baseName + '_copy' + (counter > 1 ? counter : '') + ext;
        exists = await window.electronAPI.fs.exists(candidate);
        counter++;
    }
    return candidate;
}

// ─── Paste Helper ───
async function performPaste(clipboard, targetDir) {
    const fileName = clipboard.path.split(/[\\/]/).pop();
    const targetPath = await getUniquePath(targetDir, fileName);

    if (clipboard.type === 'copy') {
        await window.electronAPI.fs.copy(clipboard.path, targetPath);
    } else {
        await window.electronAPI.fs.move(clipboard.path, targetPath);
        useAppStore.getState().clearClipboard();
    }
    useAppStore.getState().triggerRefresh();
}

// ─── Context Menu ───
function ContextMenu({ x, y, items, onClose }) {
    const ref = useRef(null);

    useEffect(() => {
        const handler = () => onClose();
        document.addEventListener('click', handler);
        document.addEventListener('contextmenu', handler);
        return () => {
            document.removeEventListener('click', handler);
            document.removeEventListener('contextmenu', handler);
        };
    }, [onClose]);

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="context-menu"
            style={{ left: x, top: y }}
        >
            {items.map((item, i) =>
                item.separator ? (
                    <div key={i} className="context-menu-separator" />
                ) : (
                    <div
                        key={i}
                        className="context-menu-item"
                        onClick={(e) => {
                            e.stopPropagation();
                            item.action();
                            onClose();
                        }}
                    >
                        {item.icon && <item.icon size={14} />}
                        {item.label}
                    </div>
                )
            )}
        </motion.div>
    );
}

// ─── Tree Node ───
function TreeNode({ entry, depth, onFileClick }) {
    const [expanded, setExpanded] = useState(false);
    const [children, setChildren] = useState([]);
    const [loading, setLoading] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [renaming, setRenaming] = useState(false);
    const [newName, setNewName] = useState(entry.name);
    const [isDragOver, setIsDragOver] = useState(false);

    // Global creation state
    const globalCreating = useAppStore((s) => s.creating);
    const setGlobalCreating = useAppStore((s) => s.setCreating);
    const [createName, setCreateName] = useState('');

    const triggerRefresh = useAppStore((s) => s.triggerRefresh);
    const refreshTrigger = useAppStore((s) => s.refreshTrigger);

    const activeFile = useAppStore((s) => s.activeFile);
    const selectedNode = useAppStore((s) => s.selectedNode);
    const setSelection = useAppStore((s) => s.setSelectedNode);

    const loadChildren = useCallback(async () => {
        if (!entry.isDirectory) return;
        setLoading(true);
        const result = await window.electronAPI.fs.readDir(entry.path);
        setChildren(result || []);
        setLoading(false);
    }, [entry.path, entry.isDirectory]);

    useEffect(() => {
        if (expanded) loadChildren();
    }, [expanded, loadChildren, refreshTrigger]);

    const toggle = () => {
        if (entry.isDirectory) setExpanded(!expanded);
        else onFileClick(entry.path);
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setSelection(entry.path);

        const items = [];
        if (entry.isDirectory) {
            items.push({ label: 'New File', icon: FilePlus, action: () => setGlobalCreating({ type: 'file', path: entry.path }) });
            items.push({ label: 'New Folder', icon: FolderPlus, action: () => setGlobalCreating({ type: 'folder', path: entry.path }) });
            items.push({ separator: true });
        }

        items.push({
            label: 'Copy',
            icon: Clipboard,
            action: () => useAppStore.getState().setClipboard({ type: 'copy', path: entry.path })
        });
        items.push({
            label: 'Cut',
            icon: Scissors,
            action: () => useAppStore.getState().setClipboard({ type: 'cut', path: entry.path })
        });

        const clipboard = useAppStore.getState().clipboard;
        if (clipboard) {
            items.push({
                label: 'Paste',
                icon: ClipboardPaste,
                action: async () => {
                    const targetDir = entry.isDirectory ? entry.path : entry.path.substring(0, entry.path.lastIndexOf('\\'));
                    await performPaste(clipboard, targetDir);
                }
            });
        }

        items.push({ separator: true });
        items.push({ label: 'Rename', icon: Pencil, action: () => { setRenaming(true); setNewName(entry.name); } });
        items.push({ label: 'Delete', icon: Trash2, action: handleDelete });

        setContextMenu({ x: e.clientX, y: e.clientY, items });
    };

    const handleDelete = async () => {
        const rootPath = useAppStore.getState().rootPath;
        useAppStore.getState().setDialog({
            title: 'Confirm Deletion',
            message: `Are you sure you want to delete "${entry.name}"? You can undo with Ctrl+Z.`,
            onConfirm: async () => {
                const result = await window.electronAPI.fs.moveToTrash(entry.path, rootPath);
                if (result) {
                    useAppStore.getState().pushUndo({
                        type: 'delete',
                        trashPath: result.trashPath,
                        originalPath: result.originalPath,
                        name: result.baseName,
                    });
                }
                triggerRefresh();
                useAppStore.getState().setDialog(null);
            }
        });
    };

    const handleRename = async (e) => {
        e.preventDefault();
        if (newName && newName !== entry.name) {
            const pathParts = entry.path.split(/[\\/]/);
            pathParts.pop();
            const dir = pathParts.join('\\');
            const newPath = dir + '\\' + newName;
            await window.electronAPI.fs.rename(entry.path, newPath);
            triggerRefresh();
        }
        setRenaming(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!createName) { setGlobalCreating(null); return; }
        const newPath = entry.path + '\\' + createName;
        if (globalCreating.type === 'file') {
            await window.electronAPI.fs.createFile(newPath);
        } else {
            await window.electronAPI.fs.createFolder(newPath);
        }
        setGlobalCreating(null);
        setCreateName('');
        setExpanded(true);
        triggerRefresh();
    };

    // ─── Drag & Drop ───
    const handleDragStart = (e) => {
        e.dataTransfer.setData('text/plain', entry.path);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        if (entry.isDirectory) {
            e.preventDefault();
            setIsDragOver(true);
        }
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const sourcePath = e.dataTransfer.getData('text/plain');
        if (!sourcePath || sourcePath === entry.path) return;

        const fileName = sourcePath.split(/[\\/]/).pop();
        const targetPath = await getUniquePath(entry.path, fileName);

        await window.electronAPI.fs.move(sourcePath, targetPath);
        triggerRefresh();
    };

    const fileIconInfo = getFileIcon(entry.name, entry.isDirectory);
    const FileIconComponent = fileIconInfo?.icon || File;
    const iconColor = fileIconInfo?.color || '#71717a';
    const clipboard = useAppStore((s) => s.clipboard);
    const isCut = clipboard?.type === 'cut' && clipboard?.path === entry.path;
    const isActive = activeFile === entry.path || selectedNode === entry.path;
    const isLocalCreating = globalCreating && globalCreating.path === entry.path;

    return (
        <div>
            <div
                draggable
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex items-center py-[4px] px-2 cursor-pointer group transition-all duration-150 relative ${isActive ? 'bg-accent/15 text-text-primary' : 'hover:bg-white/[0.04] text-text-secondary hover:text-text-primary'
                    } ${isDragOver ? 'bg-accent/30 scale-[1.02] z-10' : ''} ${isCut ? 'opacity-40 grayscale' : ''}`}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={(e) => {
                    e.stopPropagation();
                    setSelection(entry.path);
                    toggle();
                }}
                onContextMenu={handleContextMenu}
            >
                {entry.isDirectory ? (
                    <>
                        <span className="mr-1 text-text-muted">
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        {expanded ? (
                            <FolderOpen size={15} className="mr-2 text-accent/80 shrink-0 shadow-accent/20 shadow-sm" />
                        ) : (
                            <Folder size={15} className="mr-2 text-text-muted shrink-0" />
                        )}
                    </>
                ) : (
                    <>
                        <span className="mr-1 w-[14px]" />
                        <FileIconComponent size={15} className="mr-2 shrink-0 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" style={{ color: iconColor }} />
                    </>
                )}

                {renaming ? (
                    <form onSubmit={handleRename} className="flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                        <input
                            autoFocus
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onBlur={() => setRenaming(false)}
                            className="w-full bg-surface-3 text-text-primary text-[13px] px-1 py-0.5 rounded border border-accent/40 outline-none font-mono"
                        />
                    </form>
                ) : (
                    <span className="text-[13px] truncate font-medium">{entry.name}</span>
                )}
            </div>

            {/* Context Menu */}
            <AnimatePresence>
                {contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        items={contextMenu.items}
                        onClose={() => setContextMenu(null)}
                    />
                )}
            </AnimatePresence>

            {/* Expanded children / creation form */}
            <AnimatePresence initial={false}>
                {(expanded || isLocalCreating) && entry.isDirectory && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        className="overflow-hidden"
                    >
                        {/* Inline create form (Shortcut triggered) */}
                        {isLocalCreating && (
                            <form
                                onSubmit={handleCreate}
                                style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
                                className="flex items-center py-1.5 bg-accent/5"
                                onClick={e => e.stopPropagation()}
                            >
                                {globalCreating.type === 'folder' ? <FolderPlus size={14} className="mr-2 text-accent" /> : <FilePlus size={14} className="mr-2 text-accent" />}
                                <input
                                    autoFocus
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    onBlur={() => setGlobalCreating(null)}
                                    placeholder={globalCreating.type === 'folder' ? 'Folder name...' : 'File name...'}
                                    className="flex-1 bg-surface-3 text-text-primary text-[13px] px-1 py-0.5 rounded border border-accent/40 outline-none font-mono mr-2 shadow-inner"
                                />
                            </form>
                        )}

                        {children.map((child) => (
                            <TreeNode
                                key={child.path}
                                entry={child}
                                depth={depth + 1}
                                onFileClick={onFileClick}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Main File Explorer ───
export default function FileExplorer() {
    const rootPath = useAppStore((s) => s.rootPath);
    const setRootPath = useAppStore((s) => s.setRootPath);
    const openFile = useAppStore((s) => s.openFile);
    const refreshTrigger = useAppStore((s) => s.refreshTrigger);
    const globalCreating = useAppStore((s) => s.creating);
    const setGlobalCreating = useAppStore((s) => s.setCreating);

    const [rootEntries, setRootEntries] = useState([]);
    const [isRootDragOver, setIsRootDragOver] = useState(false);

    useEffect(() => {
        if (!rootPath) return;

        // Start Electron watcher
        window.electronAPI.fs.startWatcher(rootPath);

        // Initial load
        window.electronAPI.fs.readDir(rootPath).then((entries) => {
            setRootEntries(entries || []);
        });

        // Listen for changes
        const cleanup = window.electronAPI.fs.onChanged(() => {
            console.log('[Explorer] FS changed, refreshing...');
            useAppStore.getState().triggerRefresh();
        });

        return cleanup;
    }, [rootPath, refreshTrigger]);

    const handleOpenFolder = async () => {
        const folder = await window.electronAPI.dialog.openFolder();
        if (folder) {
            setRootPath(folder);
            useAppStore.getState().setSelectedNode(folder);
        }
    };

    const handleRootDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsRootDragOver(true);
    };

    const handleRootDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsRootDragOver(false);
        const sourcePath = e.dataTransfer.getData('text/plain');
        if (!sourcePath || !rootPath) return;

        const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('\\'));
        if (sourceDir === rootPath || sourcePath === rootPath) return;

        const fileName = sourcePath.split(/[\\/]/).pop();
        const targetPath = await getUniquePath(rootPath, fileName);

        await window.electronAPI.fs.move(sourcePath, targetPath);
        useAppStore.getState().triggerRefresh();
    };

    // ─── Keyboard Shortcuts ───
    useEffect(() => {
        const handleKeyDown = async (e) => {
            const state = useAppStore.getState();
            const selectedNode = state.selectedNode;
            const clipboard = state.clipboard;

            // Ctrl+Z: Undo last deletion
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                const action = state.popUndo();
                if (action && action.type === 'delete') {
                    const ok = await window.electronAPI.fs.restoreFromTrash(action.trashPath, action.originalPath);
                    if (ok) {
                        state.triggerRefresh();
                    }
                }
                return;
            }

            // Handle Delete
            if (e.key === 'Delete' && selectedNode) {
                const nodeName = selectedNode.split(/[\\/]/).pop();
                state.setDialog({
                    title: 'Confirm Deletion',
                    message: `Are you sure you want to delete "${nodeName}"? You can undo with Ctrl+Z.`,
                    onConfirm: async () => {
                        const result = await window.electronAPI.fs.moveToTrash(selectedNode, rootPath);
                        if (result) {
                            state.pushUndo({
                                type: 'delete',
                                trashPath: result.trashPath,
                                originalPath: result.originalPath,
                                name: result.baseName,
                            });
                        }
                        state.triggerRefresh();
                        state.setDialog(null);
                        state.setSelectedNode(null);
                    }
                });
                return;
            }

            // Handle Ctrl Shortcuts
            if (e.ctrlKey) {
                if (e.key === 'c' && selectedNode) {
                    state.setClipboard({ type: 'copy', path: selectedNode });
                } else if (e.key === 'x' && selectedNode) {
                    state.setClipboard({ type: 'cut', path: selectedNode });
                } else if (e.key === 'v' && clipboard) {
                    try {
                        let targetDir = rootPath; // Default: paste to root
                        if (selectedNode) {
                            const stat = await window.electronAPI.fs.stat(selectedNode);
                            targetDir = stat?.isDirectory ? selectedNode : selectedNode.substring(0, selectedNode.lastIndexOf('\\'));
                        }
                        await performPaste(clipboard, targetDir);
                    } catch (err) {
                        console.error('Paste failed:', err);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [rootPath]);

    const folderName = rootPath ? rootPath.split(/[\\/]/).pop() || rootPath : null;

    const [rootContextMenu, setRootContextMenu] = useState(null);

    const handleRootContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const clipboard = useAppStore.getState().clipboard;
        const items = [
            { label: 'New File', icon: FilePlus, action: () => setGlobalCreating({ type: 'file', path: rootPath }) },
            { label: 'New Folder', icon: FolderPlus, action: () => setGlobalCreating({ type: 'folder', path: rootPath }) },
        ];

        if (clipboard) {
            items.push({ separator: true });
            items.push({
                label: 'Paste',
                icon: ClipboardPaste,
                action: async () => {
                    await performPaste(clipboard, rootPath);
                }
            });
        }

        // Undo option
        const undoStack = useAppStore.getState().undoStack;
        if (undoStack.length > 0) {
            items.push({ separator: true });
            items.push({
                label: `Undo Delete "${undoStack[undoStack.length - 1].name}"`,
                icon: Undo2,
                action: async () => {
                    const action = useAppStore.getState().popUndo();
                    if (action && action.type === 'delete') {
                        await window.electronAPI.fs.restoreFromTrash(action.trashPath, action.originalPath);
                        useAppStore.getState().triggerRefresh();
                    }
                }
            });
        }

        setRootContextMenu({ x: e.clientX, y: e.clientY, items });
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full flex flex-col bg-surface-1/50 overflow-hidden border-r border-border/10"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 shrink-0 bg-white/[0.02]">
                <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-text-muted/80">Explorer</span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setGlobalCreating({ type: 'file', path: rootPath })}
                        className="p-1 rounded hover:bg-white/[0.08] text-text-muted hover:text-accent transition-all duration-200"
                        title="New File"
                    >
                        <FilePlus size={14} />
                    </button>
                    <button
                        onClick={handleOpenFolder}
                        className="p-1 rounded hover:bg-white/[0.08] text-text-muted hover:text-accent transition-all duration-200 ml-1"
                        title="Open Folder"
                    >
                        <FolderOpenDot size={15} />
                    </button>
                </div>
            </div>

            {/* Folder name badge */}
            {folderName && (
                <div className="px-4 py-2.5 border-b border-border/20 bg-accent/5">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                        <span className="text-[12px] font-semibold text-text-primary truncate uppercase tracking-tight">{folderName}</span>
                    </div>
                </div>
            )}

            {/* Tree — fills all remaining space so empty area is clickable */}
            <div
                className={`flex-1 overflow-y-auto overflow-x-hidden transition-colors duration-300 ${isRootDragOver ? 'bg-accent/10' : ''}`}
                onDragOver={handleRootDragOver}
                onDragLeave={() => setIsRootDragOver(false)}
                onDrop={handleRootDrop}
                onContextMenu={handleRootContextMenu}
                onClick={() => useAppStore.getState().setSelectedNode(rootPath)}
                style={{ display: 'flex', flexDirection: 'column' }}
            >
                {rootPath ? (
                    <>
                        <div>
                            {globalCreating && globalCreating.path === rootPath && (
                                <TreeNodeForm
                                    type={globalCreating.type}
                                    onCancel={() => setGlobalCreating(null)}
                                    onSubmit={async (name) => {
                                        const newPath = rootPath + '\\' + name;
                                        if (globalCreating.type === 'file') await window.electronAPI.fs.createFile(newPath);
                                        else await window.electronAPI.fs.createFolder(newPath);
                                        setGlobalCreating(null);
                                        useAppStore.getState().triggerRefresh();
                                    }}
                                />
                            )}
                            {rootEntries.length > 0 ? (
                                rootEntries.map((entry) => (
                                    <TreeNode
                                        key={entry.path}
                                        entry={entry}
                                        depth={0}
                                        onFileClick={openFile}
                                    />
                                ))
                            ) : (
                                <div className="text-text-muted text-xs p-8 text-center opacity-50 italic">Empty folder — Right click to create</div>
                            )}
                        </div>
                        {/* Spacer that fills remaining area for right-click target */}
                        <div className="flex-1 min-h-[60px]" />
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
                        <div className="relative">
                            <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 4, repeat: Infinity }}
                                className="w-16 h-16 rounded-[2rem] bg-gradient-to-tr from-accent/20 to-accent/5 flex items-center justify-center border border-accent/10 shadow-2xl shadow-accent/20"
                            >
                                <FolderOpenDot size={32} className="text-accent/60" />
                            </motion.div>
                        </div>
                        <div className="space-y-1.5 px-4">
                            <p className="text-text-primary text-sm font-semibold tracking-tight">Project Workspace</p>
                            <p className="text-text-muted text-[12px] leading-relaxed">Select a directory to begin your creative session in Gamanote.</p>
                        </div>
                        <button
                            onClick={handleOpenFolder}
                            className="mt-2 w-full max-w-[180px] px-5 py-2.5 bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-xl text-accent text-sm font-bold transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] shadow-lg shadow-black/20"
                        >
                            Select Folder
                        </button>
                        <button
                            onClick={async () => {
                                useAppStore.getState().setDialog({
                                    title: 'Create New Project',
                                    message: 'Enter a name for your new project folder:',
                                    inputType: 'text',
                                    inputPlaceholder: 'my-awesome-project',
                                    onConfirm: async (name) => {
                                        if (!name || !name.trim()) return;
                                        const parent = await window.electronAPI?.dialog.createFolder();
                                        if (parent) {
                                            try {
                                                const fullPath = `${parent}\\${name.trim()}`.replace(/\\\\/g, '\\');
                                                await window.electronAPI?.fs.createFolder(fullPath);
                                                useAppStore.getState().setRootPath(fullPath);
                                            } catch (err) {
                                                console.error('Failed to create folder:', err);
                                                useAppStore.getState().setDialog({
                                                    title: 'Creation Error',
                                                    message: 'Could not create the folder. Check if it already exists.'
                                                });
                                            }
                                        }
                                    }
                                });
                            }}
                            className="mt-1 w-full max-w-[180px] px-5 py-2.5 bg-accent/5 hover:bg-accent/10 border border-accent/10 rounded-xl text-accent/80 text-sm font-bold transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
                        >
                            Create Folder
                        </button>

                        {/* Recent Projects Sidebar Section */}
                        {useAppStore.getState().recentProjects?.length > 0 && (
                            <div className="w-full mt-8 pt-4 border-t border-border/10">
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-text-muted/40 mb-3 px-2">
                                    <Clock size={11} /> Recent Projects
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    {useAppStore.getState().recentProjects.slice(0, 5).map((p, i) => (
                                        <div key={i} className="flex items-center justify-between group rounded-lg hover:bg-white/[0.03] transition-colors pr-1">
                                            <button
                                                onClick={() => setRootPath(p)}
                                                className="flex flex-col items-start flex-1 px-3 py-1.5 truncate group"
                                            >
                                                <span className="text-[12px] font-medium text-text-muted/60 group-hover:text-text-primary truncate w-full text-left">
                                                    {p.split(/[\\/]/).pop() || p}
                                                </span>
                                                <span className="text-[9px] text-text-muted/30 truncate w-full text-left">{p}</span>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); useAppStore.getState().removeRecentProject(p); }}
                                                className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-text-muted/40 hover:text-red-400 transition-all"
                                                title="Remove from history"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Root Context Menu */}
            <AnimatePresence>
                {rootContextMenu && (
                    <ContextMenu
                        x={rootContextMenu.x}
                        y={rootContextMenu.y}
                        items={rootContextMenu.items}
                        onClose={() => setRootContextMenu(null)}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function TreeNodeForm({ type, onSubmit, onCancel }) {
    const [name, setName] = useState('');
    return (
        <form
            onSubmit={(e) => { e.preventDefault(); onSubmit(name); }}
            className="flex items-center py-2 px-4 bg-accent/5 border-b border-accent/10"
        >
            {type === 'folder' ? <FolderPlus size={14} className="mr-2 text-accent" /> : <FilePlus size={14} className="mr-2 text-accent" />}
            <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={onCancel}
                placeholder={type === 'folder' ? 'Folder name...' : 'File name...'}
                className="flex-1 bg-surface-3 text-text-primary text-[13px] px-2 py-1 rounded border border-accent/40 outline-none font-mono shadow-inner"
            />
        </form>
    );
}
