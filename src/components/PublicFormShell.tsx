// Wraps each public, embeddable form. When the form sits in an iframe on the WordPress
// site, it tells the page how tall it is, so the frame grows and shrinks with it
// (phones stack fields, so forms get taller) and never shows its own scrollbar.
import { useEffect, useRef, type ReactNode } from 'react';

export const FORM_HEIGHT_MESSAGE = 'confession-form-height';

export function PublicFormShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const main = ref.current;
    if (!main || window.parent === window) return; // opened directly, not embedded
    let last = 0;
    // Measure the form itself: the page fills the frame, so it can't tell us how tall the form is.
    const send = () => {
      const height = Math.ceil(main.getBoundingClientRect().height);
      if (height === last) return;
      last = height;
      window.parent.postMessage({ type: FORM_HEIGHT_MESSAGE, height }, '*');
    };
    const ro = new ResizeObserver(send);
    ro.observe(main);
    send();
    return () => ro.disconnect();
  }, []);
  return (
    <main ref={ref} className="public-form">
      {children}
    </main>
  );
}
