'use client';

import { Page, Layout, BlockStack, Banner, SkeletonPage, SkeletonBodyText } from '@shopify/polaris';
import type { PageProps } from '@shopify/polaris';
import type { ReactNode } from 'react';

// ── Types ──

interface PageShellAction {
  content: string;
  onAction: () => void;
  icon?: PageProps['primaryAction'] extends { icon?: infer I } ? I : never;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
  url?: string;
}

interface PageShellProps {
  /** Page title */
  title: string;
  /** Optional subtitle below title */
  subtitle?: string;
  /** Badge/metadata next to title */
  titleMetadata?: ReactNode;
  /** Back navigation */
  backAction?: { content: string; url: string };
  /** Primary CTA button */
  primaryAction?: PageShellAction;
  /** Secondary action buttons */
  secondaryActions?: PageShellAction[];
  /** Use full width layout */
  fullWidth?: boolean;
  /** Page content */
  children: ReactNode;
  /** Loading skeleton state */
  loading?: boolean;
  /** Error message to display as banner */
  error?: string | null;
  /** Optional action bar above children (filters, bulk actions) */
  actionBar?: ReactNode;
  /** Additional header content (tabs, etc) */
  headerContent?: ReactNode;
}

/**
 * PageShell — Enterprise page wrapper
 *
 * Provides consistent page structure across all dashboard pages:
 * - Polaris Page with title/actions
 * - Loading skeleton
 * - Error banner
 * - Action bar slot
 * - Layout.Section wrapper
 *
 * @example
 * <PageShell
 *   title="Productos"
 *   subtitle="Catálogo completo"
 *   primaryAction={{ content: 'Agregar', onAction: openModal }}
 *   loading={isLoading}
 * >
 *   <ProductsTable />
 * </PageShell>
 */
export function PageShell({
  title,
  subtitle,
  titleMetadata,
  backAction,
  primaryAction,
  secondaryActions,
  fullWidth = true,
  children,
  loading = false,
  error,
  actionBar,
  headerContent,
}: PageShellProps) {
  if (loading) {
    return (
      <SkeletonPage title={title} primaryAction fullWidth={fullWidth}>
        <Layout>
          <Layout.Section>
            <SkeletonBodyText lines={6} />
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  return (
    <Page
      fullWidth={fullWidth}
      title={title}
      subtitle={subtitle}
      titleMetadata={titleMetadata}
      backAction={backAction}
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
    >
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical" title="Error">
            <p>{error}</p>
          </Banner>
        )}

        {headerContent}
        {actionBar}

        <Layout>
          <Layout.Section>{children}</Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
