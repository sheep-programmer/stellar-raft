import * as React from 'react';

export interface TabItem {
  id: string;
  label?: React.ReactNode;
  /** Leading Lucide icon name. */
  icon?: string;
  /** Small mono count after the label. */
  count?: number | string;
  /** id of the tabpanel this tab controls (wired to aria-controls). */
  panelId?: string;
  disabled?: boolean;
}

export interface TabsProps {
  tabs?: TabItem[];
  /** id of the selected tab. */
  value?: string;
  onChange?: (id: string, tab: TabItem) => void;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

/** Underline tabs — a glowing star-blue indicator glides along a hairline. role="tablist", ←→ keyboard. */
export function Tabs(props: TabsProps): JSX.Element;
