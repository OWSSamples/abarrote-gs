'use client';

import Image from 'next/image';
import { getBrandLogo } from '@/lib/brand-logos';

interface BrandLogoProps {
  /** Nombre de la marca (e.g. "Stripe", "Mercado Pago") */
  name: string;
  /** Tamaño en px (cuadrado). Default 24 */
  size?: number;
  /** Texto alternativo (default = name) */
  alt?: string;
  /** Borde redondeado del fallback */
  rounded?: boolean;
  /** Variante visual del logo cuando la librería la provee. */
  variant?: 'default' | 'light' | 'dark' | 'wordmark';
}

/**
 * Renderiza logos de marcas desde `thesvg`.
 * No usa archivos locales ni CDNs para logos de empresas o servicios.
 */
export function BrandLogo({ name, size = 24, alt, rounded = true, variant = 'light' }: BrandLogoProps) {
  const logo = getBrandLogo(name);

  if (!logo) {
    return (
      <div
        aria-hidden
        title={alt ?? name}
        style={{
          width: size,
          height: size,
          background: '#F4F0FF',
          borderRadius: rounded ? 4 : 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.max(8, Math.floor(size * 0.4)),
          fontWeight: 600,
          color: '#5B3FB8',
          flexShrink: 0,
        }}
      >
        {(alt ?? name).slice(0, 2).toUpperCase()}
      </div>
    );
  }

  const label = alt ?? logo.title ?? name;

  if (logo.svg) {
    const svgSource = logo.variants?.[variant] ?? logo.variants?.default ?? logo.svg;
    const svg = svgSource
      .replace(/\s(width|height)="[^"]*"/g, '')
      .replace(
        '<svg ',
        `<svg width="${size}" height="${size}" style="width:${size}px;height:${size}px;display:block;object-fit:contain;flex-shrink:0" `,
      );

    return (
      <span
        aria-label={label}
        role="img"
        style={{
          width: size,
          height: size,
          display: 'block',
          flexShrink: 0,
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  if (logo.url?.startsWith('/')) {
    return (
      <Image
        src={logo.url}
        alt={label}
        width={size}
        height={size}
        unoptimized
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          flexShrink: 0,
          display: 'block',
        }}
      />
    );
  }

  return (
    <div
      aria-hidden
      title={label}
      style={{
        width: size,
        height: size,
        background: '#F4F0FF',
        borderRadius: rounded ? 4 : 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(8, Math.floor(size * 0.4)),
        fontWeight: 600,
        color: '#5B3FB8',
        flexShrink: 0,
      }}
    >
      {label.slice(0, 2).toUpperCase()}
    </div>
  );
}
