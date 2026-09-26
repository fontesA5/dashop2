/**
 * DaShop Theme Manager - Light Mode Only
 * Dark mode has been completely disabled across the application.
 */

(function() {
    // Ensure 'dark' class is never present on document element
    if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.classList.remove('dark');
    }

    // Clean up any legacy saved theme preference in localStorage
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('dashop_theme');
            localStorage.setItem('dashop_theme', 'light');
        }
    } catch (e) {}

    // Safe stub so any legacy calls to themeManager do not error
    window.themeManager = {
        isDark: () => false,
        setDark: () => {
            if (document.documentElement) document.documentElement.classList.remove('dark');
        },
        toggle: () => {
            if (document.documentElement) document.documentElement.classList.remove('dark');
        },
        updateIcons: () => {}
    };

    document.addEventListener('DOMContentLoaded', () => {
        if (document.documentElement) {
            document.documentElement.classList.remove('dark');
        }
    });
})();
