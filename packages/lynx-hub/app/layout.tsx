import type { Metadata } from "next";
import "../styles/globals.css";
import { SITE_NAME } from "../lib/siteConfig";

export const metadata: Metadata = {
  title: `${SITE_NAME} — Console`,
  description: `Estado en vivo de la infraestructura CDN de ${SITE_NAME}`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
