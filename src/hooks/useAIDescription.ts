import { useState, useCallback } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';

interface GenerateDescriptionParams {
  name: string;
  category: string;
  unitPrice?: number;
  unit?: string;
}

export function useAIDescription() {
  const aiEnabled = useDashboardStore((s) => s.storeConfig.aiEnabled);
  const categories = useDashboardStore((s) => s.categories);
  const [generating, setGenerating] = useState(false);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const generateDescription = useCallback(
    async (params: GenerateDescriptionParams) => {
      if (!aiEnabled) {
        setError('IA no habilitada. Actívala en Configuración → Inteligencia Artificial.');
        return;
      }

      if (!params.name.trim()) {
        setError('Ingresa el nombre del producto primero');
        return;
      }

      setGenerating(true);
      setError(null);

      try {
        const categoryName = categories.find((c) => c.id === params.category)?.name || params.category;

        const res = await fetch('/api/generate-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: params.name,
            category: categoryName,
            unitPrice: params.unitPrice,
            unit: params.unit,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Error al generar descripción');
        }

        const { description: desc } = await res.json();
        setDescription(desc);
        return desc;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        setError(message);
        return undefined;
      } finally {
        setGenerating(false);
      }
    },
    [aiEnabled, categories],
  );

  const clearDescription = useCallback(() => {
    setDescription('');
    setError(null);
  }, []);

  return {
    aiEnabled,
    generating,
    description,
    error,
    generateDescription,
    clearDescription,
  };
}
