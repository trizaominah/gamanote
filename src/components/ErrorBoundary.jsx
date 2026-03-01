import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('IDE Crash caught by Boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                        <div className="w-10 h-10 rounded-full bg-red-500 animate-pulse" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Application Crash Detected</h1>
                    <p className="text-text-secondary max-w-md mb-8 leading-relaxed">
                        An unexpected error occurred in the UI. This can happen during complex file operations or theme transitions.
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-8 w-full max-w-lg text-left overflow-auto max-h-48 font-mono text-sm text-red-400">
                        {this.state.error && this.state.error.toString()}
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-accent/20"
                    >
                        Restart Gamanote
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
