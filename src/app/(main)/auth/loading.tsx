'use client';

import { SkeletonPage, Layout, SkeletonBodyText, SkeletonDisplayText, BlockStack } from '@shopify/polaris';

export default function AuthLoading() {
  return (
    <SkeletonPage title="Cargando..." narrowWidth>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <SkeletonDisplayText size="medium" />
            <SkeletonBodyText lines={3} />
          </BlockStack>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}
