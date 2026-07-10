import * as React from 'react';

export interface ButtonProps {
  children?: React.ReactNode;
  /** primary = gold reward · secondary = glass · ghost = transparent. */
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  /** Leading Lucide icon name. */
  icon?: string;
  /** Trailing Lucide icon name. */
  iconRight?: string;
  /** Force the gold glow (e.g. the hero "点亮这颗星"). */
  glow?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

/** Pill text button — gold primary reserved for ignition / reward / confirm. */
export function Button(props: ButtonProps): JSX.Element;
