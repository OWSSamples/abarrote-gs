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
  ChoiceList,
  Collapsible,
} from '@shopify/polaris';
import { useDashboardStore } from '@/store/dashboardStore';
import {
  getAIProvidersAction,
  saveProviderConfigAction,
  testProviderAction,
  deleteProviderConfigAction,
} from '@/app/actions/ai-actions';
import { parseError } from '@/lib/errors';
import { useToast } from '@/components/notifications/ToastProvider';

// ── Provider catalogue ─────────────────────────────────────────────────────
const AI_PROVIDERS = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    tier: 'Gratis/Pago',
    description: 'Acceso a 100+ modelos (Google, OpenAI, Meta, Anthropic) con una sola API key. Varios modelos 100% gratuitos.',
    keyUrl: 'https://openrouter.ai/keys',
    keyPlaceholder: 'sk-or-v1-...',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    tier: 'De pago',
    description: 'GPT-4.1, GPT-4o y o4-mini. La IA más utilizada del mundo.',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-proj-...',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    tier: 'Gratis/Pago',
    description: 'Gemini 2.5 Pro y Flash. API gratuita con límites generosos en Google AI Studio.',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyPlaceholder: 'AIzaSy...',
  },
  {
    id: 'groq',
    name: 'Groq',
    tier: 'Gratis/Pago',
    description: 'La inferencia más rápida disponible. Plan gratuito con rate limits. Ideal para tiempo real.',
    keyUrl: 'https://console.groq.com/keys',
    keyPlaceholder: 'gsk_...',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    tier: 'Muy económico',
    description: 'DeepSeek V3 y R1 (razonamiento). Excelente calidad a precio muy bajo.',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'qwen',
    name: 'Qwen (Alibaba)',
    tier: 'Económico',
    description: 'Qwen3, QwQ y modelos especializados en código y e-commerce.',
    keyUrl: 'https://dashscope.aliyuncs.com/',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    tier: 'Económico',
    description: 'Mistral Large, Small y Codestral. Modelos europeos eficientes en múltiples idiomas.',
    keyUrl: 'https://console.mistral.ai/api-keys',
    keyPlaceholder: 'xxxxxxxx...',
  },
] as const;

