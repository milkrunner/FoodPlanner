// Toast Notification Manager
export const Toast = {
    show(message, options = {}) {
        const {
            duration = options.showUndo ? 10000 : 3000,
            showUndo = false,
            onUndo = null,
            type = 'default' // 'default', 'success', 'error'
        } = options;

        // Remove existing toast
        const existingToast = document.getElementById('toast-notification');
        if (existingToast) existingToast.remove();

        // Determine background color based on type
        let bgColor = 'bg-gray-800 dark:bg-gray-700';
        if (type === 'success') bgColor = 'bg-green-600 dark:bg-green-700';
        if (type === 'error') bgColor = 'bg-red-600 dark:bg-red-700';

        // Create toast with ARIA live region for accessibility
        const toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-4 z-50 animate-slide-up`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        toast.setAttribute('aria-atomic', 'true');

        // Create message span with safe text content
        const messageSpan = document.createElement('span');
        messageSpan.className = 'flex-1';
        messageSpan.textContent = message;
        toast.appendChild(messageSpan);

        // Add undo button if needed
        if (showUndo) {
            const undoBtn = document.createElement('button');
            undoBtn.id = 'toast-undo-btn';
            undoBtn.className = 'px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors font-medium';
            undoBtn.textContent = 'Rückgängig';
            toast.appendChild(undoBtn);
        }

        // Add close button
        const closeBtnEl = document.createElement('button');
        closeBtnEl.id = 'toast-close-btn';
        closeBtnEl.className = 'text-gray-200 hover:text-white text-xl';
        closeBtnEl.textContent = '✕';
        toast.appendChild(closeBtnEl);

        document.body.appendChild(toast);

        // Attach event listeners
        const close = () => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 200);
        };

        closeBtnEl.addEventListener('click', close);

        if (showUndo && onUndo) {
            const undoBtnEl = toast.querySelector('#toast-undo-btn');
            if (undoBtnEl) {
                undoBtnEl.addEventListener('click', () => {
                    onUndo();
                    close();
                });
            }
        }

        // Auto close after duration
        setTimeout(close, duration);
    },

    success(message) {
        this.show(message, { type: 'success' });
    },

    error(message) {
        this.show(message, { type: 'error' });
    }
};
