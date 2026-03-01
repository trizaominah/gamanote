import React from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import FileExplorer from './FileExplorer';
import EditorPanel from './EditorPanel';
import BrowserPanel from './BrowserPanel';
import TerminalPanel from './TerminalPanel';
import ProblemsPanel from './ProblemsPanel';
import GitPanel from './GitPanel';
import TopBar from './TopBar';
import Dialog from './Dialog';
import ErrorBoundary from './ErrorBoundary';
import useAppStore from '../store/useAppStore';

function ResizeHandle({ direction = 'vertical' }) {
    return (
        <PanelResizeHandle
            className={`
        ${direction === 'vertical' ? 'w-[4px] hover:w-[6px]' : 'h-[4px] hover:h-[6px]'}
        bg-border/40 hover:bg-accent/40 active:bg-accent/60
        transition-all duration-200
        shrink-0
        relative
        z-10
      `}
        >
            <div className={`
        absolute inset-0 m-auto
        ${direction === 'vertical' ? 'w-[1px] h-8' : 'w-8 h-[1px]'}
        bg-white/10
      `} />
        </PanelResizeHandle>
    );
}

export default function Layout() {
    const terminalVisible = useAppStore((s) => s.terminalVisible);
    const problemsVisible = useAppStore((s) => s.problemsVisible);
    const browserVisible = useAppStore((s) => s.browserVisible);
    const explorerVisible = useAppStore((s) => s.explorerVisible);
    const editorSplit = useAppStore((s) => s.editorSplit);
    const gitVisible = useAppStore((s) => s.gitVisible);

    return (
        <ErrorBoundary>
            <div className="h-screen w-screen bg-surface-0 flex flex-col overflow-hidden text-text-primary select-none">
                <TopBar />
                <Dialog />
                <div className="flex-1 overflow-hidden">
                    <PanelGroup direction="horizontal">
                        {/* Explorer (Left) */}
                        {explorerVisible && (
                            <>
                                <Panel defaultSize={20} minSize={10} maxSize={35}>
                                    {gitVisible ? (
                                        <PanelGroup direction="vertical">
                                            <Panel defaultSize={60} minSize={20}>
                                                <FileExplorer />
                                            </Panel>
                                            <ResizeHandle direction="horizontal" />
                                            <Panel defaultSize={40} minSize={15}>
                                                <GitPanel />
                                            </Panel>
                                        </PanelGroup>
                                    ) : (
                                        <FileExplorer />
                                    )}
                                </Panel>
                                <ResizeHandle direction="vertical" />
                            </>
                        )}

                        {/* Center Section (Editor & Bottom Panels) */}
                        <Panel defaultSize={explorerVisible ? (browserVisible ? 55 : 80) : (browserVisible ? 75 : 100)} minSize={30}>
                            <PanelGroup direction="vertical">
                                {/* Editor Panel Area */}
                                <Panel defaultSize={(terminalVisible || problemsVisible) ? 60 : 100} minSize={20}>
                                    {editorSplit ? (
                                        <PanelGroup direction="horizontal">
                                            <Panel defaultSize={50} minSize={20}>
                                                <EditorPanel side="primary" />
                                            </Panel>
                                            <ResizeHandle direction="vertical" />
                                            <Panel defaultSize={50} minSize={20}>
                                                <EditorPanel side="secondary" />
                                            </Panel>
                                        </PanelGroup>
                                    ) : (
                                        <EditorPanel side="primary" />
                                    )}
                                </Panel>

                                {/* Bottom Panels (Terminal / Problems) */}
                                {(terminalVisible || problemsVisible) && (
                                    <>
                                        <ResizeHandle direction="horizontal" />
                                        <Panel defaultSize={40} minSize={15}>
                                            {/* We can toggle between Terminal and Problems or stack them. 
                                                Typical IDE behavior: active tab in bottom area. */}
                                            {terminalVisible && !problemsVisible && <TerminalPanel />}
                                            {problemsVisible && !terminalVisible && <ProblemsPanel />}
                                            {terminalVisible && problemsVisible && (
                                                <PanelGroup direction="horizontal">
                                                    <Panel defaultSize={50} minSize={20}>
                                                        <TerminalPanel />
                                                    </Panel>
                                                    <ResizeHandle direction="vertical" />
                                                    <Panel defaultSize={50} minSize={20}>
                                                        <ProblemsPanel />
                                                    </Panel>
                                                </PanelGroup>
                                            )}
                                        </Panel>
                                    </>
                                )}
                            </PanelGroup>
                        </Panel>

                        {/* Browser (Right) */}
                        {browserVisible && (
                            <>
                                <ResizeHandle direction="vertical" />
                                <Panel defaultSize={25} minSize={15} maxSize={60}>
                                    <BrowserPanel />
                                </Panel>
                            </>
                        )}
                    </PanelGroup>
                </div>
            </div>
        </ErrorBoundary>
    );
}