// ── Model lists per provider ────────────────────────────────────────────────
const PROVIDER_MODELS: Record<string, { label: string; value: string }[]> = {
  openrouter: [
    { label: 'NVIDIA: Nemotron 3 Super — Gratis', value: 'nvidia/nemotron-3-super:free' },
    { label: 'OpenAI: GPT-OSS 120B — Gratis', value: 'openai/gpt-oss-120b:free' },
    { label: 'Google: Gemma 4 31B — Gratis', value: 'google/gemma-4-31b-it:free' },
    { label: 'Google: Gemma 4 26B A4B — Gratis', value: 'google/gemma-4-26b-it:free' },
    { label: 'Meta: Llama 3.3 70B — Gratis', value: 'meta-llama/llama-3.3-70b-instruct:free' },
    { label: 'MiniMax: M2.5 — Gratis (196k ctx)', value: 'minimax/minimax-m2.5:free' },
    { label: 'DeepSeek V3 — Gratis', value: 'deepseek/deepseek-chat-v3-0324:free' },
    { label: 'Qwen3 Coder 480B A35B — Gratis', value: 'qwen/qwen3-coder-480b-a35b-instruct:free' },
    { label: 'Z.ai: GLM 4.5 Air — Gratis', value: 'z-ai/glm-4.5-air:free' },
    { label: 'Arcee AI: Trinity Large — Gratis', value: 'arceeai/arcee-trinity-large:free' },
    { label: 'Google: Gemini 2.5 Flash Preview', value: 'google/gemini-2.5-flash-preview' },
    { label: 'Anthropic: Claude 3.5 Haiku', value: 'anthropic/claude-3.5-haiku' },
    { label: 'OpenAI: GPT-4o Mini', value: 'openai/gpt-4o-mini' },
  ],
  openai: [
    { label: 'GPT-4.1', value: 'gpt-4.1' },
    { label: 'GPT-4.1 Mini', value: 'gpt-4.1-mini' },
    { label: 'GPT-4.1 Nano', value: 'gpt-4.1-nano' },
    { label: 'GPT-4o', value: 'gpt-4o' },
    { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
    { label: 'o4-mini', value: 'o4-mini' },
  ],
  google: [
    { label: 'Gemini 2.5 Pro Preview', value: 'gemini-2.5-pro-preview-05-06' },
    { label: 'Gemini 2.5 Flash Preview', value: 'gemini-2.5-flash-preview-04-17' },
    { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
    { label: 'Gemini 2.0 Flash Lite', value: 'gemini-2.0-flash-lite' },
    { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
    { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
  ],
  groq: [
    { label: 'Llama 4 Scout 17B', value: 'meta-llama/llama-4-scout-17b-16e-instruct' },
    { label: 'Llama 3.3 70B Versatile', value: 'llama-3.3-70b-versatile' },
    { label: 'Llama 3.1 8B Instant', value: 'llama-3.1-8b-instant' },
    { label: 'DeepSeek R1 Distill Llama 70B', value: 'deepseek-r1-distill-llama-70b' },
    { label: 'Mixtral 8x7B', value: 'mixtral-8x7b-32768' },
    { label: 'Gemma 2 9B', value: 'gemma2-9b-it' },
  ],
  deepseek: [
    { label: 'DeepSeek V3 (Chat)', value: 'deepseek-chat' },
    { label: 'DeepSeek R1 (Razonamiento)', value: 'deepseek-reasoner' },
  ],
  qwen: [
    { label: 'Qwen Turbo', value: 'qwen-turbo' },
    { label: 'Qwen Plus', value: 'qwen-plus' },
    { label: 'Qwen Max', value: 'qwen-max' },
    { label: 'QwQ Plus (Razonamiento)', value: 'qwq-plus' },
    { label: 'Qwen3 235B A22B', value: 'qwen3-235b-a22b' },
  ],
  mistral: [
    { label: 'Mistral Large', value: 'mistral-large-latest' },
    { label: 'Mistral Small', value: 'mistral-small-latest' },
    { label: 'Codestral', value: 'codestral-latest' },
    { label: 'Mistral NeMo (Gratis)', value: 'open-mistral-nemo' },
  ],
};

const TIER_TONE: Record<string, 'success' | 'info' | 'attention' | 'new'> = {
  'Gratis/Pago': 'success',
  'De pago': 'attention',
  'Muy económico': 'info',
  'Económico': 'info',
};

// ── Types ──────────────────────────────────────────────────────────────────
interface ProviderState {
  hasKey: boolean;
  enabled: boolean;
  selectedModel: string;
}
type FeedbackMap = Record<string, { success: boolean; message: string } | undefined>;

// ── Component ──────────────────────────────────────────────────────────────
export function AISection() {
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const saveStoreConfig = useDashboardStore((s) => s.saveStoreConfig);
  const { showSuccess, showError } = useToast();

  // Global state
  const [globalEnabled, setGlobalEnabled] = useState(storeConfig.aiEnabled ?? false);
  const [activeProvider, setActiveProvider] = useState(storeConfig.aiProvider || 'openrouter');
  const [globalSaving, setGlobalSaving] = useState(false);

  // Provider configs loaded from DB
  const [providerStates, setProviderStates] = useState<Record<string, ProviderState>>({});
  const [loadingProviders, setLoadingProviders] = useState(true);

  // Per-provider form state
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [modelSelections, setModelSelections] = useState<Record<string, string>>({});
  const [modelPopoverOpen, setModelPopoverOpen] = useState<Record<string, boolean>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [removingProvider, setRemovingProvider] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackMap>({});

  // Sync global state from store when it changes externally
  useEffect(() => {
    setGlobalEnabled(storeConfig.aiEnabled ?? false);
    setActiveProvider(storeConfig.aiProvider || 'openrouter');
  }, [storeConfig.aiEnabled, storeConfig.aiProvider]);

  // Load per-provider configs from DB
  const refreshProviderStates = useCallback(async () => {
    try {
      const configs = await getAIProvidersAction();
      const states: Record<string, ProviderState> = {};
      const models: Record<string, string> = {};
      for (const c of configs) {
        states[c.id] = { hasKey: c.hasKey, enabled: c.enabled, selectedModel: c.selectedModel };
        if (c.selectedModel) models[c.id] = c.selectedModel;
      }
      setProviderStates(states);
      // Only set defaults for providers not yet touched by the user
      setModelSelections((prev) => {
        const merged: Record<string, string> = { ...models };
        for (const [k, v] of Object.entries(prev)) {
          if (v) merged[k] = v;
        }
        return merged;
      });
    } catch {
      // non-critical; UI degrades gracefully
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  useEffect(() => {
    void refreshProviderStates();
  }, [refreshProviderStates]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleToggleProvider = useCallback((id: string) => {
    setExpandedProvider((prev) => (prev === id ? null : id));
    setFeedbacks((prev) => ({ ...prev, [id]: undefined }));
  }, []);

  const handleSaveGlobal = async () => {
    setGlobalSaving(true);
    try {
      await saveStoreConfig({ aiEnabled: globalEnabled, aiProvider: activeProvider } as Parameters<typeof saveStoreConfig>[0]);
      showSuccess('Configuración global guardada');
    } catch (err) {
      showError(parseError(err).description);
    } finally {
      setGlobalSaving(false);
    }
  };

  const handleSaveProvider = async (providerId: string) => {
    const selectedModel =
      modelSelections[providerId] || (PROVIDER_MODELS[providerId]?.[0]?.value ?? '');
    if (!selectedModel) {
      showError('Selecciona un modelo antes de guardar');
      return;
    }

    setSavingProvider(providerId);
    setFeedbacks((prev) => ({ ...prev, [providerId]: undefined }));
    try {
      const result = await saveProviderConfigAction({
        providerId,
        apiKey: apiKeyInputs[providerId] || undefined,
        selectedModel,
      });

      if (result.success) {
        await refreshProviderStates();
        setApiKeyInputs((prev) => ({ ...prev, [providerId]: '' }));
        setFeedbacks((prev) => ({
          ...prev,
          [providerId]: { success: true, message: 'Configuración guardada correctamente.' },
        }));

        // Auto-set as active if no provider is configured yet
        const anyConfigured = Object.values(providerStates).some((s) => s.hasKey);
        if (!anyConfigured) {
          setActiveProvider(providerId);
          await saveStoreConfig({ aiProvider: providerId } as Parameters<typeof saveStoreConfig>[0]);
        }
      } else {
        setFeedbacks((prev) => ({
          ...prev,
          [providerId]: { success: false, message: result.error ?? 'Error al guardar.' },
        }));
      }
    } catch (err) {
      setFeedbacks((prev) => ({
        ...prev,
        [providerId]: { success: false, message: parseError(err).description },
      }));
    } finally {
      setSavingProvider(null);
    }
  };

  const handleTestProvider = async (providerId: string) => {
    setTestingProvider(providerId);
    setFeedbacks((prev) => ({ ...prev, [providerId]: undefined }));
    try {
      const result = await testProviderAction(providerId);
      setFeedbacks((prev) => ({ ...prev, [providerId]: result }));
    } catch (err) {
      setFeedbacks((prev) => ({
        ...prev,
        [providerId]: { success: false, message: parseError(err).description },
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSetActive = useCallback(
    async (providerId: string) => {
      setActiveProvider(providerId);
      try {
        await saveStoreConfig({ aiProvider: providerId } as Parameters<typeof saveStoreConfig>[0]);
        const name = AI_PROVIDERS.find((p) => p.id === providerId)?.name ?? providerId;
        showSuccess(`Proveedor activo: ${name}`);
      } catch (err) {
        showError(parseError(err).description);
      }
    },
    [saveStoreConfig, showSuccess, showError]
  );

  const handleRemoveProvider = async (providerId: string) => {
    setRemovingProvider(providerId);
    try {
      await deleteProviderConfigAction(providerId);
      await refreshProviderStates();
      setFeedbacks((prev) => ({ ...prev, [providerId]: undefined }));
      showSuccess('API key eliminada');
    } catch (err) {
      showError(parseError(err).description);
    } finally {
      setRemovingProvider(null);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────

  const configuredProviders = AI_PROVIDERS.filter((p) => providerStates[p.id]?.hasKey);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <BlockStack gap="400">
      {/* ── Global toggle ── */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="050">
              <Text as="h2" variant="headingMd">
                Inteligencia Artificial
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Activa o desactiva todas las funciones de IA en la plataforma
              </Text>
            </BlockStack>
            <Badge
              tone={globalEnabled && configuredProviders.length > 0 ? 'success' : 'new'}
            >
              {globalEnabled && configuredProviders.length > 0 ? 'Activo' : 'Inactivo'}
            </Badge>
          </InlineStack>

          <Divider />

          <Checkbox
            label="Habilitar IA en la plataforma"
            helpText="Descrpciones de productos automáticas, análisis de recibos y más"
            checked={globalEnabled}
            onChange={setGlobalEnabled}
          />

          {globalEnabled && configuredProviders.length > 0 && (
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" fontWeight="medium">
                Proveedor activo
              </Text>
              <ChoiceList
                title=""
                titleHidden
                choices={configuredProviders.map((p) => ({
                  label: `${p.name} — ${providerStates[p.id]?.selectedModel || ''}`,
                  value: p.id,
                }))}
                selected={[activeProvider]}
                onChange={([val]) => void handleSetActive(val)}
              />
            </BlockStack>
          )}

          <InlineStack>
            <Button variant="primary" onClick={handleSaveGlobal} loading={globalSaving}>
              Guardar
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>

      {/* ── Provider cards ── */}
      <Card padding="0">
        {loadingProviders ? (
          <Box padding="400">
            <Text as="p" variant="bodySm" tone="subdued">
              Cargando proveedores...
            </Text>
          </Box>
        ) : (
          AI_PROVIDERS.map((provider, index) => {
            const state = providerStates[provider.id];
            const isExpanded = expandedProvider === provider.id;
            const isActive = activeProvider === provider.id && state?.hasKey;
            const feedback = feedbacks[provider.id];
            const models = PROVIDER_MODELS[provider.id] ?? [];
            const selectedModel =
              modelSelections[provider.id] || state?.selectedModel || models[0]?.value || '';
            const selectedModelLabel =
              models.find((m) => m.value === selectedModel)?.label || selectedModel;

            return (
              <Box
                key={provider.id}
                padding="400"
                borderBlockStartWidth={index > 0 ? '025' : '0'}
                borderColor="border"
              >
                <BlockStack gap="300">
                  {/* Summary row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <BlockStack gap="050">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                        <Text as="span" variant="bodyMd" fontWeight="semibold">
                          {provider.name}
                        </Text>
                        <Badge tone={TIER_TONE[provider.tier] ?? 'new'}>{provider.tier}</Badge>
                        {isActive && <Badge tone="success">Activo</Badge>}
                      </div>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {provider.description}
                      </Text>
                    </BlockStack>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {state?.hasKey && <Badge tone="success">Conectado</Badge>}
                      <Button size="slim" onClick={() => handleToggleProvider(provider.id)}>
                        {isExpanded ? 'Cerrar' : state?.hasKey ? 'Editar' : 'Configurar'}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded form */}
                  <Collapsible
                    id={`provider-form-${provider.id}`}
                    open={isExpanded}
                    transition={{ duration: '200ms', timingFunction: 'ease-in-out' }}
                  >
                    <Box paddingBlockStart="200">
                      <BlockStack gap="300">
                        {feedback && (
                          <Banner tone={feedback.success ? 'success' : 'critical'}>
                            {feedback.message}
                          </Banner>
                        )}

                        <FormLayout>
                          <TextField
                            label="API Key"
                            type="password"
                            value={apiKeyInputs[provider.id] || ''}
                            onChange={(val) =>
                              setApiKeyInputs((prev) => ({ ...prev, [provider.id]: val }))
                            }
                            placeholder={
                              state?.hasKey
                                ? '••••••••  (ya configurada — vacío para conservar)'
                                : provider.keyPlaceholder
                            }
                            helpText={
                              <span>
                                {'Obtén tu API key en '}
                                <Link url={provider.keyUrl} external>
                                  {provider.keyUrl.replace('https://', '')}
                                </Link>
                              </span>
                            }
                            autoComplete="off"
                          />

                          <BlockStack gap="100">
                            <Text as="span" variant="bodySm" fontWeight="medium">
                              Modelo
                            </Text>
                            <Popover
                              active={modelPopoverOpen[provider.id] ?? false}
                              activator={
                                <Button
                                  onClick={() =>
                                    setModelPopoverOpen((prev) => ({
                                      ...prev,
                                      [provider.id]: !(prev[provider.id] ?? false),
                                    }))
                                  }
                                  disclosure
                                  fullWidth
                                  textAlign="start"
                                >
                                  {selectedModelLabel || 'Seleccionar modelo'}
                                </Button>
                              }
                              onClose={() =>
                                setModelPopoverOpen((prev) => ({
                                  ...prev,
                                  [provider.id]: false,
                                }))
                              }
                              fullWidth
                            >
                              <OptionList
                                onChange={([val]) => {
                                  setModelSelections((prev) => ({
                                    ...prev,
                                    [provider.id]: val,
                                  }));
                                  setModelPopoverOpen((prev) => ({
                                    ...prev,
                                    [provider.id]: false,
                                  }));
                                }}
                                options={models}
                                selected={[selectedModel]}
                              />
                            </Popover>
                          </BlockStack>
                        </FormLayout>

                        <InlineStack gap="200" blockAlign="center">
                          <Button
                            variant="primary"
                            onClick={() => void handleSaveProvider(provider.id)}
                            loading={savingProvider === provider.id}
                            disabled={!apiKeyInputs[provider.id] && !state?.hasKey}
                          >
                            Guardar
                          </Button>
                          {state?.hasKey && (
                            <Button
                              onClick={() => void handleTestProvider(provider.id)}
                              loading={testingProvider === provider.id}
                            >
                              Probar conexión
                            </Button>
                          )}
                          {state?.hasKey && !isActive && (
                            <Button
                              variant="plain"
                              onClick={() => void handleSetActive(provider.id)}
                            >
                              Usar como activo
                            </Button>
                          )}
                          {state?.hasKey && (
                            <Button
                              variant="plain"
                              tone="critical"
                              onClick={() => void handleRemoveProvider(provider.id)}
                              loading={removingProvider === provider.id}
                            >
                              Eliminar key
                            </Button>
                          )}
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  </Collapsible>
                </BlockStack>
              </Box>
            );
          })
        )}
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
              <Badge tone={globalEnabled ? 'success' : undefined}>
                {globalEnabled ? 'Disponible' : 'Requiere IA'}
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
              <Badge tone={globalEnabled ? 'success' : undefined}>
                {globalEnabled ? 'Disponible' : 'Requiere IA'}
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

      {/* Security note */}
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            Seguridad
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Todas las API keys se almacenan encriptadas con AES-256-GCM en la base de datos. Nunca se exponen al
            navegador ni aparecen en los logs. Puedes eliminar una key en cualquier momento.
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            <strong>¿Cuál elegir?</strong> OpenRouter (recomendado para empezar — modelos gratuitos), Google Gemini
            (excelente para análisis de imágenes y recibos), Groq (respuestas ultrarrápidas).
          </Text>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
