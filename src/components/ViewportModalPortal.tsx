import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ViewportModalPortalProps {
  children: React.ReactNode;
  isOpen?: boolean;
}

/**
 * Renders any modal/sheet directly into document.body via React Portal
 * so it is 100% immune to parent `transform`, `filter`, or `backdrop-filter`
 * containing-block traps and always opens immediately in the active viewport
 * without requiring the user to scroll down the page.
 */
export const ViewportModalPortal: React.FC<ViewportModalPortalProps> = ({
  children,
  isOpen = true
}) => {
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return <>{children}</>;

  return createPortal(children, document.body);
};
