import React, { useState } from 'react';
import {
    File,
    Terminal as TermIcon,
    Settings,
    FolderOpen,
    FilePlus,
    FolderPlus,
    Save,
    Trash2,
    Database,
    History,
    Download,
    ChevronDown,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Columns,
    Layout,
    AlertCircle,
    SplitSquareVertical,
    SplitSquareHorizontal,
    Star,
    Globe,
    GitBranch
} from 'lucide-react';

const BookmarkItem = ({ bookmark, onClick, onDelete }) => (
    <div className="w-full flex items-center justify-between px-3 py-2 text-xs rounded transition-colors text-text-secondary hover:bg-white/[0.06] hover:text-white group">
        <button
            onClick={onClick}
            className="flex-1 flex items-center gap-2 text-left truncate mr-2"
        >
            <Globe size={14} className="shrink-0" />
            <span className="truncate">{bookmark.title || bookmark.url}</span>
        </button>
        <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-400/20 text-text-muted hover:text-red-400 transition-all shrink-0"
            title="Remove bookmark"
        >
            <Trash2 size={12} />
        </button>
    </div>
);
import useAppStore from '../store/useAppStore';

const MenuButton = ({ label, icon: Icon, children, isOpen, onToggle }) => (
    <div className="relative">
        <button
            onClick={onToggle}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded transition-colors ${isOpen ? 'bg-white/[0.08] text-white' : 'text-text-muted hover:bg-white/[0.04] hover:text-text-primary'
                }`}
        >
            <Icon size={14} className={isOpen ? 'text-accent' : ''} />
            <span>{label}</span>
            <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-surface-1 border border-border rounded-lg shadow-2xl p-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                {children}
            </div>
        )}
    </div>
);

const MenuItem = ({ label, icon: Icon, onClick, shortcut, danger, info, active }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded transition-colors ${danger
            ? 'text-red-400 hover:bg-red-400/10'
            : active
                ? 'bg-accent/20 text-accent'
                : 'text-text-secondary hover:bg-white/[0.06] hover:text-white'
            }`}
    >
        <div className="flex items-center gap-2">
            <Icon size={14} />
            <span>{label}</span>
        </div>
        <div className="flex items-center gap-2">
            {info && <span className="text-[10px] text-accent font-mono">{info}</span>}
            {shortcut && <span className="text-[10px] text-text-muted font-mono">{shortcut}</span>}
        </div>
    </button>
);

