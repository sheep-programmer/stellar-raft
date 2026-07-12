import * as React from 'react';

export interface ModalProps {
  /** Controls visibility. Nothing renders while false. */
  open?: boolean;
  /** Called on Esc, mask click, or the close button. Also restores focus. */
  onClose?: () => void;
  /** Header title (labels the dialog via aria-labelledby). */
  title?: React.ReactNode;
  /** Leading Lucide icon in the header, star-blue. */
  icon?: string;
  /** Panel width in px (clamped to 94vw). */
  width?: number;
  /** Pinned footer row, right-aligned — put Buttons here. */
  footer?: React.ReactNode;
  /** Clicking the darkened mask closes the modal. */
  closeOnMask?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Glass dialog on a deep-space darkened + blurred mask. Traps focus, Esc closes. */
export function Modal(props: ModalProps): JSX.Element | null;
