import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { toPersianDigits } from '../utils/jalali';
import { triggerHaptic } from '../utils/haptics';

interface FloatingNotificationBadgeProps {
  unreadCount?: number;
  onClick: () => void;
}

export const FloatingNotificationBadge: React.FC<FloatingNotificationBadgeProps> = ({
  unreadCount = 0,
  onClick
}) => {
  // 1. Vertical position state with localStorage persistence
  const [topPos, setTopPos] = useState<number>(() => {
    if (typeof window === 'undefined') return 180;
    try {
      const saved = localStorage.getItem('minadental_notif_badge_top');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val > 60 && val < window.innerHeight - 80) {
          return val;
        }
      }
    } catch {
      // fallback
    }
    return Math.max(100, Math.floor(window.innerHeight * 0.25));
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartY = useRef<number>(0);
  const initialTopY = useRef<number>(topPos);
  const hasMoved = useRef<boolean>(false);

  // Bounds clamp helper
  const clampTop = (val: number) => {
    const minTop = 60; // Below top status bar / header
    const maxTop = Math.max(minTop + 40, window.innerHeight - 100); // Above bottom dock
    return Math.min(Math.max(val, minTop), maxTop);
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragStartY.current = touch.clientY;
    initialTopY.current = topPos;
    hasMoved.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const deltaY = touch.clientY - dragStartY.current;
    if (Math.abs(deltaY) > 4) {
      hasMoved.current = true;
    }
    const newTop = clampTop(initialTopY.current + deltaY);
    setTopPos(newTop);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    try {
      localStorage.setItem('minadental_notif_badge_top', topPos.toString());
    } catch {
      // ignore
    }
    if (!hasMoved.current) {
      onClick();
    }
  };

  // Mouse drag handlers for desktop/web preview
  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartY.current = e.clientY;
    initialTopY.current = topPos;
    hasMoved.current = false;
    setIsDragging(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - dragStartY.current;
      if (Math.abs(deltaY) > 4) {
        hasMoved.current = true;
      }
      setTopPos(clampTop(initialTopY.current + deltaY));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsDragging(false);
      try {
        localStorage.setItem('minadental_notif_badge_top', topPos.toString());
      } catch {
        // ignore
      }
      if (!hasMoved.current) {
        onClick();
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Listen to window resize to ensure it doesn't get pushed off-screen
  useEffect(() => {
    const onResize = () => {
      setTopPos((prev) => clampTop(prev));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Position default around middle-lower right edge like the Q-Bank screenshot
  return (
    <aside
      aria-label="نشانگر یادآوری‌ها و اعلانات"
      style={{ top: `${topPos}px` }}
      className={`fixed right-0 z-40 select-none touch-none transition-transform duration-150 ${
        isDragging ? 'scale-105 opacity-95 cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* 
        Exact Q-Bank Right-Edge S-Curved Notification Tab (from Screenshot 3 & 5):
        - Smooth concave top & bottom S-curves blending seamlessly into the right bezel
        - Realistic Bell with neon-lime clapper & pulsing red notification dot
        - Supports vertical drag-and-drop and 1-tap slide-out Notification Drawer
      */}
      <div
        onTouchStart={(e) => {
          triggerHaptic('light');
          handleTouchStart(e);
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => {
          if (!hasMoved.current) triggerHaptic('medium');
          handleTouchEnd();
        }}
        onMouseDown={handleMouseDown}
        className="relative w-[38px] h-[88px] flex items-center justify-center group active:scale-95 transition-transform cursor-pointer"
        style={{ filter: 'drop-shadow(-4px 4px 12px rgba(15, 23, 42, 0.12))' }}
        title="باز کردن کشوی اعلانات و یادآوری‌ها (قابل جابجایی عمودی)"
      >
        {/* Q-Bank Authentic S-Curve Right-Edge Tab SVG */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 38 88"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 38 0 C 38 14, 2 14, 2 30 L 2 58 C 2 74, 38 74, 38 88 Z"
            fill="rgba(255, 255, 255, 0.96)"
            stroke="rgba(203, 213, 225, 0.9)"
            strokeWidth="1.5"
          />
        </svg>

        {/* Realistic Q-Bank Bell Icon + Neon Lime Clapper + Red Dot */}
        <div className="relative z-10 flex items-center justify-center pl-1.5">
          <div className="relative animate-bell-ring">
            <svg width="22" height="24" viewBox="0 0 24 26" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Neon Lime Clapper at Bottom */}
              <path
                d="M9.5 20.5C9.5 21.8807 10.6193 23 12 23C13.3807 23 14.5 21.8807 14.5 20.5H9.5Z"
                fill="#84cc16"
              />
              {/* Dark Bell Body */}
              <path
                d="M12 3C8.68629 3 6 5.68629 6 9V14.5L4.29289 16.2071C3.66293 16.8371 4.1091 17.9142 5 17.9142H19C19.8909 17.9142 20.3371 16.8371 19.7071 16.2071L18 14.5V9C18 5.68629 15.3137 3 12 3Z"
                fill="#0f172a"
              />
              {/* Subtle Center Bell Slot Highlight */}
              <rect x="11.2" y="10" width="1.6" height="4" rx="0.8" fill="#a3e635" />
            </svg>

            {/* Red Notification Dot / Counter on Top-Right of Bell */}
            {unreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[13px] h-[13px] px-0.5 bg-rose-500 border-[1.5px] border-white text-[8px] font-black text-white rounded-full shadow-2xs font-mono leading-none">
                {toPersianDigits(unreadCount)}
              </span>
            ) : (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 border-[1.5px] border-white rounded-full" />
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

