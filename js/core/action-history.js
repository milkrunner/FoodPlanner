import { Toast } from './toast.js';

// Action History Manager
export const ActionHistory = {
    history: [],
    maxHistory: 10,

    addAction(action) {
        this.history.unshift(action);
        if (this.history.length > this.maxHistory) {
            this.history.pop();
        }
    },

    undo() {
        if (this.history.length === 0) return;

        const action = this.history.shift();
        if (action && action.undo) {
            action.undo();
            Toast.show(action.undoMessage || 'Aktion rückgängig gemacht');
        }
    },

    clear() {
        this.history = [];
    }
};
