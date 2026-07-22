'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'kiosko-cookie-consent';
const STORAGE_VERSION = 1;

export interface CookiePreferences {
  necessary: true; // siempre true, no se puede desactivar
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

interface StoredConsent {
  v: number;
  decidedAt: string;
  preferences: CookiePreferences;
}

const DEFAULT_PREFS: CookiePreferences = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
};

const ALL_ACCEPTED: CookiePreferences = {
  necessary: true,
  functional: true,
  analytics: true,
  marketing: true,
};

interface CookieConsentContextValue {
  isReady: boolean;
  hasDecided: boolean;
  preferences: CookiePreferences;
  showBanner: boolean;
  showPreferences: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (prefs: Partial<CookiePreferences>) => void;
  openPreferences: () => void;
  closePreferences: () => void;
  reset: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error('useCookieConsent must be used inside CookieConsentProvider');
  return ctx;
}

function readStored(): StoredConsent | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed.v !== STORAGE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(prefs: CookiePreferences) {
  const data: StoredConsent = {
    v: STORAGE_VERSION,
    decidedAt: new Date().toISOString(),
    preferences: prefs,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignorar */
  }
}

function clearStored() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignorar */
  }
}

function emit(prefs: CookiePreferences) {
  window.dispatchEvent(new CustomEvent('kiosko:cookie-consent', { detail: prefs }));
}

interface ProviderProps {
  children: ReactNode;
}

export function CookieConsentProvider({ children }: ProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [hasDecided, setHasDecided] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_PREFS);
  const [showPreferences, setShowPreferences] = useState(false);

  // Cargar estado desde localStorage al montar
  useEffect(() => {
    const stored = readStored();
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate consent state from browser storage on mount.
      setPreferences(stored.preferences);
      setHasDecided(true);
    }
    setIsReady(true);
  }, []);

  // Escuchar evento global para abrir preferencias (desde el footer)
  useEffect(() => {
    function onOpen() {
      setShowPreferences(true);
    }
    window.addEventListener('kiosko:open-cookie-preferences', onOpen);
    return () => window.removeEventListener('kiosko:open-cookie-preferences', onOpen);
  }, []);

  const acceptAll = useCallback(() => {
    setPreferences(ALL_ACCEPTED);
    setHasDecided(true);
    setShowPreferences(false);
    writeStored(ALL_ACCEPTED);
    emit(ALL_ACCEPTED);
  }, []);

  const rejectAll = useCallback(() => {
    setPreferences(DEFAULT_PREFS);
    setHasDecided(true);
    setShowPreferences(false);
    writeStored(DEFAULT_PREFS);
    emit(DEFAULT_PREFS);
  }, []);

  const savePreferences = useCallback((partial: Partial<CookiePreferences>) => {
    setPreferences((prev) => {
      const next: CookiePreferences = {
        ...prev,
        ...partial,
        necessary: true,
      };
      writeStored(next);
      emit(next);
      setHasDecided(true);
      setShowPreferences(false);
      return next;
    });
  }, []);

  const openPreferences = useCallback(() => setShowPreferences(true), []);
  const closePreferences = useCallback(() => setShowPreferences(false), []);

  const reset = useCallback(() => {
    clearStored();
    setPreferences(DEFAULT_PREFS);
    setHasDecided(false);
  }, []);

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      isReady,
      hasDecided,
      preferences,
      showBanner: isReady && !hasDecided,
      showPreferences,
      acceptAll,
      rejectAll,
      savePreferences,
      openPreferences,
      closePreferences,
      reset,
    }),
    [
      isReady,
      hasDecided,
      preferences,
      showPreferences,
      acceptAll,
      rejectAll,
      savePreferences,
      openPreferences,
      closePreferences,
      reset,
    ],
  );

  return (
    <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>
  );
}
