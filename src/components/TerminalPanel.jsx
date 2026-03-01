import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal as TermIcon, X } from 'lucide-react';
import useAppStore from '../store/useAppStore';

function TerminalInstance({ id, isActive }) {
    const containerRef = useRef(null);
    const terminalRef = useRef(null);
    const fitAddonRef = useRef(null);
    const initRef = useRef(false);
    const resizeTimerRef = useRef(null);
    const rootPath = useAppStore((s) => s.rootPath);
    const terminalFontSize = useAppStore((s) => s.terminalFontSize);

    // Debounced fit — prevents layout thrashing on rapid resize events
    const debouncedFit = useCallback(() => {
        if (resizeTimerRef.current) cancelAnimationFrame(resizeTimerRef.current);
        resizeTimerRef.current = requestAnimationFrame(() => {
            if (fitAddonRef.current && containerRef.current && containerRef.current.offsetWidth > 0 && containerRef.current.offsetHeight > 0) {
                try { fitAddonRef.current.fit(); } catch (e) { /* ignore */ }
            }
        });
    }, []);

    // React to font size changes
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.options.fontSize = terminalFontSize;
            debouncedFit();
        }
    }, [terminalFontSize, debouncedFit]);

    // Handle initialization
    useEffect(() => {
        if (!rootPath || initRef.current) return;

        const initTerminal = async () => {
            const { Terminal } = await import('@xterm/xterm');
            const { FitAddon } = await import('@xterm/addon-fit');
            const { WebLinksAddon } = await import('@xterm/addon-web-links');
            await import('@xterm/xterm/css/xterm.css');

            if (!containerRef.current) return;
            initRef.current = true;

            const term = new Terminal({
                cursorBlink: true,
                cursorStyle: 'bar',
                fontSize: terminalFontSize,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                lineHeight: 1.3,
                letterSpacing: 0,
                scrollback: 5000,
                theme: {
                    background: '#0a0a0a',
                    foreground: '#e4e4e7',
                    cursor: '#6366f1',
                    cursorAccent: '#0a0a0a',
                    selectionBackground: 'rgba(99, 102, 241, 0.35)',
                    selectionForeground: '#ffffff',
                    black: '#27272a',
                    red: '#ef4444',
                    green: '#22c55e',
                    yellow: '#eab308',
                    blue: '#3b82f6',
                    magenta: '#a855f7',
                    cyan: '#06b6d4',
                    white: '#e4e4e7',
                    brightBlack: '#52525b',
                    brightRed: '#f87171',
                    brightGreen: '#4ade80',
                    brightYellow: '#facc15',
                    brightBlue: '#60a5fa',
                    brightMagenta: '#c084fc',
                    brightCyan: '#22d3ee',
                    brightWhite: '#fafafa',
                },
                allowTransparency: false,
                windowsMode: false,
            });

            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.loadAddon(new WebLinksAddon());

            term.open(containerRef.current);

            // Wait for next frames to ensure DOM is ready for measurement
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    try { fitAddon.fit(); } catch (e) { }
                    term.focus();
                });
            });

            terminalRef.current = term;
            fitAddonRef.current = fitAddon;

            // Connect to Electron PTY
            window.electronAPI.pty.spawn(String(id), rootPath);

            const removeDataListener = window.electronAPI.pty.onData(String(id), (data) => {
                term.write(data);
            });

            term.onData((data) => {
                window.electronAPI.pty.write(String(id), data);
            });

            term.onResize(({ cols, rows }) => {
                window.electronAPI.pty.resize(String(id), cols, rows);
            });

            // Handle Resize with debouncing
            const resizeObserver = new ResizeObserver(() => {
                debouncedFit();
            });
            resizeObserver.observe(containerRef.current);

            return () => {
                if (resizeTimerRef.current) cancelAnimationFrame(resizeTimerRef.current);
                resizeObserver.disconnect();
                removeDataListener();
                window.electronAPI.pty.kill(String(id));
                term.dispose();
            };
        };

        const cleanupPromise = initTerminal();
        return () => {
            cleanupPromise.then(cleanup => cleanup?.());
        };
    }, [id, rootPath, debouncedFit]);

    // Re-fit and focus when becoming active
    useEffect(() => {
        if (isActive && fitAddonRef.current) {
            // Double rAF ensures layout is settled before measuring
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    try { fitAddonRef.current.fit(); } catch (e) { }
                    terminalRef.current?.focus();
                });
            });
        }
    }, [isActive]);

    return (
        <div
            ref={containerRef}
            className={`w-full h-full bg-[#0a0a0a] ${isActive ? 'block' : 'hidden'}`}
            style={{ overflow: 'hidden', padding: '4px 4px 0 4px' }}
        />
    );
}

export default function TerminalPanel() {
    const terminalVisible = useAppStore((s) => s.terminalVisible);
    const setTerminalVisible = useAppStore((s) => s.setTerminalVisible);
    const terminalId = useAppStore((s) => s.terminalId);

    if (!terminalVisible) return null;

    return (
        <div className="h-full flex flex-col bg-surface-0 overflow-hidden select-none">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-2 bg-surface-1/80 border-b border-border shrink-0 h-9">
                <div className="flex items-center gap-2 px-3">
                    <TermIcon size={12} className="text-accent" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-accent">PowerShell</span>
                </div>

                <div className="flex items-center gap-1 px-2">
                    <button
                        onClick={() => setTerminalVisible(false)}
                        className="p-1 rounded hover:bg-white/[0.08] text-text-muted hover:text-text-primary"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Viewport */}
            <div className="flex-1 relative bg-[#0a0a0a] overflow-hidden">
                <TerminalInstance
                    id={terminalId}
                    isActive={true}
                />
            </div>
        </div>
    );
}
