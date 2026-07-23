import React, { useState } from 'react';
import { ActivityLog } from '../types.js';
import { Bell, Info, AlertTriangle, AlertCircle, ShieldAlert, Trash2, Search, Sliders } from 'lucide-react';

interface ActivityLogsProps {
  logs: ActivityLog[];
  currentUserRole: string;
  onClearLogs: () => Promise<void>;
}

export default function ActivityLogs({
  logs,
  currentUserRole,
  onClearLogs
}: ActivityLogsProps) {
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'alert':
        return <ShieldAlert className="w-4 h-4 text-rose-500 animate-bounce" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLevelBadgeClass = (level: string) => {
    switch (level) {
      case 'alert':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900';
      case 'warning':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-900';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900';
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    const matchesSearch = 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  return (
    <div id="activity_logs_wrapper" className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            System Activity & Security Alerts Logs
          </h3>
          <p className="text-zinc-500 text-xs mt-1">
            Real-time chronology of discovery cycles, hardware link alerts, sleep behaviors, and administrative audits.
          </p>
        </div>
        <button
          id="btn_clear_logs"
          disabled={currentUserRole !== 'admin'}
          onClick={onClearLogs}
          className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 disabled:opacity-50 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow-sm transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Audit Trail</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div id="logs_toolbar" className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center bg-white dark:bg-zinc-900 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input_logs_search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search within message descriptions and details..."
            className="w-full pl-9 pr-4 py-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs rounded-lg focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-zinc-400" />
          <span className="text-xs text-zinc-500">Log level:</span>
          <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
            {['all', 'info', 'warning', 'alert'].map((level) => (
              <button
                key={level}
                id={`btn_log_lvl_${level}`}
                onClick={() => setLevelFilter(level)}
                className={`px-3 py-1 rounded text-[11px] font-bold capitalize transition ${
                  levelFilter === level 
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline View */}
      <div id="logs_timeline" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden p-5">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 font-sans italic">
            No activity logs matched your active filter rules.
          </div>
        ) : (
          <div className="relative border-l-2 border-zinc-200 dark:border-zinc-800 pl-4 ml-2 space-y-6">
            {filteredLogs.map((log) => {
              const formattedTime = new Date(log.timestamp).toLocaleString();
              
              return (
                <div 
                  key={log.id} 
                  id={`log_item_${log.id}`}
                  className="relative group transition duration-150"
                >
                  {/* Timeline bullet icon */}
                  <span className="absolute -left-[25px] top-0 p-1 bg-white dark:bg-zinc-900 rounded-full border-2 border-zinc-200 dark:border-zinc-800 z-10">
                    {getLogIcon(log.level)}
                  </span>

                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-1">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm leading-snug">
                          {log.message}
                        </span>
                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${getLevelBadgeClass(log.level)}`}>
                          {log.level}
                        </span>
                      </div>
                      <p className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed max-w-3xl">
                        {log.details}
                      </p>
                    </div>

                    <span className="text-[10.5px] text-zinc-400 font-mono self-start mt-0.5">
                      {formattedTime}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
