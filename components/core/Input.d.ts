import * as React from 'react';

export interface InputProps {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  /** Leading Lucide icon (e.g. "search"). */
  icon?: string;
  /** Trailing keyboard hint chip (e.g. "⌘K"). */
  kbd?: string;
  type?: string;
  size?: 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
}

/** Dark glass text/search field — faint cool glow on focus. */
export function Input(props: InputProps): JSX.Element;
