import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Minus,
  Plus,
  UploadCloud,
  X,
  ChevronUp,
} from 'lucide-react';
import { EASE_OUT_EXPO } from './MotionPrimitives';

/* ============================================================================
 * 1. BADGE
 * ==========================================================================*/
export type BadgeTone = 'neutral' | 'emerald' | 'blue' | 'amber' | 'rose' | 'indigo';

const TONE_MAP: Record<BadgeTone, string> = {
  neutral: 'bg-slate-900/90 text-slate-300 border-slate-700/80',
  emerald: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40',
  blue: 'bg-blue-950/70 text-blue-300 border-blue-500/40',
  amber: 'bg-amber-950/70 text-amber-300 border-amber-500/40',
  rose: 'bg-rose-950/70 text-rose-300 border-rose-500/40',
  indigo: 'bg-indigo-950/70 text-indigo-300 border-indigo-500/40',
};

export const Badge: React.FC<{
  children: React.ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}> = ({ children, tone = 'neutral', dot = false, pulse = false, className = '' }) => {
  const dotColor =
    tone === 'emerald'
      ? 'bg-emerald-400'
      : tone === 'blue'
      ? 'bg-blue-400'
      : tone === 'amber'
      ? 'bg-amber-400'
      : tone === 'rose'
      ? 'bg-rose-400'
      : tone === 'indigo'
      ? 'bg-indigo-400'
      : 'bg-slate-400';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-bold border whitespace-nowrap tabular-nums ${TONE_MAP[tone]} ${className}`}
    >
      {dot && (
        <span className="relative flex h-2 w-2 shrink-0">
          {pulse && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
        </span>
      )}
      {children}
    </span>
  );
};

/* ============================================================================
 * 2. TOOLTIP & POPOVER
 * ==========================================================================*/
export const Tooltip: React.FC<{
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
}> = ({ content, children, position = 'top' }) => {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && content && (
          <motion.div
            initial={{ opacity: 0, y: position === 'top' ? 4 : -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: position === 'top' ? 4 : -4, scale: 0.96 }}
            transition={{ duration: 0.14, ease: EASE_OUT_EXPO }}
            role="tooltip"
            className={`pointer-events-none absolute left-1/2 -translate-x-1/2 z-50 px-2.5 py-1.5 rounded-lg glass-surface-strong text-[11px] font-medium text-slate-100 whitespace-nowrap shadow-xl border border-slate-700/80 ${
              position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Popover: React.FC<{
  trigger: (props: { isOpen: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'left' | 'right';
}> = ({ trigger, children, align = 'right' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block">
      {trigger({ isOpen, toggle: () => setIsOpen((v) => !v) })}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
            className={`absolute mt-2 z-50 min-w-[260px] max-w-[340px] glass-surface-strong rounded-2xl border border-slate-700/80 p-3.5 shadow-2xl ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {children(() => setIsOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ============================================================================
 * 3. SWITCH, CHECKBOX, RADIO GROUP, SLIDER, SELECT
 * ==========================================================================*/
export const Switch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  tone?: 'emerald' | 'amber' | 'blue';
  disabled?: boolean;
}> = ({ checked, onChange, label, description, tone = 'emerald', disabled = false }) => {
  const activeBg =
    tone === 'amber' ? 'bg-amber-500' : tone === 'blue' ? 'bg-blue-500' : 'bg-emerald-500';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`flex items-center justify-between gap-3 text-left select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      {(label || description) && (
        <div className="min-w-0">
          {label && <span className="text-xs font-semibold text-slate-200 block">{label}</span>}
          {description && (
            <span className="text-[11px] text-slate-400 block leading-snug">{description}</span>
          )}
        </div>
      )}
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors border ${
          checked
            ? `${activeBg} border-white/20 shadow-inner`
            : 'bg-slate-800 border-slate-700 neu-pressed'
        }`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 560, damping: 32 }}
          className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-md ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
};

export const Checkbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: string;
  tone?: 'emerald' | 'amber' | 'blue' | 'rose';
}> = ({ checked, onChange, label, description, tone = 'amber' }) => {
  const boxTone =
    tone === 'emerald'
      ? 'bg-emerald-500 border-emerald-400 text-slate-950'
      : tone === 'blue'
      ? 'bg-blue-500 border-blue-400 text-white'
      : tone === 'rose'
      ? 'bg-rose-500 border-rose-400 text-white'
      : 'bg-amber-500 border-amber-400 text-slate-950';

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-start gap-2.5 text-left cursor-pointer select-none w-full"
    >
      <motion.span
        whileTap={{ scale: 0.88 }}
        className={`mt-0.5 w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
          checked ? boxTone : 'bg-slate-950 border-slate-600'
        }`}
      >
        <AnimatePresence>
          {checked && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.16, ease: EASE_OUT_EXPO }}
            >
              <Check className="w-3 h-3 stroke-[3]" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
      <span className="flex-1 min-w-0 text-xs leading-snug">
        <span className="font-semibold text-slate-200 block">{label}</span>
        {description && <span className="text-[11px] text-slate-400 block mt-0.5">{description}</span>}
      </span>
    </button>
  );
};

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  sublabel?: string;
}

export function RadioGroup<T extends string>({
  value,
  onChange,
  options,
  name,
  className = '',
}: {
  value: T;
  onChange: (val: T) => void;
  options: RadioOption<T>[];
  name: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className={`flex flex-wrap gap-1.5 ${className}`}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              active
                ? 'bg-indigo-600/20 border-indigo-400/70 text-white shadow-sm'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <span
              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                active ? 'border-indigo-400' : 'border-slate-600'
              }`}
            >
              {active && (
                <motion.span
                  layoutId={`radio-dot-${name}`}
                  className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                />
              )}
            </span>
            <span>{opt.label}</span>
            {opt.sublabel && (
              <span className="text-[10px] font-mono text-slate-400">{opt.sublabel}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export const Select: React.FC<{
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}> = ({ value, onChange, options, placeholder = 'Seleccionar', className = '', ariaLabel }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700/90 hover:border-slate-500 text-xs font-semibold text-slate-200 flex items-center justify-between gap-2 transition-colors cursor-pointer"
      >
        <span className="truncate">{current ? current.label : placeholder}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: EASE_OUT_EXPO }}
            className="absolute left-0 right-0 mt-1.5 z-50 glass-surface-strong rounded-xl border border-slate-700/90 py-1 shadow-2xl max-h-56 overflow-y-auto"
          >
            {options.map((opt) => {
              const selected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    selected
                      ? 'bg-amber-500/15 text-amber-300 font-bold'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {selected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Slider: React.FC<{
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  label?: string;
  formatValue?: (val: number) => string;
}> = ({ value, min, max, step = 100, onChange, label, formatValue }) => {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">{label}</span>
          <span className="font-mono font-bold text-amber-400 tabular-nums">
            {formatValue ? formatValue(value) : value}
          </span>
        </div>
      )}
      <div className="relative flex items-center h-6">
        <div className="w-full h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-75"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
        <div
          className="pointer-events-none absolute w-4 h-4 rounded-full bg-white border-2 border-amber-400 shadow-md -translate-x-1/2 transition-all duration-75"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. STEPPERS (PROCESS STEPPER & NUMERIC QUANTITY STEPPER)
 * ==========================================================================*/
export interface StepperStep {
  id: string;
  label: string;
  sublabel?: string;
}

export const ProcessStepper: React.FC<{
  steps: StepperStep[];
  currentStepIndex: number;
  tone?: 'emerald' | 'blue' | 'amber' | 'rose';
}> = ({ steps, currentStepIndex, tone = 'emerald' }) => {
  const activeColor =
    tone === 'blue'
      ? 'bg-blue-500 border-blue-400 text-white shadow-blue-500/25'
      : tone === 'amber'
      ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-amber-500/25'
      : tone === 'rose'
      ? 'bg-rose-500 border-rose-400 text-white shadow-rose-500/25'
      : 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-emerald-500/25';

  return (
    <div className="flex items-center justify-between gap-1 sm:gap-2 w-full">
      {steps.map((step, idx) => {
        const isDone = idx < currentStepIndex;
        const isActive = idx === currentStepIndex;
        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-1.5 min-w-0">
              <motion.div
                layout
                className={`w-6 h-6 rounded-full border text-[11px] font-mono font-extrabold flex items-center justify-center shrink-0 transition-colors ${
                  isActive
                    ? `${activeColor} shadow-md`
                    : isDone
                    ? 'bg-emerald-950 border-emerald-500/50 text-emerald-400'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
              </motion.div>
              <div className="min-w-0 leading-tight">
                <div
                  className={`text-[11px] font-bold truncate ${
                    isActive ? 'text-white' : isDone ? 'text-emerald-300' : 'text-slate-500'
                  }`}
                >
                  {step.label}
                </div>
                {step.sublabel && (
                  <div className="text-[9px] font-mono text-slate-500 hidden sm:block truncate">
                    {step.sublabel}
                  </div>
                )}
              </div>
            </div>
            {idx < steps.length - 1 && (
              <div className="flex-1 h-0.5 bg-slate-800 rounded-full overflow-hidden min-w-[10px]">
                <motion.div
                  initial={false}
                  animate={{ width: idx < currentStepIndex ? '100%' : '0%' }}
                  transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                  className="h-full bg-emerald-500/70"
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const NumericStepper: React.FC<{
  value: number | '';
  onChange: (next: number) => void;
  min?: number;
  disabled?: boolean;
}> = ({ value, onChange, min = 0, disabled = false }) => {
  const num = value === '' ? 0 : Number(value) || 0;

  return (
    <div className="flex items-center gap-1 neu-surface rounded-xl p-1 border border-slate-800 shrink-0">
      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        disabled={disabled || num <= min}
        onClick={() => onChange(Math.max(min, num - 1))}
        aria-label="Restar pieza"
        className="w-9 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 flex items-center justify-center disabled:opacity-40 cursor-pointer transition-colors"
      >
        <Minus className="w-4 h-4" />
      </motion.button>
      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        disabled={disabled}
        onClick={() => onChange(num + 1)}
        aria-label="Sumar pieza"
        className="w-9 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 flex items-center justify-center disabled:opacity-40 cursor-pointer transition-colors"
      >
        <Plus className="w-4 h-4" />
      </motion.button>
    </div>
  );
};

/* ============================================================================
 * 5. BREADCRUMB & SHARED-ELEMENT TABS
 * ==========================================================================*/
export const Breadcrumb: React.FC<{
  items: Array<{ label: string; onClick?: () => void }>;
}> = ({ items }) => (
  <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 flex-wrap">
    {items.map((item, idx) => {
      const isLast = idx === items.length - 1;
      return (
        <React.Fragment key={`${item.label}-${idx}`}>
          {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
          {item.onClick && !isLast ? (
            <button
              type="button"
              onClick={item.onClick}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              {item.label}
            </button>
          ) : (
            <span className={isLast ? 'text-slate-200 font-bold' : 'text-slate-400'}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      );
    })}
  </nav>
);

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  layoutGroup,
  className = '',
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  layoutGroup: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`inline-flex flex-wrap items-center gap-1 bg-slate-950/90 p-1 rounded-2xl border border-slate-800/90 ${className}`}
    >
      {items.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`relative px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              active ? 'text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`tab-pill-${layoutGroup}`}
                transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                className="absolute inset-0 rounded-xl bg-amber-400 shadow-md"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono tabular-nums ${
                    active ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * 6. ACCORDION
 * ==========================================================================*/
export const Accordion: React.FC<{
  title: React.ReactNode;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}> = ({ title, subtitle, defaultOpen = false, children, badge }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-900/60 transition-colors cursor-pointer"
      >
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-100 flex items-center gap-2 flex-wrap">
            {title}
            {badge}
          </div>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <span className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 shrink-0">
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-slate-800/70">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ============================================================================
 * 7. AUTOCOMPLETE INPUT
 * ==========================================================================*/
export const AutocompleteInput: React.FC<{
  id?: string;
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
  inputClassName?: string;
  leftIcon?: React.ReactNode;
  onSelectSuggestion?: (val: string) => void;
  readOnly?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onPaste?: React.ClipboardEventHandler<HTMLInputElement>;
  tabIndex?: number;
}> = ({
  id,
  value,
  onChange,
  suggestions,
  placeholder,
  inputClassName = '',
  leftIcon,
  onSelectSuggestion,
  readOnly,
  inputMode,
  inputRef,
  onKeyDown,
  onBlur,
  onPaste,
  tabIndex,
}) => {
  const [focused, setFocused] = useState(false);

  const filtered = React.useMemo(() => {
    if (readOnly) return [];
    const q = value.trim().toLowerCase();
    if (!q || q.includes('_')) return [];
    return suggestions
      .filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q)
      .slice(0, 6);
  }, [value, suggestions, readOnly]);

  return (
    <div className="relative">
      {leftIcon && (
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
          {leftIcon}
        </div>
      )}
      <input
        id={id}
        ref={inputRef}
        type="text"
        value={value}
        readOnly={readOnly}
        tabIndex={tabIndex}
        inputMode={inputMode}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setTimeout(() => setFocused(false), 140);
          onBlur?.(e);
        }}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName}
      />
      <AnimatePresence>
        {focused && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 right-0 mt-1.5 z-40 glass-surface-strong rounded-xl border border-slate-700 py-1 shadow-2xl max-h-48 overflow-y-auto"
          >
            {filtered.map((item) => (
              <button
                key={item}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(item);
                  onSelectSuggestion?.(item);
                  setFocused(false);
                }}
                className="w-full px-3.5 py-2 text-left text-xs font-mono text-slate-200 hover:bg-amber-500/15 hover:text-amber-300 transition-colors cursor-pointer truncate"
              >
                {item}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ============================================================================
 * 8. DATE RANGE PICKER POPOVER
 * ==========================================================================*/
export const DateRangePicker: React.FC<{
  fromDate: string;
  toDate: string;
  onChange: (from: string, to: string) => void;
}> = ({ fromDate, toDate, onChange }) => {
  const hasFilter = Boolean(fromDate || toDate);
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <Popover
      align="left"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className={`h-10 px-3 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            hasFilter
              ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
              : 'bg-slate-950 border-slate-700/90 hover:border-slate-500 text-slate-300'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            {hasFilter
              ? `${fromDate || '...'} → ${toDate || '...'}`
              : 'Fecha / Turno'}
          </span>
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white">Filtrar por Fecha</span>
            {hasFilter && (
              <button
                type="button"
                onClick={() => {
                  onChange('', '');
                  close();
                }}
                className="text-[11px] text-rose-400 hover:underline cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                onChange(todayIso, todayIso);
                close();
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
            >
              Solo Hoy
            </button>
            <button
              type="button"
              onClick={() => {
                const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
                onChange(yest, todayIso);
                close();
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
            >
              Últimas 48h
            </button>
            <button
              type="button"
              onClick={() => {
                onChange('', '');
                close();
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
            >
              Todo el Ciclo
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Desde:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => onChange(e.target.value, toDate)}
                className="w-full h-9 px-2 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-mono text-slate-200"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Hasta:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => onChange(fromDate, e.target.value)}
                className="w-full h-9 px-2 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-mono text-slate-200"
              />
            </div>
          </div>
        </div>
      )}
    </Popover>
  );
};

/* ============================================================================
 * 9. DROPZONE (CSV BACKUP VERIFICATION / IMPORT PREVIEW)
 * ==========================================================================*/
export const Dropzone: React.FC<{
  onFileLoaded: (fileName: string, content: string) => void;
  accept?: string;
  label?: string;
  sublabel?: string;
}> = ({
  onFileLoaded,
  accept = '.csv,text/csv',
  label = 'Arrastra aquí una copia CSV de respaldo o haz clic para explorar',
  sublabel = 'Valida conteos exportados sin alterar la base en vivo',
}) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onFileLoaded(file.name, reader.result);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) readFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer select-none ${
        dragging
          ? 'border-amber-400 bg-amber-500/10'
          : 'border-slate-700/80 hover:border-slate-500 bg-slate-950/60'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
          e.target.value = '';
        }}
      />
      <UploadCloud className="w-6 h-6 text-amber-400 mx-auto mb-2" />
      <p className="text-xs font-bold text-slate-200">{label}</p>
      <p className="text-[11px] text-slate-400 mt-1">{sublabel}</p>
    </div>
  );
};

/* ============================================================================
 * 10. SKELETON, EMPTY STATE, PAGINATION
 * ==========================================================================*/
export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => (
  <div className={`animate-shimmer rounded-xl ${className}`} />
);

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="py-10 px-4 text-center space-y-3">
    <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mx-auto">
      {icon}
    </div>
    <div className="space-y-1 max-w-sm mx-auto">
      <h4 className="text-sm font-bold text-slate-200">{title}</h4>
      <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
    </div>
    {action && <div className="pt-1">{action}</div>}
  </div>
);

export const Pagination: React.FC<{
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}> = ({ currentPage, totalItems, pageSize, onPageChange, onPageSizeChange }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(totalItems, currentPage * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-800/80 text-xs">
      <div className="text-slate-400 font-mono text-[11px] tabular-nums">
        Mostrando <strong className="text-slate-200">{start}-{end}</strong> de{' '}
        <strong className="text-slate-200">{totalItems}</strong> registros
      </div>

      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <Select
            ariaLabel="Registros por página"
            value={String(pageSize)}
            onChange={(v) => onPageSizeChange(Number(v))}
            options={[
              { value: '15', label: '15 / pág' },
              { value: '30', label: '30 / pág' },
              { value: '50', label: '50 / pág' },
              { value: '100', label: '100 / pág' },
            ]}
            className="w-28"
          />
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Página anterior"
            className="h-9 w-9 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-600 text-slate-300 flex items-center justify-center disabled:opacity-40 cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2.5 font-mono text-[11px] text-slate-300 tabular-nums">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Página siguiente"
            className="h-9 w-9 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-600 text-slate-300 flex items-center justify-center disabled:opacity-40 cursor-pointer transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 11. DRAWER (DESKTOP SLIDE-OVER) & BOTTOM SHEET (MOBILE/TC26)
 * ==========================================================================*/
export const Drawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, subtitle, children }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.26, ease: EASE_OUT_EXPO }}
            className="relative z-10 w-full max-w-md h-full glass-surface-strong border-l border-slate-700/80 flex flex-col shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white">{title}</h3>
                {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                aria-label="Cerrar panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};

export const BottomSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%', opacity: 0.7 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.5 }}
            transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 180 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90) onClose();
            }}
            className="relative z-10 w-full sm:max-w-md glass-surface-strong border-t sm:border border-slate-700/90 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[88vh] overflow-y-auto"
          >
            <div className="w-10 h-1 rounded-full bg-slate-600/80 mx-auto mb-3 sm:hidden" />
            {title && (
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-white">{title}</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

/* ============================================================================
 * 12. FAB & SWIPE ACTION ITEM
 * ==========================================================================*/
export const FloatingActionButton: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone?: 'amber' | 'emerald';
}> = ({ onClick, icon, label, tone = 'amber' }) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileHover={{ scale: 1.05, y: -2 }}
    whileTap={{ scale: 0.92 }}
    transition={{ type: 'spring', stiffness: 480, damping: 24 }}
    aria-label={label}
    title={label}
    className={`fixed bottom-20 md:bottom-6 right-4 z-30 h-13 px-4 rounded-2xl font-bold text-xs shadow-2xl flex items-center gap-2 cursor-pointer border ${
      tone === 'emerald'
        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300/50 shadow-emerald-500/25'
        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300/50 shadow-amber-500/25'
    }`}
  >
    {icon}
    <span className="hidden xs:inline">{label}</span>
  </motion.button>
);

export const SwipeActionRow: React.FC<{
  children: React.ReactNode;
  onInspect?: () => void;
  onDelete?: () => void;
}> = ({ children, onInspect, onDelete }) => {
  const [swiped, setSwiped] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-y-0 right-0 flex items-center gap-1.5 px-2 bg-slate-950">
        {onInspect && (
          <button
            type="button"
            onClick={() => {
              setSwiped(false);
              onInspect();
            }}
            className="h-10 px-3 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
          >
            Detalle
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => {
              setSwiped(false);
              onDelete();
            }}
            className="h-10 px-3 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
          >
            Borrar
          </button>
        )}
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -135, right: 0 }}
        dragElastic={0.15}
        animate={{ x: swiped ? -130 : 0 }}
        onDragEnd={(_, info) => {
          setSwiped(info.offset.x < -55);
        }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="relative z-10 bg-slate-900"
      >
        {children}
      </motion.div>
    </div>
  );
};
