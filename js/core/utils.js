// HTML escape utility to prevent XSS
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Trap focus within a modal element.
 * Returns a cleanup function to remove the trap.
 */
export function trapFocus(modalElement) {
    const focusableSelectors = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const previouslyFocused = document.activeElement;

    function handleKeyDown(e) {
        if (e.key !== 'Tab') return;
        const focusable = [...modalElement.querySelectorAll(focusableSelectors)];
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    modalElement.addEventListener('keydown', handleKeyDown);

    // Focus first focusable element
    const firstFocusable = modalElement.querySelector(focusableSelectors);
    if (firstFocusable) firstFocusable.focus();

    return function release() {
        modalElement.removeEventListener('keydown', handleKeyDown);
        if (previouslyFocused && previouslyFocused.focus) {
            previouslyFocused.focus();
        }
    };
}
