'use client';

import { SkeletonPage, Layout, SkeletonBodyText, SkeletonDisplayText, BlockStack } from '@shopify/polaris';

export default function MainLoading() {
  return (
    <SkeletonPage title="Cargando..." fullWidth>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <SkeletonDisplayText size="medium" />
            <SkeletonBodyText lines={4} />
          </BlockStack>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}
