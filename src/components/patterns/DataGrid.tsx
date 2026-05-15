'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  IndexTable,
  Card,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Button,
  Badge,
  Pagination,
  EmptySearchResult,
  Box,
  Spinner,
  Filters,
  type IndexTableProps,
} from '@shopify/polaris';
import type { ReactNode } from 'react';
import { SearchIcon } from '@shopify/polaris-icons';

// ── Types ──

export type SortDirection = 'ascending' | 'descending';

export interface DataGridColumn<T> {
  /** Unique column key — maps to a property of T */
  id: string;
  /** Header label */
  header: string;
  /** Render cell content */
  render: (row: T) => ReactNode;
  /** Enable sorting for this column */
  sortable?: boolean;
  /** Sort comparator (client-side). If omitted, uses default string compare. */
  compare?: (a: T, b: T) => number;
  /** Column width hint */
  width?: string;
  /** Alignment */
  alignment?: 'start' | 'center' | 'end';
  /** Hide on mobile */
  hideOnMobile?: boolean;
}

interface BulkAction {
  content: string;
  onAction: (selectedRows: string[]) => void;
  destructive?: boolean;
  icon?: ReactNode;
}

interface DataGridProps<T> {
  /** Unique key per row */
  resourceName: { singular: string; plural: string };
  /** Row data */
  items: T[];
  /** Column definitions */
  columns: DataGridColumn<T>[];
  /** Extract unique ID from each row */
  getId: (row: T) => string;
  /** Bulk actions when rows are selected */
  bulkActions?: BulkAction[];
  /** Enable row selection checkboxes */
  selectable?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Client-side pagination (items per page) */
  pageSize?: number;
  /** Enable client-side search. Provide a function that returns searchable text for a row. */
  searchable?: (row: T) => string;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Default sort column */
  defaultSortColumnId?: string;
  /** Default sort direction */
  defaultSortDirection?: SortDirection;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Empty state override */
  emptyState?: ReactNode;
  /** Condensed table rows */
  condensed?: boolean;
}

/**
 * DataGrid — Enterprise-grade data table built on Polaris IndexTable.
 *
 * Features:
 * - Column sorting (client-side)
 * - Search filtering
 * - Pagination with page size
 * - Row selection + bulk actions
 * - Loading/empty states
 * - Responsive (hides columns via hideOnMobile)
 *
 * @example
 * <DataGrid
 *   resourceName={{ singular: 'producto', plural: 'productos' }}
 *   items={products}
 *   getId={(p) => p.id}
 *   columns={[
 *     { id: 'name', header: 'Nombre', render: (p) => p.name, sortable: true },
 *     { id: 'price', header: 'Precio', render: (p) => formatCurrency(p.price), sortable: true,
 *       compare: (a, b) => a.price - b.price },
 *     { id: 'stock', header: 'Stock', render: (p) => <Badge>{p.stock}</Badge> },
 *   ]}
 *   searchable={(p) => `${p.name} ${p.sku}`}
 *   pageSize={25}
 *   selectable
 *   bulkActions={[{ content: 'Eliminar', onAction: handleDelete, destructive: true }]}
 * />
 */
