// Mobile detection and touch utilities
export const MobileUtils = {
    isMobile() {
        return window.innerWidth < 640;
    },

    isTablet() {
        return window.innerWidth >= 640 && window.innerWidth < 1024;
    },

    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },

    // Swipe gesture detection
    setupSwipeGestures(element, callbacks) {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;
        const minSwipeDistance = 50;
        const maxVerticalDistance = 100;

        element.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        element.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            const horizontalDiff = touchEndX - touchStartX;
            const verticalDiff = Math.abs(touchEndY - touchStartY);

            // Only trigger if horizontal swipe is dominant
            if (Math.abs(horizontalDiff) > minSwipeDistance && verticalDiff < maxVerticalDistance) {
                if (horizontalDiff > 0 && callbacks.onSwipeRight) {
                    callbacks.onSwipeRight();
                } else if (horizontalDiff < 0 && callbacks.onSwipeLeft) {
                    callbacks.onSwipeLeft();
                }
            }
        }
    },

    // Pull to refresh
    setupPullToRefresh(element, onRefresh) {
        let startY = 0;
        let isPulling = false;
        const threshold = 80;

        element.addEventListener('touchstart', (e) => {
            if (element.scrollTop === 0) {
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        }, { passive: true });

        element.addEventListener('touchmove', (e) => {
            if (!isPulling) return;
            const currentY = e.touches[0].clientY;
            const diff = currentY - startY;

            if (diff > 0 && diff < threshold * 2) {
                const pullIndicator = document.querySelector('.pull-to-refresh');
                if (pullIndicator) {
                    pullIndicator.classList.toggle('visible', diff > threshold / 2);
                }
            }
        }, { passive: true });

        element.addEventListener('touchend', async (e) => {
            if (!isPulling) return;
            isPulling = false;

            const pullIndicator = document.querySelector('.pull-to-refresh');
            if (pullIndicator && pullIndicator.classList.contains('visible')) {
                pullIndicator.classList.add('refreshing');
                await onRefresh();
                pullIndicator.classList.remove('visible', 'refreshing');
            }
        }, { passive: true });
    }
};
