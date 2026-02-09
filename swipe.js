/* Swipe & Transition Handler - HSAAS Premium */
(function () {
    let startX = 0;
    let isDragging = false;

    const pages = ['fileviewer.html', 'index.html', 'contacts.html'];
    const currentPath = window.location.pathname.toLowerCase();

    let currentIndex = 1;
    if (currentPath.includes('fileviewer')) currentIndex = 0;
    else if (currentPath.includes('contacts')) currentIndex = 2;
    else if (currentPath.includes('index') || currentPath === '/' || currentPath === '') currentIndex = 1;

    function handleEnd(endX) {
        const dx = endX - startX;
        if (Math.abs(dx) > 100) { // Threshold for swipe
            if (dx < 0 && currentIndex < pages.length - 1) {
                navigate(pages[currentIndex + 1], 'next');
            } else if (dx > 0 && currentIndex > 0) {
                navigate(pages[currentIndex - 1], 'prev');
            }
        }
    }

    function navigate(url, direction) {
        const wrapper = document.getElementById('page-wrapper');
        if (wrapper) {
            wrapper.classList.add(direction === 'next' ? 'slide-out-left' : 'slide-out-right');
        }
        if (window.navigator?.vibrate) window.navigator.vibrate(10);
        setTimeout(() => { window.location.href = url; }, 250);
    }

    // Touch Events
    document.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    document.addEventListener('touchend', e => { handleEnd(e.changedTouches[0].clientX); }, { passive: true });

    // Mouse Events (Desktop Drag Support)
    document.addEventListener('mousedown', e => {
        startX = e.clientX;
        isDragging = true;
    });
    document.addEventListener('mouseup', e => {
        if (isDragging) {
            handleEnd(e.clientX);
            isDragging = false;
        }
    });

    // Handle slide-in on load
    window.addEventListener('DOMContentLoaded', () => {
        const wrapper = document.getElementById('page-wrapper');
        if (wrapper) {
            setTimeout(() => wrapper.classList.add('slide-in'), 10);
        }
    });
})();
