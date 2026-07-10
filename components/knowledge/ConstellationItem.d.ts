import * as React from 'react';

export interface ConstellationItemProps {
  name: string;
  /** Representative memory color (warm = solid, cold = dimming). */
  color?: string;
  /** Star count on the right. */
  count?: number;
  active?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

/** Sidebar row for one constellation (note group) — colored memory dot + count. */
export function ConstellationItem(props: ConstellationItemProps): JSX.Element;
