/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                surface: {
                    0: '#0a0a0a',
                    1: '#111111',
                    2: '#1a1a1a',
                    3: '#222222',
                    4: '#2a2a2a',
                },
                accent: {
                    DEFAULT: '#6366f1',
                    hover: '#818cf8',
                    dim: '#4f46e5',
                },
                border: {
                    DEFAULT: 'rgba(255, 255, 255, 0.06)',
                    hover: 'rgba(255, 255, 255, 0.12)',
                },
                text: {
                    primary: '#e4e4e7',
                    secondary: '#a1a1aa',
                    muted: '#71717a',
                },
            },
            fontFamily: {
                sans: ['Inter', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
                mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
            },
            backdropBlur: {
                glass: '20px',
            },
            boxShadow: {
                glass: '0 8px 32px rgba(0, 0, 0, 0.4)',
                'glass-inset': 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            },
        },
    },
    plugins: [],
};
