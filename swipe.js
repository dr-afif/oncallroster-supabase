/* Swipe & Transition Handler - HSAAS Premium */
(function () {
    let startX = 0;
    let startY = 0;
    let lockDirection = null; // 'horizontal' | 'vertical' | null

    const SWIPE_THRESHOLD = 80;       // minimum px horizontal to trigger swipe
    const DIRECTION_LOCK_THRESHOLD = 8; // px moved before we decide scroll vs swipe
    const H_TO_V_RATIO = 1.5;         // horizontal must be 1.5x the vertical to count

    const pages = ['fileviewer.html', 'index.html', 'contacts.html'];
    const currentPath = window.location.pathname.toLowerCase();

    let currentIndex = 1;
    if (currentPath.includes('fileviewer')) currentIndex = 0;
    else if (currentPath.includes('contacts')) currentIndex = 2;
    else if (currentPath.includes('index') || currentPath === '/' || currentPath === '') currentIndex = 1;

    // -- Touch Events --
    document.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        lockDirection = null;
    }, { passive: true });

    document.addEventListener('touchmove', e => {
        if (lockDirection) return; // already decided
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = Math.abs(e.touches[0].clientY - startY);
        if (dx < DIRECTION_LOCK_THRESHOLD && dy < DIRECTION_LOCK_THRESHOLD) return;
        // Lock the direction based on which axis moved more
        lockDirection = dx > dy ? 'horizontal' : 'vertical';
    }, { passive: true });

    document.addEventListener('touchend', e => {
        // Only act on intentional horizontal swipes
        if (lockDirection !== 'horizontal') return;

        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const dx = endX - startX;
        const dy = endY - startY;

        // Extra safety: horizontal must dominate over vertical
        if (Math.abs(dx) < SWIPE_THRESHOLD) return;
        if (Math.abs(dx) < Math.abs(dy) * H_TO_V_RATIO) return;

        // Ignore swipe if the target is inside a horizontally scrollable container
        let target = e.target;
        while (target && target !== document.body) {
            if (target.scrollWidth > target.clientWidth) {
                const overflowX = window.getComputedStyle(target).overflowX;
                if (overflowX === 'auto' || overflowX === 'scroll') {
                    return;
                }
            }
            target = target.parentElement;
        }

        if (dx < 0 && currentIndex < pages.length - 1) {
            navigate(pages[currentIndex + 1], 'next');
        } else if (dx > 0 && currentIndex > 0) {
            navigate(pages[currentIndex - 1], 'prev');
        }
    }, { passive: true });

    function navigate(url, direction) {
        const wrapper = document.getElementById('page-wrapper');
        if (wrapper) {
            wrapper.classList.add(direction === 'next' ? 'slide-out-left' : 'slide-out-right');
        }
        if (window.navigator?.vibrate) window.navigator.vibrate(10);
        setTimeout(() => { window.location.href = url; }, 250);
    }

    // Handle slide-in on load
    window.addEventListener('DOMContentLoaded', () => {
        const wrapper = document.getElementById('page-wrapper');
        if (wrapper) {
            setTimeout(() => wrapper.classList.add('slide-in'), 10);
        }
    });
})();
