import * as React from 'react';

export interface ToastProps {
  /** The one quiet line of feedback ("点亮 +1 · 融会贯通"). */
  message?: React.ReactNode;
  children?: React.ReactNode;
  /** blue = everyday · gold = ignite/reward only · danger = rare destructive. */
  tone?: 'blue' | 'gold' | 'danger';
  /** Leading Lucide icon name; pass '' to omit. */
  icon?: string;
  style?: React.CSSProperties;
}

/** Glass feedback pill (role="status"). Position it yourself when declarative. */
export function Toast(props: ToastProps): JSX.Element;

export interface ToastOptions {
  tone?: 'blue' | 'gold' | 'danger';
  icon?: string;
  /** Auto-dismiss after this many ms. Default 2400. */
  duration?: number;
}

/**
 * Imperative command: shows a self-dismissing glass pill in a shared
 * bottom-center aria-live stack. Returns a function that dismisses it early.
 */
export function toast(message: React.ReactNode, opts?: ToastOptions): () => void;
