// static/js/core/common.js
(function() {
    // Loading Screen
    window.addEventListener('load', () => {
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) loadingScreen.classList.add('hidden');
        }, 500);
    });

    // Navbar Scroll Effect
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (navbar && window.scrollY > 50) navbar.classList.add('scrolled');
        else if (navbar) navbar.classList.remove('scrolled');
    });

    // Fix for CSV export - prevent particle animation freeze
    let exportInProgress = false;

    window.addEventListener('beforeunload', () => {
        if (exportInProgress) return;
        const canvas = document.getElementById('particles-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    });

    document.addEventListener('click', (e) => {
        const exportBtn = e.target.closest('[onclick*="exportReport"]') ||
                          (e.target.closest('button') && e.target.innerText.includes('Экспорт'));
        if (exportBtn || (e.target.closest('a') && e.target.href && e.target.href.includes('export-report'))) {
            exportInProgress = true;
            setTimeout(() => {
                exportInProgress = false;
                setTimeout(() => {
                    const canvas = document.getElementById('particles-canvas');
                    if (canvas && window.location.href.includes('/reports')) {
                        const event = new Event('resize');
                        window.dispatchEvent(event);
                    }
                }, 100);
            }, 500);
        }
    });

    window.addEventListener('pageshow', () => {
        exportInProgress = false;
    });
})();