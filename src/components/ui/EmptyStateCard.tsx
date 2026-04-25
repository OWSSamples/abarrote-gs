'use client';

import { Card, EmptyState, Button } from '@shopify/polaris';
import type { ButtonProps } from '@shopify/polaris';

interface EmptyStateCardProps {
  heading: string;
  description: string;
  action?: {
    content: string;
    icon?: ButtonProps['icon'];
    onAction: () => void;
  };
}

export function EmptyStateCard({ heading, description, action }: EmptyStateCardProps) {
  return (
    <Card>
      <EmptyState heading={heading} image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-data.svg">
        <p>{description}</p>
        {action && (
          <Button variant="primary" icon={action.icon} onClick={action.onAction}>
            {action.content}
          </Button>
        )}
      </EmptyState>
    </Card>
  );
}
