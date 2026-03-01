import { create } from 'zustand';

let termIdCounter = 0;

const useAppStore = create((set, get) => ({
    // Root folder path
    rootPath: null,
    setRootPath: (p) => {
        set((s) => {
            if (!p) return { rootPath: p };
            // Add to recent projects
            const recent = [p, ...s.recentProjects.filter(rp => rp !== p)].slice(0, 5);
            window.electronAPI.settings.save({ recentProjects: recent });
            return { rootPath: p, recentProjects: recent };
        });
    },

    recentProjects: [],
    removeRecentProject: (p) => {
        set((s) => {
            const recent = s.recentProjects.filter(rp => rp !== p);
            window.electronAPI.settings.save({ recentProjects: recent });
            return { recentProjects: recent };
        });
    },

    // Open files (tabs)
    openFiles: [],
    activeFile: null,
    activeFileSecondary: null,
    focusedEditor: 'primary', // 'primary' or 'secondary'

    // Explorer selection
    selectedNode: null,
    setSelectedNode: (path) => set({ selectedNode: path }),

    setFocusedEditor: (side) => set({ focusedEditor: side }),

    openFile: (filePath) => {
        const { openFiles, focusedEditor, activeFile } = get();
        const nextState = {};

        if (!openFiles.includes(filePath)) {
            nextState.openFiles = [...openFiles, filePath];
        }

        if (focusedEditor === 'primary') {
            nextState.activeFile = filePath;
        } else {
            nextState.activeFileSecondary = filePath;
        }

        set(nextState);
    },

    closeFile: (filePath) => {
        const { openFiles, activeFile, activeFileSecondary } = get();
        const newFiles = openFiles.filter((f) => f !== filePath);
        const nextState = { openFiles: newFiles };

        if (activeFile === filePath) {
            const idx = openFiles.indexOf(filePath);
            nextState.activeFile = newFiles[Math.min(idx, newFiles.length - 1)] || null;
        }
        if (activeFileSecondary === filePath) {
            const idx = openFiles.indexOf(filePath);
            nextState.activeFileSecondary = newFiles[Math.min(idx, newFiles.length - 1)] || null;
        }
        set(nextState);
    },

    closeAllFiles: () => set({ openFiles: [], activeFile: null, activeFileSecondary: null }),

    setActiveFile: (filePath) => {
        const { focusedEditor } = get();
        if (focusedEditor === 'primary') {
            set({ activeFile: filePath });
        } else {
            set({ activeFileSecondary: filePath });
        }
    },

    // Terminal state — single persistent terminal
    terminalVisible: true,
    toggleTerminal: () => set((s) => ({ terminalVisible: !s.terminalVisible })),
    setTerminalVisible: (v) => set({ terminalVisible: v }),
    terminalId: 1, // Constant ID for the single terminal
    // addTerminal and removeTerminal are now simplified/deprecated for multi-terminal
    addTerminal: () => {
        set({ terminalVisible: true });
        return 1;
    },
    removeTerminal: () => set({ terminalVisible: false }),

    // Problems panel
    problemsVisible: false,
    toggleProblems: () => set((s) => ({ problemsVisible: !s.problemsVisible })),
    setProblemsVisible: (v) => set({ problemsVisible: v }),

    // Editor split
    editorSplit: false,
    toggleEditorSplit: () => set((s) => ({
        editorSplit: !s.editorSplit,
        // When splitting, sync the secondary editor with the primary active file if null
        activeFileSecondary: (!s.editorSplit && !s.activeFileSecondary) ? s.activeFile : s.activeFileSecondary
    })),

    // Browser panel
    browserVisible: true,
    toggleBrowser: () => set((s) => ({ browserVisible: !s.browserVisible })),
    browserUrl: 'https://www.google.com',
    setBrowserUrl: (url) => {
        set({ browserUrl: url });
        window.electronAPI.settings.save({ browserUrl: url });
    },

    // Bookmarks
    bookmarks: [],
    addBookmark: (bookmark) => {
        set((s) => {
            const next = [...s.bookmarks, bookmark];
            window.electronAPI.settings.save({ bookmarks: next });
            return { bookmarks: next };
        });
    },
    removeBookmark: (url) => {
        set((s) => {
            const next = s.bookmarks.filter(b => b.url !== url);
            window.electronAPI.settings.save({ bookmarks: next });
            return { bookmarks: next };
        });
    },

    // Explorer visibility
    explorerVisible: true,
    toggleExplorer: () => set((s) => ({ explorerVisible: !s.explorerVisible })),

    // Git panel visibility
    gitVisible: false,
    toggleGit: () => set((s) => ({ gitVisible: !s.gitVisible })),

    // Creating file/folder state
    creating: null,
    setCreating: (val) => set({ creating: val }),

    // Clipboard for files/folders
    clipboard: null,
    setClipboard: (val) => set({ clipboard: val }),
    clearClipboard: () => set({ clipboard: null }),

    // Dialog State
    dialog: null,
    setDialog: (val) => set({ dialog: val }),

    // Zoom / Scale
    zoom: 1,
    setZoom: (val) => set({ zoom: val }),
    editorFontSize: 14,
    setEditorFontSize: (val) => set({ editorFontSize: val }),
    terminalFontSize: 13,
    setTerminalFontSize: (val) => set({ terminalFontSize: val }),

    // Undo stack for file operations
    undoStack: [],
    pushUndo: (action) => set((s) => ({ undoStack: [...s.undoStack, action] })),
    popUndo: () => {
        const { undoStack } = get();
        if (undoStack.length === 0) return null;
        const action = undoStack[undoStack.length - 1];
        set({ undoStack: undoStack.slice(0, -1) });
        return action;
    },

    // File explorer refresh trigger
    refreshTrigger: 0,
    triggerRefresh: () => set((s) => ({ refreshTrigger: s.refreshTrigger + 1 })),

    // Load initial settings from disk
    loadInitialSettings: (settings) => {
        if (!settings) return;
        set((s) => ({
            recentProjects: settings.recentProjects || s.recentProjects,
            browserUrl: settings.browserUrl || s.browserUrl,
            bookmarks: settings.bookmarks || s.bookmarks,
        }));
    },
}));

export default useAppStore;
