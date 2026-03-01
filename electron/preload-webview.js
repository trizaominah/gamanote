const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inject styles for our custom tooltip (Smart Code Detection)
    const style = document.createElement('style');
    style.textContent = `
        .gamanote-smart-btn-container {
            position: absolute;
            display: none;
            gap: 6px;
            background: rgba(20, 20, 20, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 6px;
            border-radius: 20px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            z-index: 2147483647;
            font-family: system-ui, -apple-system, sans-serif;
            transition: opacity 0.2s ease-in-out;
            opacity: 0;
            pointer-events: none;
        }
        .gamanote-smart-btn-container.visible {
            display: flex;
            opacity: 1;
            pointer-events: auto;
        }
        .gamanote-smart-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.05);
            color: #e5e7eb;
            font-size: 11px;
            font-weight: 500;
            padding: 4px 10px;
            border-radius: 14px;
            cursor: pointer;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .gamanote-smart-btn:hover {
            background: rgba(99, 102, 241, 0.2);
            border-color: rgba(99, 102, 241, 0.5);
            color: #fff;
        }
        .gamanote-code-glow {
            outline: 2px solid rgba(99, 102, 241, 0.5) !important;
            border-radius: 4px;
            transition: outline 0.2s ease;
        }
    `;
    document.head.appendChild(style);

    // 2. Create the floating UI container
    const container = document.createElement('div');
    container.className = 'gamanote-smart-btn-container';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'gamanote-smart-btn';
    copyBtn.innerText = 'Copy';

    const openMonacoBtn = document.createElement('button');
    openMonacoBtn.className = 'gamanote-smart-btn';
    openMonacoBtn.innerText = 'Open in Monaco';

    const createFileBtn = document.createElement('button');
    createFileBtn.className = 'gamanote-smart-btn';
    createFileBtn.innerText = 'Create File';

    container.appendChild(copyBtn);
    container.appendChild(openMonacoBtn);
    container.appendChild(createFileBtn);
    document.body.appendChild(container);

    let activeCodeBlock = null;
    let hideTimeout = null;

    // 3. Logic to show/hide and position
    const showToolbar = (element) => {
        if (hideTimeout) clearTimeout(hideTimeout);
        activeCodeBlock = element;

        // Add glow
        element.classList.add('gamanote-code-glow');

        // Calculate position (top right of the code block)
        const rect = element.getBoundingClientRect();
        container.style.top = `${window.scrollY + rect.top + 8}px`;
        container.style.left = `${window.scrollX + rect.right - container.offsetWidth - 8}px`;

        // If it goes off-screen to the right, align it differently
        if (parseInt(container.style.left) < window.scrollX + rect.left) {
            container.style.left = `${window.scrollX + rect.left + 8}px`;
        }

        container.classList.add('visible');
    };

    const hideToolbar = (element) => {
        if (element) {
            element.classList.remove('gamanote-code-glow');
        }
        hideTimeout = setTimeout(() => {
            if (!container.matches(':hover')) {
                container.classList.remove('visible');
                if (activeCodeBlock) activeCodeBlock.classList.remove('gamanote-code-glow');
                activeCodeBlock = null;
            }
        }, 300); // Small delay to allow moving mouse to the toolbar
    };

    // 4. Attach mouse listeners to all code blocks
    const attachListeners = () => {
        const blocks = document.querySelectorAll('pre, code');
        blocks.forEach(block => {
            // Avoid attaching to inline code that is very small
            if (block.tagName.toLowerCase() === 'code' && block.parentElement.tagName.toLowerCase() !== 'pre') {
                if (block.textContent.length < 20) return; // Skip tiny inline snippets
            }

            // Prevent multiple attachments
            if (block.dataset.gamanoteAttached) return;
            block.dataset.gamanoteAttached = 'true';

            block.addEventListener('mouseenter', () => showToolbar(block));
            block.addEventListener('mouseleave', () => hideToolbar(block));
        });
    };

    // Run initially and observe for dynamic content
    attachListeners();
    const observer = new MutationObserver(attachListeners);
    observer.observe(document.body, { childList: true, subtree: true });

    // Keep toolbar visible when hovering over it
    container.addEventListener('mouseenter', () => {
        if (hideTimeout) clearTimeout(hideTimeout);
        if (activeCodeBlock) activeCodeBlock.classList.add('gamanote-code-glow');
    });
    container.addEventListener('mouseleave', () => hideToolbar(activeCodeBlock));

    // 5. Button Actions
    const getCode = () => activeCodeBlock ? activeCodeBlock.innerText || activeCodeBlock.textContent : '';

    copyBtn.addEventListener('click', async () => {
        const text = getCode();
        if (text) {
            try {
                await navigator.clipboard.writeText(text);
                const originalText = copyBtn.innerText;
                copyBtn.innerText = 'Copied!';
                setTimeout(() => copyBtn.innerText = originalText, 2000);
            } catch (err) {
                console.error('Failed to copy', err);
            }
        }
    });

    openMonacoBtn.addEventListener('click', () => {
        const text = getCode();
        if (text) {
            ipcRenderer.sendToHost('smart-code-action', { action: 'open-monaco', code: text });
        }
    });

    createFileBtn.addEventListener('click', () => {
        const text = getCode();
        if (text) {
            ipcRenderer.sendToHost('smart-code-action', { action: 'create-file', code: text });
        }
    });
});
