import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';
import { X, Code2, FileCode, Eye, EyeOff, FolderOpen, FolderPlus, Trash2, Clock } from 'lucide-react';
import useAppStore from '../store/useAppStore';

function getLanguage(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const map = {
        js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
        py: 'python', html: 'html', htm: 'html', css: 'css', scss: 'scss',
        json: 'json', md: 'markdown', xml: 'xml', yaml: 'yaml', yml: 'yaml',
        sql: 'sql', sh: 'shell', bat: 'bat', ps1: 'powershell',
        c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', java: 'java',
        rs: 'rust', go: 'go', rb: 'ruby', php: 'php',
        toml: 'ini', ini: 'ini', env: 'ini',
        txt: 'plaintext', log: 'plaintext', gitignore: 'plaintext',
    };
    return map[ext] || 'plaintext';
}

function getFileName(filePath) {
    return filePath.split('\\').pop() || filePath.split('/').pop() || filePath;
}

function isMarkdown(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    return ext === 'md' || ext === 'markdown';
}

// Simple markdown to HTML renderer
function renderMarkdown(text) {
    if (!text) return '';
    let html = text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;margin:12px 0 6px;color:#e4e4e7">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;margin:14px 0 8px;color:#e4e4e7">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:700;margin:16px 0 10px;color:#e4e4e7">$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code style="background:rgba(99,102,241,.15);padding:2px 5px;border-radius:3px;font-size:12px">$1</code>')
        .replace(/^```(\w*)\n([\s\S]*?)```$/gm, (_, lang, code) =>
            `<pre style="background:#1a1a2e;padding:10px;border-radius:6px;overflow-x:auto;font-size:12px;margin:8px 0"><code>${code}</code></pre>`)
        .replace(/^- (.+)$/gm, '<li style="margin:2px 0;padding-left:8px">• $1</li>')
        .replace(/^\d+\. (.+)$/gm, '<li style="margin:2px 0;padding-left:8px">$1</li>')
        .replace(/\n/g, '<br/>');
    return html;
}

// Auto-complete registration
function registerAutoComplete(monaco) {
    const keywords = {
        javascript: ['console.log', 'document.getElementById', 'addEventListener', 'querySelector', 'fetch', 'async', 'await', 'Promise', 'setTimeout', 'setInterval', 'Array.from', 'Object.keys', 'JSON.parse', 'JSON.stringify', 'export default', 'import', 'require', 'module.exports'],
        python: ['print(', 'def ', 'class ', 'import ', 'from ', 'return ', 'if __name__', 'self.', 'try:', 'except:', 'with open', 'for i in range', 'list(', 'dict(', 'str(', 'int(', 'len(', 'enumerate(', 'zip(', 'map(', 'filter(', 'lambda '],
        html: ['<!DOCTYPE html>', '<html>', '<head>', '<body>', '<div>', '<span>', '<p>', '<a href="">', '<img src="">', '<script>', '<style>', '<link rel="stylesheet">', '<meta charset="UTF-8">'],
        css: ['display: flex;', 'justify-content:', 'align-items:', 'background-color:', 'border-radius:', 'box-shadow:', 'transition:', 'transform:', 'position:', 'z-index:', '@media', 'grid-template-columns:'],
    };

    const langs = ['javascript', 'typescript', 'python', 'html', 'css'];
    langs.forEach(lang => {
        monaco.languages.registerCompletionItemProvider(lang, {
            provideCompletionItems: (model, position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                };
                const items = (keywords[lang] || keywords.javascript).map(k => ({
                    label: k,
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: k,
                    range,
                }));
                return { suggestions: items };
            }
        });
    });
}

let autoCompleteRegistered = false;

