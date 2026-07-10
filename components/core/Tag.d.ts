import * as React from 'react';

export interface TagProps {
  children?: React.ReactNode;
  /** Leading Lucide icon name. */
  icon?: string;
  /** Leading dot — true for star-blue, or a CSS color string (e.g. a constellation color). */
  dot?: boolean | string;
  /** Lit gold (selected filter). */
  active?: boolean;
  /** Show a remove (x) affordance. */
  removable?: boolean;
  onRemove?: () => void;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

/** Quiet glass metadata chip — note tags, filter chips, constellation labels. */
export function Tag(props: TagProps): JSX.Element;
