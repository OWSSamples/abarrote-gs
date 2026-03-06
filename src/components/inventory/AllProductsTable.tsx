'use client';

import { useState } from 'react';
import {
  Card,
  IndexTable,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  Button,
  ButtonGroup,
  TextField,
  Icon,
} from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';
import { Product } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

interface AllProductsTableProps {
  products: Product[];
  onProductClick?: (product: Product) => void;
  onRegisterProduct?: () => void;
  onExport?: () => void;
  onCreatePedido?: () => void;
  onDeleteProduct?: (product: Product) => void;
  onUpdateProduct?: (product: Product) => void;
}

export function AllProductsTable({ products, onProductClick, onRegisterProduct, onExport, onCreatePedido, onDeleteProduct, onUpdateProduct }: AllProductsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.barcode.includes(searchQuery)
  );

  const getStockBadge = (product: Product) => {
    if (product.currentStock === 0) {
      return <Badge tone="critical">Sin stock</Badge>;
    }
    if (product.currentStock <= product.minStock) {
      return <Badge tone="warning">Stock bajo</Badge>;
    }
    return <Badge tone="success">OK</Badge>;
  };

  const rowMarkup = filteredProducts.map((product, index) => (
    <IndexTable.Row
      id={product.id}
      key={product.id}
      position={index}
      onClick={() => onProductClick?.(product)}
    >
      <IndexTable.Cell>
        <Text as="p" variant="bodyMd" fontWeight="semibold">
          {product.name}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {product.sku}
        </Text>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <Text as="p" variant="bodyMd" tone="subdued">
          {product.barcode}
        </Text>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <Text as="p" variant="bodyMd">
          {product.category}
        </Text>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <InlineStack gap="200" blockAlign="center">
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            {product.currentStock}
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            / {product.minStock} mín
          </Text>
        </InlineStack>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <BlockStack gap="050">
          <Text as="p" variant="bodySm" tone="subdued">
            Costo: {formatCurrency(product.costPrice)}
          </Text>
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            Venta: {formatCurrency(product.unitPrice)}
          </Text>
        </BlockStack>
      </IndexTable.Cell>

      <IndexTable.Cell>
        {product.expirationDate ? (
          <Text as="p" variant="bodyMd">
            {formatDate(product.expirationDate)}
          </Text>
        ) : (
          <Text as="p" variant="bodyMd" tone="subdued">
            N/A
          </Text>
        )}
      </IndexTable.Cell>

      <IndexTable.Cell>
        {getStockBadge(product)}
      </IndexTable.Cell>

      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button
            size="slim"
            onClick={() => onUpdateProduct?.(product)}
          >
            Actualizar
          </Button>
          <Button
            size="slim"
            tone="critical"
            onClick={() => onDeleteProduct?.(product)}
          >
            Eliminar
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <BlockStack gap="100">
            <Text as="h3" variant="headingMd">
              Todos los Productos
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {products.length} productos agregados
            </Text>
          </BlockStack>

                    <ButtonGroup>
            <Button size="slim" onClick={onExport}>Exportar</Button>
            {onRegisterProduct && (
              <Button variant="primary" tone="success" size="slim" onClick={onRegisterProduct}>
                Registrar Producto
              </Button>
            )}
            <Button variant="primary" size="slim" onClick={onCreatePedido}>
              Crear pedido
            </Button>
          </ButtonGroup>
        </InlineStack>

        <TextField
          label=""
          labelHidden
          placeholder="Buscar por nombre, SKU o código de barras..."
          value={searchQuery}
          onChange={setSearchQuery}
          prefix={<Icon source={SearchIcon} />}
          autoComplete="off"
        />

        {filteredProducts.length === 0 ? (
          <BlockStack gap="200" inlineAlign="center">
            <Text as="p" variant="bodyMd" tone="subdued">
              {searchQuery ? 'No se encontraron productos' : 'No hay productos registrados'}
            </Text>
          </BlockStack>
        ) : (
          <IndexTable
            itemCount={filteredProducts.length}
            headings={[
              { title: 'Producto' },
              { title: 'Código de Barras' },
              { title: 'Categoría' },
              { title: 'Stock' },
              { title: 'Precios' },
              { title: 'Vencimiento' },
              { title: 'Estado' },
              { title: 'Acciones' },
            ]}
            selectable={false}
          >
            {rowMarkup}
          </IndexTable>
        )}
      </BlockStack>
    </Card>
  );
}
