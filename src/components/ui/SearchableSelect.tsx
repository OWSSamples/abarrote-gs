'use client';

import { useState, useCallback, useMemo } from 'react';
import { Autocomplete, Icon, Listbox, EmptySearchResult } from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';

interface Option {
  label: string;
  value: string;
}

interface SearchableSelectProps {
  label: string;
  options: Option[];
  selected?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  helpText?: string;
  labelHidden?: boolean;
  /** Max visible options in the dropdown (default: unlimited — shows all) */
  maxVisible?: number;
}

/** Default batch size when no text is entered: show first N, then all on search */
const DEFAULT_IDLE_LIMIT = 50;

export function SearchableSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Buscar...',
  error,
  helpText,
  labelHidden,
  maxVisible,
}: SearchableSelectProps) {
  const [inputValue, setInputValue] = useState('');

  // Sync input value with selection changes from parent (e.g. clearing after add)
  const [lastSelected, setLastSelected] = useState(selected);
  if (selected !== lastSelected) {
    setLastSelected(selected);
    if (!selected) {
      setInputValue('');
    } else {
      const selectedOption = options.find((opt) => opt.value === selected);
      if (selectedOption) {
        setInputValue(selectedOption.label);
      }
    }
  }

  // Derive filtered options from props + input — always up to date
  const filteredOptions = useMemo(() => {
    const limit = maxVisible;

    if (inputValue === '') {
      // When idle, show up to DEFAULT_IDLE_LIMIT unless overridden
      const cap = limit ?? DEFAULT_IDLE_LIMIT;
      return options.slice(0, cap);
    }

    const filterRegex = new RegExp(inputValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const matches = options.filter((option) => option.label.match(filterRegex));
    // When searching, show ALL matches (or capped if maxVisible set)
    return limit ? matches.slice(0, limit) : matches;
  }, [options, inputValue, maxVisible]);

  // Count how many were hidden
  const totalMatches = useMemo(() => {
    if (inputValue === '') return options.length;
    const filterRegex = new RegExp(inputValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return options.filter((option) => option.label.match(filterRegex)).length;
  }, [options, inputValue]);

  const hiddenCount = totalMatches - filteredOptions.length;

  const updateText = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const updateSelection = useCallback(
    (selection: string[]) => {
      const nextSelected = selection[0];
      onChange(nextSelected);

      const selectedOption = options.find((opt) => opt.value === nextSelected);
      if (selectedOption) {
        setInputValue(selectedOption.label);
      }
    },
    [options, onChange],
  );

  const displayValue = inputValue;

  const textField = (
    <Autocomplete.TextField
      onChange={updateText}
      label={label}
      labelHidden={labelHidden}
      value={displayValue}
      placeholder={placeholder}
      prefix={<Icon source={SearchIcon} tone="subdued" />}
      autoComplete="off"
      error={error}
      helpText={
        helpText || (hiddenCount > 0 ? `Escribe para buscar entre ${totalMatches} opciones` : undefined)
      }
    />
  );

  const emptyState = (
    <EmptySearchResult
      title="No se encontraron resultados"
      description={`No hay coincidencias para "${inputValue}"`}
    />
  );

  return (
    <Autocomplete
      options={filteredOptions}
      selected={selected ? [selected] : []}
      onSelect={updateSelection}
      textField={textField}
      emptyState={emptyState}
      willLoadMoreResults={hiddenCount > 0}
      listTitle={
        hiddenCount > 0
          ? `Mostrando ${filteredOptions.length} de ${totalMatches} — escribe para filtrar`
          : undefined
      }
    />
  );
}
