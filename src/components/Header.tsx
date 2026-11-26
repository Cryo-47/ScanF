import React, { useRef } from 'react';
import { motion } from 'motion/react';
import {
  Scan,
  FileSpreadsheet,
  Workflow,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import { CountRound, UserRole } from '../types/inventory';
import { isRunningInApkOrStandalone } from '../utils/storage';
import { soundManager } from '../utils/audioHaptics';
import { Badge, Tooltip } from './ui/Controls';

interface HeaderProps {
  activeTab: 'scanner' | 'history' | 'powerautomate';
  setActiveTab: (tab: 'scanner' | 'history' | 'powerautomate') => void;
  countRound: CountRound;
  onOpenMasterAuth: () => void;
  onOpenQuickGuide?: () => void;
  scansCount: number;
  userRole: UserRole;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  countRound,
  onOpenMasterAuth,
  onOpenQuickGuide,
  scansCount,
  userRole,
}) => {
  // Secret 12-tap detection on app icon
  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);

  const handleSecretIconTap = () => {
    const now = Date.now();
    if (now - lastTapTimeRef.current > 2500) {
      tapCountRef.current = 0;
    }
    lastTapTimeRef.current = now;
    tapCountRef.current += 1;

    if (tapCountRef.current >= 12) {
      tapCountRef.current = 0;
      soundManager.playSuccess();
      onOpenMasterAuth();
    }
  };

  const roundBadge =
    countRound === '1ER_CONTEO'
      ? { label: '1er Conteo', tone: 'emerald' as const }
      : countRound === '2DO_CONTEO'
      ? { label: '2do Conteo', tone: 'blue' as const }
      : countRound === '3ER_CONTEO'
      ? { label: '3er Conteo', tone: 'amber' as const }
      : { label: 'Finalizado', tone: 'rose' as const };

  const showWebNav = userRole !== 'OPERADOR_APK' && !isRunningInApkOrStandalone();

  const navItems: Array<{
    id: 'scanner' | 'history' | 'powerautomate';
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    { id: 'scanner', label: 'Escáner', icon: <Scan className="w-4 h-4 shrink-0" /> },
    {
      id: 'history',
      label: 'Consola & Excel',
      icon: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
      badge: scansCount,
    },
    ...(userRole === 'MASTER'
      ? [
          {
            id: 'powerautomate' as const,
            label: 'SharePoint',
            icon: <Workflow className="w-4 h-4 shrink-0" />,
          },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 glass-surface border-b border-slate-800/80 shadow-lg">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 h-15 flex items-center justify-between gap-3">
        {/* Zone 1: Brand + Active Round Badge (Secret 12-tap trigger preserved) */}
        <div
          onClick={handleSecretIconTap}
          className="flex items-center gap-2.5 select-none cursor-default py-1 shrink-0"
          role="presentation"
        >
          <div className="w-8.5 h-8.5 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 pointer-events-none shrink-0 shadow-inner">
            <Scan className="w-4 h-4" />
          </div>
          <span className="font-extrabold tracking-tight text-white text-lg whitespace-nowrap pointer-events-none">
            Scan<span className="text-amber-400">F</span>
          </span>
          <Badge tone={roundBadge.tone} dot pulse={countRound !== 'CONTEO_FINALIZADO'}>
            {roundBadge.label}
          </Badge>
        </div>

        {/* Zone 2: Desktop Shared-Element Navigation Tabs (hidden on APK and mobile where Bottom TabBar takes over) */}
        {showWebNav && (
          <nav
            aria-label="Navegación principal"
            className="hidden md:flex items-center gap-1 bg-slate-950/75 p-1 rounded-2xl border border-slate-800/90"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                    isActive ? 'text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="desktop-nav-pill"
                      transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                      className="absolute inset-0 rounded-xl bg-amber-400 shadow-md"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {item.icon}
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono tabular-nums ${
                          isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Zone 3: Quick Guide (?) & Master Role Indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenQuickGuide && (
            <Tooltip content="Abrir guía rápida operativa" position="bottom">
              <button
                type="button"
                onClick={onOpenQuickGuide}
                className="h-9 px-2.5 sm:px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-amber-400 border border-slate-700/80 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Guía</span>
              </button>
            </Tooltip>
          )}

          {userRole === 'MASTER' && (
            <Tooltip content="Panel Master (SharePoint y Supabase)" position="bottom">
              <button
                type="button"
                onClick={onOpenMasterAuth}
                className="h-9 px-2.5 sm:px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Master</span>
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </header>
  );
};
