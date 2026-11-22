import { useEffect, useRef } from 'react';

let openDialogLocks = 0;

/**
 * Industrial WAI-ARIA Dialog Keyboard & Viewport Accessibility Hook
 * - Enables clean Escape-key dismissal across all modals, drawers, and bottom sheets.
 * - Uses a stable ref for `onClose` so inline callbacks NEVER re-trigger cleanup
 *   or steal focus from active `<input>` / `<textarea>` fields while typing on mobile keyboards.
 * - Reference-counts active dialogs to lock background body scroll without layout jump.
 * - Restores keyboard focus to the trigger element ONLY when `isOpen` transitions from true to false.
 */
export function useEscapeKey(isOpen: boolean, onClose?: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const previousActiveElement =
      typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

    if (typeof document !== 'undefined' && document.body) {
      openDialogLocks += 1;
      document.body.style.overflow = 'hidden';
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onCloseRef.current) {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (typeof document !== 'undefined' && document.body) {
        openDialogLocks = Math.max(0, openDialogLocks - 1);
        if (openDialogLocks === 0) {
          document.body.style.overflow = '';
        }
      }
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        try {
          previousActiveElement.focus({ preventScroll: true });
        } catch {
          // Ignore focus errors if trigger element was unmounted
        }
      }
    };
  }, [isOpen]);
}
