import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, AlertTriangle, Info, X, Search, RefreshCw, FileCode } from 'lucide-react';
import useAppStore from '../store/useAppStore';

// Simple lint rules that scan file content for common issues
function scanFile(filePath, content) {
    const problems = [];
    const ext = filePath.split('.').pop()?.toLowerCase();
    const lines = content.split('\n');
    const fileName = filePath.split('\\').pop() || filePath.split('/').pop();

    lines.forEach((line, idx) => {
        const lineNum = idx + 1;

        // JS/JSX/TS/TSX checks
        if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
            if (/console\.log\s*\(/.test(line)) {
                problems.push({ type: 'warning', message: `console.log() found`, file: fileName, fullPath: filePath, line: lineNum });
            }
            if (/var\s+/.test(line) && !/\/\//.test(line.split('var')[0])) {
                problems.push({ type: 'warning', message: `Use 'let' or 'const' instead of 'var'`, file: fileName, fullPath: filePath, line: lineNum });
            }
            if (/==(?!=)/.test(line) && !/!==/.test(line) && !/\/\//.test(line.split('==')[0])) {
                problems.push({ type: 'info', message: `Use '===' instead of '=='`, file: fileName, fullPath: filePath, line: lineNum });
            }
            if (/TODO|FIXME|HACK|XXX/.test(line)) {
                const match = line.match(/(TODO|FIXME|HACK|XXX)/);
                problems.push({ type: 'info', message: `${match[1]}: ${line.trim().substring(0, 80)}`, file: fileName, fullPath: filePath, line: lineNum });
            }
        }

        // Python checks
        if (ext === 'py') {
            if (/print\s*\(/.test(line) && !/^\s*#/.test(line)) {
                problems.push({ type: 'info', message: `print() statement found`, file: fileName, fullPath: filePath, line: lineNum });
            }
            if (/except\s*:/.test(line)) {
                problems.push({ type: 'warning', message: `Bare 'except:' clause (catch specific exceptions)`, file: fileName, fullPath: filePath, line: lineNum });
            }
            if (/import \*/.test(line)) {
                problems.push({ type: 'warning', message: `Wildcard import 'import *' detected`, file: fileName, fullPath: filePath, line: lineNum });
            }
        }

        // General: very long lines
        if (line.length > 200) {
            problems.push({ type: 'info', message: `Line exceeds 200 characters (${line.length})`, file: fileName, fullPath: filePath, line: lineNum });
        }
    });

    return problems;
}

async function scanOpenFiles(openFiles) {
    const allProblems = [];
    for (const filePath of openFiles) {
        try {
            const content = await window.electronAPI?.fs.readFile(filePath);
            if (content) {
                allProblems.push(...scanFile(filePath, content));
            }
        } catch (e) { /* skip */ }
    }
    return allProblems;
}

export default function ProblemsPanel() {
    const setProblemsVisible = useAppStore((s) => s.setProblemsVisible);
    const openFiles = useAppStore((s) => s.openFiles);
    const openFile = useAppStore((s) => s.openFile);
    const [problems, setProblems] = useState([]);
    const [filter, setFilter] = useState('');
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        const results = await scanOpenFiles(openFiles);
        setProblems(results);
        setLoading(false);
    }, [openFiles]);

    useEffect(() => { refresh(); }, [refresh]);

    const errors = problems.filter(p => p.type === 'error');
    const warnings = problems.filter(p => p.type === 'warning');
    const infos = problems.filter(p => p.type === 'info');

    const filtered = filter
        ? problems.filter(p => p.message.toLowerCase().includes(filter.toLowerCase()) || p.file.toLowerCase().includes(filter.toLowerCase()))
        : problems;

    return (
        <div className="h-full flex flex-col bg-surface-0 overflow-hidden select-none border-t border-border/40">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={13} className="text-red-400" />
                        <span className="text-[11px] font-semibold tracking-widest uppercase text-text-muted">Problems</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-[10px] text-red-400">
                            <AlertCircle size={10} /> {errors.length}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-yellow-500">
                            <AlertTriangle size={10} /> {warnings.length}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-blue-400">
                            <Info size={10} /> {infos.length}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={refresh} className="p-1 rounded hover:bg-white/[0.06] text-text-muted hover:text-text-primary" title="Rescan">
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="relative group">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted/40 group-focus-within:text-accent transition-colors" />
                        <input
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            placeholder="Filter..."
                            className="bg-surface-2 text-[10px] pl-7 pr-2 py-1 rounded border border-transparent focus:border-accent/40 outline-none w-36 transition-all"
                        />
                    </div>
                    <button onClick={() => setProblemsVisible(false)} className="p-1 rounded hover:bg-white/[0.06] text-text-muted hover:text-text-primary transition-colors">
                        <X size={13} />
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {filtered.length > 0 ? (
                    <div className="py-1">
                        {filtered.map((p, i) => (
                            <div
                                key={i}
                                onClick={() => p.fullPath && openFile(p.fullPath)}
                                className="flex items-start gap-3 px-4 py-1.5 hover:bg-white/[0.03] cursor-pointer group transition-colors"
                            >
                                <div className="mt-0.5">
                                    {p.type === 'error' && <AlertCircle size={13} className="text-red-400" />}
                                    {p.type === 'warning' && <AlertTriangle size={13} className="text-yellow-500" />}
                                    {p.type === 'info' && <Info size={13} className="text-blue-400" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[11px] text-text-primary mb-0.5 font-medium line-clamp-1">{p.message}</div>
                                    <div className="flex items-center gap-2 text-[10px] text-text-muted">
                                        <span className="hover:text-accent transition-colors">{p.file}</span>
                                        <span className="opacity-40">Ln {p.line}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-2 opacity-30">
                        <FileCode size={28} />
                        <p className="text-xs italic">No problems in open files</p>
                    </div>
                )}
            </div>
        </div>
    );
}
