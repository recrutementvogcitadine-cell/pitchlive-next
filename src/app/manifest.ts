import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PITCH LIVE",
    short_name: "PitchLive",
    description: "Live commerce mobile immersive avec boutiques, lives et dashboard.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050a16",
    theme_color: "#050a16",
    icons: [
      {
        src: "/icons/preview-logo-v2.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/icons/preview-logo-v2.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/icons/preview-logo-v2.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
