'use client';

import { useState, useCallback } from 'react';
import {
  Popover,
  ActionList,
  Button,
  TextField,
  BlockStack,
  Text,
  Box,
} from '@shopify/polaris';
import { SelectIcon } from '@shopify/polaris-icons';
import type { Proveedor } from '@/types';

export interface DistribuidorSelectorProps {
  proveedores: Proveedor[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCrearNuevo: () => void;
}

export function DistribuidorSelector({ proveedores, selectedId, onSelect, onCrearNuevo }: DistribuidorSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const activos = proveedores.filter((p) => p.activo);
  const filtered = search.trim()
    ? activos.filter((p) => p.nombre.toLowerCase().includes(search.toLowerCase()))
    : activos;
  const selected = activos.find((p) => p.id === selectedId);

  const handleToggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => {
    setOpen(false);
    setSearch('');
  }, []);

  const activator = (
    <Button
      onClick={handleToggle}
      icon={SelectIcon}
      disclosure={open ? 'up' : 'down'}
      fullWidth
      textAlign="left"
    >
      {selected ? selected.nombre : 'Seleccionar distribuidor'}
    </Button>
  );

  const proveedorItems = filtered.map((p) => ({
    content: p.nombre,
    helpText: p.email || undefined,
    active: p.id === selectedId,
    onAction: () => {
      onSelect(p.id);
      close();
    },
  }));

  return (
    <Popover
      active={open}
      activator={activator}
      onClose={close}
      fullWidth
      preferredAlignment="left"
    >
      <Box padding="200">
        <BlockStack gap="200">
          {activos.length > 0 && (
            <TextField
              label="Buscar distribuidor"
              labelHidden
              placeholder="Buscar distribuidor..."
              value={search}
              onChange={setSearch}
              autoComplete="off"
              clearButton
              onClearButtonClick={() => setSearch('')}
              autoFocus
            />
          )}
        </BlockStack>
      </Box>
      {filtered.length > 0 ? (
        <ActionList items={proveedorItems} />
      ) : (
        <Box padding="400">
          <Text as="p" variant="bodySm" tone="subdued" alignment="center">
            No se encontraron distribuidores
          </Text>
        </Box>
      )}
      <Box borderBlockStartWidth="025" borderColor="border" padding="200">
        <Button variant="plain" onClick={() => { close(); onCrearNuevo(); }} fullWidth textAlign="left">
          + Crear nuevo distribuidor
        </Button>
      </Box>
    </Popover>
  );
}
