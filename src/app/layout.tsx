import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Zezinho",
    template: "%s · Zezinho",
  },
  description: "Controle simples de itens e entradas de estoque.",
  applicationName: "Zezinho",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Zezinho",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f8f4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
