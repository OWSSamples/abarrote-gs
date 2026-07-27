import { AuthLayout } from '@/components/auth/AuthLayout';
import { SkeletonLine } from '@cloudflare/kumo/components/loader';

export default function AuthLoading() {
  return (
    <AuthLayout layered>
      <div
        className="space-y-2 bg-kumo-elevated px-4 py-3"
        aria-label="Preparando inicio de sesión"
      >
        <SkeletonLine className="h-5 w-32" />
        <SkeletonLine className="w-64 max-w-full" />
      </div>
      <div className="space-y-4 bg-kumo-base p-4" aria-hidden="true">
        <div className="space-y-2">
          <SkeletonLine className="w-14" />
          <SkeletonLine className="h-9 w-full" />
        </div>
        <div className="space-y-2">
          <SkeletonLine className="w-24" />
          <SkeletonLine className="h-9 w-full" />
        </div>
        <SkeletonLine className="h-9 w-full" />
      </div>
    </AuthLayout>
  );
}
