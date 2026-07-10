import * as React from 'react';

export interface IconButtonProps {
  /** Lucide icon name (kebab-case). */
  name: string;
  /** sm 30 · md 36 · lg 44 px box. */
  size?: 'sm' | 'md' | 'lg';
  /** Active/selected — stays gold with a faint glow. */
  active?: boolean;
  disabled?: boolean;
  /** Accessible label (also the tooltip text). */
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

/**
 * Ghost icon control: star-blue idle → gold + glow on hover/active, shrink on press.
 */
export function IconButton(props: IconButtonProps): JSX.Element;
