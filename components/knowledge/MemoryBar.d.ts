import * as React from 'react';

export interface MemoryBarProps {
  /** Memory strength 0..1 — drives fill width and ramp color. */
  value?: number;
  /** Optional caption above the track. */
  label?: string;
  /** Show the percentage on the right. */
  showPct?: boolean;
  /** Track thickness in px (default 6). */
  height?: number;
  /** Pulse to flag "正变暗 / needs review". */
  fading?: boolean;
  style?: React.CSSProperties;
}

/** Memory strength as a cold→warm temperature track. */
export function MemoryBar(props: MemoryBarProps): JSX.Element;

/** Map a 0..1 strength to its ramp color (shared with StarNode). */
export function memoryColor(strength: number): string;
