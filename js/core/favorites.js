import { escapeHtml } from './utils.js';

export function renderFavoritesQuickAccess(favorites) {
    if (!favorites || favorites.length === 0) {
        return '';
    }

    const limitedFavorites = favorites.slice(0, 8);
    const overflow = favorites.length - limitedFavorites.length;

    return `
        <section class="ds-card p-3 sm:p-4">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                    <svg class="w-5 h-5 text-ds-danger" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                    </svg>
                    <h3 class="text-base font-semibold text-ds-text">Favoriten Schnellzugriff</h3>
                </div>
            </div>
            <div class="flex gap-3 overflow-x-auto favorite-quick-scroll pb-1">
                ${limitedFavorites.map(recipe => `
                    <button type="button" class="favorite-quick-item flex-shrink-0 min-w-[160px] px-4 py-3 rounded-ds border border-ds-danger-border bg-ds-danger-bg text-left transition-colors hover:bg-ds-border focus:outline-none" data-recipe-id="${recipe.id}" aria-label="${escapeHtml(recipe.name)} anzeigen">
                        <div class="flex items-center justify-between gap-3">
                            <span class="font-medium text-ds-danger truncate">${escapeHtml(recipe.name)}</span>
                            <svg class="w-4 h-4 text-ds-heart" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fill-rule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L13.586 11H4a1 1 0 110-2h9.586l-3.293-3.293a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>
                            </svg>
                        </div>
                        <p class="mt-1 text-xs text-ds-danger truncate">${escapeHtml(recipe.category || 'Ohne Kategorie')}</p>
                    </button>
                `).join('')}
                ${overflow > 0 ? `
                    <div class="flex-shrink-0 min-w-[140px] px-4 py-3 rounded-ds border border-dashed border-ds-danger-border text-ds-danger flex items-center justify-center text-sm">
                        +${overflow} weitere
                    </div>
                ` : ''}
            </div>
        </section>
    `;
}