export function DataGrid<T>({
  resourceName,
  items,
  columns,
  getId,
  bulkActions = [],
  selectable = false,
  loading = false,
  pageSize = 25,
  searchable,
  searchPlaceholder = 'Buscar…',
  defaultSortColumnId,
  defaultSortDirection = 'ascending',
  onRowClick,
  emptyState,
  condensed = false,
}: DataGridProps<T>) {
  // ── Search ──
  const [searchValue, setSearchValue] = useState('');

  // ── Sort ──
  const [sortColumnIndex, setSortColumnIndex] = useState<number | undefined>(() => {
    if (!defaultSortColumnId) return undefined;
    const idx = columns.findIndex((c) => c.id === defaultSortColumnId);
    return idx >= 0 ? idx : undefined;
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);

  // ── Pagination ──
  const [currentPage, setCurrentPage] = useState(1);

  // ── Selection ──
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // ── Filtered data ──
  const filteredItems = useMemo(() => {
    if (!searchable || !searchValue.trim()) return items;
    const query = searchValue.toLowerCase().trim();
    return items.filter((row) => searchable(row).toLowerCase().includes(query));
  }, [items, searchValue, searchable]);

  // ── Sorted data ──
  const sortedItems = useMemo(() => {
    if (sortColumnIndex === undefined) return filteredItems;
    const col = columns[sortColumnIndex];
    if (!col?.sortable) return filteredItems;

    const sorted = [...filteredItems].sort((a, b) => {
      if (col.compare) return col.compare(a, b);
      // Default: string comparison on rendered text
      const aVal = String(col.render(a) ?? '');
      const bVal = String(col.render(b) ?? '');
      return aVal.localeCompare(bVal, 'es');
    });

    return sortDirection === 'descending' ? sorted.reverse() : sorted;
  }, [filteredItems, sortColumnIndex, sortDirection, columns]);

  // ── Paginated data ──
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  // Reset page when search changes
  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
    setCurrentPage(1);
    setSelectedIds([]);
  }, []);

  // ── Sort handler ──
  const handleSort = useCallback(
    (headingIndex: number, direction: SortDirection) => {
      if (!columns[headingIndex]?.sortable) return;
      setSortColumnIndex(headingIndex);
      setSortDirection(direction);
      setCurrentPage(1);
    },
    [columns],
  );

  // ── Selection ──
  const handleSelectionChange: IndexTableProps['onSelectionChange'] = useCallback(
    (selectionType: string, toggleType: boolean, id?: string) => {
      if (selectionType === 'all') {
        setSelectedIds(toggleType ? paginatedItems.map(getId) : []);
      } else if (selectionType === 'page') {
        setSelectedIds(toggleType ? paginatedItems.map(getId) : []);
      } else if (id) {
        setSelectedIds((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
      }
    },
    [paginatedItems, getId],
  );

  // ── Headings ──
  const headings = columns.map((col) => ({
    title: col.header,
    alignment: col.alignment,
  })) as unknown as IndexTableProps['headings'];

  const sortableColumns = columns.map((col) => col.sortable ?? false);

  // ── Promotable bulk actions ──
  const promotedBulkActions = bulkActions.map((action) => ({
    content: action.content,
    onAction: () => action.onAction(selectedIds),
    destructive: action.destructive,
  }));

  // ── Empty state ──
  if (!loading && items.length === 0) {
    return (
      <Card>
        {emptyState ?? (
          <EmptySearchResult
            title={`No hay ${resourceName.plural}`}
            description={`Agrega tu primer ${resourceName.singular} para comenzar.`}
            withIllustration
          />
        )}
      </Card>
    );
  }

  return (
    <Card padding="0">
      <BlockStack>
        {/* Search bar */}
        {searchable && (
          <Box padding="400" paddingBlockEnd="0">
            <TextField
              label=""
              labelHidden
              value={searchValue}
              onChange={handleSearchChange}
              placeholder={searchPlaceholder}
              prefix={<span aria-hidden>🔍</span>}
              clearButton
              onClearButtonClick={() => handleSearchChange('')}
              autoComplete="off"
            />
          </Box>
        )}

        {/* Results count */}
        <Box padding="400" paddingBlockStart={searchable ? '200' : '400'} paddingBlockEnd="0">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="span" variant="bodySm" tone="subdued">
              {filteredItems.length === items.length
                ? `${items.length} ${items.length === 1 ? resourceName.singular : resourceName.plural}`
                : `${filteredItems.length} de ${items.length} ${resourceName.plural}`}
            </Text>
            {selectedIds.length > 0 && (
              <Badge tone="info">{`${selectedIds.length} seleccionados`}</Badge>
            )}
          </InlineStack>
        </Box>

        {/* Loading */}
        {loading ? (
          <Box padding="800">
            <InlineStack align="center">
              <Spinner size="large" />
            </InlineStack>
          </Box>
        ) : (
          <>
            {/* Table */}
            <IndexTable
              resourceName={resourceName}
              itemCount={filteredItems.length}
              headings={headings}
              sortable={sortableColumns}
              sortColumnIndex={sortColumnIndex}
              sortDirection={sortDirection}
              onSort={handleSort}
              selectedItemsCount={selectedIds.length}
              onSelectionChange={selectable ? handleSelectionChange : undefined}
              promotedBulkActions={selectable ? promotedBulkActions : undefined}
              selectable={selectable}
              condensed={condensed}
              emptyState={
                searchValue ? (
                  <EmptySearchResult
                    title="Sin resultados"
                    description={`No se encontraron ${resourceName.plural} para "${searchValue}".`}
                    withIllustration
                  />
                ) : undefined
              }
            >
              {paginatedItems.map((row, index) => {
                const id = getId(row);
                return (
                  <IndexTable.Row
                    key={id}
                    id={id}
                    position={index}
                    selected={selectedIds.includes(id)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => (
                      <IndexTable.Cell key={col.id}>{col.render(row)}</IndexTable.Cell>
                    ))}
                  </IndexTable.Row>
                );
              })}
            </IndexTable>

            {/* Pagination */}
            {totalPages > 1 && (
              <Box padding="400">
                <InlineStack align="center">
                  <Pagination
                    hasPrevious={currentPage > 1}
                    hasNext={currentPage < totalPages}
                    onPrevious={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    label={`${currentPage} de ${totalPages}`}
                  />
                </InlineStack>
              </Box>
            )}
          </>
        )}
      </BlockStack>
    </Card>
  );
}
