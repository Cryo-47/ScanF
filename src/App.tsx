import React, { useState, useEffect } from 'react';
import { 
  ScannedItem, 
  PowerAutomateConfig, 
  SupabaseConfig,
  CountRound,
  UserRole,
  DeviceInfo
} from './types/inventory';
import { 
  loadScans, 
  saveScans, 
  loadPowerAutomateConfig, 
  savePowerAutomateConfig, 
  loadSupabaseConfig, 
  saveSupabaseConfig, 
  loadCountRound, 
  saveCountRound, 
  loadDeviceInfo, 
  saveDeviceInfo, 
  unlockUserNumberCycle,
  loadRound2Authorizations,
  saveRound2Authorizations,
  loadUserRounds,
  saveUserRounds,
  computeDeviceSummaries, 
  isRunningInApkOrStandalone 
} from './utils/storage';
import { syncScannedItem } from './utils/syncService';
import { Header } from './components/Header';
import { ScannerView } from './components/ScannerView';
import { HistoryView } from './components/HistoryView';
import { PowerAutomateConfigView } from './components/PowerAutomateConfig';
import { MasterAuthModal } from './components/MasterAuthModal';
import { DeviceSetupModal } from './components/DeviceSetupModal';
import { HandheldCheckInModal } from './components/HandheldCheckInModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'history' | 'powerautomate'>('scanner');
  
  // Role Detection:
  // - If running in standalone/APK (PWA Builder): defaults to 'OPERADOR_APK'
  // - If running in Web / Browser: defaults to 'GERENTE' (controls rounds 1, 2, 3, finalize, reset + history & Excel link)
  // - If unlocked via secret 12 taps: becomes 'MASTER' (SharePoint & Supabase connection configs)
  const [userRole, setUserRole] = useState<UserRole>(() => {
    return isRunningInApkOrStandalone() ? 'OPERADOR_APK' : 'GERENTE';
  });
  
  // Persistent data
  const [scans, setScans] = useState<ScannedItem[]>([]);
  const [countRound, setCountRound] = useState<CountRound>('1ER_CONTEO');
  const [userRounds, setUserRounds] = useState<Record<number, CountRound>>(loadUserRounds);
  const [powerAutomateConfig, setPowerAutomateConfig] = useState<PowerAutomateConfig>(loadPowerAutomateConfig);
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(loadSupabaseConfig);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(loadDeviceInfo);
  const [round2Authorizations, setRound2Authorizations] = useState<Record<number, boolean>>(loadRound2Authorizations);

  // Modals
  const [isDeviceSetupOpen, setIsDeviceSetupOpen] = useState(false);
  const [isMasterAuthOpen, setIsMasterAuthOpen] = useState(false);
  const [isHandheldCheckInOpen, setIsHandheldCheckInOpen] = useState(false);

  // Load stored data on mount
  useEffect(() => {
    setScans(loadScans());
    setCountRound(loadCountRound());
    setUserRounds(loadUserRounds());
    setDeviceInfo(loadDeviceInfo());
    setPowerAutomateConfig(loadPowerAutomateConfig());
    setSupabaseConfig(loadSupabaseConfig());
    setRound2Authorizations(loadRound2Authorizations());

    // Sync across tabs/windows (e.g. handheld simulator tab vs manager web tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'tc26_user_rounds_v3') {
        setUserRounds(loadUserRounds());
      }
      if (e.key === 'tc26_current_round_v2') {
        setCountRound(loadCountRound());
      }
      if (e.key === 'tc26_device_info_v4') {
        setDeviceInfo(loadDeviceInfo());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Determine the effective round for this terminal (individual user round has priority)
  const activeDeviceRound: CountRound = 
    deviceInfo.userNumber && userRounds[deviceInfo.userNumber]
      ? userRounds[deviceInfo.userNumber]
      : countRound;

  // Handheld check-in prompt:
  // In APK mode, if userNumber is not chosen/locked yet, or if round changed and name needs re-prompt
  useEffect(() => {
    if (userRole === 'OPERADOR_APK') {
      const needsInitialBinding = !deviceInfo.userNumber || !deviceInfo.isUserNumberLocked;
      const needsRoundReauth = Boolean(
        deviceInfo.userNumber && 
        deviceInfo.isUserNumberLocked && 
        deviceInfo.registeredRound && 
        deviceInfo.registeredRound !== activeDeviceRound && 
        activeDeviceRound !== 'CONTEO_FINALIZADO'
      );

      if (needsInitialBinding || needsRoundReauth) {
        setIsHandheldCheckInOpen(true);
      }
    }
  }, [userRole, deviceInfo, activeDeviceRound]);

  // Save new scan item
  const handleScanComplete = async (item: ScannedItem) => {
    const result = await syncScannedItem(item, powerAutomateConfig, supabaseConfig);

    const updatedItem: ScannedItem = {
      ...item,
      syncStateSharepoint: result.sharepointState,
      syncError: result.errorMessage,
    };

    setScans((prev) => {
      const next = [updatedItem, ...prev];
      saveScans(next);
      return next;
    });
  };

  // Gerente advances an individual user (1 to 10) to 2nd count, 3rd count or returns to 1st count
  const handleSetUserRound = (userNum: number, round: CountRound) => {
    const next = {
      ...userRounds,
      [userNum]: round,
    };
    setUserRounds(next);
    saveUserRounds(next);

    // If current device happens to be this user, update its registeredRound trigger
    if (deviceInfo.userNumber === userNum) {
      const updatedDev = { ...deviceInfo };
      setDeviceInfo(updatedDev);
      saveDeviceInfo(updatedDev);
    }
  };

  // Gerente advances or sets all users (1 to 10) to a round
  const handleSetAllUsersRound = (round: CountRound) => {
    const next: Record<number, CountRound> = {};
    for (let i = 1; i <= 10; i++) next[i] = round;
    setUserRounds(next);
    saveUserRounds(next);
    setCountRound(round);
    saveCountRound(round);
  };

  // Gerente authorizes new round globally or resets cycle
  const handleAuthorizeRound = (newRound: CountRound) => {
    setCountRound(newRound);
    saveCountRound(newRound);

    if (newRound === '1ER_CONTEO') {
      handleSetAllUsersRound('1ER_CONTEO');
      unlockUserNumberCycle();
      setDeviceInfo(loadDeviceInfo());
    } else if (newRound === '2DO_CONTEO') {
      handleSetAllUsersRound('2DO_CONTEO');
    } else if (newRound === '3ER_CONTEO') {
      handleSetAllUsersRound('3ER_CONTEO');
    } else if (newRound === 'CONTEO_FINALIZADO') {
      handleSetAllUsersRound('CONTEO_FINALIZADO');
    }
  };

  // Clear local history
  const handleClearHistory = () => {
    setScans([]);
    saveScans([]);
  };

  // Save Power Automate config
  const handleSavePowerAutomate = (cfg: PowerAutomateConfig) => {
    setPowerAutomateConfig(cfg);
    savePowerAutomateConfig(cfg);
  };

  // Save Supabase config
  const handleSaveSupabase = (cfg: SupabaseConfig) => {
    setSupabaseConfig(cfg);
    saveSupabaseConfig(cfg);
  };

  // Update Excel link directly from HistoryView
  const handleUpdateExcelLink = (newUrl: string) => {
    const updated = {
      ...powerAutomateConfig,
      excelFileDirectUrl: newUrl,
    };
    setPowerAutomateConfig(updated);
    savePowerAutomateConfig(updated);
  };

  const handleSaveDeviceInfo = (newInfo: DeviceInfo) => {
    setDeviceInfo(newInfo);
    saveDeviceInfo(newInfo);
  };

  // Handheld Initial Check-in (Name + User Number 1 to 10)
  const handleSaveCheckIn = (fullName: string, userNumber: number) => {
    const updated: DeviceInfo = {
      ...deviceInfo,
      operatorName: fullName,
      userNumber,
      isUserNumberLocked: true,
      registeredRound: activeDeviceRound,
    };
    setDeviceInfo(updated);
    saveDeviceInfo(updated);
    setIsHandheldCheckInOpen(false);
  };

  // Handheld Name Re-Prompt when round changed
  const handleConfirmNewRoundName = (fullName: string) => {
    const updated: DeviceInfo = {
      ...deviceInfo,
      operatorName: fullName,
      registeredRound: activeDeviceRound,
    };
    setDeviceInfo(updated);
    saveDeviceInfo(updated);
    setIsHandheldCheckInOpen(false);
  };

  // Gerente round 2 user authorization toggles
  const handleToggleUserRound2 = (userNum: number) => {
    const next = {
      ...round2Authorizations,
      [userNum]: !round2Authorizations[userNum],
    };
    setRound2Authorizations(next);
    saveRound2Authorizations(next);
  };

  const handleSetAllUsersRound2 = (enabled: boolean) => {
    const next: Record<number, boolean> = {};
    for (let i = 1; i <= 10; i++) next[i] = enabled;
    setRound2Authorizations(next);
    saveRound2Authorizations(next);
  };

  const roundCounts = {
    round1: scans.filter((s) => s.conteoRound === '1ER_CONTEO').length,
    round2: scans.filter((s) => s.conteoRound === '2DO_CONTEO').length,
    round3: scans.filter((s) => s.conteoRound === '3ER_CONTEO').length,
  };

  // Compute live device summaries for monitoring who is on Count 1 and who is on Count 2
  const deviceSummaries = computeDeviceSummaries(scans, deviceInfo, countRound, userRounds);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Minimalist Top Bar with Secret 12-Tap Trigger on App Logo */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        countRound={activeDeviceRound}
        onOpenMasterAuth={() => setIsMasterAuthOpen(true)}
        scansCount={scans.length}
        scans={scans}
        userRole={userRole}
        onSetUserRole={setUserRole}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {/* In OPERADOR_APK mode: ALWAYS render ScannerView */}
        {(activeTab === 'scanner' || userRole === 'OPERADOR_APK') && (
          <ScannerView
            onScanComplete={handleScanComplete}
            scans={scans}
            powerAutomateConfig={powerAutomateConfig}
            countRound={countRound}
            userRounds={userRounds}
            operatorName={deviceInfo.operatorName}
            userRole={userRole}
            deviceInfo={deviceInfo}
            round2Authorizations={round2Authorizations}
            onOpenDeviceSetup={() => setIsDeviceSetupOpen(true)}
            onOpenMasterAuth={() => setIsMasterAuthOpen(true)}
            onOpenPowerAutomate={() => setActiveTab('powerautomate')}
            onOpenCheckIn={() => setIsHandheldCheckInOpen(true)}
          />
        )}

        {/* Historial Excel is rendered for Gerente and Master */}
        {userRole !== 'OPERADOR_APK' && activeTab === 'history' && (
          <HistoryView
            scans={scans}
            powerAutomateConfig={powerAutomateConfig}
            onClearHistory={handleClearHistory}
            userRole={userRole}
            deviceSummaries={deviceSummaries}
            onUpdateExcelLink={handleUpdateExcelLink}
            currentRound={countRound}
            userRounds={userRounds}
            onAuthorizeRound={handleAuthorizeRound}
            onSetUserRound={handleSetUserRound}
            onSetAllUsersRound={handleSetAllUsersRound}
            scansCountInRound={roundCounts}
            round2Authorizations={round2Authorizations}
            onToggleUserRound2={handleToggleUserRound2}
            onSetAllUsersRound2={handleSetAllUsersRound2}
          />
        )}

        {/* Enlace SharePoint & Supabase is EXCLUSIVE to Master */}
        {userRole === 'MASTER' && activeTab === 'powerautomate' && (
          <PowerAutomateConfigView
            config={powerAutomateConfig}
            onSaveConfig={handleSavePowerAutomate}
            supabaseConfig={supabaseConfig}
            onSaveSupabase={handleSaveSupabase}
          />
        )}
      </main>

      {/* Master User Configurations Modal (SharePoint & Supabase ONLY, no rounds) */}
      <MasterAuthModal
        isOpen={isMasterAuthOpen}
        onClose={() => setIsMasterAuthOpen(false)}
        userRole={userRole}
        onSetUserRole={setUserRole}
        powerAutomateConfig={powerAutomateConfig}
        onSavePowerAutomate={handleSavePowerAutomate}
        supabaseConfig={supabaseConfig}
        onSaveSupabase={handleSaveSupabase}
      />

      {/* Handheld Device & Operator Setup Modal */}
      <DeviceSetupModal
        isOpen={isDeviceSetupOpen}
        onClose={() => setIsDeviceSetupOpen(false)}
        currentInfo={deviceInfo}
        onSave={handleSaveDeviceInfo}
      />

      {/* Handheld Check-in Modal (Full Name + User Number 1 to 10 Lock) */}
      <HandheldCheckInModal
        isOpen={isHandheldCheckInOpen}
        deviceInfo={deviceInfo}
        currentRound={activeDeviceRound}
        onSaveCheckIn={handleSaveCheckIn}
        onConfirmNewRoundName={handleConfirmNewRoundName}
      />
    </div>
  );
}
