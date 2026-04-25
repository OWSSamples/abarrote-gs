'use client';

import Image from 'next/image';
import { useState } from 'react';
import { getBrandLogoUrl } from '@/lib/brand-logos';

interface BrandLogoProps {
  /** Nombre de la marca (e.g. "Stripe", "Mercado Pago") */
  name: string;
  /** Tamaño en px (cuadrado). Default 24 */
  size?: number;
  /** Texto alternativo (default = name) */
  alt?: string;
  /** Borde redondeado del fallback */
  rounded?: boolean;
}

/**
 * Componente cliente que renderiza el logo de una marca
 * resuelto vía `getBrandLogoUrl` (simpleicons CDN o S3 self-hosted).
 *
 * Resolución 100% síncrona — sin fetch, sin estado de loading.
 * Si la imagen falla en cargar (404 / network), muestra placeholder.
 */
export function BrandLogo({ name, size = 24, alt, rounded = true }: BrandLogoProps) {
  const url = getBrandLogoUrl(name);
  const [errored, setErrored] = useState(false);

  if (!url || errored) {
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

  return (
    <Image
      src={url}
      alt={alt ?? name}
      width={size}
      height={size}
      unoptimized
      onError={() => setErrored(true)}
      style={{ objectFit: 'contain', flexShrink: 0 }}
    />
  );
}
