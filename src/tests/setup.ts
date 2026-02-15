import { mock } from "bun:test";

// Mock $env/dynamic/private to use real process.env
mock.module("$env/dynamic/private", () => ({
    env: process.env
}));

// Mock $env/static/private if needed
mock.module("$env/static/private", () => ({
    // Add static env vars here if needed, or just map to process.env
    env: process.env
}));
