import React from 'react';
import Select from 'react-select';

const customStyles = {
  control: (provided, state) => ({
    ...provided,
    backgroundColor: 'var(--color-surface-secondary)',
    borderColor: state.isFocused ? 'var(--color-matrix-green)' : 'var(--color-border)',
    boxShadow: state.isFocused ? '0 0 0 1px var(--color-matrix-green)' : 'none',
    '&:hover': {
      borderColor: 'var(--color-matrix-green)',
    },
    borderRadius: '0.5rem',
    minHeight: '42px',
  }),
  menu: (provided) => ({
    ...provided,
    backgroundColor: 'var(--color-surface)',
    borderRadius: '0.5rem',
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isSelected ? 'var(--color-matrix-green)' : state.isFocused ? 'var(--color-surface-secondary)' : 'transparent',
    color: 'var(--color-text-primary)',
    '&:active': {
      backgroundColor: 'var(--color-surface-secondary)',
    },
  }),
  multiValue: (provided) => ({
    ...provided,
    backgroundColor: 'var(--color-surface-secondary)',
    borderRadius: '0.25rem',
  }),
  multiValueLabel: (provided) => ({
    ...provided,
    color: 'var(--color-text-primary)',
  }),
  multiValueRemove: (provided) => ({
    ...provided,
    color: 'var(--color-text-secondary)',
    '&:hover': {
      backgroundColor: 'var(--color-matrix-green)',
      color: 'white',
    },
  }),
  placeholder: (provided) => ({
    ...provided,
    color: 'var(--color-text-secondary)',
  }),
  input: (provided) => ({
    ...provided,
    color: 'var(--color-text-primary)',
  }),
};

const MultiSelect = ({ options, value, onChange, placeholder }) => {
  const selectOptions = options.map(opt => ({ value: opt, label: opt }));
  const selectValue = value.map(val => ({ value: val, label: val }));

  return (
    <Select
      isMulti
      options={selectOptions}
      value={selectValue}
      onChange={(selected) => onChange(selected.map(s => s.value))}
      styles={customStyles}
      placeholder={placeholder}
      noOptionsMessage={() => 'No options'}
    />
  );
};

export default MultiSelect;
