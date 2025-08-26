"use client";

import Image, { type ImageProps } from "next/image";

export const LOGO_URL =
  "https://i.ibb.co/ycG8QLZj/Brown-Mascot-Lion-Free-Logo.jpg";

type SocioVipLogoProps = Omit<ImageProps, "src" | "alt" | "width" | "height"> & {
  /** Tamaño en px (alto y ancho) */
  size?: number;
  className?: string;
};

/**
 * Logo de SocioVIP como imagen (reemplaza el SVG).
 * Mantiene API simple: puedes pasar `className` y opcionalmente `size`.
 */
export function SocioVipLogo({
  size = 28,
  className,
  ...rest
}: SocioVipLogoProps) {
  return (
    <Image
      src={LOGO_URL}
      alt="SocioVIP"
      width={size}
      height={size}
      className={`rounded-full ring-1 ring-black/10 ${className ?? ""}`}
      priority
      {...rest}
    />
  );
}