export default function TopBar() {
    const [activeMenu, setActiveMenu] = useState(null);
    const rootPath = useAppStore(s => s.rootPath);
    const setRootPath = useAppStore(s => s.setRootPath);

    const editorFontSize = useAppStore(s => s.editorFontSize);
    const setEditorFontSize = useAppStore(s => s.setEditorFontSize);
    const terminalFontSize = useAppStore(s => s.terminalFontSize);
    const setTerminalFontSize = useAppStore(s => s.setTerminalFontSize);
    const zoom = useAppStore(s => s.zoom);
    const setZoom = useAppStore(s => s.setZoom);

    const toggleTerminal = useAppStore(s => s.toggleTerminal);
    const toggleProblems = useAppStore(s => s.toggleProblems);
    const toggleEditorSplit = useAppStore(s => s.toggleEditorSplit);

    const editorSplit = useAppStore(s => s.editorSplit);
    const terminalVisible = useAppStore(s => s.terminalVisible);
    const problemsVisible = useAppStore(s => s.problemsVisible);

    const toggleMenu = (menu) => setActiveMenu(activeMenu === menu ? null : menu);

    const bookmarks = useAppStore(s => s.bookmarks);
    const removeBookmark = useAppStore(s => s.removeBookmark);
    const browserVisible = useAppStore(s => s.browserVisible);
    const toggleBrowser = useAppStore(s => s.toggleBrowser);
    const gitVisible = useAppStore(s => s.gitVisible);
    const toggleGit = useAppStore(s => s.toggleGit);

    const handleBookmarkClick = (url) => {
        if (!browserVisible) toggleBrowser();
        window.dispatchEvent(new CustomEvent('navigate-browser', { detail: url }));
        setActiveMenu(null);
    };

    const handleOpenFolder = async () => {
        const folder = await window.electronAPI.dialog.openFolder();
        if (folder) setRootPath(folder);
        setActiveMenu(null);
    };

    const handleZoomIn = () => {
        const newZoom = Math.min(zoom + 0.1, 2.0);
        setZoom(newZoom);
        window.electronAPI.window.setZoomFactor(newZoom);
    };

    const handleZoomOut = () => {
        const newZoom = Math.max(zoom - 0.1, 0.5);
        setZoom(newZoom);
        window.electronAPI.window.setZoomFactor(newZoom);
    };

    const handleZoomReset = () => {
        setZoom(1.0);
        setEditorFontSize(14);
        setTerminalFontSize(13);
        window.electronAPI.window.setZoomFactor(1.0);
    };

    const dispatchHotkey = (key, shift = false) => {
        const e = new KeyboardEvent('keydown', {
            key: key,
            ctrlKey: true,
            shiftKey: shift,
            bubbles: true
        });
        window.dispatchEvent(e);
        setActiveMenu(null);
    };

    const handleCreateProject = async () => {
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
                        console.error('Failed to create project:', err);
                        useAppStore.getState().setDialog({
                            title: 'Creation Error',
                            message: 'Could not create the project. Check if the folder already exists.'
                        });
                    }
                }
            }
        });
        setActiveMenu(null);
    };

    return (
        <div className="h-10 border-b border-border bg-surface-0 flex items-center px-4 justify-between shrink-0 z-50">
            <div className="flex items-center gap-1">
                <MenuButton
                    label="File"
                    icon={File}
                    isOpen={activeMenu === 'file'}
                    onToggle={() => toggleMenu('file')}
                >
                    <MenuItem
                        label="Create New Project"
                        icon={FolderPlus}
                        onClick={handleCreateProject}
                    />
                    <div className="h-px bg-border my-1" />
                    <MenuItem
                        label="New File"
                        icon={FilePlus}
                        shortcut="Ctrl+N"
                        onClick={() => dispatchHotkey('n')}
                    />
                    <MenuItem
                        label="New Folder"
                        icon={FolderPlus}
                        shortcut="Ctrl+Shift+N"
                        onClick={() => dispatchHotkey('n', true)}
                    />
                    <MenuItem
                        label="Open Folder"
                        icon={FolderOpen}
                        shortcut="Ctrl+O"
                        onClick={handleOpenFolder}
                    />
                    <div className="h-px bg-border my-1" />
                    <MenuItem
                        label="Save"
                        icon={Save}
                        shortcut="Ctrl+S"
                        onClick={() => { window.dispatchEvent(new CustomEvent('ide-save')); setActiveMenu(null); }}
                    />
                    <MenuItem
                        label="Save As..."
                        icon={Save}
                        shortcut="Ctrl+Shift+S"
                        onClick={() => { window.dispatchEvent(new CustomEvent('ide-save-as')); setActiveMenu(null); }}
                    />
                </MenuButton>

                <MenuButton
                    label="Bookmarks"
                    icon={Star}
                    isOpen={activeMenu === 'bookmarks'}
                    onToggle={() => toggleMenu('bookmarks')}
                >
                    {bookmarks?.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-text-muted italic">No bookmarks saved yet</div>
                    ) : (
                        bookmarks?.map((b, i) => (
                            <BookmarkItem
                                key={i}
                                bookmark={b}
                                onClick={() => handleBookmarkClick(b.url)}
                                onDelete={() => removeBookmark(b.url)}
                            />
                        ))
                    )}
                </MenuButton>

                <MenuButton
                    label="View"
                    icon={Layout}
                    isOpen={activeMenu === 'view'}
                    onToggle={() => toggleMenu('view')}
                >
                    <MenuItem
                        label="Toggle Terminal"
                        icon={TermIcon}
                        shortcut="Ctrl+`"
                        active={terminalVisible}
                        onClick={() => { toggleTerminal(); setActiveMenu(null); }}
                    />
                    <MenuItem
                        label="Toggle Problems"
                        icon={AlertCircle}
                        shortcut="Ctrl+Shift+M"
                        active={problemsVisible}
                        onClick={() => { toggleProblems(); setActiveMenu(null); }}
                    />
                    <div className="h-px bg-border my-1" />
                    <MenuItem
                        label="Split Editor"
                        icon={SplitSquareHorizontal}
                        shortcut="Ctrl+\"
                        active={editorSplit}
                        onClick={() => { toggleEditorSplit(); setActiveMenu(null); }}
                    />
                    <div className="h-px bg-border my-1" />
                    <MenuItem
                        label="Git Panel"
                        icon={GitBranch}
                        active={gitVisible}
                        onClick={() => { toggleGit(); setActiveMenu(null); }}
                    />
                </MenuButton>

                <MenuButton
                    label="Settings"
                    icon={Settings}
                    isOpen={activeMenu === 'settings'}
                    onToggle={() => toggleMenu('settings')}
                >
                    <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase text-text-muted/60">Scale & Zoom</div>
                    <MenuItem
                        label="Editor Font +"
                        icon={ZoomIn}
                        info={`${editorFontSize}px`}
                        onClick={() => { setEditorFontSize(Math.min(editorFontSize + 1, 28)); }}
                    />
                    <MenuItem
                        label="Editor Font −"
                        icon={ZoomOut}
                        info={`${editorFontSize}px`}
                        onClick={() => { setEditorFontSize(Math.max(editorFontSize - 1, 10)); }}
                    />
                    <MenuItem
                        label="Terminal Font +"
                        icon={ZoomIn}
                        info={`${terminalFontSize}px`}
                        onClick={() => { setTerminalFontSize(Math.min(terminalFontSize + 1, 24)); }}
                    />
                    <MenuItem
                        label="Terminal Font −"
                        icon={ZoomOut}
                        info={`${terminalFontSize}px`}
                        onClick={() => { setTerminalFontSize(Math.max(terminalFontSize - 1, 9)); }}
                    />
                    <div className="h-px bg-border my-1" />
                    <MenuItem
                        label="UI Zoom In"
                        icon={ZoomIn}
                        info={`${Math.round(zoom * 100)}%`}
                        shortcut="Ctrl+="
                        onClick={handleZoomIn}
                    />
                    <MenuItem
                        label="UI Zoom Out"
                        icon={ZoomOut}
                        info={`${Math.round(zoom * 100)}%`}
                        shortcut="Ctrl+-"
                        onClick={handleZoomOut}
                    />
                    <MenuItem
                        label="Reset All Zoom"
                        icon={RotateCcw}
                        onClick={handleZoomReset}
                    />
                    <div className="h-px bg-border my-1" />
                    <MenuItem
                        label="Export Project as ZIP"
                        icon={Download}
                        onClick={async () => {
                            if (!rootPath) { alert('Open a folder first.'); return; }
                            const ok = await window.electronAPI?.fs.exportZIP(rootPath);
                            if (ok) alert('Project exported successfully!');
                            setActiveMenu(null);
                        }}
                    />
                </MenuButton>
            </div>

            <div className="flex items-center gap-4 text-[10px] text-text-muted font-mono">
                {rootPath && (
                    <span className="bg-surface-3 px-2 py-0.5 rounded border border-border/40 max-w-[300px] truncate">
                        {rootPath}
                    </span>
                )}
            </div>
        </div>
    );
}
