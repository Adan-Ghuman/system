import { useState, useEffect } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

export function GlobalSyncBar() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const isActive = isFetching > 0 || isMutating > 0;

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isActive) {
      setVisible(true);
    } else {
      // Keep visible for a tiny moment so brief operations feel smooth
      timeout = setTimeout(() => {
        setVisible(false);
      }, 300);
    }
    return () => clearTimeout(timeout);
  }, [isActive]);

  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-label="Synchronizing data"
      className="fixed top-0 left-0 right-0 h-[2.5px] z-50 pointer-events-none overflow-hidden bg-zinc-900/40"
    >
      <div className="w-full h-full relative">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 opacity-90 shadow-[0_0_10px_#10b981] animate-[syncPulse_1.4s_ease-in-out_infinite]" />
      </div>
      <style>{`
        @keyframes syncPulse {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
