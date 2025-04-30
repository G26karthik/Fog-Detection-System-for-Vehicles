import type { NextConfig } from "next";
// Import next-pwa
import withPWAInit from "next-pwa";

// Initialize next-pwa
const withPWA = withPWAInit({
  dest: "public", // Destination directory for service worker files
  register: true, // Register the service worker
  skipWaiting: true, // Install new service worker without waiting
  disable: process.env.NODE_ENV === "development", // Disable PWA in development
});

const nextConfig: NextConfig = {
  // Your existing Next.js config options go here
  reactStrictMode: true,
};

// Wrap the config with withPWA
export default withPWA(nextConfig);
