import * as React from 'react';

export interface IconProps {
  /** Lucide icon name, kebab-case (e.g. "search", "satellite", "hourglass"). */
  name: string;
  /** Pixel box. 24 default canvas, 18 inline, 20 in capsules. */
  size?: number;
  /** Stroke width — keep ~1.6 for the brand line weight. */
  strokeWidth?: number;
  /** Override color; defaults to currentColor (inherits from wrapper). */
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Accessible label; omit for decorative icons (aria-hidden). */
  title?: string;
}

/** Themed Lucide linear icon — the brand's sole icon source. */
export function Icon(props: IconProps): JSX.Element;
