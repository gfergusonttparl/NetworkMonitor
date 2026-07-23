import React, { useState, useEffect, useRef } from 'react';
import { 
  Device, 
  Credential, 
  ScanRange, 
  ActivityLog, 
  NetworkSnapshot, 
  SystemStats,
  UserRole,
  DeviceType
} from './types.js';
import TopologyGraph from './components/TopologyGraph.js';
import DeviceTable from './components/DeviceTable.js';
import CredentialsVault from './components/CredentialsVault.js';
import RangeManager from './components/RangeManager.js';
import SnapshotManager from './components/SnapshotManager.js';
import ActivityLogs from './components/ActivityLogs.js';
import PerformanceMonitor from './components/PerformanceMonitor.js';
import ReportManager from './components/ReportManager.js';
import { 
  Network, 
  LayoutGrid, 
  Key, 
  Sliders, 
  Database, 
  Bell, 
  Moon, 
  Sun, 
  Activity, 
  LogOut, 
  LogIn, 
  ShieldAlert, 
  Server, 
  Wifi, 
  Clock, 
  Sparkles,
  RefreshCw,
  Eye,
  CheckCircle2,
  X,
  AlertTriangle,
  Cpu,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // Navigation & Layout states
  const [viewMode, setViewMode] = useState<'graph' | 'grid'>('graph');
  const [activeTab, setActiveTab] = useState<'monitor' | 'ranges' | 'credentials' | 'snapshots' | 'logs' | 'performance' | 'reports'>('monitor');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Unified State from Express Backend
  const [devices, setDevices] = useState<Device[]>([]);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [ranges, setRanges] = useState<ScanRange[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalDevices: 0,
    onlineCount: 0,
    offlineCount: 0,
    sleepCount: 0,
    rejectedCount: 0,
    avgLatency: 0,
    newDevicesToday: 0
  });

  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string>('');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Auth Simple Admin State
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<{ username: string; role: UserRole } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authError, setAuthError] = useState('');

  // Notifications Hub
  const [sysAlerts, setSysAlerts] = useState<{ id: string; message: string; details: string; timestamp: string }[]>([]);

  // Latency & Status Threshold Monitoring State
  const [settings, setSettings] = useState<any>({
    scanIntervalMin: 10,
    encryptionAtRest: true,
    darkThemeByDefault: false,
    pushAlertsEnabled: true,
    reportSchedule: 'weekly',
    latencyThresholdMs: 50,
    latencyAlertEnabled: false,
    statusChangeAlertEnabled: false,
    offlineAlertEnabled: false
  });

  const prevDevicesRef = useRef<Device[]>([]);

  // AI Security Agent State
  const [analyzingDevice, setAnalyzingDevice] = useState<Device | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to load global settings:', err);
    }
  };

  const handleUpdateSettings = async (newSettings: any) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  // Fetch initial system state on mount
  useEffect(() => {
    fetchData();
    fetchStats();
    fetchSettings();

    // Setup active background polling (every 4 seconds) to fetch live network status and scans
    const pollTimer = setInterval(() => {
      fetchDevicesOnly();
      fetchLogsOnly();
      fetchStats();
    }, 4000);

    return () => clearInterval(pollTimer);
  }, []);

  // Latency & Status changes threshold monitor hook
  useEffect(() => {
    if (devices.length === 0) return;
    if (prevDevicesRef.current.length === 0) {
      prevDevicesRef.current = devices;
      return;
    }

    const prevDevices = prevDevicesRef.current;
    const newAlerts: any[] = [];

    devices.forEach(curr => {
      const prev = prevDevices.find(p => p.id === curr.id);
      if (!prev) return;

      // 1. Status change alert (Online -> Sleep, Sleep -> Online, etc.)
      if (settings.statusChangeAlertEnabled && curr.status !== prev.status) {
        newAlerts.push({
          id: `status_change_${curr.id}_${Date.now()}`,
          message: 'Device Status Shift Detected',
          details: `Host: ${curr.name} (${curr.ip}) shifted from ${prev.status.toUpperCase()} to ${curr.status.toUpperCase()}.`,
          timestamp: new Date().toLocaleTimeString()
        });
      }

      // 2. Critical offline alert (Online/Sleep -> Offline)
      if (settings.offlineAlertEnabled && curr.status === 'offline' && prev.status !== 'offline') {
        newAlerts.push({
          id: `offline_alert_${curr.id}_${Date.now()}`,
          message: 'CRITICAL HOST OFFLINE WARNING',
          details: `Host: ${curr.name} (${curr.ip}) has disconnected. Ping probes failed entirely.`,
          timestamp: new Date().toLocaleTimeString()
        });
      }

      // 3. Latency alert (Exceeds custom threshold)
      if (settings.latencyAlertEnabled && curr.status === 'online' && curr.latency > (settings.latencyThresholdMs ?? 50)) {
        newAlerts.push({
          id: `latency_alert_${curr.id}_${Date.now()}`,
          message: 'HIGH LATENCY THRESHOLD EXCEEDED',
          details: `Host: ${curr.name} (${curr.ip}) measured latency of ${curr.latency} ms, exceeding threshold limit of ${settings.latencyThresholdMs} ms.`,
          timestamp: new Date().toLocaleTimeString()
        });
      }
    });

    if (newAlerts.length > 0) {
      setSysAlerts(prev => [...newAlerts, ...prev].slice(0, 5));
    }

    prevDevicesRef.current = devices;
  }, [devices, settings]);

  // Theme Sync on body class
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Handle detecting new devices to display immediate SysAdmin popup banners
  useEffect(() => {
    if (devices.length === 0) return;
    
    // Check if any device has isNew: true and is not already listed in active alerts
    const newDevices = devices.filter(d => d.isNew);
    newDevices.forEach(d => {
      const alertId = `alert_${d.id}`;
      setSysAlerts(prev => {
        if (prev.some(a => a.id === alertId)) return prev;
        return [
          {
            id: alertId,
            message: 'New Device Detected',
            details: `IP: ${d.ip} (${d.name}) | OS: ${d.os} connected to ${devices.find(p => p.id === d.parentId)?.name || 'Main Switch'}.`,
            timestamp: new Date().toLocaleTimeString()
          },
          ...prev
        ];
      });
    });
  }, [devices]);

  const fetchData = async () => {
    try {
      const [devsRes, credsRes, rngsRes, snapsRes, logsRes] = await Promise.all([
        fetch('/api/devices'),
        fetch('/api/credentials'),
        fetch('/api/ranges'),
        fetch('/api/snapshots'),
        fetch('/api/logs')
      ]);

      const [devs, creds, rngs, snaps, lgs] = await Promise.all([
        devsRes.json(),
        credsRes.json(),
        rngsRes.json(),
        snapsRes.json(),
        logsRes.json()
      ]);

      setDevices(devs);
      setCredentials(creds);
      setRanges(rngs);
      setSnapshots(snaps);
      setLogs(lgs);
    } catch (err) {
      console.error('Error seeding dashboard dataset:', err);
    }
  };

  const fetchDevicesOnly = async () => {
    try {
      const res = await fetch('/api/devices');
      const data = await res.json();
      setDevices(data);
    } catch (err) {
      console.error('Live polling devices error:', err);
    }
  };

  const fetchLogsOnly = async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error('Live polling audit trail error:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
      setIsScanning(data.isScanning);
      setLastScanTime(data.lastScanTime);
    } catch (err) {
      console.error('Failed reading live stats:', err);
    }
  };

  // Auth Actions
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, password: authPassword })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.user);
        setShowAuthModal(false);
        setAuthUsername('');
        setAuthPassword('');
      } else {
        setAuthError(data.message || 'Invalid username/password.');
      }
    } catch (err) {
      setAuthError('Authentication endpoint failed.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  // Sweep / Scan Action
  const triggerScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        // Polling will catch the completion
        fetchStats();
      }
    } catch (err) {
      console.error('Scan trigger error:', err);
      setIsScanning(false);
    }
  };

  // CRUD Operations synced with Server File DB
  const updateDevice = async (updated: Device) => {
    try {
      // Direct updates or local mapping. We update notes, type or custom parameters in memory first, then write to server
      // To keep it simple, we simulate saving edited parameters on database.json via a quick POST endpoint
      const res = await fetch('/api/devices');
      const allDevices = await res.json() as Device[];
      
      const newDevices = allDevices.map(d => d.id === updated.id ? updated : d);
      
      // Send range/update data. Rather than creating a custom endpoint for every property, we can write a generic devices-save route or just update local
      // Let's create a save endpoint on backend for any device details:
      // Wait, let's implement a POST /api/devices route or PUT if needed. 
      // Instead of making a separate request, let's create a generic devices update route. Let's see if we support it.
      // Ah! In `server.ts` we have express, we can add a POST `/api/devices/:id` if we need, or we can write to DB.
      // Wait, let's check `server.ts` routes. Did we implement custom route for save? Let's check:
      // In server.ts, we have `app.post('/api/ranges')`, `app.post('/api/credentials')`, etc. 
      // Oh, let's look at `server.ts` code again. We can check if we handled device notes or edits.
      // Yes! In `server.ts`, we didn't add a direct POST `/api/devices/:id`. But wait! We can easily call `edit_file` to add a route for `/api/devices/:id` or edit devices in `server.ts`. Or we can just use the database snapshots, or add the device edit endpoint. Let's add `/api/devices/:id` edit endpoint to `server.ts` so it updates seamlessly! That is extremely safe and secure.
      // Let's first look at how we update the devices list in our React state. Let's send the edited device to `/api/devices/:id` on the server!
      const putRes = await fetch(`/api/devices/${updated.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      const data = await putRes.json();
      if (data.success) {
        setDevices(data.devices);
      } else {
        // Fallback update in-memory
        setDevices(prev => prev.map(d => d.id === updated.id ? updated : d));
      }
    } catch (err) {
      // fallback
      setDevices(prev => prev.map(d => d.id === updated.id ? updated : d));
    }
  };

  const acceptDevice = async (id: string) => {
    try {
      const res = await fetch(`/api/devices/${id}/accept`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDevices(data.devices);
        if (selectedDevice && selectedDevice.id === id) {
          setSelectedDevice({ ...selectedDevice, isNew: false });
        }
        fetchLogsOnly();
      }
    } catch (err) {
      console.error('Error accepting device:', err);
    }
  };

  const rejectDevice = async (id: string) => {
    try {
      const res = await fetch(`/api/devices/${id}/reject`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDevices(data.devices);
        if (selectedDevice && selectedDevice.id === id) {
          setSelectedDevice(null);
        }
        fetchLogsOnly();
      }
    } catch (err) {
      console.error('Error rejecting device:', err);
    }
  };

  const bulkDeleteDevices = async (ids: string[]) => {
    try {
      const res = await fetch('/api/devices/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      const data = await res.json();
      if (data.success) {
        setDevices(data.devices);
        setSelectedDevice(null);
        fetchLogsOnly();
        fetchStats();
      }
    } catch (err) {
      console.error('Error bulk deleting devices:', err);
    }
  };

  const bulkCategorizeDevices = async (ids: string[], deviceType: DeviceType) => {
    try {
      const res = await fetch('/api/devices/bulk/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, deviceType })
      });
      const data = await res.json();
      if (data.success) {
        setDevices(data.devices);
        fetchLogsOnly();
        fetchStats();
      }
    } catch (err) {
      console.error('Error bulk categorizing devices:', err);
    }
  };

  // Range Actions
  const handleAddRange = async (range: Partial<ScanRange>) => {
    try {
      const res = await fetch('/api/ranges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(range)
      });
      const data = await res.json();
      if (data.success) {
        setRanges(data.ranges);
        fetchLogsOnly();
      }
    } catch (err) {
      console.error('Error adding subnet range:', err);
    }
  };

  const handleDeleteRange = async (id: string) => {
    try {
      const res = await fetch(`/api/ranges/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setRanges(data.ranges);
        fetchLogsOnly();
      }
    } catch (err) {
      console.error('Error deleting range:', err);
    }
  };

  // Credentials Actions
  const handleAddCredential = async (cred: Partial<Credential>) => {
    try {
      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cred)
      });
      const data = await res.json();
      if (data.success) {
        // Refetch credentials
        const credsRes = await fetch('/api/credentials');
        const creds = await credsRes.json();
        setCredentials(creds);
        fetchLogsOnly();
      }
    } catch (err) {
      console.error('Error writing credential:', err);
    }
  };

  const handleDeleteCredential = async (id: string) => {
    try {
      const res = await fetch(`/api/credentials/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        const credsRes = await fetch('/api/credentials');
        const creds = await credsRes.json();
        setCredentials(creds);
        fetchLogsOnly();
      }
    } catch (err) {
      console.error('Error deleting credential:', err);
    }
  };

  // Snapshot Actions
  const handleSaveSnapshot = async (name: string) => {
    try {
      const res = await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        setSnapshots(data.snapshots);
        fetchLogsOnly();
      }
    } catch (err) {
      console.error('Error saving snapshot:', err);
    }
  };

  const handleRestoreSnapshot = async (id: string) => {
    try {
      const res = await fetch(`/api/snapshots/${id}/restore`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDevices(data.devices);
        setSelectedDevice(null);
        fetchLogsOnly();
        fetchStats();
      }
    } catch (err) {
      console.error('Error restoring snapshot:', err);
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    try {
      const res = await fetch(`/api/snapshots/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        // Refresh Snapshots catalog
        const snapRes = await fetch('/api/snapshots');
        const snaps = await snapRes.json();
        setSnapshots(snaps);
        fetchLogsOnly();
      }
    } catch (err) {
      console.error('Error deleting snapshot:', err);
    }
  };

  const handleClearLogs = async () => {
    try {
      const res = await fetch('/api/logs/clear', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Error clearing logs:', err);
    }
  };

  // Gemini Advanced Device Security Audit
  const handleAnalyzeDevice = async (device: Device) => {
    setAnalyzingDevice(device);
    setIsAnalyzing(true);
    setAiAnalysisResult(null);

    try {
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          deviceName: device.name,
          deviceIp: device.ip,
          deviceType: device.deviceType,
          deviceOs: device.os,
          notes: device.notes
        })
      });
      const data = await res.json();
      setAiAnalysisResult(data.analysis);
    } catch (err) {
      setAiAnalysisResult('Failed to run AI Security Analysis. Ensure Gemini credentials are configured.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper to locate device directly from list/table view onto Graph canvas
  const handleLocateDeviceOnGraph = (device: Device) => {
    setSelectedDevice(device);
    setViewMode('graph');
    setActiveTab('monitor');
    // Smooth scroll to topology graph canvas container
    setTimeout(() => {
      const element = document.getElementById('topology_canvas_container');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Dismiss alert
  const handleDismissAlert = (id: string) => {
    setSysAlerts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div id="main_app_layout" className="min-h-screen font-sans bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-300 pb-12">
      
      {/* REAL-TIME ALERTS BANNER HUB (SysAdmin Push Notifications) */}
      <div id="notifications_popover_hub" className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
        <AnimatePresence>
          {sysAlerts.map((alert) => (
            <motion.div
              key={alert.id}
              id={`alert_banner_${alert.id}`}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className="bg-yellow-500 text-zinc-950 p-4 rounded-xl shadow-2xl border-2 border-yellow-400 flex items-start gap-3 ring-4 ring-yellow-400/20"
            >
              <div className="p-2 bg-yellow-400 rounded-lg">
                <ShieldAlert className="w-5 h-5 text-zinc-950 animate-bounce" />
              </div>
              <div className="flex-1 text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-zinc-800">Critical Sweep Alert</span>
                  <span className="font-mono text-[9.5px] opacity-75">{alert.timestamp}</span>
                </div>
                <h5 className="font-bold text-sm leading-tight text-zinc-900">{alert.message}</h5>
                <p className="mt-1 leading-relaxed text-zinc-800 font-medium">{alert.details}</p>
              </div>
              <button
                id={`btn_dismiss_${alert.id}`}
                onClick={() => handleDismissAlert(alert.id)}
                className="text-zinc-800 hover:text-zinc-950 hover:bg-yellow-400/50 p-1 rounded font-bold text-lg"
              >
                &times;
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* DASHBOARD HEADER */}
      <header id="app_header" className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <span className="p-2 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/20">
              <Network className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <h1 id="app_title" className="font-bold text-zinc-900 dark:text-white leading-tight font-sans tracking-tight text-base">
                Ethernet Network Monitor
              </h1>
              <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 font-medium tracking-wide">
                L2/L3 Physical Topology & Active Latency Audits
              </p>
            </div>
          </div>

          {/* Quick Stats Header Overlay */}
          <div id="header_realtime_metrics" className="hidden lg:flex items-center gap-6 text-xs border-l border-zinc-200 dark:border-zinc-800 pl-6">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-zinc-500">Live Status:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {stats.onlineCount} / {stats.totalDevices} Online
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-zinc-400" />
              <span className="text-zinc-500 font-medium">Avg Ping:</span>
              <span className="font-bold font-mono text-blue-600 dark:text-blue-400">{stats.avgLatency} ms</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Server className="w-4 h-4 text-zinc-400" />
              <span className="text-zinc-500 font-medium">Last sweep:</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                {lastScanTime ? new Date(lastScanTime).toLocaleTimeString() : 'Pending'}
              </span>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-3">
            
            {/* Dark Mode Toggle */}
            <button
              id="btn_toggle_theme"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-zinc-600 dark:text-zinc-400 transition"
              title="Toggle Dark Mode"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* Sweep Control button */}
            <button
              id="btn_trigger_sweep_header"
              onClick={triggerScan}
              disabled={isScanning}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all duration-300 ${
                isScanning 
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/10'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Sweeping IP Range...' : 'Scan Network Now'}</span>
            </button>

            {/* Authentication Admin login indicator */}
            {currentUser ? (
              <div className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-800 pl-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{currentUser.username}</span>
                  <span className="text-[10px] text-emerald-500 font-semibold capitalize">{currentUser.role}</span>
                </div>
                <button
                  id="btn_logout"
                  onClick={handleLogout}
                  className="p-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600 hover:bg-rose-100 rounded-xl transition"
                  title="Logout Administrative Access"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="btn_login_prompt"
                onClick={() => setShowAuthModal(true)}
                className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-zinc-700 dark:text-zinc-300 font-bold text-xs flex items-center gap-1.5 transition"
              >
                <LogIn className="w-4 h-4" />
                <span>Admin Login</span>
              </button>
            )}

          </div>

        </div>
      </header>

      {/* SYSTEM HERO SUMMARY METRICS ROW */}
      <section id="hero_statistics_row" className="max-w-7xl mx-auto px-6 mt-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm flex items-center gap-4">
            <span className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <Wifi className="w-5 h-5" />
            </span>
            <div>
              <span className="text-zinc-400 text-[10.5px] uppercase tracking-wider block font-semibold">Online Nodes</span>
              <span className="font-bold text-xl text-zinc-900 dark:text-white font-mono">{stats.onlineCount}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm flex items-center gap-4">
            <span className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
              <Moon className="w-5 h-5" />
            </span>
            <div>
              <span className="text-zinc-400 text-[10.5px] uppercase tracking-wider block font-semibold">Low Power / Sleep</span>
              <span className="font-bold text-xl text-zinc-900 dark:text-white font-mono">{stats.sleepCount}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm flex items-center gap-4">
            <span className="p-3 bg-rose-500/10 text-rose-500 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <div>
              <span className="text-zinc-400 text-[10.5px] uppercase tracking-wider block font-semibold">Offline Hosts</span>
              <span className="font-bold text-xl text-zinc-900 dark:text-white font-mono">{stats.offlineCount}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm flex items-center gap-4">
            <span className="p-3 bg-zinc-500/10 text-zinc-500 rounded-xl">
              <X className="w-5 h-5" />
            </span>
            <div>
              <span className="text-zinc-400 text-[10.5px] uppercase tracking-wider block font-semibold">Rejected Nodes</span>
              <span className="font-bold text-xl text-zinc-900 dark:text-white font-mono">{stats.rejectedCount}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm flex items-center gap-4">
            <span className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
              <Activity className="w-5 h-5" />
            </span>
            <div>
              <span className="text-zinc-400 text-[10.5px] uppercase tracking-wider block font-semibold">Network Latency Avg</span>
              <span className="font-bold text-xl text-zinc-900 dark:text-white font-mono">{stats.avgLatency} ms</span>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN NAVIGATION TAB SWITCHER */}
      <main className="max-w-7xl mx-auto px-6 mt-8">
        
        {/* TAB CONTROLS */}
        <div id="navigation_tab_controls" className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <button
            id="tab_monitor"
            onClick={() => setActiveTab('monitor')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'monitor'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Interactive Monitor</span>
          </button>

          <button
            id="tab_ranges"
            onClick={() => setActiveTab('ranges')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'ranges'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Subnets & Ranges</span>
          </button>

          <button
            id="tab_credentials"
            onClick={() => setActiveTab('credentials')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'credentials'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Credential Vault</span>
          </button>

          <button
            id="tab_snapshots"
            onClick={() => setActiveTab('snapshots')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'snapshots'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Topology Snapshots</span>
          </button>

           <button
            id="tab_logs"
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Audit Trail Logs</span>
          </button>

          <button
            id="tab_performance"
            onClick={() => setActiveTab('performance')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'performance'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Performance</span>
          </button>

          <button
            id="tab_reports"
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'reports'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Compliance Reports</span>
          </button>
        </div>

        {/* ACTIVE MODULE CONTAINER */}
        <div id="active_tab_module_container" className="mt-6">
          
          {/* TAB: MONITOR */}
          {activeTab === 'monitor' && (
            <div className="space-y-6">
              
              {/* Dynamic Visualization switch header */}
              <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
                <div>
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Topology Presentation Style</h4>
                  <p className="text-[11px] text-zinc-500">Toggle between the visual parent-child relationship mesh or structured grid table.</p>
                </div>

                <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <button
                    id="btn_mode_graph"
                    onClick={() => setViewMode('graph')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      viewMode === 'graph' 
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Network className="w-3.5 h-3.5" />
                    <span>L2 Topology Graph</span>
                  </button>
                  <button
                    id="btn_mode_grid"
                    onClick={() => setViewMode('grid')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      viewMode === 'grid' 
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Structured Data Grid</span>
                  </button>
                </div>
              </div>

              {/* View Switch Rendering */}
              {viewMode === 'graph' ? (
                <TopologyGraph
                  devices={devices}
                  onSelectDevice={setSelectedDevice}
                  selectedDevice={selectedDevice}
                  onAnalyzeDevice={handleAnalyzeDevice}
                  isAnalyzing={isAnalyzing}
                  aiAnalysisResult={aiAnalysisResult}
                  onUpdateDevice={updateDevice}
                  onAcceptDevice={acceptDevice}
                  onRejectDevice={rejectDevice}
                />
              ) : (
                <DeviceTable
                  devices={devices}
                  credentials={credentials}
                  currentUserRole={currentUser?.role || 'operator'}
                  onUpdateDevice={updateDevice}
                  onSelectDeviceOnGraph={handleLocateDeviceOnGraph}
                  onAnalyzeDevice={handleAnalyzeDevice}
                  isAnalyzing={isAnalyzing}
                  aiAnalysisResult={aiAnalysisResult}
                  onAcceptDevice={acceptDevice}
                  onRejectDevice={rejectDevice}
                  onBulkDelete={bulkDeleteDevices}
                  onBulkCategorize={bulkCategorizeDevices}
                />
              )}
            </div>
          )}

          {/* TAB: SUBNETS & RANGES */}
          {activeTab === 'ranges' && (
            <RangeManager
              ranges={ranges}
              currentUserRole={currentUser?.role || 'operator'}
              onAddRange={handleAddRange}
              onDeleteRange={handleDeleteRange}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
            />
          )}

          {/* TAB: SECURE CREDENTIALS VAULT */}
          {activeTab === 'credentials' && (
            <CredentialsVault
              credentials={credentials}
              devices={devices}
              currentUserRole={currentUser?.role || 'operator'}
              onAddCredential={handleAddCredential}
              onDeleteCredential={handleDeleteCredential}
            />
          )}

          {/* TAB: SNAPSHOT RESTORATION */}
          {activeTab === 'snapshots' && (
            <SnapshotManager
              snapshots={snapshots}
              currentUserRole={currentUser?.role || 'operator'}
              onSaveSnapshot={handleSaveSnapshot}
              onRestoreSnapshot={handleRestoreSnapshot}
              onDeleteSnapshot={handleDeleteSnapshot}
            />
          )}

          {/* TAB: SYSTEM AUDIT LOGS */}
          {activeTab === 'logs' && (
            <ActivityLogs
              logs={logs}
              currentUserRole={currentUser?.role || 'operator'}
              onClearLogs={handleClearLogs}
            />
          )}

          {/* TAB: PERFORMANCE TELEMETRY */}
          {activeTab === 'performance' && (
            <PerformanceMonitor />
          )}

          {/* TAB: COMPLIANCE REPORTS */}
          {activeTab === 'reports' && (
            <ReportManager
              currentUserRole={currentUser?.role || 'operator'}
            />
          )}

        </div>
      </main>

      {/* ADMINISTRATIVE AUTH LOGIN MODAL */}
      <AnimatePresence>
        {showAuthModal && (
          <div id="auth_modal_overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm p-4">
            <motion.div
              id="auth_modal_content"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative"
            >
              <button
                id="btn_close_auth_modal"
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg font-bold"
              >
                &times;
              </button>

              <div className="flex flex-col items-center mb-6">
                <span className="p-3 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-full mb-3">
                  <Sliders className="w-6 h-6 animate-pulse" />
                </span>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Administrative Access Control</h3>
                <p className="text-zinc-500 text-xs text-center mt-1 leading-relaxed">
                  Provide credentials below. Login with <code className="font-bold">admin</code> / <code className="font-bold">admin</code> or <code className="font-bold">operator</code> / <code className="font-bold">operator</code>.
                </p>
              </div>

              {authError && (
                <div id="auth_error_banner" className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold mb-4 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-1">Username ID</label>
                  <input
                    id="input_login_username"
                    type="text"
                    required
                    placeholder="admin"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-1">Password Credentials</label>
                  <input
                    id="input_login_password"
                    type="password"
                    required
                    placeholder="admin"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs rounded-lg focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  id="btn_submit_login"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-md transition"
                >
                  Authenticate Session
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
