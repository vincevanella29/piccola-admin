import React from 'react';
import Select from 'react-select';
import { useTheme } from '../../context/ThemeContext';

const CustomSelect = ({ styles, ...props }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const customStyles = {
        control: (provided, state) => ({
            ...provided,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(209, 213, 219, 1)',
            borderRadius: '0.75rem',
            padding: '2px 8px',
            color: isDark ? '#FFFFFF' : '#111827',
            boxShadow: state.isFocused ? (isDark ? '0 0 0 2px rgba(0, 146, 70, 0.6)' : '0 0 0 2px rgba(0, 146, 70, 0.4)') : 'none',
            '&:hover': {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(209, 213, 219, 0.8)',
            },
            backdropFilter: 'blur(8px)',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
        }),
        menu: (provided) => ({
            ...provided,
            backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
            backdropFilter: 'blur(12px)',
            borderRadius: '1rem',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
            overflow: 'hidden',
            zIndex: 9999,
            marginTop: '8px',
        }),
        menuList: (provided) => ({
            ...provided,
            padding: '8px',
            '&::-webkit-scrollbar': {
                width: '8px',
            },
            '&::-webkit-scrollbar-track': {
                background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                borderRadius: '4px',
            },
        }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isSelected
                ? '#009246'
                : state.isFocused
                    ? (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 146, 70, 0.05)')
                    : 'transparent',
            color: state.isSelected
                ? 'white'
                : (isDark ? '#FFFFFF' : '#111827'),
            cursor: 'pointer',
            padding: '10px 15px',
            borderRadius: '8px',
            margin: '2px 0',
            '&:active': {
                backgroundColor: '#007A3D',
            },
        }),
        singleValue: (provided) => ({
            ...provided,
            color: isDark ? '#FFFFFF' : '#111827',
        }),
        placeholder: (provided) => ({
            ...provided,
            color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(17, 24, 39, 0.4)',
        }),
        input: (provided) => ({
            ...provided,
            color: isDark ? '#FFFFFF' : '#111827',
        }),
        multiValue: (provided) => ({
            ...provided,
            backgroundColor: isDark ? 'rgba(0, 146, 70, 0.2)' : 'rgba(0, 146, 70, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(0, 146, 70, 0.3)',
            display: 'flex',
            alignItems: 'center',
        }),
        multiValueLabel: (provided) => ({
            ...provided,
            color: isDark ? '#FFFFFF' : '#111827',
            fontSize: '0.85rem',
            padding: '2px 6px',
        }),
        multiValueRemove: (provided) => ({
            ...provided,
            color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
            borderRadius: '0 4px 4px 0',
            '&:hover': {
                backgroundColor: 'rgba(206, 43, 55, 0.2)',
                color: '#CE2B37',
            },
        }),
        indicatorSeparator: () => ({
            display: 'none',
        }),
        dropdownIndicator: (provided) => ({
            ...provided,
            color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(17, 24, 39, 0.4)',
            '&:hover': {
                color: isDark ? '#FFFFFF' : '#111827',
            },
        }),
        clearIndicator: (provided) => ({
            ...provided,
            color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(17, 24, 39, 0.4)',
            '&:hover': {
                color: '#CE2B37',
            },
        }),
        ...styles,
    };

    return <Select styles={customStyles} {...props} />;
};

export default CustomSelect;
