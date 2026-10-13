import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Shell } from "@/components/shell";
import { themeBootScript } from "@/components/theme";
import { installBootScript } from "@/components/install";

export const metadata: Metadata = {
  title: { default: "Nexus Radar", template: "%s | Nexus" },
  description: "Radar di asimmetrie: dove la sostanza cresce prima dell'attenzione dei media.",
  applicationName: "Nexus",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Nexus", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9ede7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1d2b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript + installBootScript }} />
        {/* iOS: necessario per aprire l'app a schermo intero dalla schermata Home */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col">
        <Suspense>
          <Shell>{children}</Shell>
        </Suspense>
      </body>
    </html>
  );
}
