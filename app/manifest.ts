import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Solar Quotation System",
    short_name: "SolarQuote",
    description: "Professional solar panel quotation management for dealers",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#e76f00",
    orientation: "portrait",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  }
}
