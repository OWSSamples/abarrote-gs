'use client';

import { Icon, TextField } from '@shopify/polaris';
import {
  ChevronRightIcon,
  CodeIcon,
  OrderIcon,
  PersonIcon,
  TeamIcon,
} from '@shopify/polaris-icons';
import type { SettingsSectionProps } from './types';
import './NotificationsSection.css';

interface NotificationsSectionProps extends SettingsSectionProps {
  tgTesting: boolean;
  tgTestResult: { success: boolean; message: string } | null;
  handleTGTest: () => void;
}

const notificationGroups = [
  [
    {
      icon: PersonIcon,
      title: 'Notificaciones a clientes',
      description: 'Notifica a los clientes sobre eventos de pedidos y cuentas',
    },
    {
      icon: TeamIcon,
      title: 'Notificaciones a empleados',
      description: 'Notifica a los empleados sobre eventos de nuevos pedidos',
    },
    {
      icon: OrderIcon,
      title: 'Notificación de solicitud de preparación de pedido',
      description: 'Notifica a tu proveedor de servicio de logística cuando marcas un pedido como preparado',
    },
  ],
  [
    {
      icon: CodeIcon,
      title: 'Webhooks',
      description: 'Envía notificaciones XML o JSON sobre eventos de la tienda a una URL',
    },
  ],
] as const;

export function NotificationsSection({
  config,
  updateField,
}: NotificationsSectionProps) {
  return (
    <section className="notifications-shopify-panel" aria-label="Notificaciones">
      <div className="notifications-shopify-card notifications-shopify-sender-card">
        <TextField
          label="Correo electrónico del remitente"
          helpText="El correo electrónico que usa tu tienda para enviar y recibir correos de tus clientes"
          value={config.emailFrom || ''}
          onChange={(value) => updateField('emailFrom', value)}
          autoComplete="email"
          type="email"
        />
      </div>

      <div className="notifications-shopify-card notifications-shopify-options-card">
        {notificationGroups.map((group, groupIndex) => (
          <div
            key={`notification-group-${groupIndex}`}
            className="notifications-shopify-option-group"
          >
            {group.map((item) => (
              <button
                key={item.title}
                type="button"
                className="notifications-shopify-option"
                aria-label={item.title}
              >
                <span className="notifications-shopify-option-icon" aria-hidden="true">
                  <Icon source={item.icon} tone="base" />
                </span>
                <span className="notifications-shopify-option-copy">
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </span>
                <span className="notifications-shopify-option-chevron" aria-hidden="true">
                  <Icon source={ChevronRightIcon} tone="subdued" />
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
