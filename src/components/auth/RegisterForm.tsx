'use client';

import NextLink from 'next/link';
import { Button } from '@cloudflare/kumo/components/button';
import { Text } from '@cloudflare/kumo/components/text';
import { Banner } from '@cloudflare/kumo/components/banner';
import { Lock, ArrowLeft } from '@phosphor-icons/react';

export function RegisterForm() {
  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="space-y-1">
        <Text variant="heading2" as="h1">
          Solicitud de Acceso
        </Text>
        <Text variant="secondary" size="sm">
          La creación de perfiles es gestionada por el Departamento de TI de{' '}
          <span className="font-semibold text-kumo-default">Opendex Web Services</span>.
        </Text>
      </div>

      {/* Steps card */}
      <div className="space-y-3 rounded-lg bg-kumo-recessed p-4">
        <Text size="sm" bold>
          Sigue estos pasos para comenzar:
        </Text>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <Text variant="secondary" size="sm" as="span">
              Contacta a tu administrador de sistemas local.
            </Text>
          </li>
          <li>
            <Text variant="secondary" size="sm" as="span">
              Presenta tu <span className="font-semibold text-kumo-default">GlobalID</span> corporativo válido.
            </Text>
          </li>
          <li>
            <Text variant="secondary" size="sm" as="span">
              Confirma tus niveles de acceso requeridos.
            </Text>
          </li>
        </ul>
      </div>

      {/* Security banner */}
      <Banner variant="alert">
        <div className="flex items-start gap-2">
          <Lock size={16} className="mt-0.5 flex-shrink-0" />
          <Text variant="secondary" size="sm" as="span">
            La seguridad es nuestra prioridad. Nunca compartas tus llaves de acceso.
          </Text>
        </div>
      </Banner>

      {/* Action button */}
      <NextLink href="/auth/login" className="block">
        <Button variant="primary" className="w-full justify-center" size="lg" icon={ArrowLeft}>
          Volver al inicio de sesión
        </Button>
      </NextLink>
    </div>
  );
}
