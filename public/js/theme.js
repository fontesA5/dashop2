/**
 * DaShop Theme Manager (Dark Mode)
 */

class ThemeManager {
    constructor() {
        this.themeKey = 'dashop_theme';
        this.init();
    }

    init() {
        const saved = localStorage.getItem(this.themeKey);
        if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            this.setDark(true);
        } else {
            this.setDark(false);
        }
    }

    isDark() {
        return document.documentElement.classList.contains('dark');
    }

    setDark(enableDark) {
        if (enableDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem(this.themeKey, 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem(this.themeKey, 'light');
        }
        this.updateIcons();
    }

    toggle() {
        this.setDark(!this.isDark());
    }

    updateIcons() {
        const dark = this.isDark();
        document.querySelectorAll('.theme-toggle-icon').forEach(icon => {
            icon.textContent = dark ? 'light_mode' : 'dark_mode';
        });
        document.querySelectorAll('.theme-toggle-label').forEach(label => {
            label.textContent = dark ? (window.i18n ? window.i18n.t('light_mode') : 'Light') : (window.i18n ? window.i18n.t('dark_mode') : 'Dark');
        });
    }
}

window.themeManager = new ThemeManager();

document.addEventListener('DOMContentLoaded', () => {
    window.themeManager.updateIcons();
});
