import React from 'react';
import { Terminal, PanelRightClose, PanelRightOpen, Globe } from 'lucide-react';
import useAppStore from '../store/useAppStore';

export default function StatusBar() {
    const activeFile = useAppStore((s) => s.activeFile);
    const terminalVisible = useAppStore((s) => s.terminalVisible);
    const toggleTerminal = useAppStore((s) => s.toggleTerminal);
    const browserVisible = useAppStore((s) => s.browserVisible);
    const toggleBrowser = useAppStore((s) => s.toggleBrowser);

    const getLanguageLabel = () => {
        if (!activeFile) return '';
        const ext = activeFile.split('.').pop()?.toLowerCase();
        const map = {
            js: 'JavaScript', jsx: 'React JSX', ts: 'TypeScript', tsx: 'React TSX',
            py: 'Python', html: 'HTML', css: 'CSS', json: 'JSON', md: 'Markdown',
            scss: 'SCSS', yaml: 'YAML', yml: 'YAML', xml: 'XML', sql: 'SQL',
            sh: 'Shell', bat: 'Batch', ps1: 'PowerShell', c: 'C', cpp: 'C++',
            java: 'Java', rs: 'Rust', go: 'Go', rb: 'Ruby', php: 'PHP',
        };
        return map[ext] || ext?.toUpperCase() || '';
    };

    return (
        <div className="flex items-center justify-between h-6 px-3 bg-surface-1/80 border-t border-border text-[11px] text-text-muted shrink-0 select-none">
            <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-400/70" />
                    Ready
                </span>
                {activeFile && (
                    <span className="text-text-muted/60 truncate max-w-[300px]">
                        {activeFile}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-2">
                {getLanguageLabel() && (
                    <span className="px-1.5 py-0.5 rounded bg-surface-3 text-text-muted">
                        {getLanguageLabel()}
                    </span>
                )}
                <button
                    onClick={toggleBrowser}
                    className={`p-0.5 rounded hover:bg-white/[0.06] transition-colors ${browserVisible ? 'text-accent' : 'text-text-muted'}`}
                    title={browserVisible ? 'Hide Browser' : 'Show Browser'}
                >
                    <Globe size={13} />
                </button>
                <button
                    onClick={toggleTerminal}
                    className={`p-0.5 rounded hover:bg-white/[0.06] transition-colors ${terminalVisible ? 'text-accent' : 'text-text-muted'}`}
                    title={terminalVisible ? 'Hide Terminal' : 'Show Terminal'}
                >
                    <Terminal size={13} />
                </button>
                <span className="text-text-muted/50">UTF-8</span>
            </div>
        </div>
    );
}
