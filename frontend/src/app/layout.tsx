import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./browser-compatibility.css"; // Import compatibility styles

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fog4Det - Real-time Fog Detection",
  description: "Real-time fog detection using camera feed and computer vision.",
  manifest: "/manifest.json", // Ensure manifest is linked
  themeColor: "#111827", // Example theme color (dark gray)
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fog4Det",
    // startupImage: [], // Optional: Add startup images for iOS
  },
  formatDetection: {
    telephone: false,
  },
  icons: [ // Add various icon sizes
    { rel: "apple-touch-icon", url: "/icons/icon-192x192.png" }, // Example, use actual paths
    { rel: "icon", url: "/favicon.ico" }, // Standard favicon
    // Add other sizes like 72x72, 96x96, 128x128, 144x144, 152x152, 384x384, 512x512
  ],
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  console.log("--- RootLayout Rendered ---"); // Add log here
  return (
    <html lang="en">
      <head>
         {/* Standard meta tags, links are handled by Next.js Metadata API */}
      </head>
      <body className={`${inter.className} bg-gray-900 text-gray-100`}>
        {children}
      </body>
    </html>
  );
}
