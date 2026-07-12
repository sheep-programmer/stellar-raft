import * as React from 'react';

export interface SelectOption {
  value: string | number;
  label?: React.ReactNode;
  /** Leading Lucide icon name. */
  icon?: string;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string | number;
  onChange?: (value: string | number, option: SelectOption) => void;
  options?: SelectOption[];
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: React.CSSProperties;
}

/** Custom dropdown — glass list panel, ↑↓/Enter/Esc keyboard, combobox ARIA. */
export function Select(props: SelectProps): JSX.Element;
