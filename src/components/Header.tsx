import React, { useRef } from 'react';
import { 
  Scan, 
  FileSpreadsheet, 
  Workflow, 
  Lock, 
  Download,
  ShieldCheck,
  Smartphone,
  Globe
} from 'lucide-react';
import { CountRound, UserRole } from '../types/inventory';
import { exportScansToCsv } from '../utils/storage';
import { soundManager } from '../utils/audioHaptics';

interface HeaderProps {
  activeTab: 'scanner' | 'history' | 'powerautomate';
  setActiveTab: (tab: 'scanner' | 'history' | 'powerautomate') => void;
  countRound: CountRound;
  onOpenMasterAuth: () => void;
  scansCount: number;
  scans: import('../types/inventory').ScannedItem[];
  userRole: UserRole;
  onSetUserRole: (role: UserRole) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  countRound,
  onOpenMasterAuth,
  scansCount,
  scans,
  userRole,
  onSetUserRole,
}) => {
  // Secret 12-tap detection on app icon
  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);

  const handleSecretIconTap = () => {
    const now = Date.now();
    // If more than 2.5 seconds elapsed between taps, reset count
    if (now - lastTapTimeRef.current > 2500) {
      tapCountRef.current = 0;
    }
    lastTapTimeRef.current = now;
    tapCountRef.current += 1;

    // Check if 12 consecutive taps reached
    if (tapCountRef.current >= 12) {
      tapCountRef.current = 0;
      soundManager.playSuccess();
      onOpenMasterAuth();
    }
  };

  const getRoundBadge = () => {
    if (countRound === '1ER_CONTEO') return { label: '1er Conteo', color: 'text-emerald-400 bg-emerald-950/50 border-emerald-500/40' };
    if (countRound === '2DO_CONTEO') return { label: '2do Conteo', color: 'text-blue-400 bg-blue-950/50 border-blue-500/40' };
    if (countRound === '3ER_CONTEO') return { label: '3er Conteo', color: 'text-amber-400 bg-amber-950/50 border-amber-500/40' };
    return { label: 'Finalizado', color: 'text-rose-400 bg-rose-950/50 border-rose-500/40' };
  };

  const badge = getRoundBadge();

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 shadow-md">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Zone 1: Secret 12-tap Logo "ScanF" (Inconspicuous, looks completely like standard branding) */}
        <div 
          onClick={handleSecretIconTap}
          className="flex items-center gap-2 select-none cursor-default py-1 shrink-0"
          role="presentation"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 pointer-events-none shrink-0">
            <Scan className="w-4 h-4" />
          </div>
          <span className="font-extrabold tracking-tight text-white text-lg sm:text-xl whitespace-nowrap pointer-events-none">
            Scan<span className="text-amber-400">F</span>
          </span>

          <span className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-mono font-bold border whitespace-nowrap pointer-events-none ${badge.color}`}>
            {badge.label}
          </span>
        </div>

        {/* Zone 2: Navigation Links (Conditioned by Role) */}
        {/* In OPERADOR_APK mode: NO TABS ARE SHOWN AT ALL (only Escáner exists) */}
        {userRole !== 'OPERADOR_APK' && (
          <nav className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium overflow-x-auto py-1">
            <button
              onClick={() => setActiveTab('scanner')}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                activeTab === 'scanner'
                  ? 'bg-amber-500/15 text-amber-400 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Scan className="w-4 h-4 shrink-0" />
              <span>Escáner</span>
            </button>

            {/* Historial Excel is visible for ESPECIAL_2 and MASTER */}
            <button
              onClick={() => setActiveTab('history')}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                activeTab === 'history'
                  ? 'bg-amber-500/15 text-amber-400 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Historial Excel</span>
              <span className="sm:hidden">Historial</span>
              <span className="font-mono text-[11px]">({scansCount})</span>
            </button>

            {/* Enlace SharePoint is EXCLUSIVE to MASTER */}
            {userRole === 'MASTER' && (
              <button
                onClick={() => setActiveTab('powerautomate')}
                className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'powerautomate'
                    ? 'bg-amber-500/15 text-amber-400 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Workflow className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Enlace SharePoint</span>
                <span className="sm:hidden">SharePoint</span>
              </button>
            )}
          </nav>
        )}

        {/* Zone 3: Status / Role Info */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Quick CSV Export if in web/history */}
          {userRole !== 'OPERADOR_APK' && scans.length > 0 && (
            <button
              onClick={() => exportScansToCsv(scans)}
              title="Descargar copia Excel (.CSV)"
              className="p-2 text-slate-300 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors hidden md:flex items-center shrink-0"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          {/* Role Switcher Pill for Testing / Gerente vs Handheld APK */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px]">
            <button
              type="button"
              onClick={() => onSetUserRole('GERENTE')}
              className={`px-2 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                userRole === 'GERENTE' || userRole === 'MASTER'
                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Vista normal de Gerente (Navegador Web)"
            >
              <Globe className="w-3 h-3" />
              <span className="hidden xs:inline">Gerente</span>
            </button>
            <button
              type="button"
              onClick={() => onSetUserRole('OPERADOR_APK')}
              className={`px-2 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                userRole === 'OPERADOR_APK'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Vista Operador Handheld TC26 (Modo APK)"
            >
              <Smartphone className="w-3 h-3" />
              <span className="hidden xs:inline">Handheld APK</span>
              <span className="xs:hidden">APK</span>
            </button>
          </div>

          {/* Master Indicator Badge (when Master is unlocked via 12 secret taps) */}
          {userRole === 'MASTER' && (
            <button
              onClick={onOpenMasterAuth}
              className="px-2 sm:px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
              title="Panel de Enlaces Master (SharePoint y Supabase)"
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Master</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
