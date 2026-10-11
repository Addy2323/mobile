import { useEffect } from 'react';

export function useBodyScrollLock(isLocked: boolean = true) {
  useEffect(() => {
    if (!isLocked) return;

    // Save previous styles
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;

    // Prevent scrolling
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
    };
  }, [isLocked]);
}
