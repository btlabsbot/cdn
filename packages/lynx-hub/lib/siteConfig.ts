/**
 * Nombre del sitio/hub, configurable al arrancar sin tocar código:
 *   SITE_NAME="Mi CDN" npm run dev          (bash)
 *   $env:SITE_NAME="Mi CDN"; npm run dev    (PowerShell)
 *
 * `npm run dev` (scripts/dev.js en la raíz) traduce SITE_NAME a
 * NEXT_PUBLIC_SITE_NAME, que es lo que Next.js necesita para que el valor
 * también esté disponible en el bundle del navegador (componentes cliente).
 */
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "LynxNodes";
