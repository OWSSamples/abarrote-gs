'use client';

import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  TextField,
  Select,
  Checkbox,
  Box,
  Icon,
  ContextualSaveBar,
  Frame,
} from '@shopify/polaris';
import {
  PersonIcon,
  EditIcon,
  ChevronRightIcon,
  PlusIcon,
} from '@shopify/polaris-icons';
import { useState, useCallback, useEffect } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';

interface NewCustomerFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function NewCustomerForm({ onBack, onSuccess }: NewCustomerFormProps) {
  const addCliente = useDashboardStore((s) => s.addCliente);
  const { showSuccess, showError } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const styleId = 'new-customer-form-style';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      'body { overflow: hidden !important; height: 100vh !important; margin: 0; }',
      '.Polaris-Frame__Content { height: 100vh !important; overflow: hidden !important; display: flex; flex-direction: column; }',
      '.custom-scroll { height: calc(100vh - 60px); overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none; padding: 20px 0; }',
      '.custom-scroll::-webkit-scrollbar { display: none; }',
    ].join('\n');
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState('es');
  const [emailMarketing, setEmailMarketing] = useState(false);
  const [smsMarketing, setSmsMarketing] = useState(false);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [taxConfig, setTaxConfig] = useState('recaudar');

  const hasChanges = firstName !== '' || lastName !== '' || email !== '' || phone !== '' || notes !== '' || tags !== '';

  const handleDiscard = useCallback(() => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setLanguage('es');
    setEmailMarketing(false);
    setSmsMarketing(false);
    setNotes('');
    setTags('');
    setTaxConfig('recaudar');
    onBack();
  }, [onBack]);

  const handleSave = useCallback(async () => {
    if (!firstName.trim()) {
      showError('El nombre es obligatorio');
      return;
    }

    setIsSubmitting(true);
    try {
      const fullName = `${firstName} ${lastName}`.trim();
      await addCliente({
        name: fullName,
        phone: phone.trim(),
        address: '', 
        creditLimit: 500,
        points: 0,
      });
      showSuccess(`Cliente ${fullName} creado exitosamente`);
      onSuccess();
    } catch (err) {
      showError('Error al crear el cliente');
    } finally {
      setIsSubmitting(false);
    }
  }, [firstName, lastName, phone, addCliente, showSuccess, showError, onSuccess]);

  const contextualSaveBar = hasChanges ? (
    <ContextualSaveBar
      message="Cambios no guardados"
      saveAction={{
        content: 'Guardar',
        onAction: handleSave,
        loading: isSubmitting,
      }}
      discardAction={{
        content: 'Descartar',
        onAction: handleDiscard,
      }}
    />
  ) : null;

  return (
    <Frame>
      {contextualSaveBar}
      <Page>
        <div className="custom-scroll">
          <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 20px' }}>
            <Box paddingBlockEnd="400">
              <InlineStack gap="100" blockAlign="center">
                <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.6 }}>
                  <Icon source={PersonIcon} tone="base" />
                </div>
                <Text as="span" tone="subdued">
                   <span style={{ fontSize: '14px', margin: '0 4px' }}>›</span>
                </Text>
                <Text as="h1" variant="headingLg">
                  Nuevo cliente
                </Text>
              </InlineStack>
            </Box>
            
            <Layout>
              <Layout.Section>
                <BlockStack gap="400">
                  <Card>
                    <BlockStack gap="400">
                      <Text as="h2" variant="headingMd">Descripción general del cliente</Text>
                      <InlineStack gap="400">
                        <div style={{ flex: 1 }}><TextField label="Nombre" value={firstName} onChange={setFirstName} autoComplete="given-name" placeholder="ELoy" /></div>
                        <div style={{ flex: 1 }}><TextField label="Apellido" value={lastName} onChange={setLastName} autoComplete="family-name" placeholder="Hertz" /></div>
                      </InlineStack>
                      <Select
                        label="Idioma"
                        options={[{ label: 'Español [Predeterminado]', value: 'es' }, { label: 'Inglés', value: 'en' }]}
                        value={language}
                        onChange={setLanguage}
                        helpText="Este cliente recibirá las notificaciones en este idioma."
                      />
                      <TextField label="Correo electrónico" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="example@ccompany.com" />
                      <TextField
                        label="Número de teléfono"
                        type="tel"
                        value={phone}
                        onChange={setPhone}
                        autoComplete="tel"
                        placeholder="56 5035 7389"
                        prefix={<div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingRight: '8px', borderRight: '1px solid #dcdfe3' }}><span style={{ fontSize: '18px' }}>🇲🇽</span><Icon source={ChevronRightIcon} tone="subdued" /></div>}
                      />
                      <BlockStack gap="200">
                        <Checkbox label="El cliente aceptó recibir correos electrónicos de marketing." checked={emailMarketing} onChange={setEmailMarketing} />
                        <Checkbox label="El cliente aceptó recibir mensajes de texto de marketing por SMS." checked={smsMarketing} onChange={setSmsMarketing} />
                      </BlockStack>
                      <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                        <Text as="p" variant="bodySm" tone="subdued">Debes pedir permiso a los clientes antes de suscribirlos a los correos electrónicos o SMS de marketing.</Text>
                      </Box>
                    </BlockStack>
                  </Card>

                  <Card>
                    <BlockStack gap="400">
                      <BlockStack gap="100">
                        <Text as="h2" variant="headingMd">Dirección predeterminada</Text>
                        <Text as="p" tone="subdued">La dirección principal de este cliente</Text>
                      </BlockStack>
                      <Box padding="400" background="bg-surface" borderRadius="200" borderWidth="025" borderStyle="solid" borderColor="border">
                        <div onClick={() => {}} style={{ cursor: 'pointer' }}>
                          <InlineStack align="space-between" blockAlign="center">
                            <InlineStack gap="200" blockAlign="center">
                              <Icon source={PlusIcon} tone="base" /><Text as="span">Agregar dirección</Text>
                            </InlineStack>
                            <Icon source={ChevronRightIcon} tone="subdued" />
                          </InlineStack>
                        </div>
                      </Box>
                    </BlockStack>
                  </Card>

                  <Card>
                    <BlockStack gap="400">
                      <Text as="h2" variant="headingMd">Información fiscal</Text>
                      <Select label="Configuración fiscal" options={[{ label: 'Recaudar impuestos', value: 'recaudar' }, { label: 'No recaudar impuestos', value: 'no-recaudar' }]} value={taxConfig} onChange={setTaxConfig} />
                    </BlockStack>
                  </Card>
                </BlockStack>
              </Layout.Section>

              <Layout.Section variant="oneThird">
                <BlockStack gap="400">
                  <Card>
                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h2" variant="headingMd">Notas</Text>
                        <Button variant="plain" icon={EditIcon} />
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">Las notas son privadas y no se compartirán con el cliente.</Text>
                    </BlockStack>
                  </Card>
                  <Card>
                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h2" variant="headingMd">Etiquetas</Text>
                        <Button variant="plain" icon={EditIcon} />
                      </InlineStack>
                      <TextField label="Etiquetas" labelHidden value={tags} onChange={setTags} autoComplete="off" />
                    </BlockStack>
                  </Card>
                </BlockStack>
              </Layout.Section>
            </Layout>

            <Box paddingBlockStart="800" paddingBlockEnd="800">
               {/* Espacio final para que el scroll no corte el contenido */}
            </Box>
          </div>
        </div>
      </Page>
    </Frame>
  );
}
