import React from 'react';
import { motion } from 'framer-motion';
import { Minus, Square, X, Code2 } from 'lucide-react';

export default function TitleBar() {
    const handleMinimize = () => window.electronAPI?.window.minimize();
    const handleMaximize = () => window.electronAPI?.window.maximize();
    const handleClose = () => window.electronAPI?.window.close();

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="drag-region flex items-center justify-between h-10 px-4 glass-heavy border-b border-border select-none shrink-0"
        >
            {/* App Title */}
            <div className="flex items-center gap-2 text-text-secondary">
                <Code2 size={14} className="text-accent" />
                <span className="text-xs font-medium tracking-wider uppercase">Gamanote</span>
            </div>

            {/* Spacer (To balance the title if needed, or just let flex handle it) */}
            <div className="flex-1" />

            {/* Traffic Lights (Moved to the right) */}
            <div className="no-drag flex items-center gap-2">
                <button
                    onClick={handleMinimize}
                    className="group w-3 h-3 rounded-full bg-[#ffbd2e] hover:brightness-110 transition-all duration-200 flex items-center justify-center"
                    title="Minimize"
                >
                    <Minus size={7} className="text-black/0 group-hover:text-black/60 transition-all" />
                </button>
                <button
                    onClick={handleMaximize}
                    className="group w-3 h-3 rounded-full bg-[#28c840] hover:brightness-110 transition-all duration-200 flex items-center justify-center"
                    title="Maximize"
                >
                    <Square size={6} className="text-black/0 group-hover:text-black/60 transition-all" />
                </button>
                <button
                    onClick={handleClose}
                    className="group w-3 h-3 rounded-full bg-[#ff5f57] hover:brightness-110 transition-all duration-200 flex items-center justify-center"
                    title="Close"
                >
                    <X size={7} className="text-black/0 group-hover:text-black/60 transition-all" />
                </button>
            </div>
        </motion.div>
    );
}
