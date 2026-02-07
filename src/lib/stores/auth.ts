import { writable } from 'svelte/store';

export type AuthUser = {
    id: string;
    name: string;
    username: string;
    email: string;
};

type AuthState = {
    user: AuthUser | null;
    authenticated: boolean;
    loading: boolean;
};

function createAuthStore() {
    const { subscribe, set, update } = writable<AuthState>({
        user: null,
        authenticated: false,
        loading: false // loading= true after(when backend is ready)
    });

    return {
        subscribe,

        // Called after successful login
        login: (user: AuthUser) =>
            set({
                user,
                authenticated: true,
                loading: false
            }),

        // Used on logout
        logout: () =>
            set({
                user: null,
                authenticated: false,
                loading: false
            }),

        // Used on app init / session check
        setUser: (user: AuthUser | null) =>
            set({
                user,
                authenticated: !!user,
                loading: false
            })
    };
}

export const auth = createAuthStore();
