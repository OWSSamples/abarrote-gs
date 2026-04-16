'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Text,
  TextField,
  FormLayout,
  BlockStack,
  InlineStack,
  Button,
  Checkbox,
  Box,
  Banner,
  Badge,
  Divider,
  Link,
  Popover,
  OptionList,
} from '@shopify/polaris';
import { useDashboardStore } from '@/store/dashboardStore';
import { saveAIConfigAction, testAIConnectionAction } from '@/app/actions/ai-actions';
import { parseError } from '@/lib/errors';

const MODEL_OPTIONS = [
  { label: 'Google Gemini 2.0 Flash (Gratis)', value: 'google/gemini-2.0-flash-001' },
  { label: 'Google Gemini 2.0 Flash Lite (Gratis)', value: 'google/gemini-2.0-flash-lite-001' },
  { label: 'Meta Llama 4 Scout (Gratis)', value: 'meta-llama/llama-4-scout:free' },
  { label: 'DeepSeek V3 (Gratis)', value: 'deepseek/deepseek-chat-v3-0324:free' },
  { label: 'Qwen QwQ 32B (Gratis)', value: 'qwen/qwq-32b:free' },
  { label: 'Google Gemini 2.5 Flash Preview', value: 'google/gemini-2.5-flash-preview' },
  { label: 'Anthropic Claude 3.5 Haiku', value: 'anthropic/claude-3.5-haiku' },
  { label: 'OpenAI GPT-4o Mini', value: 'openai/gpt-4o-mini' },
];

