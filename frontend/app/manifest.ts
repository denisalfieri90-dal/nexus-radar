import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nexus Radar",
    short_name: "Nexus",
    description: "Radar di asimmetrie: dove la sostanza cresce prima dell'attenzione dei media.",
    lang: "it",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1d2b",
    theme_color: "#0b1d2b",
    categories: ["finance", "news", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Journal", url: "/journal/", description: "Track record dei segnali" },
      { name: "Temi", url: "/temi/", description: "Temi monitorati" },
    ],
  };
}
