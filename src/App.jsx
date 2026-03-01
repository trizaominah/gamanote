import React from 'react';
import { motion } from 'framer-motion';
import TitleBar from './components/TitleBar';
import Layout from './components/Layout';
import StatusBar from './components/StatusBar';
import ShortcutManager from './components/ShortcutManager';
import useAppStore from './store/useAppStore';

export default function App() {
    const rootPath = useAppStore(s => s.rootPath);
    const openFile = useAppStore(s => s.openFile);

    const loadInitialSettings = useAppStore(s => s.loadInitialSettings);

    React.useEffect(() => {
        // Load settings from disk on startup
        window.electronAPI?.settings.load().then(settings => {
            loadInitialSettings(settings);
        });

        const handleOpen = async (e) => {
            const code = e.detail;
            if (!code) return;

            // Generate a temporary file path to view the code in Monaco
            const tempFileName = `snippet-${Date.now()}.txt`;
            const tempFilePath = rootPath
                ? `${rootPath}\\${tempFileName}`
                : tempFileName;

            // We need a way to open "unsaved" content, but for now we write it to a temp file
            // Alternatively, in a full IDE you'd have an internal schema, but let's just write to disk
            if (rootPath) {
                await window.electronAPI?.fs.writeFile(tempFilePath, code);
                openFile(tempFilePath);
            } else {
                alert("Please open a project folder first to extract code snippets.");
            }
        };

        const handleCreate = async (e) => {
            const code = e.detail;
            if (!code || !rootPath) {
                if (!rootPath) alert("Open a folder first.");
                return;
            }

            // Prompt user via Electron dialog? Or just create a file
            const newName = prompt("Enter file name for the snippet:", "new-snippet.js");
            if (newName && newName.trim()) {
                const newPath = `${rootPath}\\${newName.trim()}`;
                await window.electronAPI?.fs.writeFile(newPath, code);
                openFile(newPath);
            }
        };

        window.addEventListener('ide-smart-code-open', handleOpen);
        window.addEventListener('ide-smart-code-create', handleCreate);
        return () => {
            window.removeEventListener('ide-smart-code-open', handleOpen);
            window.removeEventListener('ide-smart-code-create', handleCreate);
        };
    }, [rootPath, openFile]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="h-screen w-screen flex flex-col bg-surface-0 overflow-hidden"
        >
            <ShortcutManager />
            <TitleBar />
            <Layout />
            <StatusBar />
        </motion.div>
    );
}