export function AISection() {
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const saveStoreConfig = useDashboardStore((s) => s.saveStoreConfig);

  const [enabled, setEnabled] = useState(storeConfig.aiEnabled ?? false);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(storeConfig.aiModel || 'google/gemini-2.0-flash-001');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [modelPopoverActive, setModelPopoverActive] = useState(false);

  const toggleModelPopover = useCallback(() => setModelPopoverActive((v) => !v), []);

  useEffect(() => {
    setEnabled(storeConfig.aiEnabled ?? false);
    setModel(storeConfig.aiModel || 'google/gemini-2.0-flash-001');
  }, [storeConfig]);

  const hasExistingKey = !!storeConfig.aiApiKeyEnc;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    setTestResult(null);
    try {
      await saveAIConfigAction({
        aiEnabled: enabled,
        aiProvider: 'openrouter',
        aiApiKey: apiKey || undefined,
        aiModel: model,
      });

      // Update local Zustand state so the UI reflects the change
      await saveStoreConfig({
        aiEnabled: enabled,
        aiProvider: 'openrouter',
        aiModel: model,
      } as Partial<typeof storeConfig>);

      setApiKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      const { description } = parseError(err);
      setError(description);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testAIConnectionAction();
      setTestResult(result);
    } catch (err) {
      const { description } = parseError(err);
      setTestResult({ success: false, message: description });
    } finally {
      setTesting(false);
    }
  };

  return (
    <BlockStack gap="400">
      {/* Status banner */}
      {saved && <Banner tone="success" title="Configuración de IA guardada" />}
      {error && <Banner tone="critical" title="Error al guardar">{error}</Banner>}
      {testResult && (
        <Banner tone={testResult.success ? 'success' : 'critical'} title={testResult.success ? 'Prueba exitosa' : 'Prueba fallida'}>
          {testResult.message}
        </Banner>
      )}

      {/* Main config card */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">
                OpenRouter
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Proveedor de IA con modelos gratuitos y de pago
              </Text>
            </BlockStack>
            <Badge tone={enabled && hasExistingKey ? 'success' : 'new'}>
              {enabled && hasExistingKey ? 'Activo' : 'Inactivo'}
            </Badge>
          </InlineStack>

          <Divider />

          <Checkbox
            label="Habilitar Inteligencia Artificial"
            helpText="Activa funciones de IA: generación de descripciones, análisis de recibos y soporte inteligente"
            checked={enabled}
            onChange={setEnabled}
          />

          {enabled && (
            <FormLayout>
              <TextField
                label="API Key de OpenRouter"
                type="password"
                value={apiKey}
                onChange={setApiKey}
                placeholder={hasExistingKey ? '••••••••••••••••  (ya configurada)' : 'sk-or-v1-...'}
                helpText={
                  hasExistingKey
                    ? 'Tu API key está guardada de forma encriptada. Deja vacío para mantener la actual.'
                    : 'Obtén tu API key gratis en openrouter.ai/keys'
                }
                autoComplete="off"
              />

              <BlockStack gap="100">
                <Text as="span" variant="bodySm" fontWeight="medium">
                  Modelo de IA
                </Text>
                <Popover
                  active={modelPopoverActive}
                  activator={
                    <Button
                      onClick={toggleModelPopover}
                      disclosure
                      fullWidth
                      textAlign="start"
                    >
                      {MODEL_OPTIONS.find((o) => o.value === model)?.label || model}
                    </Button>
                  }
                  onClose={toggleModelPopover}
                  fullWidth
                >
                  <OptionList
                    onChange={(selected) => {
                      setModel(selected[0]);
                      setModelPopoverActive(false);
                    }}
                    options={MODEL_OPTIONS}
                    selected={[model]}
                  />
                </Popover>
                <Text as="p" variant="bodySm" tone="subdued">
                  Los modelos marcados como &apos;Gratis&apos; no tienen costo en OpenRouter
                </Text>
              </BlockStack>
            </FormLayout>
          )}

          <InlineStack gap="200">
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Guardar configuración
            </Button>
            {enabled && hasExistingKey && (
              <Button onClick={handleTest} loading={testing}>
                Probar conexión
              </Button>
            )}
          </InlineStack>
        </BlockStack>
      </Card>

      {/* Capabilities overview */}
      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingMd">
            Funciones con IA
          </Text>
          <Divider />
          <BlockStack gap="200">
            <InlineStack gap="200" blockAlign="center">
              <Badge tone={enabled ? 'success' : undefined}>
                {enabled ? 'Disponible' : 'Requiere IA'}
              </Badge>
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                Descripción de productos
              </Text>
            </InlineStack>
            <Box paddingInlineStart="800">
              <Text as="p" variant="bodySm" tone="subdued">
                Genera descripciones comerciales automáticas al registrar o editar un producto.
              </Text>
            </Box>
          </BlockStack>
          <BlockStack gap="200">
            <InlineStack gap="200" blockAlign="center">
              <Badge tone={enabled ? 'success' : undefined}>
                {enabled ? 'Disponible' : 'Requiere IA'}
              </Badge>
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                Escaneo inteligente de recibos
              </Text>
            </InlineStack>
            <Box paddingInlineStart="800">
              <Text as="p" variant="bodySm" tone="subdued">
                Sube un ticket o factura y la IA extrae concepto, monto, fecha, categoría y líneas individuales.
              </Text>
            </Box>
          </BlockStack>
          <BlockStack gap="200">
            <InlineStack gap="200" blockAlign="center">
              <Badge tone="info">Próximamente</Badge>
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                Asistente de soporte
              </Text>
            </InlineStack>
            <Box paddingInlineStart="800">
              <Text as="p" variant="bodySm" tone="subdued">
                Un chat integrado que responde preguntas sobre tu inventario, ventas y operaciones.
              </Text>
            </Box>
          </BlockStack>
        </BlockStack>
      </Card>

      {/* Info card */}
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            Acerca de OpenRouter
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            OpenRouter es un servicio que da acceso a múltiples modelos de IA (Google Gemini, Meta Llama, OpenAI, Anthropic)
            con una sola API key. Varios modelos son completamente gratuitos, ideales para empezar sin costo.
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Tu API key se almacena encriptada (AES-256-GCM) en la base de datos. Nunca se expone al navegador.
          </Text>
          <InlineStack>
            <Link url="https://openrouter.ai/keys" external>
              Obtener API Key gratuita
            </Link>
          </InlineStack>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
