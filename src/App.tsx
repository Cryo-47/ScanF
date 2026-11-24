import React, { useState, useEffect } from 'react';
import { 
  ScannedItem, 
  PowerAutomateConfig, 
  SupabaseConfig,
  CountRound,
  UserRole,
  DeviceInfo,
  DeviceStatusSummary
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
  isRunningInApkOrStandalone,
  loadLastAppliedResetTime,
  saveLastAppliedResetTime,
  loadLastAppliedRebootTime,
  saveLastAppliedRebootTime,
  normalizeRound
} from './utils/storage';
import { 
  syncScannedItem,
  pushTerminalPresence,
  fetchTerminalSessions,
  fetchCloudScans,
  pushScanToSupabase,
  deleteScanFromSupabase,
  deleteAllScansFromSupabase,
  pushRoundControl,
  fetchRoundControl,
  pushSharepointSettings,
  fetchSharepointSettings,
  deleteTerminalSession,
  clearAllTerminalSessions,
  sendDeviceRebootCommand,
  clearWebhookIdempotencyGuard
} from './utils/syncService';
import { canonicalizeLocator, normalizeLocator } from './utils/qrParser';
import { soundManager } from './utils/audioHaptics';
import { Header } from './components/Header';
import { ScannerView } from './components/ScannerView';
import { HistoryView } from './components/HistoryView';
import { PowerAutomateConfigView } from './components/PowerAutomateConfig';
import { MasterAuthModal } from './components/MasterAuthModal';
import { DeviceSetupModal } from './components/DeviceSetupModal';
import { HandheldCheckInModal } from './components/HandheldCheckInModal';
import { QuickGuideModal } from './components/QuickGuideModal';

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
  const [isQuickGuideOpen, setIsQuickGuideOpen] = useState(false);
  const [handheldRebootNotice, setHandheldRebootNotice] = useState<string | null>(null);

  // Cloud terminal sessions from Supabase
  const [cloudTerminalSessions, setCloudTerminalSessions] = useState<DeviceStatusSummary[]>([]);
  const deletedScanIdsRef = React.useRef<Set<string>>(new Set());
  const dispatchedScanKeysRef = React.useRef<Set<string>>(new Set());
  const deviceInfoRef = React.useRef<DeviceInfo>(deviceInfo);
  const activeDeviceRoundRef = React.useRef<CountRound>('1ER_CONTEO');

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

  deviceInfoRef.current = deviceInfo;
  activeDeviceRoundRef.current = activeDeviceRound;

  const getLocatorRoundKey = (round: CountRound | string | undefined, loc: string | undefined) => {
    const normRound = normalizeRound(round);
    const canon = canonicalizeLocator(loc) || normalizeLocator(loc);
    return canon ? `${normRound}::${canon}` : '';
  };

  // Helper: calculate real stats belonging ONLY to this terminal/user (prevents global scan bleed in live monitoring)
  const getTerminalOwnStats = (allScans: ScannedItem[], devInfo: DeviceInfo) => {
    if (!devInfo.userNumber) {
      return { totalScans: 0, totalPieces: 0, lastSku: undefined, lastLocator: undefined };
    }
    const userLabel = `Usuario ${devInfo.userNumber}`;
    const ownScans = allScans.filter(
      (s) =>
        (!s.sku || !s.sku.startsWith('TEST-SKU')) &&
        (s.userNumber === devInfo.userNumber || s.operador === userLabel)
    );
    const latestOwnScan = ownScans[0];
    return {
      totalScans: ownScans.length,
      totalPieces: ownScans.reduce((acc, s) => acc + (Number(s.cantidad) || 0), 0),
      lastSku: latestOwnScan?.sku,
      lastLocator: latestOwnScan?.localizador,
    };
  };

  // 1. PRESENCE HEARTBEAT: Sends active terminal status to Supabase so Gerente sees it in real time
  useEffect(() => {
    if (!deviceInfo.userNumber || !supabaseConfig.isEnabled) return;

    const sendHeartbeat = () => {
      const ownStats = getTerminalOwnStats(scans, deviceInfo);
      pushTerminalPresence(
        deviceInfo,
        activeDeviceRound,
        ownStats,
        supabaseConfig
      );
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 15000);

    // If screen turns back on or user switches back to the app, ping immediately
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // If user closes the app, set status to offline if deviceId is known
    const handleUnload = () => {
      if (deviceInfo.deviceId && supabaseConfig.url && supabaseConfig.anonKey) {
        try {
          const endpoint = `${supabaseConfig.url.replace(/\/+$/, '')}/rest/v1/terminal_sessions?device_id=eq.${encodeURIComponent(deviceInfo.deviceId)}`;
          const payload = JSON.stringify({ status: 'offline', updated_at: new Date().toISOString() });
          if (navigator.sendBeacon) {
            navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }));
          }
        } catch {}
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [deviceInfo, activeDeviceRound, scans, supabaseConfig]);

  // 2. CLOUD LIVE SYNC POLLING: Fetches terminal sessions, cloud scans, and round control from Supabase
  useEffect(() => {
    let isMounted = true;

    const syncCloudData = async () => {
      if (!supabaseConfig.isEnabled || !supabaseConfig.url || !supabaseConfig.anonKey) {
        return;
      }

      let isResetTriggered = false;

      // 1. Fetch round control & check for global or user reset / reboot commands from Gerencia
      try {
        const control = await fetchRoundControl(supabaseConfig);
        if (isMounted && control) {
          const lastAppliedReset = loadLastAppliedResetTime();
          const lastAppliedReboot = loadLastAppliedRebootTime();

          // A) DEVICE REBOOT / FORCE RE-LOGIN CHECK (Forces operator check-in screen & 1er Conteo)
          let shouldForceReboot = false;
          let rebootTimestamp = '';

          // Global device reboot command from Gerente
          if (control.deviceRebootAt) {
            const isNewer = !lastAppliedReboot || new Date(control.deviceRebootAt).getTime() > new Date(lastAppliedReboot).getTime();
            if (isNewer) {
              shouldForceReboot = true;
              rebootTimestamp = control.deviceRebootAt;
            }
          }

          const currentDevInfo = deviceInfoRef.current;
          const currentActiveRound = activeDeviceRoundRef.current;

          // Individual user reboot command (e.g. Gerente clicked Re-login on Usuario 2)
          if (!shouldForceReboot && control.userReboots && currentDevInfo.userNumber && control.userReboots[String(currentDevInfo.userNumber)]) {
            const userRebootTime = control.userReboots[String(currentDevInfo.userNumber)];
            const isNewer = !lastAppliedReboot || new Date(userRebootTime).getTime() > new Date(lastAppliedReboot).getTime();
            if (isNewer) {
              shouldForceReboot = true;
              rebootTimestamp = userRebootTime;
            }
          }

          if (shouldForceReboot) {
            isResetTriggered = true;
            saveLastAppliedRebootTime(rebootTimestamp);
            saveLastAppliedResetTime(rebootTimestamp);
            soundManager.playWarning();
            setScans([]);
            saveScans([]);
            deletedScanIdsRef.current.clear();
            dispatchedScanKeysRef.current.clear();
            clearWebhookIdempotencyGuard();
            setCountRound('1ER_CONTEO');
            saveCountRound('1ER_CONTEO');
            unlockUserNumberCycle(true);
            const freshDev = loadDeviceInfo();
            setDeviceInfo(freshDev);
            setHandheldRebootNotice(
              'Gerencia ha reiniciado los dispositivos para comenzar una nueva prueba. Ingresa tu nombre y selecciona tu usuario (1 al 14).'
            );
            setIsHandheldCheckInOpen(true);
            if (supabaseConfig.isEnabled) {
              pushTerminalPresence(
                freshDev,
                '1ER_CONTEO',
                { totalScans: 0, totalPieces: 0 },
                supabaseConfig
              ).catch(() => {});
            }
          }

          // B) NORMAL RESET CHECK (Clears scans without resetting operator binding if not rebooted)
          if (!shouldForceReboot && control.globalResetAt) {
            const isNewer = !lastAppliedReset || new Date(control.globalResetAt).getTime() > new Date(lastAppliedReset).getTime();
            if (isNewer) {
              isResetTriggered = true;
              saveLastAppliedResetTime(control.globalResetAt);
              setScans([]);
              saveScans([]);
              deletedScanIdsRef.current.clear();
              dispatchedScanKeysRef.current.clear();
              clearWebhookIdempotencyGuard();
              if (currentDevInfo.userNumber) {
                pushTerminalPresence(
                  currentDevInfo,
                  currentActiveRound,
                  { totalScans: 0, totalPieces: 0 },
                  supabaseConfig
                ).catch(() => {});
              }
            }
          }

          if (!shouldForceReboot && !isResetTriggered && control.userResets && currentDevInfo.userNumber && control.userResets[currentDevInfo.userNumber]) {
            const userResetTime = control.userResets[currentDevInfo.userNumber];
            const isNewer = !lastAppliedReset || new Date(userResetTime).getTime() > new Date(lastAppliedReset).getTime();
            if (isNewer) {
              isResetTriggered = true;
              saveLastAppliedResetTime(userResetTime);
              setScans([]);
              saveScans([]);
              deletedScanIdsRef.current.clear();
              dispatchedScanKeysRef.current.clear();
              clearWebhookIdempotencyGuard();
              if (currentDevInfo.userNumber) {
                pushTerminalPresence(
                  currentDevInfo,
                  currentActiveRound,
                  { totalScans: 0, totalPieces: 0 },
                  supabaseConfig
                ).catch(() => {});
              }
            }
          }

          // C) Global round synchronization
          if (control.globalRound && control.globalRound !== countRound) {
            setCountRound(control.globalRound);
            saveCountRound(control.globalRound);
            if (control.globalRound === 'CONTEO_FINALIZADO') {
              unlockUserNumberCycle(false);
              setDeviceInfo(loadDeviceInfo());
            }
          }

          // D) Individual user rounds synchronization (Gerente assignment takes precedence)
          if (control.userRounds && Object.keys(control.userRounds).length > 0) {
            setUserRounds(control.userRounds);
            saveUserRounds(control.userRounds);

            // If handheld is assigned to a user number, guarantee local round matches server assignment
            const curDev = deviceInfoRef.current;
            const curRound = activeDeviceRoundRef.current;
            if (curDev.userNumber && control.userRounds[curDev.userNumber]) {
              const serverUserRound = control.userRounds[curDev.userNumber];
              if (serverUserRound !== curRound) {
                setCountRound(serverUserRound);
                saveCountRound(serverUserRound);
              }
            }
          }

          if (control.authorizations && Object.keys(control.authorizations).length > 0) {
            setRound2Authorizations(control.authorizations);
            saveRound2Authorizations(control.authorizations);
          }
        }
      } catch {
        // ignore
      }

      // 2. Fetch live terminal sessions
      try {
        const remoteSessions = await fetchTerminalSessions(supabaseConfig);
        if (isMounted) {
          setCloudTerminalSessions(remoteSessions);

          const curDev = deviceInfoRef.current;
          const curRound = activeDeviceRoundRef.current;

          // If current handheld is registered, check if its session was marked 'force_relogin' or 'reset'
          if (!isResetTriggered && (curDev.userNumber || curDev.deviceId)) {
            const mySession = remoteSessions.find(
              (s) => (curDev.userNumber && s.userNumber === curDev.userNumber) || s.deviceId === curDev.deviceId
            );
            if (mySession && (mySession.status === 'force_relogin' || mySession.status === 'reset')) {
              isResetTriggered = true;
              const nowIso = new Date().toISOString();
              saveLastAppliedResetTime(nowIso);
              saveLastAppliedRebootTime(nowIso);
              setScans([]);
              saveScans([]);
              deletedScanIdsRef.current.clear();
              dispatchedScanKeysRef.current.clear();
              clearWebhookIdempotencyGuard();
              setCountRound('1ER_CONTEO');
              saveCountRound('1ER_CONTEO');

              if (mySession.status === 'force_relogin') {
                soundManager.playWarning();
                unlockUserNumberCycle(true);
                const freshDev = loadDeviceInfo();
                setDeviceInfo(freshDev);
                setHandheldRebootNotice(
                  'Gerencia ha reiniciado este dispositivo. Ingresa tu nombre y selecciona tu usuario (1 al 14).'
                );
                setIsHandheldCheckInOpen(true);
                pushTerminalPresence(
                  freshDev,
                  '1ER_CONTEO',
                  { totalScans: 0, totalPieces: 0 },
                  supabaseConfig
                ).catch(() => {});
              } else {
                pushTerminalPresence(
                  curDev,
                  curRound,
                  { totalScans: 0, totalPieces: 0 },
                  supabaseConfig
                ).catch(() => {});
              }
            }
          }
        }
      } catch {
        // ignore
      }

      // 3. Fetch cloud scans and sync authoritatively to local state
      // IMPORTANT: Never overwrite local scans if fetchCloudScans returns null (network/HTTP error)
      if (!isResetTriggered) {
        try {
          const rawRemoteScans = await fetchCloudScans(supabaseConfig);
          if (isMounted && rawRemoteScans !== null) {
            const remoteScans = rawRemoteScans.filter(
              (s) => (!s.sku || !s.sku.startsWith('TEST-SKU')) && !deletedScanIdsRef.current.has(s.id)
            );

            setScans((prev) => {
              const map = new Map<string, ScannedItem>();

              // 1. Authoritative cloud scans from Supabase
              for (const remote of remoteScans) {
                if (!deletedScanIdsRef.current.has(remote.id)) {
                  map.set(remote.id, remote);
                }
              }

              // 2. Preserve local in-flight or recent scans (< 5 min old) not yet in Supabase;
              //    if an older synced scan was deleted by Gerente in Supabase, also release its local idempotency key.
              const nowMs = Date.now();
              for (const local of prev) {
                if (deletedScanIdsRef.current.has(local.id)) continue;
                if (!map.has(local.id)) {
                  const scanAgeMs = nowMs - new Date(local.timestamp).getTime();
                  const isRecentOrPending =
                    local.syncStateSharepoint === 'pending' ||
                    isNaN(scanAgeMs) ||
                    scanAgeMs < 5 * 60 * 1000;
                  if (isRecentOrPending && (!local.sku || !local.sku.startsWith('TEST-SKU'))) {
                    map.set(local.id, local);
                  } else {
                    const lrKey = getLocatorRoundKey(local.conteoRound, local.localizador);
                    if (lrKey) dispatchedScanKeysRef.current.delete(lrKey);
                    dispatchedScanKeysRef.current.delete(local.id);
                    clearWebhookIdempotencyGuard(local.id, local.conteoRound, local.localizador);
                  }
                }
              }

              const merged = Array.from(map.values()).sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              );
              saveScans(merged);
              return merged;
            });
          }
        } catch {
          // ignore
        }
      }

      // Fetch SharePoint / Power Automate settings from Supabase
      try {
        const remoteSharepoint = await fetchSharepointSettings(supabaseConfig);
        if (isMounted && remoteSharepoint && remoteSharepoint.webhookUrl) {
          setPowerAutomateConfig((prev) => {
            if (
              prev.webhookUrl !== remoteSharepoint.webhookUrl ||
              prev.excelFileDirectUrl !== remoteSharepoint.excelFileDirectUrl
            ) {
              const merged: PowerAutomateConfig = {
                ...prev,
                ...remoteSharepoint,
                webhookUrl: remoteSharepoint.webhookUrl || prev.webhookUrl,
              };
              savePowerAutomateConfig(merged);
              return merged;
            }
            return prev;
          });
        }
      } catch {
        // ignore
      }
    };

    syncCloudData();
    const pollInterval = setInterval(syncCloudData, 4000);
    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [supabaseConfig, countRound]);

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

  // Save new scan item (Optimistic & non-blocking for rapid scanning and multi-device concurrency)
  const handleScanComplete = async (item: ScannedItem) => {
    const locRoundKey = getLocatorRoundKey(item.conteoRound, item.localizador);

    // Synchronous idempotency guard: prevent double submission of the same scan ID or round+locator
    if (
      dispatchedScanKeysRef.current.has(item.id) ||
      (locRoundKey && dispatchedScanKeysRef.current.has(locRoundKey))
    ) {
      return;
    }
    dispatchedScanKeysRef.current.add(item.id);
    if (locRoundKey) {
      dispatchedScanKeysRef.current.add(locRoundKey);
    }

    // 1. Optimistic immediate local save - returns in < 5ms, avoiding UI freezes
    const pendingItem: ScannedItem = {
      ...item,
      syncStateSharepoint: powerAutomateConfig.isEnabled && powerAutomateConfig.webhookUrl ? 'pending' : 'simulated',
    };

    setScans((prev) => {
      if (prev.some((s) => s.id === pendingItem.id)) return prev;
      const next = [pendingItem, ...prev];
      saveScans(next);
      return next;
    });

    // 2. Immediate local presence update (strictly scoped to this terminal's user)
    if (deviceInfo.userNumber) {
      const ownStats = getTerminalOwnStats([pendingItem, ...scans], deviceInfo);
      pushTerminalPresence(
        deviceInfo,
        activeDeviceRound,
        {
          totalScans: ownStats.totalScans,
          totalPieces: ownStats.totalPieces,
          lastSku: item.sku,
          lastLocator: item.localizador,
        },
        supabaseConfig
      ).catch(() => {});
    }

    // 3. Background asynchronous sync (SharePoint + Supabase) without blocking scanner
    (async () => {
      try {
        const result = await syncScannedItem(item, powerAutomateConfig, supabaseConfig);
        setScans((prev) => {
          const next = prev.map((s) =>
            s.id === item.id
              ? {
                  ...s,
                  syncStateSharepoint: result.sharepointState,
                  syncError: result.errorMessage,
                }
              : s
          );
          saveScans(next);
          return next;
        });
      } catch (err: any) {
        setScans((prev) => {
          const next: ScannedItem[] = prev.map((s) =>
            s.id === item.id
              ? {
                  ...s,
                  syncStateSharepoint: 'failed' as const,
                  syncError: err?.message || 'Error de sincronización',
                }
              : s
          );
          saveScans(next);
          return next;
        });
      }
    })();
  };

  // Gerente advances an individual user (1 to 10) to 2nd count, 3rd count or returns to 1st count
  const handleSetUserRound = (userNum: number, round: CountRound) => {
    const next = {
      ...userRounds,
      [userNum]: round,
    };
    setUserRounds(next);
    saveUserRounds(next);

    // Synchronize cloud terminal sessions immediately in UI so live monitoring reflects the change
    setCloudTerminalSessions((prev) =>
      prev.map((s) => (s.userNumber === userNum ? { ...s, currentRound: round } : s))
    );

    // If current device happens to be this user, update its registeredRound trigger
    if (deviceInfo.userNumber === userNum) {
      const updatedDev = { ...deviceInfo, registeredRound: round };
      setDeviceInfo(updatedDev);
      saveDeviceInfo(updatedDev);
    }

    // Sync round control to Supabase
    pushRoundControl(countRound, next, round2Authorizations, supabaseConfig);
  };

  // Gerente advances or sets all users (1 to 14) to a round
  const handleSetAllUsersRound = (round: CountRound) => {
    const next: Record<number, CountRound> = {};
    for (let i = 1; i <= 14; i++) next[i] = round;
    setUserRounds(next);
    saveUserRounds(next);
    setCountRound(round);
    saveCountRound(round);

    // Synchronize all cloud terminal sessions immediately
    setCloudTerminalSessions((prev) =>
      prev.map((s) => ({ ...s, currentRound: round }))
    );

    if (deviceInfo.userNumber) {
      const updatedDev = { ...deviceInfo, registeredRound: round };
      setDeviceInfo(updatedDev);
      saveDeviceInfo(updatedDev);
    }

    pushRoundControl(round, next, round2Authorizations, supabaseConfig);
  };

  // Gerente authorizes new round globally or resets cycle
  const handleAuthorizeRound = (newRound: CountRound) => {
    setCountRound(newRound);
    saveCountRound(newRound);

    let nextUserRounds = { ...userRounds };
    if (newRound === '1ER_CONTEO') {
      for (let i = 1; i <= 14; i++) nextUserRounds[i] = '1ER_CONTEO';
      setUserRounds(nextUserRounds);
      saveUserRounds(nextUserRounds);
      unlockUserNumberCycle();
      setDeviceInfo(loadDeviceInfo());
    } else if (newRound === '2DO_CONTEO') {
      for (let i = 1; i <= 14; i++) nextUserRounds[i] = '2DO_CONTEO';
      setUserRounds(nextUserRounds);
      saveUserRounds(nextUserRounds);
    } else if (newRound === '3ER_CONTEO') {
      for (let i = 1; i <= 14; i++) nextUserRounds[i] = '3ER_CONTEO';
      setUserRounds(nextUserRounds);
      saveUserRounds(nextUserRounds);
    } else if (newRound === 'CONTEO_FINALIZADO') {
      for (let i = 1; i <= 14; i++) nextUserRounds[i] = 'CONTEO_FINALIZADO';
      setUserRounds(nextUserRounds);
      saveUserRounds(nextUserRounds);
      unlockUserNumberCycle();
      setDeviceInfo(loadDeviceInfo());
    }

    pushRoundControl(newRound, nextUserRounds, round2Authorizations, supabaseConfig);
  };

  // Clear local history
  const handleClearHistory = () => {
    setScans([]);
    saveScans([]);
  };

  // Save Power Automate config
  const handleSavePowerAutomate = async (cfg: PowerAutomateConfig) => {
    setPowerAutomateConfig(cfg);
    savePowerAutomateConfig(cfg);
    await pushSharepointSettings(cfg, supabaseConfig);
  };

  // Save Supabase config
  const handleSaveSupabase = (cfg: SupabaseConfig) => {
    setSupabaseConfig(cfg);
    saveSupabaseConfig(cfg);
  };

  // Sync / backup all local scans to Supabase
  const handleSyncAllScansToSupabase = async (): Promise<number> => {
    if (!supabaseConfig.isEnabled || !supabaseConfig.url || !supabaseConfig.anonKey) {
      throw new Error('Supabase no está configurado o habilitado');
    }
    let count = 0;
    for (const scan of scans) {
      const ok = await pushScanToSupabase(scan, supabaseConfig);
      if (ok) count++;
    }
    return count;
  };

  // Delete a single scan from Supabase (Gerente and Master)
  const handleDeleteScanFromSupabase = async (scanId: string): Promise<boolean> => {
    if (userRole !== 'MASTER' && userRole !== 'GERENTE') {
      throw new Error('Solo los usuarios autorizados (Gerente o Master) pueden eliminar registros de Supabase.');
    }
    deletedScanIdsRef.current.add(scanId);
    const targetScan = scans.find((s) => s.id === scanId);
    dispatchedScanKeysRef.current.delete(scanId);
    if (targetScan) {
      const lrKey = getLocatorRoundKey(targetScan.conteoRound, targetScan.localizador);
      if (lrKey) dispatchedScanKeysRef.current.delete(lrKey);
      clearWebhookIdempotencyGuard(scanId, targetScan.conteoRound, targetScan.localizador);
    } else {
      clearWebhookIdempotencyGuard(scanId);
    }

    const ok = await deleteScanFromSupabase(scanId, supabaseConfig);
    if (ok) {
      setScans((prev) => {
        const next = prev.filter((s) => s.id !== scanId);
        saveScans(next);
        return next;
      });
    }
    return ok;
  };

  // Delete all scans from Supabase (Gerente and Master)
  const handleDeleteAllScansFromSupabase = async (): Promise<boolean> => {
    if (userRole !== 'MASTER' && userRole !== 'GERENTE') {
      throw new Error('Solo los usuarios autorizados (Gerente o Master) pueden eliminar registros de Supabase.');
    }
    const nowIso = new Date().toISOString();
    saveLastAppliedResetTime(nowIso);
    deletedScanIdsRef.current.clear();
    dispatchedScanKeysRef.current.clear();
    clearWebhookIdempotencyGuard();
    setScans([]);
    saveScans([]);

    // 1. Delete all records from inventory_scans table in Supabase
    const ok = await deleteAllScansFromSupabase(supabaseConfig);

    // 2. Broadcast global reset to inventory_round_control so all connected handhelds clear local caches
    await pushRoundControl(countRound, userRounds, round2Authorizations, supabaseConfig, {
      globalResetAt: nowIso,
    });

    // 3. Clear live terminal sessions in Supabase and locally
    await clearAllTerminalSessions(supabaseConfig);
    setCloudTerminalSessions([]);

    // 4. If current device is bound to an operator, ping reset with 0 counts
    if (deviceInfo.userNumber) {
      pushTerminalPresence(
        deviceInfo,
        activeDeviceRound,
        { totalScans: 0, totalPieces: 0 },
        supabaseConfig
      ).catch(() => {});
    }

    return ok;
  };

  // Refresh scans and live terminal sessions directly from Supabase
  const handleRefreshCloudScans = async (): Promise<number> => {
    if (!supabaseConfig.isEnabled || !supabaseConfig.url || !supabaseConfig.anonKey) {
      throw new Error('Supabase no está configurado o habilitado');
    }
    deletedScanIdsRef.current.clear();
    const rawRemoteScans = await fetchCloudScans(supabaseConfig);
    if (rawRemoteScans === null) {
      throw new Error('No se pudo conectar con Supabase en este momento. Se conservan los escaneos locales.');
    }
    const remoteScans = rawRemoteScans.filter((s) => !s.sku || !s.sku.startsWith('TEST-SKU'));

    setScans((prev) => {
      const map = new Map<string, ScannedItem>();
      for (const s of remoteScans) map.set(s.id, s);
      for (const s of prev) {
        if (!map.has(s.id) && (!s.sku || !s.sku.startsWith('TEST-SKU')) && !deletedScanIdsRef.current.has(s.id)) {
          map.set(s.id, s);
        }
      }
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      saveScans(merged);
      return merged;
    });

    const sessions = await fetchTerminalSessions(supabaseConfig);
    setCloudTerminalSessions(sessions);
    return remoteScans.length;
  };

  // Delete single terminal session from live monitoring board ONLY (does not wipe scans or force logout)
  const handleDeleteTerminalSession = async (deviceId: string): Promise<boolean> => {
    const ok = await deleteTerminalSession(deviceId, supabaseConfig);
    if (ok) {
      setCloudTerminalSessions((prev) =>
        prev.filter((d) => d.deviceId !== deviceId && String(d.userNumber) !== deviceId)
      );
    }
    return ok;
  };

  // Clear all terminal sessions from live monitoring board ONLY (does not wipe scans or force re-login)
  const handleClearAllTerminalSessions = async (): Promise<boolean> => {
    const ok = await clearAllTerminalSessions(supabaseConfig);
    if (ok) {
      setCloudTerminalSessions([]);
    }
    return ok;
  };

  // Remote reboot / force re-login for an individual user terminal (1 to 10)
  const handleResetUserDevice = async (userNumber: number): Promise<void> => {
    // 1. If the current device happens to be this user, execute local logout immediately
    if (deviceInfo.userNumber === userNumber) {
      soundManager.playWarning();
      unlockUserNumberCycle(true);
      const freshDev = loadDeviceInfo();
      setDeviceInfo(freshDev);
      dispatchedScanKeysRef.current.clear();
      clearWebhookIdempotencyGuard();
      setScans([]);
      saveScans([]);
      setCountRound('1ER_CONTEO');
      saveCountRound('1ER_CONTEO');
      setHandheldRebootNotice('Has cerrado sesión. Ingresa tu nombre y selecciona tu usuario (1 al 14).');
      setIsHandheldCheckInOpen(true);
    }

    // 2. Broadcast reboot order via Supabase to target handheld
    if (supabaseConfig.isEnabled && supabaseConfig.url && supabaseConfig.anonKey) {
      await sendDeviceRebootCommand(userNumber, supabaseConfig);
      // Immediately refresh live sessions
      try {
        const freshSessions = await fetchTerminalSessions(supabaseConfig);
        setCloudTerminalSessions(freshSessions);
      } catch {}
    }
  };

  // Remote reboot / force re-login for ALL handhelds (resets to 1er conteo and forces re-login)
  const handleResetAllDevices = async (): Promise<void> => {
    // 1. If running as operator, reset locally
    if (userRole === 'OPERADOR_APK' || deviceInfo.userNumber) {
      soundManager.playWarning();
      unlockUserNumberCycle(true);
      const freshDev = loadDeviceInfo();
      setDeviceInfo(freshDev);
      dispatchedScanKeysRef.current.clear();
      clearWebhookIdempotencyGuard();
      setScans([]);
      saveScans([]);
      setCountRound('1ER_CONTEO');
      saveCountRound('1ER_CONTEO');
      setHandheldRebootNotice('Gerencia ha reiniciado todas las terminales. Ingresa tu nombre y selecciona tu usuario (1 al 14).');
      setIsHandheldCheckInOpen(true);
    }

    // 2. Broadcast global reboot order via Supabase
    if (supabaseConfig.isEnabled && supabaseConfig.url && supabaseConfig.anonKey) {
      await sendDeviceRebootCommand(undefined, supabaseConfig);
      try {
        const freshSessions = await fetchTerminalSessions(supabaseConfig);
        setCloudTerminalSessions(freshSessions);
      } catch {}
    }
  };

  // Update Excel link directly from HistoryView
  const handleUpdateExcelLink = (newUrl: string) => {
    const updated = {
      ...powerAutomateConfig,
      excelFileDirectUrl: newUrl,
    };
    setPowerAutomateConfig(updated);
    savePowerAutomateConfig(updated);
    pushSharepointSettings(updated, supabaseConfig);
  };

  const handleSaveDeviceInfo = (newInfo: DeviceInfo) => {
    setDeviceInfo(newInfo);
    saveDeviceInfo(newInfo);
  };

  // Handheld Initial Check-in (Name + User Number 1 to 10)
  const handleSaveCheckIn = async (fullName: string, userNumber: number) => {
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

    // Immediately push presence to Supabase so Gerente sees it in real time
    const ownStats = getTerminalOwnStats(scans, updated);
    await pushTerminalPresence(
      updated,
      activeDeviceRound,
      ownStats,
      supabaseConfig
    );
  };

  // Handheld Name Re-Prompt when round changed
  const handleConfirmNewRoundName = async (fullName: string) => {
    const updated: DeviceInfo = {
      ...deviceInfo,
      operatorName: fullName,
      registeredRound: activeDeviceRound,
    };
    setDeviceInfo(updated);
    saveDeviceInfo(updated);
    setIsHandheldCheckInOpen(false);

    const ownStats = getTerminalOwnStats(scans, updated);
    await pushTerminalPresence(
      updated,
      activeDeviceRound,
      ownStats,
      supabaseConfig
    );
  };

  // Gerente round 2 user authorization toggles
  const handleToggleUserRound2 = (userNum: number) => {
    const next = {
      ...round2Authorizations,
      [userNum]: !round2Authorizations[userNum],
    };
    setRound2Authorizations(next);
    saveRound2Authorizations(next);

    pushRoundControl(countRound, userRounds, next, supabaseConfig);
  };

  const handleSetAllUsersRound2 = (enabled: boolean) => {
    const next: Record<number, boolean> = {};
    for (let i = 1; i <= 14; i++) next[i] = enabled;
    setRound2Authorizations(next);
    saveRound2Authorizations(next);

    pushRoundControl(countRound, userRounds, next, supabaseConfig);
  };

  // Compute live device summaries for monitoring who is on Count 1 and who is on Count 2
  // Merges local device state, local scans, and cloud terminal sessions from Supabase
  const deviceSummaries = computeDeviceSummaries(
    scans,
    deviceInfo,
    countRound,
    userRounds,
    cloudTerminalSessions
  );

  // Scans from individual records stored in inventory_scans / local storage
  const validScans = scans.filter((s) => s.sku !== 'TEST-SKU');
  const itemizedRound1 = validScans.filter((s) => normalizeRound(s.conteoRound) === '1ER_CONTEO').length;
  const itemizedRound2 = validScans.filter((s) => normalizeRound(s.conteoRound) === '2DO_CONTEO').length;
  const itemizedRound3 = validScans.filter((s) => normalizeRound(s.conteoRound) === '3ER_CONTEO').length;
  const totalItemized = itemizedRound1 + itemizedRound2 + itemizedRound3;

  const totalTerminalScans = deviceSummaries.reduce((sum, d) => sum + (d.totalScans || 0), 0);

  // Exact round count distribution strictly derived from itemized records:
  // When records are deleted from Supabase, all rounds immediately drop to 0
  const roundCounts = {
    round1: itemizedRound1,
    round2: itemizedRound2,
    round3: itemizedRound3,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Minimalist Top Bar with Secret 12-Tap Trigger on App Logo */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        countRound={activeDeviceRound}
        onOpenMasterAuth={() => setIsMasterAuthOpen(true)}
        onOpenQuickGuide={() => setIsQuickGuideOpen(true)}
        scansCount={scans.length}
        scans={scans}
        userRole={userRole}
        onSetUserRole={setUserRole}
      />

      {/* Main Container */}
      <main className={`flex-1 w-full mx-auto p-3 sm:p-6 transition-all ${activeTab === 'history' ? 'max-w-7xl' : 'max-w-5xl'}`}>
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
            supabaseConfig={supabaseConfig}
            onOpenDeviceSetup={() => setIsDeviceSetupOpen(true)}
            onOpenMasterAuth={() => setIsMasterAuthOpen(true)}
            onOpenPowerAutomate={() => setActiveTab('powerautomate')}
            onOpenCheckIn={() => setIsHandheldCheckInOpen(true)}
          />
        )}

        {/* Historial Excel is rendered for Gerente and Master (Web only, never in APK) */}
        {userRole !== 'OPERADOR_APK' && !isRunningInApkOrStandalone() && activeTab === 'history' && (
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
            onDeleteScanFromSupabase={handleDeleteScanFromSupabase}
            onDeleteAllScansFromSupabase={handleDeleteAllScansFromSupabase}
            onRefreshCloudScans={handleRefreshCloudScans}
            onDeleteTerminalSession={handleDeleteTerminalSession}
            onClearAllTerminalSessions={handleClearAllTerminalSessions}
            onResetUserDevice={handleResetUserDevice}
            onResetAllDevices={handleResetAllDevices}
          />
        )}

        {/* Enlace SharePoint & Supabase is EXCLUSIVE to Master */}
        {userRole === 'MASTER' && !isRunningInApkOrStandalone() && activeTab === 'powerautomate' && (
          <PowerAutomateConfigView
            config={powerAutomateConfig}
            onSaveConfig={handleSavePowerAutomate}
            supabaseConfig={supabaseConfig}
            onSaveSupabase={handleSaveSupabase}
            onSyncAllToSupabase={handleSyncAllScansToSupabase}
            scansCount={scans.length}
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
        onSyncAllToSupabase={handleSyncAllScansToSupabase}
        scansCount={scans.length}
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
        cloudTerminalSessions={cloudTerminalSessions}
        scans={scans}
        supabaseConfig={supabaseConfig}
      />

      {/* Quick Operational Guide Modal (?) */}
      <QuickGuideModal
        isOpen={isQuickGuideOpen}
        onClose={() => setIsQuickGuideOpen(false)}
        userRole={userRole}
        activeTab={activeTab}
      />
    </div>
  );
}
