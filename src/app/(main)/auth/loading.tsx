'use client';

import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import { SkeletonLine } from '@cloudflare/kumo/components/loader';
import { AuthLayout } from '@/components/auth/AuthLayout';

function SkeletonText({ width, blockHeight }: { width: number; blockHeight?: number }) {
  return (
    <SkeletonLine
      minWidth={width}
      maxWidth={width}
      minDuration={1.5}
      maxDuration={1.5}
      minDelay={0}
      maxDelay={0}
      blockHeight={blockHeight}
    />
  );
}

function SkeletonControl({ labelWidth }: { labelWidth: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      <SkeletonText width={labelWidth} />
      <div className="h-8 w-full animate-pulse rounded-md border border-kumo-line bg-kumo-recessed/70 motion-reduce:animate-none" />
    </div>
  );
}

export default function AuthLoading() {
  return (
    <AuthLayout layered>
      <LayerCard.Secondary>
        <div className="space-y-2" aria-hidden="true">
          <SkeletonText width={31} blockHeight={20} />
          <SkeletonText width={72} />
        </div>
      </LayerCard.Secondary>

      <LayerCard.Primary
        className="gap-4"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Cargando formulario de inicio de sesión</span>

        <div className="space-y-2" aria-hidden="true">
          <div className="h-8 w-full animate-pulse rounded-md border border-kumo-line bg-kumo-recessed/70 motion-reduce:animate-none" />
          <div className="h-8 w-full animate-pulse rounded-md border border-kumo-line bg-kumo-recessed/70 motion-reduce:animate-none" />
        </div>

        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-kumo-hairline" />
          <div className="size-2 rounded-full bg-kumo-recessed" />
          <div className="h-px flex-1 bg-kumo-hairline" />
        </div>

        <div className="space-y-4">
          <SkeletonControl labelWidth={14} />
          <SkeletonControl labelWidth={24} />

          <div className="flex justify-end" aria-hidden="true">
            <SkeletonText width={38} />
          </div>

          <div
            className="h-8 w-full animate-pulse rounded-md bg-kumo-brand/20 motion-reduce:animate-none"
            aria-hidden="true"
          />
        </div>

        <div className="flex justify-center" aria-hidden="true">
          <SkeletonText width={58} />
        </div>
      </LayerCard.Primary>
    </AuthLayout>
  );
}
