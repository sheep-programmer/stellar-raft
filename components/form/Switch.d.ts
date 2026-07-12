import * as React from 'react';

export interface SwitchProps {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  /** Optional inline label; clicking it also toggles. */
  label?: React.ReactNode;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

/** On/off toggle — on = star-blue thumb with a faint glow. role="switch". */
export function Switch(props: SwitchProps): JSX.Element;
