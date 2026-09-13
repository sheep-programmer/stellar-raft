import * as React from 'react';

export interface StarNodeProps {
  /** Memory strength 0..1 — brightness & color temperature. */
  strength?: number;
  /** Importance 0.6..1.6 — size multiplier. */
  importance?: number;
  /** Optional star name shown beneath. */
  label?: string;
  /** Selected ring. */
  selected?: boolean;
  /** Subtle scale breathing (alive). Default true. */
  breathe?: boolean;
  /** Touch hit-disc diameter in canvas-local px (pass 44 / k); 0 = core only. */
  hit?: number;
  onClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  /** Absolute position from the parent canvas (left/top). */
  style?: React.CSSProperties;
}

/** A single knowledge star: brightness=memory, size=importance, breathing=alive. */
export function StarNode(props: StarNodeProps): JSX.Element;
