import React, { useState, useEffect } from 'react';
import { ScanRange } from '../types.js';
import { Sliders, Plus, Trash2, Power, HelpCircle, CheckCircle2, Globe, Bell, ShieldAlert, Save, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RangeManagerProps {
  ranges: ScanRange[];
  currentUserRole: string;
  onAddRange: (range: Partial<ScanRange>) => Promise<void>;
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
  onDeleteRange,
  settings,
  onUpdateSettings
}: RangeManagerProps) {
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [name, setName] = useState('');
  const [rangeStr, setRangeStr] = useState('');
  const [isActive, setIsActive] = useState(true);

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
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !rangeStr) return;

    // Validate simple format e.g. 192.168.1.1-100 or 10.0.0.0/24
    await onAddRange({
      name,
      range: rangeStr,
      isActive
    });

    setName('');
    setRangeStr('');
    setIsActive(true);
    setIsOpenForm(false);
  };

  const toggleRangeActive = async (range: ScanRange) => {
    await onAddRange({
      ...range,
      isActive: !range.isActive
    });
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
          onClick={() => setIsOpenForm(!isOpenForm)}
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
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-xs uppercase tracking-wider">Configure Network Sweep IP Band</h4>
            
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
                  Register Subnet Range
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

