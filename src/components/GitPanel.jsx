import React, { useState, useEffect, useCallback } from 'react';
import { GitBranch, Plus, Upload, Download, RefreshCw, Check, X, FileText, FilePlus, FileMinus, FileQuestion } from 'lucide-react';
import useAppStore from '../store/useAppStore';

const STATUS_MAP = {
    'M': { label: 'Modified', icon: FileText, color: 'text-yellow-400' },
    'A': { label: 'Added', icon: FilePlus, color: 'text-green-400' },
    'D': { label: 'Deleted', icon: FileMinus, color: 'text-red-400' },
    '?': { label: 'Untracked', icon: FileQuestion, color: 'text-text-muted' },
    'R': { label: 'Renamed', icon: FileText, color: 'text-blue-400' },
};

function parseStatus(output) {
    if (!output) return [];
    return output.split('\n').filter(Boolean).map(line => {
        const status = line.substring(0, 2).trim();
        const file = line.substring(3).trim();
        const key = status.replace('??', '?')[0] || '?';
        return { status: key, file, raw: line };
    });
}

export default function GitPanel() {
    const rootPath = useAppStore(s => s.rootPath);
    const [files, setFiles] = useState([]);
    const [commitMsg, setCommitMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [output, setOutput] = useState('');
    const [isRepo, setIsRepo] = useState(true);

    const refresh = useCallback(async () => {
        if (!rootPath) return;
        setLoading(true);
        const res = await window.electronAPI?.git.status(rootPath);
        if (res?.code === 0) {
            setFiles(parseStatus(res.stdout));
            setIsRepo(true);
        } else if (res?.stderr?.includes('not a git repository')) {
            setIsRepo(false);
            setFiles([]);
        }
        setLoading(false);
    }, [rootPath]);

    useEffect(() => { refresh(); }, [refresh]);

    const runAction = async (action, ...args) => {
        setLoading(true);
        setOutput('');
        const res = await action(...args);
        setOutput(res?.stdout || res?.stderr || 'Done');
        await refresh();
        setLoading(false);
    };

    const handleCommit = async () => {
        if (!commitMsg.trim()) return;
        await window.electronAPI?.git.add(rootPath);
        await runAction(() => window.electronAPI?.git.commit(rootPath, commitMsg));
        setCommitMsg('');
    };

    const handleInit = async () => {
        await runAction(() => window.electronAPI?.git.init(rootPath));
    };

    if (!rootPath) return (
        <div className="h-full flex items-center justify-center text-text-muted text-xs">
            Open a folder first
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-surface-0 overflow-hidden text-xs">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                    <GitBranch size={13} className="text-accent" />
                    <span className="font-bold uppercase tracking-wider text-accent text-[11px]">Git</span>
                </div>
                <button onClick={refresh} className="p-1 rounded hover:bg-white/[0.06] text-text-muted hover:text-text-primary" title="Refresh">
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {!isRepo ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
                    <p className="text-text-muted">Not a Git repository</p>
                    <button onClick={handleInit} className="px-3 py-1.5 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 text-xs font-medium">
                        Initialize Git Repository
                    </button>
                </div>
            ) : (
                <div className="flex-1 overflow-auto">
                    {/* Changed Files */}
                    <div className="p-2">
                        <div className="text-[10px] uppercase tracking-wider text-text-muted/60 font-bold px-2 py-1">
                            Changes ({files.length})
                        </div>
                        {files.length === 0 ? (
                            <div className="px-2 py-3 text-text-muted italic text-center">No changes</div>
                        ) : (
                            files.map((f, i) => {
                                const info = STATUS_MAP[f.status] || STATUS_MAP['?'];
                                const Icon = info.icon;
                                return (
                                    <div key={i} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/[0.04] group">
                                        <Icon size={13} className={info.color} />
                                        <span className="flex-1 truncate text-text-secondary">{f.file}</span>
                                        <span className={`text-[9px] font-mono ${info.color}`}>{f.status}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Commit */}
                    <div className="p-2 border-t border-border">
                        <input
                            value={commitMsg}
                            onChange={e => setCommitMsg(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCommit()}
                            placeholder="Commit message..."
                            className="w-full bg-surface-3/80 text-text-primary text-xs rounded px-2 py-1.5 outline-none border border-border focus:border-accent/30 placeholder:text-text-muted font-mono"
                        />
                        <div className="flex gap-1.5 mt-2">
                            <button onClick={handleCommit} disabled={!commitMsg.trim()} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-accent/20 text-accent rounded hover:bg-accent/30 disabled:opacity-30 font-medium">
                                <Check size={12} /> Commit
                            </button>
                        </div>
                    </div>

                    {/* Push / Pull */}
                    <div className="flex gap-1.5 p-2 border-t border-border">
                        <button onClick={() => runAction(() => window.electronAPI?.git.push(rootPath))} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-surface-3/60 text-text-secondary rounded hover:bg-white/[0.06] font-medium">
                            <Upload size={12} /> Push
                        </button>
                        <button onClick={() => runAction(() => window.electronAPI?.git.pull(rootPath))} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-surface-3/60 text-text-secondary rounded hover:bg-white/[0.06] font-medium">
                            <Download size={12} /> Pull
                        </button>
                    </div>

                    {/* Output */}
                    {output && (
                        <div className="p-2 border-t border-border">
                            <pre className="text-[10px] text-text-muted font-mono whitespace-pre-wrap bg-surface-3/40 rounded p-2 max-h-24 overflow-auto">{output}</pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
