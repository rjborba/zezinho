import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Zezinho",
    short_name: "Zezinho",
    description: "Controle simples dos insumos da casa.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f8f4",
    theme_color: "#f6f8f4",
    lang: "pt-BR",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Registrar entrada",
        short_name: "Nova entrada",
        description: "Registrar uma nova reposição.",
        url: "/entradas",
        icons: [
          {
            src: "/pwa-icon-192.png",
            sizes: "192x192",
          },
        ],
      },
      {
        name: "Ver itens",
        short_name: "Itens",
        description: "Abrir a lista de itens.",
        url: "/itens",
        icons: [
          {
            src: "/pwa-icon-192.png",
            sizes: "192x192",
          },
        ],
      },
    ],
  };
}