export default function EditorPanel({ side = 'primary' }) {
    const openFiles = useAppStore((s) => s.openFiles);
    const activeFile = useAppStore((s) => (side === 'primary' ? s.activeFile : s.activeFileSecondary));
    const focusedEditor = useAppStore((s) => s.focusedEditor);
    const setActiveFile = useAppStore((s) => s.setActiveFile);
    const setFocusedEditor = useAppStore((s) => s.setFocusedEditor);
    const closeFile = useAppStore((s) => s.closeFile);
    const editorFontSize = useAppStore((s) => s.editorFontSize);
    const setRootPath = useAppStore((s) => s.setRootPath);
    const recentProjects = useAppStore((s) => s.recentProjects);
    const removeRecentProject = useAppStore((s) => s.removeRecentProject);

    const [fileContents, setFileContents] = useState({});
    const [modified, setModified] = useState({});
    const [showPreview, setShowPreview] = useState(false);
    const [dragOver, setDragOver] = useState(null);
    const editorRef = useRef(null);

    const isFocused = focusedEditor === side;
    const activeIsMarkdown = activeFile && isMarkdown(activeFile);

    // Load file content
    useEffect(() => {
        if (!activeFile || fileContents[activeFile] !== undefined) return;
        window.electronAPI.fs.readFile(activeFile).then((content) => {
            if (content !== null) setFileContents((prev) => ({ ...prev, [activeFile]: content }));
        });
    }, [activeFile]);

    // Save function
    const saveActiveFile = useCallback(async () => {
        if (activeFile && fileContents[activeFile] !== undefined) {
            await window.electronAPI.fs.writeFile(activeFile, fileContents[activeFile]);
            setModified((prev) => ({ ...prev, [activeFile]: false }));
        }
    }, [activeFile, fileContents]);

    // Save As function
    const saveFileAs = useCallback(async () => {
        if (!activeFile || fileContents[activeFile] === undefined) return;
        const currentName = getFileName(activeFile);
        const newPath = await window.electronAPI?.dialog.saveAs(currentName);
        if (newPath) {
            await window.electronAPI.fs.writeFile(newPath, fileContents[activeFile]);
            // Close old tab and open new one
            setFileContents((prev) => { const n = { ...prev }; delete n[activeFile]; return n; });
            setModified((prev) => { const n = { ...prev }; delete n[activeFile]; return n; });
            closeFile(activeFile);
            useAppStore.getState().openFile(newPath);
            setTimeout(() => setFocusedEditor(side), 100);
        }
    }, [activeFile, fileContents, closeFile, side, setFocusedEditor]);

    // Save on Ctrl+S
    useEffect(() => {
        const handler = (e) => {
            if (isFocused && (e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (e.shiftKey) {
                    saveFileAs();
                } else {
                    saveActiveFile();
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isFocused, saveActiveFile, saveFileAs]);

    // Listen for global save events from TopBar File Menu
    useEffect(() => {
        const handleGlobalSave = () => { if (isFocused) saveActiveFile(); };
        const handleGlobalSaveAs = () => { if (isFocused) saveFileAs(); };
        window.addEventListener('ide-save', handleGlobalSave);
        window.addEventListener('ide-save-as', handleGlobalSaveAs);
        return () => {
            window.removeEventListener('ide-save', handleGlobalSave);
            window.removeEventListener('ide-save-as', handleGlobalSaveAs);
        };
    }, [isFocused, saveActiveFile, saveFileAs]);

    const handleEditorChange = useCallback((value) => {
        if (activeFile) {
            setFileContents((prev) => ({ ...prev, [activeFile]: value }));
            setModified((prev) => ({ ...prev, [activeFile]: true }));
        }
    }, [activeFile]);

    const handleEditorMount = useCallback((editor, monaco) => {
        editorRef.current = editor;
        if (!autoCompleteRegistered) {
            registerAutoComplete(monaco);
            autoCompleteRegistered = true;
        }
    }, []);

    const handleTabClick = (filePath) => {
        setFocusedEditor(side);
        setActiveFile(filePath);
    };

    const handleCloseTab = (e, filePath) => {
        e.stopPropagation();
        setFileContents((prev) => { const n = { ...prev }; delete n[filePath]; return n; });
        setModified((prev) => { const n = { ...prev }; delete n[filePath]; return n; });
        closeFile(filePath);
    };

    // ── Drag & Drop Tabs ──
    const handleDragStart = (e, filePath) => {
        e.dataTransfer.setData('text/tab-path', filePath);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOverTab = (e, filePath) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOver(filePath);
    };

    const handleDrop = (e, targetPath) => {
        e.preventDefault();
        const srcPath = e.dataTransfer.getData('text/tab-path');
        if (!srcPath || srcPath === targetPath) { setDragOver(null); return; }
        const store = useAppStore.getState();
        const files = [...store.openFiles];
        const srcIdx = files.indexOf(srcPath);
        const tgtIdx = files.indexOf(targetPath);
        if (srcIdx < 0 || tgtIdx < 0) { setDragOver(null); return; }
        files.splice(srcIdx, 1);
        files.splice(tgtIdx, 0, srcPath);
        useAppStore.setState({ openFiles: files });
        setDragOver(null);
    };

    const handleDragEnd = () => setDragOver(null);

    // Markdown HTML
    const markdownHtml = useMemo(() => {
        if (activeIsMarkdown && showPreview && fileContents[activeFile]) {
            return renderMarkdown(fileContents[activeFile]);
        }
        return '';
    }, [activeFile, showPreview, fileContents[activeFile], activeIsMarkdown]);

    if (openFiles.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center bg-surface-0 gap-6 overflow-y-auto"
                onClick={() => setFocusedEditor(side)}
            >
                {/* Logo and Welcome Text - ABSOLUTELY CENTERED */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 pointer-events-none">
                    <div className="flex flex-col items-center gap-4 text-center pointer-events-auto">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mb-2 shadow-lg shadow-accent/5"
                        >
                            <Code2 size={40} className="text-accent/80" />
                        </motion.div>
                        <div>
                            <h1 className="text-text-primary text-2xl font-bold tracking-tight mb-1">GammaNote</h1>
                            <p className="text-text-muted text-sm">Welcome to your workspace</p>
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <div
            className={`h-full flex flex-col bg-surface-0 overflow-hidden border-2 transition-colors duration-200 ${isFocused ? 'border-accent/30' : 'border-transparent'}`}
            onClick={() => setFocusedEditor(side)}
        >
            {/* Tab Bar */}
            <div className={`flex items-center bg-surface-1/50 border-b border-border overflow-x-auto shrink-0 ${!isFocused && 'opacity-70'}`}>
                {openFiles.map((filePath) => {
                    const isActive = filePath === activeFile;
                    const isModified = modified[filePath];
                    const isDragTarget = dragOver === filePath;
                    return (
                        <div
                            key={filePath}
                            draggable
                            onDragStart={(e) => handleDragStart(e, filePath)}
                            onDragOver={(e) => handleDragOverTab(e, filePath)}
                            onDrop={(e) => handleDrop(e, filePath)}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => { e.stopPropagation(); handleTabClick(filePath); }}
                            className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-r border-border text-[13px] transition-colors duration-150 shrink-0 group ${isActive
                                ? 'bg-surface-0 text-text-primary border-b-2 border-b-accent'
                                : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.02]'
                                } ${isDragTarget ? 'bg-accent/10 border-l-2 border-l-accent' : ''}`}
                        >
                            <FileCode size={13} className={isActive ? 'text-accent' : 'text-text-muted'} />
                            <span className="truncate max-w-[120px]">{getFileName(filePath)}</span>
                            {isModified && <span className="w-2 h-2 rounded-full bg-accent/60" />}
                            <button
                                onClick={(e) => handleCloseTab(e, filePath)}
                                className="ml-1 p-0.5 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    );
                })}

                {/* Markdown preview toggle */}
                {activeIsMarkdown && (
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className={`ml-auto px-2 py-1.5 flex items-center gap-1 text-[11px] font-medium shrink-0 ${showPreview ? 'text-accent' : 'text-text-muted hover:text-text-primary'}`}
                        title={showPreview ? 'Hide Preview' : 'Show Preview'}
                    >
                        {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
                        Preview
                    </button>
                )}
            </div>

            {/* Editor + Preview */}
            <div className="flex-1 overflow-hidden flex">
                {/* Editor */}
                <div className={`${activeIsMarkdown && showPreview ? 'w-1/2' : 'w-full'} h-full overflow-hidden`}>
                    {activeFile && fileContents[activeFile] !== undefined && (
                        <Editor
                            key={`${side}-${activeFile}`}
                            height="100%"
                            language={getLanguage(activeFile)}
                            value={fileContents[activeFile]}
                            onChange={handleEditorChange}
                            onMount={handleEditorMount}
                            theme="vs-dark"
                            options={{
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                fontSize: editorFontSize,
                                lineHeight: Math.round(editorFontSize * 1.6),
                                fontLigatures: true,
                                minimap: { enabled: true, scale: 1 },
                                smoothScrolling: true,
                                cursorBlinking: 'smooth',
                                cursorSmoothCaretAnimation: 'on',
                                padding: { top: 12 },
                                renderLineHighlight: 'all',
                                bracketPairColorization: { enabled: true },
                                guides: { indentation: true, bracketPairs: 'active' },
                                scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6, useShadows: false },
                                wordWrap: 'off',
                                automaticLayout: true,
                                quickSuggestions: true,
                                suggestOnTriggerCharacters: true,
                                acceptSuggestionOnEnter: 'on',
                                tabCompletion: 'on',
                            }}
                        />
                    )}
                </div>

                {/* Markdown Preview */}
                {activeIsMarkdown && showPreview && (
                    <div className="w-1/2 h-full border-l border-border overflow-auto bg-surface-0 p-4">
                        <div
                            className="text-text-secondary text-sm leading-relaxed font-sans"
                            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
                            dangerouslySetInnerHTML={{ __html: markdownHtml }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
