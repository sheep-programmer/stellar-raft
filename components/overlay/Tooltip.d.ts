import * as React from 'react';

export interface TooltipProps {
  /** One short line — a whisper, not a panel. */
  content?: React.ReactNode;
  /** The trigger; a single element also receives aria-describedby. */
  children?: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay in ms before the tooltip appears. Default 450. */
  delay?: number;
  style?: React.CSSProperties;
}

/** Delayed glass mini-card on hover/focus. Esc hides; reduced-motion aware. */
export function Tooltip(props: TooltipProps): JSX.Element;
