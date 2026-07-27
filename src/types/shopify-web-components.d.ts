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
      's-page': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        heading?: string;
      };
      's-link': React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLElement>, HTMLElement> & {
        href?: string;
        tone?: string;
      };
      's-section': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        heading?: string;
      };
      's-card': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      's-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        variant?: string;
      };
      's-badge': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        tone?: string;
      };
      's-search-field': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        value?: string;
        placeholder?: string;
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
      's-page': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { heading?: string };
      's-link': React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLElement>, HTMLElement> & {
        href?: string;
        tone?: string;
      };
      's-section': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { heading?: string };
      's-card': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      's-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { variant?: string };
      's-badge': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { tone?: string };
      's-search-field': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        value?: string;
        placeholder?: string;
      };
    }
  }
}

export {};
