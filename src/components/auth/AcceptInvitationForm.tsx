'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@cloudflare/kumo/components/button';
import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import { Link } from '@cloudflare/kumo/components/link';
import { Text } from '@cloudflare/kumo/components/text';
import {
  CheckmarkCircle24Filled,
  DismissCircle24Filled,
  PeopleTeam24Filled,
} from '@fluentui/react-icons';
import {
  acceptTenantInvitation,
  getTenantInvitationPreview,
} from '@/app/actions/tenant-invitation-actions';
import { useToast } from '@/components/notifications/ToastProvider';

interface InvitationPreview {
  valid: boolean;
  tenantName?: string;
  email?: string;
  roleName?: string;
}

export function AcceptInvitationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const token = searchParams.get('token') ?? '';
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const returnTo = useMemo(
    () => `/auth/accept-invitation?token=${encodeURIComponent(token)}`,
    [token],
  );

  useEffect(() => {
    let active = true;
    void getTenantInvitationPreview(token)
      .then((result) => {
        if (active) setPreview(result);
      })
      .catch(() => {
        if (active) setPreview({ valid: false });
      });
    return () => {
      active = false;
    };
  }, [token]);

  const handleAccept = useCallback(async () => {
    setIsAccepting(true);
    try {
      await acceptTenantInvitation(token);
      setAccepted(true);
      toast.showSuccess('Tu acceso al negocio quedó activado.');
      router.refresh();
      setTimeout(() => router.push('/'), 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/autenticaci[oó]n|sesi[oó]n|authenticated/i.test(message)) {
        router.push(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      toast.showError(message || 'No fue posible aceptar la invitación.');
    } finally {
      setIsAccepting(false);
    }
  }, [returnTo, router, toast, token]);

  if (preview === null) {
    return (
      <LayerCard.Primary className="flex min-h-48 items-center justify-center">
        <Text variant="secondary" size="sm">Revisando invitación...</Text>
      </LayerCard.Primary>
    );
  }

  if (!preview.valid) {
    return (
      <>
        <LayerCard.Secondary>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-kumo-danger-tint/70">
              <DismissCircle24Filled className="text-kumo-danger" />
            </div>
            <Text variant="heading2" as="h1">Invitación no disponible</Text>
            <Text variant="secondary" size="sm" as="p">
              El enlace venció, fue utilizado o ya fue revocado.
            </Text>
          </div>
        </LayerCard.Secondary>
        <LayerCard.Primary>
          <Link href="/auth/login" variant="plain" render={<NextLink href="/auth/login" />}>
            <Text as="span" size="sm" bold>Volver al inicio de sesión</Text>
          </Link>
        </LayerCard.Primary>
      </>
    );
  }

  if (accepted) {
    return (
      <>
        <LayerCard.Secondary>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-kumo-success-tint/70">
              <CheckmarkCircle24Filled className="text-kumo-success" />
            </div>
            <Text variant="heading2" as="h1">Acceso activado</Text>
            <Text variant="secondary" size="sm" as="p">
              Ya puedes trabajar en {preview.tenantName}.
            </Text>
          </div>
        </LayerCard.Secondary>
        <LayerCard.Primary>
          <Button variant="primary" className="w-full justify-center" onClick={() => router.push('/')}>
            Entrar al negocio
          </Button>
        </LayerCard.Primary>
      </>
    );
  }

  return (
    <>
      <LayerCard.Secondary>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-kumo-recessed">
            <PeopleTeam24Filled className="text-kumo-secondary" />
          </div>
          <Text variant="heading2" as="h1">Únete al negocio</Text>
          <Text variant="secondary" size="sm" as="p">
            Revisa el acceso antes de incorporarlo a tu cuenta.
          </Text>
        </div>
      </LayerCard.Secondary>
      <LayerCard.Primary className="gap-4">
        <dl className="grid gap-3 rounded-lg border border-kumo-line bg-kumo-recessed p-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-kumo-subtle">Negocio</dt>
            <dd className="font-medium text-kumo-default">{preview.tenantName}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-kumo-subtle">Cuenta</dt>
            <dd className="font-medium text-kumo-default">{preview.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-kumo-subtle">Rol</dt>
            <dd className="font-medium text-kumo-default">{preview.roleName}</dd>
          </div>
        </dl>
        <Button
          variant="primary"
          size="lg"
          className="w-full justify-center"
          loading={isAccepting}
          onClick={handleAccept}
        >
          Aceptar invitación
        </Button>
        <Text variant="secondary" size="xs" as="p" DANGEROUS_className="text-center">
          Debes iniciar sesión con el mismo correo que recibió la invitación.
        </Text>
      </LayerCard.Primary>
    </>
  );
}
