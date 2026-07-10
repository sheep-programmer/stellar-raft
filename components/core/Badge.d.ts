import * as React from 'react';

export interface BadgeProps {
  children?: React.ReactNode;
  /** blue default · gold reward/active · fading needs-review · neutral. */
  tone?: 'blue' | 'gold' | 'fading' | 'neutral';
  /** Render as a tiny notification dot instead of a pill. */
  dot?: boolean;
  /** Soft filled background (default) vs. bare text. */
  soft?: boolean;
  style?: React.CSSProperties;
}

/** Small count / status marker — mono, capsule, within the hue budget. */
export function Badge(props: BadgeProps): JSX.Element;
