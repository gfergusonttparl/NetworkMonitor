import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Cpu, HardDrive, Activity, Zap, Layers, RefreshCw, AlertCircle, Settings } from 'lucide-react';

interface PerformanceData {
  cpu: number;
  memory: number;
  activeThreads: number;
  scanRate: number;
  queueSize: number;
  packetsSent: number;
  packetsReceived: number;
  isScanning: boolean;
  history: Array<{ time: string; cpu: number; memory: number }>;
}

export default function PerformanceMonitor() {
  const [stats, setStats] = useState<PerformanceData>({
    cpu: 8.5,
    memory: 52.4,
    activeThreads: 0,
    scanRate: 0,
    queueSize: 0,
    packetsSent: 152430,
    packetsReceived: 152194,
    isScanning: false,
    history: []
  });

  const [throttle, setThrottle] = useState<'low' | 'med' | 'high'>('med');
  const [isClearing, setIsClearing] = useState(false);
  const [isThrottling, setIsThrottling] = useState(false);

  // Poll performance stats from the server
  useEffect(() => {
    const fetchPerf = async () => {
      try {
        const res = await fetch(`/api/performance-stats?throttle=${throttle}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to fetch performance stats:', err);
      }
    };

    fetchPerf();
    const interval = setInterval(fetchPerf, 3000);
    return () => clearInterval(interval);
  }, [throttle]);

  const handleClearCache = () => {
    setIsClearing(true);
    setTimeout(async () => {
      try {
        await fetch('/api/performance-stats/clear', { method: 'POST' });
      } catch (err) {
        console.error(err);
      }
      setIsClearing(false);
    }, 1200);
  };

  const handleSimulateStress = () => {
    setIsThrottling(true);
    setTimeout(async () => {
      try {
        await fetch('/api/performance-stats/stress', { method: 'POST' });
      } catch (err) {
        console.error(err);
      }
      setIsThrottling(false);
    }, 1500);
  };

  const currentCpu = stats.cpu;
  const currentMem = stats.memory;
  const cpuPercent = Math.min(100, Math.max(0, currentCpu));
  const memPercent = Math.min(100, Math.max(0, (currentMem / 128) * 100)); // out of 128MB limit

  return (
    <div id="performance_monitor_wrapper" className="space-y-6">
      {/* HEADER SUMMARY CARD */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-500" />
            Scanning Engine Performance & Resource Load
          </h3>
          <p className="text-zinc-500 text-xs mt-1">
            Real-time telemetry from the network scanning backend daemon. Monitor daemon load, thread dispatching speeds, and ICMP/SNMP socket queue throughput.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            id="btn_clear_engine_cache"
            onClick={handleClearCache}
            disabled={isClearing}
            className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isClearing ? 'animate-spin' : ''}`} />
            <span>{isClearing ? 'Clearing Cache...' : 'Flush DNS & Port Cache'}</span>
          </button>
          
          <button
            id="btn_simulate_stress"
            onClick={handleSimulateStress}
            disabled={isThrottling}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 transition"
          >
            <Zap className={`w-3.5 h-3.5 ${isThrottling ? 'animate-bounce' : ''}`} />
            <span>{isThrottling ? 'Bursting...' : 'Stress Test Engine'}</span>
          </button>
        </div>
      </div>

      {/* RESOURCE RADIALS AND LIVE COUNTERS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CPU TELEMETRY */}
        <div className="bg-white dark:bg-zinc-900 p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-purple-100 dark:bg-purple-950/40 text-purple-600 rounded-md">
                <Cpu className="w-4 h-4" />
              </span>
              <span className="font-bold text-xs text-zinc-400 uppercase tracking-wider">Engine CPU Utilization</span>
            </div>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              cpuPercent > 70 
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400' 
                : cpuPercent > 30 
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
            }`}>
              {cpuPercent.toFixed(1)}%
            </span>
          </div>

          <div className="flex flex-col items-center py-4">
            {/* Custom SVG Radial Gauge */}
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                {/* Background Track */}
                <path
                  className="text-zinc-100 dark:text-zinc-800"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* Accent Fill */}
                <path
                  className="text-purple-500 transition-all duration-500"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={`${cpuPercent}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {cpuPercent.toFixed(0)}%
                </span>
                <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">Load</span>
              </div>
            </div>
            
            <p className="text-zinc-500 text-[11px] text-center mt-3 font-medium px-4">
              {stats.isScanning 
                ? 'Multi-threaded IP subnet discovery active. Thread pools are locked.' 
                : 'Engine idle. Executing lightweight keep-alive pings and SNMP polls.'}
            </p>
          </div>

          <div className="mt-2 bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-400">Scan Threads Allocated:</span>
              <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{stats.activeThreads} Workers</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Process Affinity Code:</span>
              <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">Daemon_v2.0.4</span>
            </div>
          </div>
        </div>

        {/* MEMORY FOOTPRINT */}
        <div className="bg-white dark:bg-zinc-900 p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-100 dark:bg-blue-950/40 text-blue-600 rounded-md">
                <HardDrive className="w-4 h-4" />
              </span>
              <span className="font-bold text-xs text-zinc-400 uppercase tracking-wider">Daemon RAM Allocation</span>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 rounded">
              {currentMem.toFixed(1)} MB
            </span>
          </div>

          <div className="flex flex-col items-center py-4">
            {/* Custom SVG Radial Gauge for Memory */}
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <path
                  className="text-zinc-100 dark:text-zinc-800"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-blue-500 transition-all duration-500"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={`${memPercent}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {currentMem.toFixed(0)}M
                </span>
                <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">Allocated</span>
              </div>
            </div>

            <p className="text-zinc-500 text-[11px] text-center mt-3 font-medium px-4">
              Sustained memory boundaries out of a 128 MB maximum buffer allocation before GC.
            </p>
          </div>

          <div className="mt-2 bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-400">Garbage Collection Count:</span>
              <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">Clean (Every 60s)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Static Node Table Heap:</span>
              <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{(currentMem * 0.15).toFixed(2)} MB</span>
            </div>
          </div>
        </div>

        {/* ACTIVE THROUGHPUT STATUS */}
        <div className="bg-white dark:bg-zinc-900 p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-md">
                <Activity className="w-4 h-4" />
              </span>
              <span className="font-bold text-xs text-zinc-400 uppercase tracking-wider">Engine Scan Throughput</span>
            </div>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              stats.scanRate > 0 
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 animate-pulse'
                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
            }`}>
              {stats.scanRate.toFixed(0)} pps
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-400 text-[10px] block font-semibold uppercase tracking-wider">Queue Backlog</span>
              <span className="font-bold text-lg font-mono text-zinc-900 dark:text-white block mt-1">{stats.queueSize}</span>
              <span className="text-[9.5px] text-zinc-500 font-medium block mt-0.5">Pending sockets</span>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-400 text-[10px] block font-semibold uppercase tracking-wider">Scan Sweep Coverage</span>
              <span className="font-bold text-lg font-mono text-zinc-900 dark:text-white block mt-1">100%</span>
              <span className="text-[9.5px] text-zinc-500 font-medium block mt-0.5">Subnets indexed</span>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-400 text-[10px] block font-semibold uppercase tracking-wider">Pings Transmitted</span>
              <span className="font-bold text-lg font-mono text-zinc-900 dark:text-white block mt-1">{(stats.packetsSent / 1000).toFixed(1)}K</span>
              <span className="text-[9.5px] text-zinc-500 font-medium block mt-0.5">Total packets</span>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-400 text-[10px] block font-semibold uppercase tracking-wider">Socket Responses</span>
              <span className="font-bold text-lg font-mono text-zinc-900 dark:text-white block mt-1">{(stats.packetsReceived / 1000).toFixed(1)}K</span>
              <span className="text-[9.5px] text-zinc-500 font-medium block mt-0.5">Reliability: 99.84%</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 font-bold flex items-center gap-1">
              <Settings className="w-3.5 h-3.5 text-zinc-400" />
              <span>Concurrency Speed Throttling</span>
            </span>

            <div className="flex bg-zinc-100 dark:bg-zinc-950 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <button
                id="btn_throttle_low"
                onClick={() => setThrottle('low')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition ${
                  throttle === 'low' 
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                Safe
              </button>
              <button
                id="btn_throttle_med"
                onClick={() => setThrottle('med')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition ${
                  throttle === 'med' 
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                Normal
              </button>
              <button
                id="btn_throttle_high"
                onClick={() => setThrottle('high')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition ${
                  throttle === 'high' 
                    ? 'bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                Aggressive
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* GRAPH CHART SECTION - RESOURCE TRENDS over time */}
      <div className="bg-white dark:bg-zinc-900 p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
        <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
          <div>
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Daemon Real-Time Telemetry Analytics</h4>
            <p className="text-[11px] text-zinc-500">Continuous telemetry tracking system resource trends (CPU in purple, Memory footprint in blue).</p>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-purple-500">
              <span className="w-2.5 h-2.5 bg-purple-500 rounded-full"></span>
              <span>CPU Load (%)</span>
            </span>
            <span className="flex items-center gap-1.5 text-blue-500">
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
              <span>Memory Heap (MB)</span>
            </span>
          </div>
        </div>

        {/* Real-time custom SVG line chart */}
        <div className="h-64 relative mt-2">
          {stats.history && stats.history.length > 1 ? (
            <svg viewBox="0 0 500 200" className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="cpuArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0"/>
                </linearGradient>
                <linearGradient id="memArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0"/>
                </linearGradient>
              </defs>

              {/* Gridlines */}
              <line x1="0" y1="50" x2="500" y2="50" stroke="rgba(128,128,128,0.1)" strokeWidth="0.5" strokeDasharray="3 3" />
              <line x1="0" y1="100" x2="500" y2="100" stroke="rgba(128,128,128,0.1)" strokeWidth="0.5" strokeDasharray="3 3" />
              <line x1="0" y1="150" x2="500" y2="150" stroke="rgba(128,128,128,0.1)" strokeWidth="0.5" strokeDasharray="3 3" />

              {/* Draw Area Graphs under Lines */}
              {(() => {
                const step = 500 / (stats.history.length - 1);
                // CPU Area
                let cpuPoints = stats.history.map((pt, index) => {
                  const x = index * step;
                  const y = 200 - (pt.cpu / 100) * 160 - 20; // scaled
                  return `${x},${y}`;
                }).join(' ');
                
                const cpuAreaPath = `M0,180 L${cpuPoints} L500,180 Z`;

                // Mem Area
                let memPoints = stats.history.map((pt, index) => {
                  const x = index * step;
                  const y = 200 - (pt.memory / 128) * 160 - 20; // scaled to 128 MB max
                  return `${x},${y}`;
                }).join(' ');
                const memAreaPath = `M0,180 L${memPoints} L500,180 Z`;

                return (
                  <g>
                    <path d={cpuAreaPath} fill="url(#cpuArea)" />
                    <path d={memAreaPath} fill="url(#memArea)" />

                    {/* Lines */}
                    <path d={`M${cpuPoints}`} fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
                    <path d={`M${memPoints}`} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                    
                    {/* Points nodes */}
                    {stats.history.map((pt, idx) => {
                      const x = idx * step;
                      const cpuY = 200 - (pt.cpu / 100) * 160 - 20;
                      const memY = 200 - (pt.memory / 128) * 160 - 20;

                      return (
                        <g key={idx}>
                          {/* Only draw circles occasionally or for first/last/active to avoid clutter */}
                          {(idx === stats.history.length - 1 || idx % 3 === 0) && (
                            <>
                              <circle cx={x} cy={cpuY} r="3" fill="#a855f7" stroke="white" strokeWidth="1" />
                              <circle cx={x} cy={memY} r="3" fill="#3b82f6" stroke="white" strokeWidth="1" />
                            </>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })()}

              {/* Bottom timeline label row */}
              <text x="5" y="196" fill="#71717a" fontSize="7" fontWeight="bold">History Timeline (Real-Time 3s intervals)</text>
              <text x="450" y="196" fill="#71717a" fontSize="7" fontWeight="bold">Live telemetry</text>
            </svg>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-400 italic text-xs">
              Sampling telemetry... Please wait.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
