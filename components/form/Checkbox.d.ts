import * as React from 'react';

export interface CheckboxProps {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  /** Inline label; clicking it also toggles. `children` works too. */
  label?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Soft-cornered checkbox with a self-drawn star-blue SVG check. role="checkbox". */
export function Checkbox(props: CheckboxProps): JSX.Element;
