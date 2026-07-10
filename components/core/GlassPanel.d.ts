import * as React from 'react';

export interface GlassPanelProps {
  children?: React.ReactNode;
  /** Stronger opacity + border — for drawers, overlays, modals. */
  strong?: boolean;
  radius?: 'sm' | 'md' | 'lg' | 'xl' | 'pill';
  pad?: 'none' | 'sm' | 'md' | 'lg';
  /** Add a faint outer glow halo. */
  glow?: boolean;
  style?: React.CSSProperties;
}

/** Floating glassmorphism surface — blur, cool 1px edge, deep soft shadow. */
export function GlassPanel(props: GlassPanelProps): JSX.Element;
