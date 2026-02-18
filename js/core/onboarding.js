import { Toast } from './toast.js';

// Onboarding Tour Manager
export const OnboardingManager = {
    STORAGE_KEY: 'foodplanner_onboarding',
    currentStep: 0,
    isActive: false,

    steps: [
        {
            target: null, // Welcome modal, no target
            title: 'Willkommen beim FoodPlanner!',
            content: 'Entdecke, wie du deine Mahlzeiten einfach planen kannst. Diese kurze Tour zeigt dir die wichtigsten Funktionen.',
            position: 'center'
        },
        {
            target: '[data-nav="planner"]',
            title: 'Wochenplaner',
            content: 'Plane deine Mahlzeiten für die ganze Woche. Ziehe Rezepte einfach in die gewünschten Tage oder lass dir von der KI einen Plan erstellen.',
            position: 'bottom'
        },
        {
            target: '[data-nav="recipes"]',
            title: 'Rezeptsammlung',
            content: 'Hier findest du alle deine Rezepte. Du kannst neue hinzufügen, suchen und nach Zeit, Schwierigkeit oder Saison filtern.',
            position: 'bottom'
        },
        {
            target: '[data-nav="shopping"]',
            title: 'Einkaufsliste',
            content: 'Die Einkaufsliste wird automatisch aus deinem Wochenplan erstellt. Praktisch beim Einkaufen!',
            position: 'bottom'
        },
        {
            target: null,
            title: 'Bereit zum Starten!',
            content: 'Du kennst jetzt die Grundlagen. Erstelle dein erstes Rezept oder erkunde die App auf eigene Faust. Tipp: Mit Strg+Z kannst du Aktionen rückgängig machen!',
            position: 'center'
        }
    ],

    init() {
        const status = this.getStatus();
        if (!status.completed && !status.skipped) {
            // First visit - show onboarding after a short delay
            setTimeout(() => this.start(), 500);
        }
    },

    getStatus() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : { completed: false, skipped: false };
        } catch {
            return { completed: false, skipped: false };
        }
    },

    saveStatus(status) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(status));
        } catch (e) {
            console.warn('Could not save onboarding status:', e);
        }
    },

    start() {
        this.currentStep = 0;
        this.isActive = true;
        this.showStep();
    },

    restart() {
        this.saveStatus({ completed: false, skipped: false });
        this.start();
    },

    showStep() {
        // Remove existing overlay
        this.removeOverlay();

        const step = this.steps[this.currentStep];
        if (!step) {
            this.complete();
            return;
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'onboarding-overlay';
        overlay.className = 'fixed inset-0 z-[9999] transition-opacity';
        overlay.innerHTML = `
            <div class="absolute inset-0 bg-black/60"></div>
            <div id="onboarding-spotlight" class="absolute rounded-lg transition-all duration-300" style="box-shadow: 0 0 0 9999px rgba(0,0,0,0.6);"></div>
            <div id="onboarding-tooltip" class="absolute bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm z-10 transform transition-all duration-300">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-lg font-bold text-gray-800 dark:text-white">${step.title}</h3>
                    <span class="text-sm text-gray-500 dark:text-gray-400">${this.currentStep + 1}/${this.steps.length}</span>
                </div>
                <p class="text-gray-600 dark:text-gray-300 mb-6">${step.content}</p>
                <div class="flex items-center justify-between">
                    <button id="onboarding-skip" class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                        Tour überspringen
                    </button>
                    <div class="flex gap-2">
                        ${this.currentStep > 0 ? `
                            <button id="onboarding-prev" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                                Zurück
                            </button>
                        ` : ''}
                        <button id="onboarding-next" class="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                            ${this.currentStep === this.steps.length - 1 ? 'Fertig' : 'Weiter'}
                        </button>
                    </div>
                </div>
                <div class="flex justify-center gap-1 mt-4">
                    ${this.steps.map((_, i) => `
                        <div class="w-2 h-2 rounded-full transition-colors ${i === this.currentStep ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}"></div>
                    `).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Position elements
        this.positionTooltip(step);

        // Attach event listeners
        document.getElementById('onboarding-skip')?.addEventListener('click', () => this.skip());
        document.getElementById('onboarding-prev')?.addEventListener('click', () => this.prev());
        document.getElementById('onboarding-next')?.addEventListener('click', () => this.next());

        // Close on escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.skip();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    },

    positionTooltip(step) {
        const tooltip = document.getElementById('onboarding-tooltip');
        const spotlight = document.getElementById('onboarding-spotlight');
        if (!tooltip || !spotlight) return;

        if (!step.target || step.position === 'center') {
            // Center the tooltip
            tooltip.style.top = '50%';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translate(-50%, -50%)';
            spotlight.style.display = 'none';
            return;
        }

        const targetEl = document.querySelector(step.target);
        if (!targetEl) {
            // Target not found, center the tooltip
            tooltip.style.top = '50%';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translate(-50%, -50%)';
            spotlight.style.display = 'none';
            return;
        }

        const rect = targetEl.getBoundingClientRect();
        const padding = 8;

        // Position spotlight around target
        spotlight.style.display = 'block';
        spotlight.style.top = `${rect.top - padding}px`;
        spotlight.style.left = `${rect.left - padding}px`;
        spotlight.style.width = `${rect.width + padding * 2}px`;
        spotlight.style.height = `${rect.height + padding * 2}px`;
        spotlight.style.boxShadow = '0 0 0 9999px rgba(0,0,0,0.6)';

        // Position tooltip
        const tooltipRect = tooltip.getBoundingClientRect();
        let top, left;

        switch (step.position) {
            case 'bottom':
                top = rect.bottom + 16;
                left = rect.left + rect.width / 2 - tooltipRect.width / 2;
                break;
            case 'top':
                top = rect.top - tooltipRect.height - 16;
                left = rect.left + rect.width / 2 - tooltipRect.width / 2;
                break;
            case 'left':
                top = rect.top + rect.height / 2 - tooltipRect.height / 2;
                left = rect.left - tooltipRect.width - 16;
                break;
            case 'right':
                top = rect.top + rect.height / 2 - tooltipRect.height / 2;
                left = rect.right + 16;
                break;
            default:
                top = rect.bottom + 16;
                left = rect.left;
        }

        // Keep tooltip in viewport
        left = Math.max(16, Math.min(left, window.innerWidth - tooltipRect.width - 16));
        top = Math.max(16, Math.min(top, window.innerHeight - tooltipRect.height - 16));

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        tooltip.style.transform = 'none';
    },

    next() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.showStep();
        } else {
            this.complete();
        }
    },

    prev() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showStep();
        }
    },

    skip() {
        this.saveStatus({ completed: false, skipped: true });
        this.removeOverlay();
        this.isActive = false;
        Toast.show('Tour übersprungen. Du kannst sie jederzeit im Menü neu starten.');
    },

    complete() {
        this.saveStatus({ completed: true, skipped: false });
        this.removeOverlay();
        this.isActive = false;
        Toast.success('Tour abgeschlossen! Viel Spaß mit dem FoodPlanner.');
    },

    removeOverlay() {
        const overlay = document.getElementById('onboarding-overlay');
        if (overlay) overlay.remove();
    }
};
