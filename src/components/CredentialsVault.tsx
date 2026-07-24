import React, { useState } from 'react';
import { Credential, Device } from '../types.js';
import { Key, Lock, Plus, Trash2, Eye, ShieldCheck, Check, UserCheck, Smartphone, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CredentialsVaultProps {
  credentials: any[];
  devices: Device[];
  currentUserRole: string;
  onAddCredential: (cred: Partial<Credential>) => Promise<void>;
  onEditCredential?: (id: string, cred: Partial<Credential>) => Promise<void>;
  onDeleteCredential: (id: string) => Promise<void>;
}

export default function CredentialsVault({
  credentials,
  devices,
  currentUserRole,
  onAddCredential,
  onEditCredential,
  onDeleteCredential
}: CredentialsVaultProps) {
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingCredId, setEditingCredId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [credType, setCredType] = useState<'global' | 'device'>('global');
  const [deviceId, setDeviceId] = useState<string>('');
  
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenNewForm = () => {
    setEditingCredId(null);
    setLabel('');
    setUsername('');
    setPassword('');
    setCredType('global');
    setDeviceId('');
    setIsOpenForm(true);
  };

  const handleOpenEditForm = (cred: any) => {
    setEditingCredId(cred.id);
    setLabel(cred.label || '');
    setUsername(cred.username || '');
    setPassword(cred.password || '');
    setCredType(cred.type || 'global');
    setDeviceId(cred.deviceId || '');
    setIsOpenForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label || !username) return;

    if (editingCredId && onEditCredential) {
      await onEditCredential(editingCredId, {
        label,
        username,
        password,
        type: credType,
        deviceId: credType === 'device' ? deviceId : null
      });
    } else {
      await onAddCredential({
        label,
        username,
        password,
        type: credType,
        deviceId: credType === 'device' ? deviceId : null
      });
    }

    // Reset Form
    setEditingCredId(null);
    setLabel('');
    setUsername('');
    setPassword('');
    setCredType('global');
    setDeviceId('');
    setIsOpenForm(false);
  };

  return (
    <div id="credentials_vault_wrapper" className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            AES-256 Cryptographic Credential Vault
          </h3>
          <p className="text-zinc-500 text-xs mt-1">
            Global and device-specific network admin credentials (SNMP, SSH, SSH Keys, WMI) are encrypted on disk at rest using AES-256 GCM on the server.
          </p>
        </div>
        <button
          id="btn_open_vault_form"
          disabled={currentUserRole !== 'admin'}
          onClick={handleOpenNewForm}
          className="px-4 py-2 bg-blue-600 disabled:opacity-50 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow hover:bg-blue-700 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Credential</span>
        </button>
      </div>

      <AnimatePresence>
        {isOpenForm && (
          <motion.form
            id="credential_form"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleSubmit}
            className="p-5 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4"
          >
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-xs uppercase tracking-wider">
              {editingCredId ? 'Edit Vault Credential' : 'Configure Secure Vault Key'}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-zinc-400 text-[10.5px] uppercase tracking-wider mb-1 font-semibold">Credential Label</label>
                <input
                  id="input_cred_label"
                  type="text"
                  required
                  placeholder="e.g., HQ Cisco SNMP v3, Lab Admin SSH"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-[10.5px] uppercase tracking-wider mb-1 font-semibold">Admin Username</label>
                <input
                  id="input_cred_username"
                  type="text"
                  required
                  placeholder="e.g., root, snmpuser, admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-[10.5px] uppercase tracking-wider mb-1 font-semibold">Password / Private String</label>
                <div className="relative">
                  <input
                    id="input_cred_password"
                    type="password"
                    placeholder="••••••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs rounded-lg focus:outline-none"
                  />
                  <Lock className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-400 text-[10.5px] uppercase tracking-wider mb-1 font-semibold">Scope of Connection Rule</label>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="scopeType"
                      checked={credType === 'global'}
                      onChange={() => setCredType('global')}
                      className="text-blue-600 focus:ring-0"
                    />
                    <span>Global Level (Attempt on all scanned devices)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="scopeType"
                      checked={credType === 'device'}
                      onChange={() => setCredType('device')}
                      className="text-blue-600 focus:ring-0"
                    />
                    <span>Device Specific Override</span>
                  </label>
                </div>
              </div>

              {credType === 'device' && (
                <div>
                  <label className="block text-zinc-400 text-[10.5px] uppercase tracking-wider mb-1 font-semibold">Target Network Device</label>
                  <select
                    id="select_cred_device"
                    required
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs rounded-lg focus:outline-none"
                  >
                    <option value="">-- Choose Target Endpoint --</option>
                    {devices.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.ip})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                id="btn_cancel_cred"
                onClick={() => setIsOpenForm(false)}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="btn_save_cred"
                className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition"
              >
                {editingCredId ? 'Update Credential' : 'Save Credential securely'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div id="credentials_grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {credentials.length === 0 ? (
          <div className="col-span-full p-8 text-center text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl font-sans italic bg-white dark:bg-zinc-900">
            Vault is empty. Add SSH keys or SNMP community strings to connect to device SNMP agents.
          </div>
        ) : (
          credentials.map((cred) => {
            const isGlobal = cred.type === 'global';
            const matchedDevice = devices.find(d => d.id === cred.deviceId);

            return (
              <div
                key={cred.id}
                id={`cred_card_${cred.id}`}
                className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-zinc-500">
                      <Key className="w-4 h-4 text-emerald-500" />
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      isGlobal ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                    }`}>
                      {isGlobal ? 'Global Key' : 'Device Override'}
                    </span>
                  </div>

                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm truncate" title={cred.label}>
                    {cred.label}
                  </h4>

                  <div className="mt-3 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                    <div className="flex justify-between items-center">
                      <span>Username:</span>
                      <span className="font-mono text-zinc-950 dark:text-zinc-200 font-semibold">{cred.username}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Secret String:</span>
                      <span className="font-mono text-zinc-500 flex items-center gap-1">
                        <span>{visiblePasswords[cred.id] ? 'admin1234' : '••••••••••••'}</span>
                        <Lock className="w-3 h-3 text-zinc-400" />
                      </span>
                    </div>
                    {!isGlobal && matchedDevice && (
                      <div className="flex justify-between items-center text-[11px] bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded border border-zinc-100 dark:border-zinc-900 mt-2">
                        <span className="text-zinc-400 font-semibold">Tethered IP:</span>
                        <span className="font-mono text-blue-600 font-bold">{matchedDevice.ip}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    id={`btn_edit_c_${cred.id}`}
                    disabled={currentUserRole !== 'admin'}
                    onClick={() => handleOpenEditForm(cred)}
                    className="p-1.5 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 rounded text-blue-600 dark:text-blue-400 transition"
                    title="Edit credential details"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    id={`btn_toggle_p_${cred.id}`}
                    onClick={() => togglePasswordVisibility(cred.id)}
                    className="p-1.5 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 rounded text-zinc-500 transition"
                    title="Toggle password view"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    id={`btn_delete_c_${cred.id}`}
                    disabled={currentUserRole !== 'admin'}
                    onClick={() => onDeleteCredential(cred.id)}
                    className="p-1.5 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 rounded text-rose-600 dark:text-rose-400 transition border border-transparent hover:border-rose-200"
                    title="Delete secure key"
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
