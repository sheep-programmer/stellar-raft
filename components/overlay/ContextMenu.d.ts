import * as React from 'react';

export interface ContextMenuItem {
  id?: string;
  label?: React.ReactNode;
  /** Leading Lucide icon name. */
  icon?: string;
  /** Right-aligned shortcut hint (mono, decorative). */
  kbd?: string;
  /** Warm low-sat destructive tint — use sparingly. */
  danger?: boolean;
  disabled?: boolean;
  onSelect?: (item: ContextMenuItem) => void;
  /** { type: 'separator' } renders a hairline divider. */
  type?: 'separator';
}

export interface ContextMenuProps {
  items?: ContextMenuItem[];
  /** Fires for any picked item, after its own onSelect. */
  onSelect?: (item: ContextMenuItem) => void;
  /** Disables the right-click interception entirely. */
  disabled?: boolean;
  menuWidth?: number;
  /** The right-click target area. */
  children?: React.ReactNode;
  /** Extra styles for the menu panel. */
  style?: React.CSSProperties;
}

/** Right-click menu primitive — glass panel at the cursor, hairline separators, ↑↓/Enter/Esc. */
export function ContextMenu(props: ContextMenuProps): JSX.Element;
