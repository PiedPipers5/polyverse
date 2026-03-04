import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.piedpipers.polyverse',
    appName: 'Polyverse',
    // Since we use adapter-vercel with server routes, the app loads from the deployed URL.
    // Update this URL to your Vercel deployment.
    server: {
        url: 'https://polyverse-piedpipers.vercel.app',
        cleartext: false
    },
    android: {
        // Allow mixed content for development
        allowMixedContent: false,
        // Use Chrome Custom Tabs for OAuth if needed
        useLegacyBridge: false
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            backgroundColor: '#09090b',
            showSpinner: false,
            androidScaleType: 'CENTER_CROP'
        },
        StatusBar: {
            style: 'DARK',
            backgroundColor: '#09090b'
        }
    }
};

export default config;
