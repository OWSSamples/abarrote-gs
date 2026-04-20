import type * as React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      's-switch': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        id?: string;
        label?: string;
        checked?: boolean;
        disabled?: boolean;
        accessibilityLabel?: string;
        labelAccessibilityVisibility?: 'visible' | 'exclusive';
      };
    }
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      's-switch': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        id?: string;
        label?: string;
        checked?: boolean;
        disabled?: boolean;
        accessibilityLabel?: string;
        labelAccessibilityVisibility?: 'visible' | 'exclusive';
      };
    }
  }
}

export {};
