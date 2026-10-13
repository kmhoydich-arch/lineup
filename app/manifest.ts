import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lineup — free surf report",
    short_name: "Lineup",
    description:
      "Open surf forecasts with plain-language ratings. No account and no paywall.",
    start_url: "/",
    display: "standalone",
    background_color: "#efe6d6",
    theme_color: "#14343a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
