import React, { useState, useEffect } from 'react';
import { Activity, Radar, ShieldAlert, CheckCircle2, RefreshCw, Cpu, Server, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScanStatusData {
  isScanning: boolean;
  currentSubnet: string | null;
  progressPercent: number;
  scannedHosts: number;
  totalHosts: number;
  lastScanTime: string | null;
}

interface ScanProgressMonitorProps {
  onScanComplete?: () => void;
}

export default function ScanProgressMonitor({ onScanComplete }: ScanProgressMonitorProps) {
  const [scanStatus, setScanStatus] = useState<ScanStatusData>({
    isScanning: false,
    currentSubnet: null,
    progressPercent: 0,
    scannedHosts: 0,
    totalHosts: 0,
    lastScanTime: null
  });

  const [wasScanning, setWasScanning] = useState(false);

  useEffect(() => {
    let intervalId: any = null;

    const pollScanStatus = async () => {
      try {
        const res = await fetch('/api/scan/status');
        if (res.ok) {
          const data: ScanStatusData = await res.json();
          setScanStatus(data);

          // If scan just completed, notify parent to refresh devices/logs/stats
          if (wasScanning && !data.isScanning) {
            if (onScanComplete) {
              onScanComplete();
            }
          }
          setWasScanning(data.isScanning);
        }
      } catch (err) {
        console.error('Error polling scan status:', err);
      }
    };

    pollScanStatus();
    // Poll faster (every 1 second) when scanning is active, otherwise every 3 seconds
    const intervalMs = scanStatus.isScanning ? 1000 : 3000;
    intervalId = setInterval(pollScanStatus, intervalMs);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [scanStatus.isScanning, wasScanning, onScanComplete]);

  if (!scanStatus.isScanning && !scanStatus.currentSubnet) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        id="realtime_scan_monitor_panel"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-6 bg-gradient-to-r from-blue-900/90 via-zinc-900 to-indigo-950 text-white border border-blue-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden backdrop-blur-md"
      >
        {/* Animated Background Radar Glow */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          
          {/* Header & Subnet Details */}
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-400 relative">
              <Radar className="w-6 h-6 animate-spin text-blue-400" style={{ animationDuration: '3s' }} />
              <span className="absolute top-1 right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold uppercase rounded-md border border-blue-500/30 tracking-wider">
                  Real-Time Scan Monitor
                </span>
                <span className="text-xs text-blue-200/70 font-medium">
                  Active ICMP Ping / ARP Sweep
                </span>
              </div>

              <h3 className="text-base font-bold text-white mt-1 flex items-center gap-2">
                <span>Scanning Subnet:</span>
                <span className="font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                  {scanStatus.currentSubnet || 'Active Network Ranges'}
                </span>
              </h3>
            </div>
          </div>

          {/* Host Progress Stats */}
          <div className="flex items-center gap-6 text-xs bg-zinc-900/60 p-3 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              <div>
                <span className="text-zinc-400 block text-[10px]">Hosts Scanned</span>
                <span className="font-mono font-bold text-white">
                  {scanStatus.scannedHosts} / {scanStatus.totalHosts || 254}
                </span>
              </div>
            </div>

            <div className="h-8 w-px bg-zinc-800" />

            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-zinc-400 block text-[10px]">Progress</span>
                <span className="font-mono font-bold text-emerald-400">
                  {scanStatus.progressPercent}%
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Progress Bar Container */}
        <div className="mt-4 relative z-10">
          <div className="w-full bg-zinc-950/80 rounded-full h-3 overflow-hidden border border-white/10 p-0.5">
            <motion.div
              className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-full rounded-full relative"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(5, scanStatus.progressPercent)}%` }}
              transition={{ ease: 'easeOut', duration: 0.3 }}
            >
              {/* Pulsing leading edge */}
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full animate-pulse shadow-lg" />
            </motion.div>
          </div>

          <div className="flex justify-between items-center text-[11px] text-blue-200/70 mt-1.5 font-mono">
            <span className="flex items-center gap-1">
              <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>Probing ARP tables, Ping response times & Open Ports (22, 80, 443, 161)...</span>
            </span>
            <span className="font-bold text-emerald-400">
              {scanStatus.isScanning ? 'IN PROGRESS' : 'COMPLETE'}
            </span>
          </div>
        </div>

      </motion.div>
    </AnimatePresence>
  );
}
