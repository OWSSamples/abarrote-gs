'use client';

import { Classic } from '@/components/loading-ui/classic';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { BlockStack } from '@shopify/polaris';

export default function AuthLoading() {
  return (
    <AuthLayout>
      <div className="flex min-h-screen items-center justify-center">
        <BlockStack gap="400" align="center">
          <Classic size={36} duration={1.2} />
        </BlockStack>
      </div>
    </AuthLayout>
  );
}
