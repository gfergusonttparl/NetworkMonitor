import React, { useState, useEffect } from 'react';
import { ScanRange } from '../types.js';
import { Sliders, Plus, Trash2, Power, HelpCircle, CheckCircle2, Globe, Bell, ShieldAlert, Save, Clock, Edit3, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RangeManagerProps {
  ranges: ScanRange[];
  currentUserRole: string;
  onAddRange: (range: Partial<ScanRange>) => Promise<void>;
  onEditRange?: (id: string, range: Partial<ScanRange>) => Promise<void>;
  onDeleteRange: (id: string) => Promise<void>;
  settings: {
    scanIntervalMin: number;
    encryptionAtRest: boolean;
    darkThemeByDefault: boolean;
    pushAlertsEnabled: boolean;
    reportSchedule?: string;
    latencyThresholdMs?: number;
    latencyAlertEnabled?: boolean;
    statusChangeAlertEnabled?: boolean;
    offlineAlertEnabled?: boolean;
  };
  onUpdateSettings: (newSettings: any) => Promise<void>;
}

export default function RangeManager({
  ranges,
  currentUserRole,
  onAddRange,
  onEditRange,
  onDeleteRange,
  settings,
  onUpdateSettings
}: RangeManagerProps) {
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingRangeId, setEditingRangeId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [rangeStr, setRangeStr] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Background Scan Schedule state
  const [scanIntervalMin, setScanIntervalMin] = useState<number>(15);
  const [scanScheduleType, setScanScheduleType] = useState<'interval' | 'daily' | 'weekly'>('interval');
  const [dailyScanTime, setDailyScanTime] = useState<string>('02:00');
  const [weeklyScanDay, setWeeklyScanDay] = useState<string>('Sunday');
  const [weeklyScanTime, setWeeklyScanTime] = useState<string>('03:00');
  const [isSavingInterval, setIsSavingInterval] = useState(false);
  const [intervalSaveSuccess, setIntervalSaveSuccess] = useState(false);

  // Threshold config local state
  const [latencyThreshold, setLatencyThreshold] = useState(50);
  const [latencyAlert, setLatencyAlert] = useState(false);
  const [statusAlert, setStatusAlert] = useState(false);
  const [offlineAlert, setOfflineAlert] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync settings when loaded
  useEffect(() => {
    if (settings) {
      setLatencyThreshold(settings.latencyThresholdMs ?? 50);
      setLatencyAlert(settings.latencyAlertEnabled ?? false);
      setStatusAlert(settings.statusChangeAlertEnabled ?? false);
      setOfflineAlert(settings.offlineAlertEnabled ?? false);
      if (settings.scanIntervalMin) {
        setScanIntervalMin(settings.scanIntervalMin);
      }
      if ((settings as any).scanScheduleType) {
        setScanScheduleType((settings as any).scanScheduleType);
      }
      if ((settings as any).dailyScanTime) {
        setDailyScanTime((settings as any).dailyScanTime);
      }
      if ((settings as any).weeklyScanDay) {
        setWeeklyScanDay((settings as any).weeklyScanDay);
      }
      if ((settings as any).weeklyScanTime) {
        setWeeklyScanTime((settings as any).weeklyScanTime);
      }
    }
  }, [settings]);

  const handleOpenNewForm = () => {
    setEditingRangeId(null);
    setName('');
    setRangeStr('');
    setIsActive(true);
    setIsOpenForm(true);
  };

  const handleOpenEditForm = (range: ScanRange) => {
    setEditingRangeId(range.id);
    setName(range.name);
    setRangeStr(range.range);
    setIsActive(range.isActive);
    setIsOpenForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !rangeStr) return;

    if (editingRangeId && onEditRange) {
      await onEditRange(editingRangeId, {
        name,
        range: rangeStr,
        isActive
      });
    } else {
      await onAddRange({
        name,
        range: rangeStr,
        isActive
      });
    }

    setEditingRangeId(null);
    setName('');
    setRangeStr('');
    setIsActive(true);
    setIsOpenForm(false);
  };

  const toggleRangeActive = async (range: ScanRange) => {
    if (onEditRange) {
      await onEditRange(range.id, {
        ...range,
        isActive: !range.isActive
      });
    } else {
      await onAddRange({
        ...range,
        isActive: !range.isActive
      });
    }
  };

  const handleSaveScanInterval = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingInterval(true);
    setIntervalSaveSuccess(false);

    try {
      await onUpdateSettings({
        scanIntervalMin: Number(scanIntervalMin),
        scanScheduleType,
        dailyScanTime,
        weeklyScanDay,
        weeklyScanTime
      });
      setIntervalSaveSuccess(true);
      setTimeout(() => setIntervalSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update scan schedule settings:', err);
    } finally {
      setIsSavingInterval(false);
    }
  };

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await onUpdateSettings({
        latencyThresholdMs: Number(latencyThreshold),
        latencyAlertEnabled: latencyAlert,
        statusChangeAlertEnabled: statusAlert,
        offlineAlertEnabled: offlineAlert
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save notification settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="range_manager_wrapper" className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-500" />
            IP Address Scanning Range Administrator
          </h3>
          <p className="text-zinc-500 text-xs mt-1">
            Specify multiple subnets or specific IP host list bounds (CIDR notation 192.168.1.0/24 or range 10.0.1.1-10.0.1.50). Only active subnets undergo sweeps.
          </p>
        </div>
        <button
          id="btn_open_range_form"
          disabled={currentUserRole !== 'admin'}
          onClick={handleOpenNewForm}
          className="px-4 py-2 bg-blue-600 disabled:opacity-50 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow hover:bg-blue-700 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add IP Range</span>
        </button>
      </div>

      <AnimatePresence>
        {isOpenForm && (
          <motion.form
            id="range_form"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleSubmit}
            className="p-5 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4"
          >
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-xs uppercase tracking-wider">
              {editingRangeId ? 'Edit Network Subnet Range' : 'Configure Network Sweep IP Band'}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-400 text-[10.5px] uppercase tracking-wider mb-1 font-semibold">Subnet Description Name</label>
                <input
                  id="input_range_name"
                  type="text"
                  required
                  placeholder="e.g., Guest WiFi Subnet, Main Lab VLAN"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-[10.5px] uppercase tracking-wider mb-1 font-semibold">IP Range boundaries</label>
                <input
                  id="input_range_bounds"
                  type="text"
                  required
                  placeholder="e.g., 192.168.1.1-192.168.1.150 or 10.0.1.1/24"
                  value={rangeStr}
                  onChange={(e) => setRangeStr(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs rounded-lg focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  id="checkbox_range_active"
                  checked={isActive}
                  onChange={() => setIsActive(!isActive)}
                  className="text-blue-600 rounded focus:ring-0 w-4 h-4"
                />
                <span>Enable immediately for background/manual monitoring scans</span>
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  id="btn_cancel_range"
                  onClick={() => setIsOpenForm(false)}
                  className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn_save_range"
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition"
                >
                  {editingRangeId ? 'Update Subnet Range' : 'Register Subnet Range'}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div id="ranges_grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ranges.length === 0 ? (
          <div className="col-span-full p-8 text-center text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl font-sans italic bg-white dark:bg-zinc-900">
            No IP ranges defined. Scans will run empty sweeps. Add your network subnet range to discover devices.
          </div>
        ) : (
          ranges.map((range) => {
            return (
              <div
                key={range.id}
                id={`range_card_${range.id}`}
                className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm flex items-center justify-between transition hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span className={`p-2.5 rounded-lg border ${
                    range.isActive 
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border-emerald-100 dark:border-emerald-900/40' 
                      : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border-zinc-100 dark:border-zinc-800'
                  }`}>
                    <Globe className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                      {range.name}
                    </h4>
                    <span className="text-zinc-500 font-mono text-[11px] block mt-0.5">{range.range}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id={`btn_edit_r_${range.id}`}
                    disabled={currentUserRole !== 'admin'}
                    onClick={() => handleOpenEditForm(range)}
                    className="p-1.5 bg-blue-50 dark:bg-blue-950 border border-transparent hover:border-blue-200 rounded-lg text-blue-600 dark:text-blue-400 transition"
                    title="Edit range details"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    id={`btn_toggle_r_${range.id}`}
                    onClick={() => toggleRangeActive(range)}
                    className={`p-1.5 rounded-lg border transition flex items-center gap-1 text-[11px] font-semibold ${
                      range.isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400'
                        : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500'
                    }`}
                    title="Toggle active sweep status"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{range.isActive ? 'Active' : 'Disabled'}</span>
                  </button>

                  <button
                    id={`btn_delete_r_${range.id}`}
                    disabled={currentUserRole !== 'admin'}
                    onClick={() => onDeleteRange(range.id)}
                    className="p-1.5 bg-rose-50 dark:bg-rose-950 border border-transparent hover:border-rose-200 rounded-lg text-rose-600 dark:text-rose-400 transition"
                    title="Delete range"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* AUTOMATED NETWORK SCAN SCHEDULER CARD */}
      <div id="background_scan_interval_card" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </span>
            <div>
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Automated Network Scan Scheduler</h4>
              <p className="text-[11px] text-zinc-500">Configure automated background subnet sweeps on an interval, daily, or weekly schedule.</p>
            </div>
          </div>

          <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              id="tab_schedule_interval"
              onClick={() => setScanScheduleType('interval')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                scanScheduleType === 'interval'
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Interval Sweeps
            </button>
            <button
              type="button"
              id="tab_schedule_daily"
              onClick={() => setScanScheduleType('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                scanScheduleType === 'daily'
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Daily Automated
            </button>
            <button
              type="button"
              id="tab_schedule_weekly"
              onClick={() => setScanScheduleType('weekly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                scanScheduleType === 'weekly'
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Weekly Automated
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveScanInterval} className="p-5 space-y-5">
          {scanScheduleType === 'interval' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-zinc-400 text-[10.5px] uppercase tracking-wider mb-1 font-semibold">
                  Scan Sweep Frequency Preset
                </label>
                <div className="flex flex-wrap gap-2">
                  {[5, 15, 30, 60, 120, 360, 1440].map((interval) => (
                    <button
                      type="button"
                      key={interval}
                      id={`btn_interval_preset_${interval}`}
                      onClick={() => setScanIntervalMin(interval)}
                      disabled={currentUserRole !== 'admin'}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        scanIntervalMin === interval
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {interval < 60 ? `${interval} m` : interval === 60 ? '1 hr' : interval === 1440 ? '24 hrs' : `${interval / 60} hrs`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 text-[10.5px] uppercase tracking-wider mb-1 font-semibold">
                  Custom Interval Time (Minutes)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="input_custom_scan_interval"
                    type="number"
                    min="1"
                    max="10080"
                    value={scanIntervalMin}
                    onChange={(e) => setScanIntervalMin(Math.max(1, Number(e.target.value)))}
                    disabled={currentUserRole !== 'admin'}
                    className="w-32 px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs font-mono font-bold rounded-lg focus:outline-none"
                  />
                  <span className="text-xs text-zinc-500 font-medium">Minutes between sweeps</span>
                </div>
              </div>
            </div>
          )}

          {scanScheduleType === 'daily' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                Daily sweeps run automatically once every 24 hours at your specified execution time.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-zinc-400 text-[10.5px] uppercase tracking-wider mb-1 font-semibold">
                    Daily Scan Time Presets
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['00:00', '02:00', '06:00', '12:00', '18:00', '22:00'].map((time) => (
                      <button
                        type="button"
                        key={time}
                        id={`btn_daily_time_${time.replace(':', '')}`}
                        onClick={() => setDailyScanTime(time)}
                        disabled={currentUserRole !== 'admin'}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          dailyScanTime === time
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {time} {Number(time.split(':')[0]) < 12 ? 'AM' : 'PM'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-400 text-[10.5px] uppercase tracking-wider mb-1 font-semibold">
                    Custom Daily Execution Time
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="input_daily_scan_time"
                      type="time"
                      value={dailyScanTime}
                      onChange={(e) => setDailyScanTime(e.target.value)}
                      disabled={currentUserRole !== 'admin'}
                      className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs font-mono font-bold rounded-lg focus:outline-none"
                    />
                    <span className="text-xs text-zinc-500 font-medium">Local server time</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {scanScheduleType === 'weekly' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                Weekly sweeps run once every 7 days on the selected day of the week and target time window.
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-zinc-400 text-[10.5px] uppercase tracking-wider mb-1.5 font-semibold">
                    Target Day of the Week
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                      <button
                        type="button"
                        key={day}
                        id={`btn_weekly_day_${day}`}
                        onClick={() => setWeeklyScanDay(day)}
                        disabled={currentUserRole !== 'admin'}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          weeklyScanDay === day
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-400 text-[10.5px] uppercase tracking-wider mb-1 font-semibold">
                    Weekly Execution Time
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="input_weekly_scan_time"
                      type="time"
                      value={weeklyScanTime}
                      onChange={(e) => setWeeklyScanTime(e.target.value)}
                      disabled={currentUserRole !== 'admin'}
                      className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs font-mono font-bold rounded-lg focus:outline-none"
                    />
                    <span className="text-xs text-zinc-500 font-medium">Scheduled for every {weeklyScanDay}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE SCHEDULE SUMMARY BANNER */}
          <div className="bg-zinc-50 dark:bg-zinc-950 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-zinc-600 dark:text-zinc-400">Current Schedule Plan:</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                {scanScheduleType === 'daily'
                  ? `Daily Sweep @ ${dailyScanTime}`
                  : scanScheduleType === 'weekly'
                    ? `Weekly Sweep @ Every ${weeklyScanDay} at ${weeklyScanTime}`
                    : `Interval Sweep @ Every ${scanIntervalMin} minutes`}
              </span>
            </div>
            <span className="text-zinc-400 text-[11px] hidden sm:inline">Daemon Active</span>
          </div>

          <div className="flex justify-between items-center border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <div className="text-xs">
              {intervalSaveSuccess && (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Network scan schedule updated successfully.
                </span>
              )}
            </div>

            <button
              id="btn_save_scan_interval"
              type="submit"
              disabled={isSavingInterval || currentUserRole !== 'admin'}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 flex items-center gap-1.5 transition shadow"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingInterval ? 'Saving...' : 'Save Scan Schedule'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* NOTIFICATION CONFIGURATION THRESHOLDS PANEL */}
      <div id="notification_threshold_card" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
          <span className="p-1.5 bg-yellow-100 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-500 rounded-lg">
            <Bell className="w-4 h-4" />
          </span>
          <div>
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">System Push Notification & Threshold Settings</h4>
            <p className="text-[11px] text-zinc-500">Configure alert rules that automatically trigger immediate popups on the dashboard console when devices fluctuate.</p>
          </div>
        </div>

        <form onSubmit={handleSaveThresholds} className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* LATENCY THRESHOLD SETTING */}
            <div className="space-y-4 border-r border-transparent md:border-zinc-100 dark:md:border-zinc-800/60 pr-0 md:pr-6">
              <h5 className="font-bold text-zinc-900 dark:text-zinc-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                Latency Alarm Limits
              </h5>

              <div className="space-y-3">
                <label className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    id="checkbox_latency_alert"
                    checked={latencyAlert}
                    onChange={() => setLatencyAlert(!latencyAlert)}
                    disabled={currentUserRole !== 'admin'}
                    className="text-blue-600 rounded focus:ring-0 w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 block">Enable Latency High-Water Alarm</span>
                    <span className="text-zinc-400 text-[11px] mt-0.5 block font-medium">Trigger notification when any online node ping exceeds maximum threshold limit.</span>
                  </div>
                </label>

                {latencyAlert && (
                  <div className="bg-zinc-50 dark:bg-zinc-950 p-3.5 rounded-lg border border-zinc-150 dark:border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-zinc-500">Max Acceptable Latency:</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{latencyThreshold} ms</span>
                    </div>
                    <input
                      id="input_latency_slider"
                      type="range"
                      min="5"
                      max="300"
                      step="5"
                      value={latencyThreshold}
                      onChange={(e) => setLatencyThreshold(Number(e.target.value))}
                      disabled={currentUserRole !== 'admin'}
                      className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-400 font-bold">
                      <span>5 ms (Fast)</span>
                      <span>300 ms (Critical)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* STATUS CHANGE THRESHOLD SETTING */}
            <div className="space-y-4">
              <h5 className="font-bold text-zinc-900 dark:text-zinc-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-zinc-400" />
                Status Shift Triggers
              </h5>

              <div className="space-y-4">
                <label className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    id="checkbox_status_alert"
                    checked={statusAlert}
                    onChange={() => setStatusAlert(!statusAlert)}
                    disabled={currentUserRole !== 'admin'}
                    className="text-blue-600 rounded focus:ring-0 w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 block">General Status Shift Warns</span>
                    <span className="text-zinc-400 text-[11px] mt-0.5 block font-medium">Notify instantly if any host node changes status (e.g. shifts from Online to Sleep).</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    id="checkbox_offline_alert"
                    checked={offlineAlert}
                    onChange={() => setOfflineAlert(!offlineAlert)}
                    disabled={currentUserRole !== 'admin'}
                    className="text-blue-600 rounded focus:ring-0 w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 block">Critical Node Offline Alarm</span>
                    <span className="text-zinc-400 text-[11px] mt-0.5 block font-medium">Generate severe priority popups specifically if an active host drops entirely offline.</span>
                  </div>
                </label>
              </div>
            </div>

          </div>

          <div className="flex justify-between items-center border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-2">
            <div className="text-xs">
              {saveSuccess && (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Threshold triggers successfully locked and persisted.
                </span>
              )}
            </div>

            <button
              id="btn_save_notification_thresholds"
              type="submit"
              disabled={isSaving || currentUserRole !== 'admin'}
              className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-xl font-bold text-xs hover:bg-zinc-800 dark:hover:bg-zinc-100 flex items-center gap-1.5 transition shadow"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving Configurations...' : 'Save Alarm Configuration'}</span>
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}

