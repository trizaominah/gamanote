import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, ArrowLeft, ArrowRight, RotateCw, Lock, ExternalLink, Star } from 'lucide-react';
import useAppStore from '../store/useAppStore';

const SCROLLBAR_CSS = `
::-webkit-scrollbar {
    width: 6px !important;
    height: 6px !important;
}
::-webkit-scrollbar-track {
    background: transparent !important;
}
::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12) !important;
    border-radius: 3px !important;
}
::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.22) !important;
}
::selection {
    background: rgba(99, 102, 241, 0.3) !important;
}
`;

export default function BrowserPanel() {
    const webviewRef = useRef(null);
    const url = useAppStore((s) => s.browserUrl);
    const setUrl = useAppStore((s) => s.setBrowserUrl);
    const [inputUrl, setInputUrl] = useState(url);
    const [isLoading, setIsLoading] = useState(false);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const [pageTitle, setPageTitle] = useState('');
    const zoom = useAppStore((s) => s.zoom);
    const bookmarks = useAppStore((s) => s.bookmarks);
    const addBookmark = useAppStore((s) => s.addBookmark);
    const removeBookmark = useAppStore((s) => s.removeBookmark);

    const isBookmarked = bookmarks.some(b => b.url === url);
    const toggleBookmark = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isBookmarked) {
            removeBookmark(url);
        } else {
            addBookmark({ title: pageTitle || url, url });
        }
    };

    const [navSrc, setNavSrc] = useState(url);
    const lastLoadedUrl = useRef(url);

    useEffect(() => {
        const webview = webviewRef.current;
        if (!webview) return;

        const handleNavigation = () => {
            try {
                const currentUrl = webview.getURL();
                if (currentUrl !== lastLoadedUrl.current) {
                    lastLoadedUrl.current = currentUrl;
                    setUrl(currentUrl);
                    setInputUrl(currentUrl);
                }
            } catch (e) { }

            try {
                setCanGoBack(webview.canGoBack());
                setCanGoForward(webview.canGoForward());
            } catch (e) { }
        };

        const handleStartLoading = () => setIsLoading(true);
        const handleStopLoading = () => {
            setIsLoading(false);
            handleNavigation();
            // Inject custom scrollbar CSS into the webview
            try {
                webview.insertCSS(SCROLLBAR_CSS);
            } catch (e) {
                // webview might not be ready
            }
        };
        const handleTitleUpdate = (e) => setPageTitle(e.title);

        const handleDomReady = () => {
            // Inject scrollbar CSS on initial load too
            try {
                webview.insertCSS(SCROLLBAR_CSS);
            } catch (e) { }
        };

        webview.addEventListener('did-start-loading', handleStartLoading);
        webview.addEventListener('did-stop-loading', handleStopLoading);
        webview.addEventListener('did-navigate', handleNavigation);
        webview.addEventListener('did-navigate-in-page', handleNavigation);
        webview.addEventListener('page-title-updated', handleTitleUpdate);
        webview.addEventListener('dom-ready', handleDomReady);

        // Smart Code Event Listener
        const handleIpcMessage = (e) => {
            if (e.channel === 'smart-code-action') {
                const { action, code } = e.args[0] || {};

                if (action === 'copy') {
                    // Handled internally by script
                } else if (action === 'open-monaco') {
                    window.dispatchEvent(new CustomEvent('ide-smart-code-open', { detail: code }));
                } else if (action === 'create-file') {
                    window.dispatchEvent(new CustomEvent('ide-smart-code-create', { detail: code }));
                }
            }
        };
        webview.addEventListener('ipc-message', handleIpcMessage);

        return () => {
            webview.removeEventListener('did-start-loading', handleStartLoading);
            webview.removeEventListener('did-stop-loading', handleStopLoading);
            webview.removeEventListener('did-navigate', handleNavigation);
            webview.removeEventListener('did-navigate-in-page', handleNavigation);
            webview.removeEventListener('page-title-updated', handleTitleUpdate);
            webview.removeEventListener('dom-ready', handleDomReady);
            webview.removeEventListener('ipc-message', handleIpcMessage);
        };
    }, []);

    // Apply zoom factor to webview
    useEffect(() => {
        const webview = webviewRef.current;
        if (webview && webview.setZoomFactor) {
            try {
                webview.setZoomFactor(zoom);
            } catch (e) { }
        }
    }, [zoom]);

    // External store updates (e.g. from settings)
    useEffect(() => {
        if (url !== lastLoadedUrl.current) {
            lastLoadedUrl.current = url;
            setNavSrc(url);
            setInputUrl(url);
        }
    }, [url]);

    const navigate = (e) => {
        if (e) e.preventDefault();
        let targetUrl = inputUrl.trim();
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
        }
        if (targetUrl !== lastLoadedUrl.current) {
            lastLoadedUrl.current = targetUrl;
            setUrl(targetUrl);
            setNavSrc(targetUrl);
        }
    };

    const goBack = () => webviewRef.current?.goBack();
    const goForward = () => webviewRef.current?.goForward();
    const reload = () => webviewRef.current?.reload();

    useEffect(() => {
        const handleNavEvent = (e) => {
            const newUrl = e.detail;
            if (newUrl !== lastLoadedUrl.current) {
                lastLoadedUrl.current = newUrl;
                setUrl(newUrl);
                setNavSrc(newUrl);
                setInputUrl(newUrl);
            }
        };
        window.addEventListener('navigate-browser', handleNavEvent);
        return () => window.removeEventListener('navigate-browser', handleNavEvent);
    }, []);

    const openExternal = () => {
        window.electronAPI?.shell.openExternal(url);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="h-full flex flex-col bg-surface-1/50 overflow-hidden"
        >
            {/* Browser toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
                <div className="flex items-center gap-1">
                    <button
                        onClick={goBack}
                        disabled={!canGoBack}
                        className="p-1 rounded hover:bg-white/[0.06] text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ArrowLeft size={14} />
                    </button>
                    <button
                        onClick={goForward}
                        disabled={!canGoForward}
                        className="p-1 rounded hover:bg-white/[0.06] text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ArrowRight size={14} />
                    </button>
                    <button
                        onClick={reload}
                        className={`p-1 rounded hover:bg-white/[0.06] text-text-muted hover:text-text-primary transition-colors ${isLoading ? 'animate-spin' : ''}`}
                    >
                        <RotateCw size={14} />
                    </button>
                </div>

                <form onSubmit={navigate} className="flex-1 flex items-center">
                    <div className="flex items-center w-full bg-surface-3/80 rounded-lg px-2.5 py-1.5 border border-border focus-within:border-accent/30 transition-colors">
                        {url.startsWith('https://') && <Lock size={11} className="text-green-400/70 mr-1.5 shrink-0" />}
                        <input
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            placeholder="Search or enter URL..."
                            className="flex-1 bg-transparent text-text-primary text-[12px] outline-none font-mono placeholder:text-text-muted"
                        />
                        <button
                            type="button"
                            onClick={toggleBookmark}
                            className={`ml-2 p-1 rounded hover:bg-white/[0.06] transition-colors ${isBookmarked ? 'text-yellow-400' : 'text-text-muted hover:text-text-primary'}`}
                            title={isBookmarked ? "Remove Bookmark" : "Add Bookmark"}
                        >
                            <Star size={13} className={isBookmarked ? "fill-current" : ""} />
                        </button>
                    </div>
                </form>

                <button
                    onClick={openExternal}
                    className="p-1 rounded hover:bg-white/[0.06] text-text-muted hover:text-text-primary transition-colors"
                    title="Open in browser"
                >
                    <ExternalLink size={13} />
                </button>
            </div>

            {/* Loading bar */}
            {isLoading && (
                <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 2, ease: 'easeInOut' }}
                    className="h-[2px] bg-accent origin-left"
                />
            )}

            {/* Webview */}
            <div className="flex-1 bg-white">
                <webview
                    ref={webviewRef}
                    src={navSrc}
                    preload={window.electronAPI?.env?.webviewPreloadPath}
                    style={{ width: '100%', height: '100%' }}
                    allowpopups="true"
                />
            </div>
        </motion.div>
    );
}
