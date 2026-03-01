import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Check } from 'lucide-react';
import useAppStore from '../store/useAppStore';

export default function Dialog() {
    const dialog = useAppStore(s => s.dialog);
    const setDialog = useAppStore(s => s.setDialog);
    const [inputValue, setInputValue] = useState('');

    if (!dialog) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="w-full max-w-sm bg-surface-1 border border-border rounded-xl shadow-2xl overflow-hidden"
                >
                    <div className="p-6">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                                <AlertCircle size={20} className="text-accent" />
                            </div>
                            <h3 className="text-sm font-semibold text-white tracking-tight">
                                {dialog.title || 'Notification'}
                            </h3>
                        </div>
                        <p className="text-[13px] text-text-muted leading-relaxed mb-4">
                            {dialog.message}
                        </p>

                        {dialog.inputType && (
                            <input
                                autoFocus
                                type={dialog.inputType}
                                placeholder={dialog.inputPlaceholder || 'Type something...'}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                className="w-full bg-surface-2 border border-border focus:border-accent/50 rounded-lg px-3 py-2 text-sm text-white outline-none transition-all placeholder:text-text-muted/50"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        if (dialog.onConfirm) dialog.onConfirm(inputValue);
                                        setDialog(null);
                                        setInputValue('');
                                    }
                                }}
                            />
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3 px-6 py-4 bg-white/[0.02] border-t border-border">
                        <button
                            onClick={() => {
                                setDialog(null);
                                setInputValue('');
                            }}
                            className="px-4 py-2 text-xs font-medium text-text-muted hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                if (dialog.onConfirm) dialog.onConfirm(inputValue);
                                setDialog(null);
                                setInputValue('');
                            }}
                            className="px-6 py-2 bg-accent hover:bg-accent/90 text-white text-xs font-semibold rounded-lg shadow-lg shadow-accent/20 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <Check size={14} />
                            Confirm
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
