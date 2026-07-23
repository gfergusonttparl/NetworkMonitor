import React, { useState } from 'react';
import { NetworkSnapshot } from '../types.js';
import { Database, Plus, Trash2, RotateCcw, Calendar, HardDrive, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SnapshotManagerProps {
  snapshots: any[];
  currentUserRole: string;
  onSaveSnapshot: (name: string) => Promise<void>;
  onRestoreSnapshot: (id: string) => Promise<void>;
  onDeleteSnapshot: (id: string) => Promise<void>;
}

export default function SnapshotManager({
  snapshots,
  currentUserRole,
  onSaveSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot
}: SnapshotManagerProps) {
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [snapName, setSnapName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapName) return;

    await onSaveSnapshot(snapName);
    setSnapName('');
    setIsOpenForm(false);
  };

  return (
    <div id="snapshot_manager_wrapper" className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-500" />
            Network Topology State Snapshots
          </h3>
          <p className="text-zinc-500 text-xs mt-1">
            Save current device discovery scans as golden state snapshots. Restore older snapshots to analyze modifications to physical ports and endpoint structures over time.
          </p>
        </div>
        <button
          id="btn_open_snap_form"
          disabled={currentUserRole !== 'admin'}
          onClick={() => setIsOpenForm(!isOpenForm)}
          className="px-4 py-2 bg-blue-600 disabled:opacity-50 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow hover:bg-blue-700 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Save State Archive</span>
        </button>
      </div>

      <AnimatePresence>
        {isOpenForm && (
          <motion.form
            id="snap_form"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleSubmit}
            className="p-5 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4"
          >
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-xs uppercase tracking-wider">Configure Topology Snapshot Name</h4>
            
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-zinc-400 text-[10.5px] uppercase tracking-wider mb-1 font-semibold">Snapshot Label Description</label>
                <input
                  id="input_snap_name"
                  type="text"
                  required
                  placeholder="e.g., Post-Maintenance Golden State, Prior to VLAN Migrations"
                  value={snapName}
                  onChange={(e) => setSnapName(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs rounded-lg focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  id="btn_cancel_snap"
                  onClick={() => setIsOpenForm(false)}
                  className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn_save_snap"
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition"
                >
                  Commit Archive
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div id="snapshots_grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {snapshots.length === 0 ? (
          <div className="col-span-full p-8 text-center text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl font-sans italic bg-white dark:bg-zinc-900">
            No state snapshots logged in catalog. Run a discovery scan and save current telemetry.
          </div>
        ) : (
          snapshots.map((snap) => {
            const formattedDate = new Date(snap.timestamp).toLocaleString();
            
            return (
              <div
                key={snap.id}
                id={`snap_card_${snap.id}`}
                className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-zinc-500">
                      <HardDrive className="w-4 h-4 text-purple-500" />
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
                      {snap.deviceCount} Scanned Nodes
                    </span>
                  </div>

                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm truncate" title={snap.name}>
                    {snap.name}
                  </h4>

                  <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="font-medium text-[10.5px]">{formattedDate}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    id={`btn_restore_${snap.id}`}
                    onClick={() => onRestoreSnapshot(snap.id)}
                    className="p-1.5 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 rounded text-blue-600 dark:text-blue-400 transition border border-transparent hover:border-blue-200 flex items-center gap-1 text-[11px] font-bold"
                    title="Restore active scan grid to this state"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore state</span>
                  </button>
                  <button
                    id={`btn_delete_snap_${snap.id}`}
                    disabled={currentUserRole !== 'admin'}
                    onClick={() => onDeleteSnapshot(snap.id)}
                    className="p-1.5 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 rounded text-rose-600 dark:text-rose-400 transition border border-transparent hover:border-rose-200"
                    title="Delete backup snapshot"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
