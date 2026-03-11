```
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

// Get initial theme from localStorage or default to light
function getInitialTheme(): Theme {
    if (!browser) return 'light';

    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
        return stored;
    }

    // Default to light theme
    return 'light';
}

// Create the theme store
function createThemeStore() {
    const { subscribe, set, update } = writable<Theme>(getInitialTheme());

    return {
        subscribe,
        toggle: () => {
            update(current => {
                const newTheme = current === 'dark' ? 'light' : 'dark';
                if (browser) {
                    localStorage.setItem('theme', newTheme);
                    // Update document class
                    document.documentElement.classList.toggle('dark', newTheme === 'dark');
                }
                return newTheme;
            });
        },
        set: (theme: Theme) => {
            if (browser) {
                localStorage.setItem('theme', theme);
                document.documentElement.classList.toggle('dark', theme === 'dark');
            }
            set(theme);
        },
        init: () => {
            if (browser) {
                const theme = getInitialTheme();
                document.documentElement.classList.toggle('dark', theme === 'dark');
            }
        }
    };
}

export const theme = createThemeStore();
