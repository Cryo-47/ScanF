import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';

export const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const EASE_ANTICIPATION: [number, number, number, number] = [0.36, 0, 0.66, -0.56];

interface FadeSlideProps {
  children: React.ReactNode;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
}

export const FadeSlide: React.FC<FadeSlideProps> = ({
  children,
  className = '',
  direction = 'up',
  delay = 0,
}) => {
  const offset =
    direction === 'up'
      ? { y: 12, x: 0 }
      : direction === 'down'
      ? { y: -12, x: 0 }
      : direction === 'left'
      ? { x: 14, y: 0 }
      : { x: -14, y: 0 };

  return (
    <motion.div
      initial={{ opacity: 0, ...offset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, ...offset }}
      transition={{ duration: 0.24, delay, ease: EASE_OUT_EXPO }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

interface StaggerListProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

export const StaggerList: React.FC<StaggerListProps> = ({
  children,
  className = '',
  staggerDelay = 0.035,
}) => {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10, scale: 0.985 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.26, ease: EASE_OUT_EXPO },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Tactile Squash & Stretch + Anticipation + Follow-through button wrapper
 */
interface TactileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  anticipation?: boolean;
}

export const TactileButton: React.FC<TactileButtonProps> = ({
  children,
  className = '',
  anticipation = false,
  disabled,
  ...rest
}) => {
  return (
    <motion.button
      whileHover={disabled ? undefined : { y: -1, scale: 1.01 }}
      whileTap={
        disabled
          ? undefined
          : anticipation
          ? { scaleX: 1.03, scaleY: 0.94, y: 1 }
          : { scaleX: 1.02, scaleY: 0.96 }
      }
      transition={{ type: 'spring', stiffness: 520, damping: 24, mass: 0.7 }}
      disabled={disabled}
      className={className}
      {...(rest as any)}
    >
      {children}
    </motion.button>
  );
};

/**
 * Shake container triggered when errorKey increments or shakes on invalid input
 */
export const ShakeContainer: React.FC<{
  shakeKey: number | string | boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ shakeKey, children, className = '' }) => {
  return (
    <motion.div
      key={String(shakeKey)}
      initial={shakeKey ? { x: 0 } : false}
      animate={shakeKey ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
      transition={{ duration: 0.36, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Curved parabolic arc badge/chip entrance (Follow-through + Arcs)
 */
export const ArcBadgeEntrance: React.FC<{
  show: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ show, children, className = '' }) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: -16, y: 14, scale: 0.85 }}
          animate={{
            opacity: [0, 1, 1],
            x: [-16, -4, 0],
            y: [14, -6, 0],
            scale: [0.85, 1.04, 1],
          }}
          exit={{ opacity: 0, y: -8, scale: 0.92 }}
          transition={{ duration: 0.38, ease: EASE_OUT_EXPO }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Pull-to-Refresh gesture wrapper for handheld & mobile touch lists
 */
interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  disabled?: boolean;
  label?: string;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false,
  label = 'Suelta para sincronizar con Supabase',
}) => {
  const startYRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const THRESHOLD = 68;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    if (window.scrollY <= 4) {
      startYRef.current = e.touches[0].clientY;
    } else {
      startYRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null || disabled || isRefreshing) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0 && window.scrollY <= 4) {
      const damped = Math.min(96, delta * 0.45);
      setPullDistance(damped);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (startYRef.current === null) return;
    startYRef.current = null;
    if (pullDistance >= THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(52);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      <AnimatePresence>
        {(pullDistance > 8 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: Math.max(44, pullDistance) }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
            className="flex items-center justify-center overflow-hidden"
          >
            <div className="glass-surface px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs font-medium text-emerald-300 shadow-lg">
              <RefreshCw
                className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`}
                style={
                  !isRefreshing
                    ? { transform: `rotate(${Math.min(360, pullDistance * 4)}deg)` }
                    : undefined
                }
              />
              <span>
                {isRefreshing
                  ? 'Sincronizando nube...'
                  : pullDistance >= THRESHOLD
                  ? label
                  : 'Desliza hacia abajo para actualizar'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </div>
  );
};
