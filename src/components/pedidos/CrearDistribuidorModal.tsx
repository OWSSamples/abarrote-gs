'use client';

import { useState, useCallback } from 'react';
import { Modal, FormLayout, TextField, Select, Button, InlineGrid, Text } from '@shopify/polaris';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import type { Proveedor } from '@/types';

/* ─── Estados de México para el select ─── */
const ESTADOS_MX_OPTIONS = [
  { label: 'Selecciona estado', value: '' },
  { label: 'Aguascalientes', value: 'Aguascalientes' },
  { label: 'Baja California', value: 'Baja California' },
  { label: 'Baja California Sur', value: 'Baja California Sur' },
  { label: 'Campeche', value: 'Campeche' },
  { label: 'Chiapas', value: 'Chiapas' },
  { label: 'Chihuahua', value: 'Chihuahua' },
  { label: 'Ciudad de México', value: 'Ciudad de México' },
  { label: 'Coahuila', value: 'Coahuila' },
  { label: 'Colima', value: 'Colima' },
  { label: 'Durango', value: 'Durango' },
  { label: 'Estado de México', value: 'Estado de México' },
  { label: 'Guanajuato', value: 'Guanajuato' },
  { label: 'Guerrero', value: 'Guerrero' },
  { label: 'Hidalgo', value: 'Hidalgo' },
  { label: 'Jalisco', value: 'Jalisco' },
  { label: 'Michoacán', value: 'Michoacán' },
  { label: 'Morelos', value: 'Morelos' },
  { label: 'Nayarit', value: 'Nayarit' },
  { label: 'Nuevo León', value: 'Nuevo León' },
  { label: 'Oaxaca', value: 'Oaxaca' },
  { label: 'Puebla', value: 'Puebla' },
  { label: 'Querétaro', value: 'Querétaro' },
  { label: 'Quintana Roo', value: 'Quintana Roo' },
  { label: 'San Luis Potosí', value: 'San Luis Potosí' },
  { label: 'Sinaloa', value: 'Sinaloa' },
  { label: 'Sonora', value: 'Sonora' },
  { label: 'Tabasco', value: 'Tabasco' },
  { label: 'Tamaulipas', value: 'Tamaulipas' },
  { label: 'Tlaxcala', value: 'Tlaxcala' },
  { label: 'Veracruz', value: 'Veracruz' },
  { label: 'Yucatán', value: 'Yucatán' },
  { label: 'Zacatecas', value: 'Zacatecas' },
];

const PAIS_OPTIONS = [{ label: 'México', value: 'México' }];

/* ─── Modal Crear Distribuidor ─── */
export interface CrearDistribuidorModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (proveedor: Proveedor) => void;
}

export function CrearDistribuidorModal({ open, onClose, onSaved }: CrearDistribuidorModalProps) {
  const addProveedor = useDashboardStore((s) => s.addProveedor);
  const { showSuccess, showError } = useToast();

  const [saving, setSaving] = useState(false);
  const [empresa, setEmpresa] = useState('');
  const [calle, setCalle] = useState('');
  const [apartamento, setApartamento] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [estado, setEstado] = useState('');
  const [contacto, setContacto] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');

  const resetForm = useCallback(() => {
    setEmpresa('');
    setCalle('');
    setApartamento('');
    setCodigoPostal('');
    setCiudad('');
    setEstado('');
    setContacto('');
    setEmail('');
    setTelefono('');
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleGuardar = useCallback(async () => {
    if (!empresa.trim()) return;
    setSaving(true);
    try {
      const direccion = [calle, apartamento, ciudad, estado, codigoPostal].filter(Boolean).join(', ');
      const newProv = await addProveedor({
        nombre: empresa.trim(),
        contacto: contacto.trim(),
        telefono: telefono.trim(),
        email: email.trim(),
        direccion,
        categorias: [],
        notas: '',
        activo: true,
      });
      showSuccess(`Distribuidor "${empresa}" creado`);
      onSaved(newProv);
      resetForm();
      onClose();
    } catch {
      showError('Error al crear el distribuidor');
    }
    setSaving(false);
  }, [
    empresa,
    calle,
    apartamento,
    codigoPostal,
    ciudad,
    estado,
    contacto,
    email,
    telefono,
    addProveedor,
    showSuccess,
    showError,
    onSaved,
    resetForm,
    onClose,
  ]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Crear distribuidor"
      primaryAction={{
        content: saving ? 'Guardando...' : 'Guardar',
        onAction: handleGuardar,
        loading: saving,
        disabled: !empresa.trim(),
      }}
      secondaryActions={[{ content: 'Cerrar', onAction: handleClose }]}
    >
      <Modal.Section>
        <FormLayout>
          <TextField label="Empresa" value={empresa} onChange={setEmpresa} autoComplete="organization" autoFocus />
          <Select label="País o región" options={PAIS_OPTIONS} value="México" onChange={() => {}} />
          <TextField label="Calle y número de casa" value={calle} onChange={setCalle} autoComplete="address-line1" />
          <TextField
            label="Apartamento, local, etc."
            value={apartamento}
            onChange={setApartamento}
            autoComplete="address-line2"
          />
          <InlineGrid columns={2} gap="400">
            <TextField
              label="Código postal"
              value={codigoPostal}
              onChange={setCodigoPostal}
              autoComplete="postal-code"
            />
            <TextField label="Ciudad" value={ciudad} onChange={setCiudad} autoComplete="address-level2" />
          </InlineGrid>
          <Select label="Estado" options={ESTADOS_MX_OPTIONS} value={estado} onChange={setEstado} />
          <TextField
            label="Nombre del contacto"
            value={contacto}
            onChange={setContacto}
            autoComplete="name"
          />
          <InlineGrid columns={2} gap="400">
            <TextField
              label="Correo electrónico"
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="email"
            />
            <TextField
              label="Número de teléfono"
              value={telefono}
              onChange={setTelefono}
              type="tel"
              autoComplete="tel"
              prefix={<Text as="span" variant="bodySm">🇲🇽</Text>}
            />
          </InlineGrid>
        </FormLayout>
      </Modal.Section>
    </Modal>
  );
}
