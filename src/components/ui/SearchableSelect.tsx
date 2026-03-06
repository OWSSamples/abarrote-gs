'use client';

import { useState, useCallback, useMemo } from 'react';
import { Autocomplete, Icon, TextField } from '@shopify/polaris';
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
}

export function SearchableSelect({
    label,
    options,
    selected,
    onChange,
    placeholder = 'Buscar...',
    error,
    helpText,
}: SearchableSelectProps) {
    const [inputValue, setInputValue] = useState('');
    const [optionsState, setOptionsState] = useState(options);

    const updateText = useCallback(
        (value: string) => {
            setInputValue(value);

            if (value === '') {
                setOptionsState(options);
                return;
            }

            const filterRegex = new RegExp(value, 'i');
            const resultOptions = options.filter((option) =>
                option.label.match(filterRegex)
            );
            setOptionsState(resultOptions);
        },
        [options]
    );

    const updateSelection = useCallback(
        (selection: string[]) => {
            const nextSelected = selection[0];
            onChange(nextSelected);

            const selectedOption = options.find((opt) => opt.value === nextSelected);
            if (selectedOption) {
                setInputValue(selectedOption.label);
            }
        },
        [options, onChange]
    );

    const textField = (
        <Autocomplete.TextField
            onChange={updateText}
            label={label}
            value={inputValue || (selected ? options.find(o => o.value === selected)?.label || '' : '')}
            placeholder={placeholder}
            prefix={<Icon source={SearchIcon} tone="subdued" />}
            autoComplete="off"
            error={error}
            helpText={helpText}
        />
    );

    return (
        <Autocomplete
            options={optionsState}
            selected={selected ? [selected] : []}
            onSelect={updateSelection}
            textField={textField}
        />
    );
}
