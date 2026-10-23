import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle, CloudCheck, ArrowUpCircle } from 'lucide-react';
import { api } from '../services/api';

export default function OfflineSyncBanner({ onSyncComplete }) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const checkPending = useCallback(async () => {
    try {
      const count = await api.getPendingOfflineCount();
      setPendingCount(count);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const handleSyncNow = useCallback(async () => {
    if (syncing || !isOnline) return;
    try {
      setSyncing(true);
      const res = await api.syncPendingOrders();
      setLastSyncResult(res);
      await checkPending();
      if (onSyncComplete) onSyncComplete(res);

      setTimeout(() => {
        setLastSyncResult(null);
      }, 5000);
    } catch (err) {
      console.error('Manual sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }, [syncing, isOnline, checkPending, onSyncComplete]);

  useEffect(() => {
    checkPending();

    const handleOnline = () => {
      setIsOnline(true);
      checkPending();
      // Auto-trigger sync when network reconnects
      setTimeout(() => {
        handleSyncNow();
      }, 1500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setDismissed(false);
      checkPending();
    };

    const handleOrderSaved = () => {
      checkPending();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('ms_store_offline_order_saved', handleOrderSaved);

    const interval = setInterval(checkPending, 8000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('ms_store_offline_order_saved', handleOrderSaved);
      clearInterval(interval);
    };
  }, [checkPending, handleSyncNow]);

  // If online, no pending orders, and no recent sync result, don't show intrusive banner
  if (isOnline && pendingCount === 0 && !lastSyncResult) {
    return null;
  }

  if (dismissed && isOnline) {
    return null;
  }

  return (
    <aside aria-label="Offline and Synchronization Status" className="no-print w-full z-30 transition-all duration-300">
      {/* 1. Offline Mode Active Notice */}
      {!isOnline && (
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 text-white px-4 py-2.5 shadow-lg border-b border-amber-500/40">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1 rounded-full bg-black/20 animate-pulse">
                <WifiOff className="w-4 h-4 text-amber-200" />
              </div>
              <div>
                <span className="font-extrabold uppercase tracking-wider text-[11px] bg-black/30 px-2 py-0.5 rounded-full mr-2">
                  Offline Mode Active
                </span>
                <span className="text-amber-100 font-medium">
                  Internet connection dropped. Zero downtime: POS scanning, billing, local stock deduction & receipt printing are running smoothly.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="bg-black/30 px-2.5 py-1 rounded-lg text-[11px] font-bold text-amber-200 font-mono">
                {pendingCount} offline {pendingCount === 1 ? 'bill' : 'bills'} queued
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Online with Pending Orders to Sync */}
      {isOnline && pendingCount > 0 && (
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 border-b border-indigo-500/50 text-indigo-100 px-4 py-2.5 shadow-xl animate-fadeIn">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-400">
                <ArrowUpCircle className="w-4 h-4 animate-bounce" />
              </div>
              <div>
                <span className="font-bold text-white">Back Online!</span>{' '}
                <span>
                  You have <strong className="text-amber-400 font-mono">{pendingCount}</strong> offline {pendingCount === 1 ? 'sale' : 'sales'} stored locally waiting to sync to the cloud database.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={syncing}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center gap-2 shadow-md shadow-indigo-600/30 text-xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing Sales...' : 'Sync to Cloud Now'}</span>
              </button>

              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="text-slate-400 hover:text-white px-2 py-1 text-xs rounded hover:bg-slate-800 transition"
                title="Dismiss banner"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Success Notification after Sync */}
      {lastSyncResult && lastSyncResult.synced > 0 && (
        <div className="bg-emerald-950/90 border-b border-emerald-500/40 text-emerald-200 px-4 py-2 text-xs flex items-center justify-between">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              Successfully synchronized <strong className="text-white">{lastSyncResult.synced}</strong> offline {lastSyncResult.synced === 1 ? 'sale' : 'sales'} to Supabase PostgreSQL database! Live stocks updated.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLastSyncResult(null)}
            className="text-emerald-400 hover:text-white text-xs px-2"
          >
            ✕
          </button>
        </div>
      )}
    </aside>
  );
}
