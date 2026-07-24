import React, { useState } from 'react';
import { Device, DeviceType, DeviceStatus, Credential, PingResult } from '../types.js';
import { 
  Search, 
  Filter, 
  Download, 
  Edit2, 
  Check, 
  X, 
  ArrowUpDown, 
  FileSpreadsheet, 
  FileText,
  AlertCircle,
  Eye,
  Settings,
  BookOpen,
  Sparkles,
  Link,
  ChevronDown,
  Globe,
  Shield,
  Router,
  Network,
  Monitor,
  Laptop,
  Server,
  Printer,
  Scan,
  HelpCircle,
  Wifi,
  Radio,
  CheckCircle2,
  Moon,
  XCircle,
  Ban,
  MoreVertical,
  Trash2,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DeviceTableProps {
  devices: Device[];
  credentials: any[];
  currentUserRole: string;
  onUpdateDevice: (updated: Device) => Promise<void>;
  onSelectDeviceOnGraph?: (device: Device) => void;
  onAnalyzeDevice?: (device: Device) => void;
  isAnalyzing?: boolean;
  aiAnalysisResult?: string | null;
  onAcceptDevice?: (id: string) => Promise<void>;
  onRejectDevice?: (id: string) => Promise<void>;
  onBulkDelete?: (ids: string[]) => Promise<void>;
  onBulkCategorize?: (ids: string[], deviceType: DeviceType) => Promise<void>;
}

export default function DeviceTable({ 
  devices, 
  credentials,
  currentUserRole,
  onUpdateDevice,
  onSelectDeviceOnGraph,
  onAnalyzeDevice,
  isAnalyzing = false,
  aiAnalysisResult = null,
  onAcceptDevice,
  onRejectDevice,
  onBulkDelete,
  onBulkCategorize
}: DeviceTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof Device>('ip');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Data grid pagination state
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, pageSize]);

  // Row selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Row ellipsis action menu state
  const [activeMenuDeviceId, setActiveMenuDeviceId] = useState<string | null>(null);

  // Ping Diagnostic State
  const [pingingDevice, setPingingDevice] = useState<Device | null>(null);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [showPingToast, setShowPingToast] = useState(false);

  const handleRunPing = async (device: Device) => {
    setIsPinging(true);
    setPingingDevice(device);
    setShowPingToast(true);
    setPingResult(null);

    try {
      const res = await fetch(`/api/devices/${device.id}/ping`, { method: 'POST' });
      if (res.ok) {
        const data: PingResult = await res.json();
        setPingResult(data);
      } else {
        console.error('Ping request failed');
      }
    } catch (err) {
      console.error('Ping error:', err);
    } finally {
      setIsPinging(false);
    }
  };

  // Bulk categorization chosen type
  const [bulkCategoryChosen, setBulkCategoryChosen] = useState<DeviceType>('computer');

  // Inline editing state
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<DeviceType>('computer');
  const [editOS, setEditOS] = useState('');

  // Local state for credentials binding dropdown trigger
  const [bindingDeviceId, setBindingDeviceId] = useState<string | null>(null);

  // Sorting logic helper
  const handleSort = (field: keyof Device) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Export functions
  const handleExportCSV = () => {
    // Generate secure CSV telemetry file
    const headers = ['ID', 'Device Name', 'IP Address', 'MAC', 'Vendor', 'Type', 'OS', 'Status', 'Latency (ms)', 'Parent Device', 'Switch Port', 'Last Seen', 'Notes'];
    const rows = devices.map(d => [
      d.id,
      d.name,
      d.ip,
      d.mac,
      d.vendor,
      d.deviceType,
      d.os,
      d.status,
      d.status === 'online' ? d.latency : '0',
      d.parentId || 'None',
      d.switchPort || 'None',
      d.lastSeen,
      (d.notes || '').replace(/"/g, '""')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `network_telemetry_audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintAudit = () => {
    window.print();
  };

  // Action: Save inline edit
  const startEditing = (device: Device) => {
    setEditingDeviceId(device.id);
    setEditNotes(device.notes || '');
    setEditName(device.name);
    setEditType(device.deviceType);
    setEditOS(device.os);
  };

  const saveEdit = async (device: Device) => {
    const updatedDevice: Device = {
      ...device,
      name: editName,
      deviceType: editType,
      os: editOS,
      notes: editNotes
    };
    await onUpdateDevice(updatedDevice);
    setEditingDeviceId(null);
  };

  const cancelEdit = () => {
    setEditingDeviceId(null);
  };

  // Helper to bind credential mapping overrides to individual devices
  const bindCredentialToDevice = async (device: Device, credId: string | null) => {
    // Simulated credential override linking on server. In this flow we add it to the device notes or update custom properties
    const updatedNotes = device.notes 
      ? `${device.notes.split(' [Bound Credential:')[0]} [Bound Credential: ${credId || 'None'}]`
      : `[Bound Credential: ${credId || 'None'}]`;
    
    await onUpdateDevice({
      ...device,
      notes: updatedNotes
    });
    setBindingDeviceId(null);
  };

  // Process sorting, filtering, and searching
  const filteredDevices = devices.filter(device => {
    const matchesSearch = 
      device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.os.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (device.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
    const matchesType = typeFilter === 'all' || device.deviceType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const sortedDevices = [...filteredDevices].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (valA === null || valA === undefined) valA = '';
    if (valB === null || valB === undefined) valB = '';

    if (typeof valA === 'string' && typeof valB === 'string') {
      // Natural IP sorting helper
      if (sortField === 'ip') {
        const ipToNum = (ip: string) => ip.split('.').map(Number).reduce((sum, part) => (sum << 8) + part, 0);
        return sortDirection === 'asc' ? ipToNum(valA) - ipToNum(valB) : ipToNum(valB) - ipToNum(valA);
      }
      return sortDirection === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    }

    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    }

    return 0;
  });

  // Selection handlers
  const isAllSelected = sortedDevices.length > 0 && sortedDevices.every(d => selectedIds.includes(d.id));
  const handleSelectAll = () => {
    if (isAllSelected) {
      const visibleIds = sortedDevices.map(d => d.id);
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      const visibleIds = sortedDevices.map(d => d.id);
      setSelectedIds(prev => {
        const combined = [...prev];
        visibleIds.forEach(id => {
          if (!combined.includes(id)) {
            combined.push(id);
          }
        });
        return combined;
      });
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const triggerBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to remove the ${selectedIds.length} selected devices from active network inventory?`)) {
      if (onBulkDelete) {
        await onBulkDelete(selectedIds);
        setSelectedIds([]);
      }
    }
  };

  const triggerBulkCategorize = async (deviceType: DeviceType) => {
    if (selectedIds.length === 0) return;
    if (onBulkCategorize) {
      await onBulkCategorize(selectedIds, deviceType);
      setSelectedIds([]);
    }
  };

  // Data grid pagination calculations
  const totalItems = sortedDevices.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedDevices = sortedDevices.slice(startIndex, startIndex + pageSize);

  // Calculate subnet representation visual bars
  const totalSubnet1Nodes = devices.filter(d => d.ip.startsWith('192.168.1.')).length;
  const activeSubnet1Nodes = devices.filter(d => d.ip.startsWith('192.168.1.') && d.status === 'online').length;
  const totalSubnet2Nodes = devices.filter(d => d.ip.startsWith('10.0.1.')).length;
  const activeSubnet2Nodes = devices.filter(d => d.ip.startsWith('10.0.1.') && d.status === 'online').length;

  const getStatusBadge = (status: DeviceStatus, isNew: boolean = false) => {
    let color = '';
    let bg = '';
    let icon = null;
    let label = '';

    switch (status) {
      case 'online':
        color = 'text-emerald-700 dark:text-emerald-400';
        bg = 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50';
        icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />;
        label = 'Online';
        break;
      case 'sleep':
        color = 'text-amber-700 dark:text-amber-400';
        bg = 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50';
        icon = <Moon className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />;
        label = 'Sleep';
        break;
      case 'offline':
        color = 'text-rose-700 dark:text-rose-400';
        bg = 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50';
        icon = <XCircle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />;
        label = 'Offline';
        break;
      case 'rejected':
        color = 'text-zinc-600 dark:text-zinc-400';
        bg = 'bg-zinc-50 dark:bg-zinc-850 border-zinc-200 dark:border-zinc-800';
        icon = <Ban className="w-3.5 h-3.5 text-zinc-400" />;
        label = 'Rejected';
        break;
      default:
        color = 'text-zinc-600 dark:text-zinc-400';
        bg = 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200';
        icon = <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />;
        label = 'Unknown';
    }

    return (
      <div className="flex items-center justify-center">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded-full text-[10.5px] font-bold ${bg} ${color} shadow-xs relative whitespace-nowrap`}>
          {isNew && (
            <span className="absolute top-0 right-0 flex h-2 w-2 -mt-0.5 -mr-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
            </span>
          )}
          {icon}
          <span>{label}</span>
        </span>
      </div>
    );
  };

  const getDeviceIcon = (type: DeviceType, status: DeviceStatus, name?: string, sizeClass = "w-4 h-4") => {
    let color = "text-zinc-400 dark:text-zinc-500";
    if (status === 'online') color = "text-emerald-500 dark:text-emerald-400";
    else if (status === 'sleep') color = "text-amber-500 dark:text-amber-400";
    else if (status === 'offline') color = "text-rose-500 dark:text-rose-400";

    const nameLower = (name || '').toLowerCase();

    switch (type) {
      case 'modem':
        return <Globe className={`${sizeClass} ${color} transition-colors`} />;
      case 'firewall':
        return <Shield className={`${sizeClass} ${color} transition-colors`} />;
      case 'router':
        return <Router className={`${sizeClass} ${color} transition-colors`} />;
      case 'switch':
        return <Network className={`${sizeClass} ${color} transition-colors`} />;
      case 'ap':
        return <Wifi className={`${sizeClass} ${color} transition-colors`} />;
      case 'extender':
        return <Radio className={`${sizeClass} ${color} transition-colors`} />;
      case 'computer':
        if (nameLower.includes('server')) {
          return <Server className={`${sizeClass} ${color} transition-colors`} />;
        }
        if (nameLower.includes('mac') || nameLower.includes('laptop') || nameLower.includes('workstation')) {
          return <Laptop className={`${sizeClass} ${color} transition-colors`} />;
        }
        return <Monitor className={`${sizeClass} ${color} transition-colors`} />;
      case 'printer':
        return <Printer className={`${sizeClass} ${color} transition-colors`} />;
      case 'scanner':
        return <Scan className={`${sizeClass} ${color} transition-colors`} />;
      default:
        return <HelpCircle className={`${sizeClass} ${color} transition-colors`} />;
    }
  };

  return (
    <div id="datagrid_wrapper" className="space-y-6">
      {/* Subnets Density Bar widgets */}
      <div id="subnet_density_charts" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div id="subnet_1_card" className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="font-bold text-zinc-700 dark:text-zinc-300">Subnet: 192.168.1.0/24</span>
            <span className="font-mono text-zinc-500">{activeSubnet1Nodes} / {totalSubnet1Nodes} Hosts Active</span>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
            <div 
              id="subnet_1_progress_bar"
              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
              style={{ width: totalSubnet1Nodes > 0 ? `${(activeSubnet1Nodes / totalSubnet1Nodes) * 100}%` : '0%' }}
            />
          </div>
        </div>

        <div id="subnet_2_card" className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="font-bold text-zinc-700 dark:text-zinc-300">Subnet: 10.0.1.0/24</span>
            <span className="font-mono text-zinc-500">{activeSubnet2Nodes} / {totalSubnet2Nodes} Hosts Active</span>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
            <div 
              id="subnet_2_progress_bar"
              className="bg-blue-500 h-full rounded-full transition-all duration-500" 
              style={{ width: totalSubnet2Nodes > 0 ? `${(activeSubnet2Nodes / totalSubnet2Nodes) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* Grid Filters Control Bar */}
      <div id="grid_control_bar" className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center bg-white dark:bg-zinc-900 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
        <div id="search_input_wrapper" className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input_table_search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by device name or IP address in real-time..."
            className="w-full pl-9 pr-4 py-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div id="filter_dropdowns" className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-lg text-xs text-zinc-600 dark:text-zinc-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
            <select
              id="select_status_filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none text-zinc-900 dark:text-zinc-100 font-semibold focus:outline-none focus:ring-0 ml-1 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="online">Online</option>
              <option value="sleep">Sleep Mode</option>
              <option value="offline">Offline</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-lg text-xs text-zinc-600 dark:text-zinc-400">
            <Settings className="w-3.5 h-3.5" />
            <span>Type:</span>
            <select
              id="select_type_filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent border-none text-zinc-900 dark:text-zinc-100 font-semibold focus:outline-none focus:ring-0 ml-1 cursor-pointer"
            >
              <option value="all">All Devices</option>
              <option value="modem">Modems</option>
              <option value="firewall">Firewalls</option>
              <option value="router">Routers</option>
              <option value="switch">Switches</option>
              <option value="ap">Access Points</option>
              <option value="extender">Extenders</option>
              <option value="computer">Computers</option>
              <option value="printer">Printers</option>
              <option value="scanner">Scanners</option>
            </select>
          </div>

          <button
            id="btn_print_audit"
            onClick={handlePrintAudit}
            title="Print PDF network report"
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-xs text-zinc-600 dark:text-zinc-400 transition"
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Devices Data Table View */}
      <div id="table_viewport" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        
        {/* CARD HEADER with Export to CSV button */}
        <div id="table_card_header" className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-50/50 dark:bg-zinc-800/10">
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-200 text-sm">Network Inventory Directory</h3>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">Offline auditing registry for all scanned subnets</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="btn_header_export_csv"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
              title="Download CSV for offline audit"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export to CSV</span>
            </button>
          </div>
        </div>

        {/* BULK ACTIONS TOOLBAR */}
        <AnimatePresence>
          {selectedIds.length > 0 && (
            <motion.div
              id="bulk_actions_toolbar"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-blue-50/80 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900 px-6 py-3 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs"
            >
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-semibold">
                <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-pulse" />
                <span>{selectedIds.length} device{selectedIds.length > 1 ? 's' : ''} selected</span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Batch Categorization */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 rounded-lg">
                  <select
                    id="select_bulk_category"
                    value={bulkCategoryChosen}
                    onChange={(e) => setBulkCategoryChosen(e.target.value as DeviceType)}
                    className="bg-transparent border-none text-zinc-900 dark:text-zinc-100 font-semibold text-[11px] focus:outline-none focus:ring-0 ml-1 cursor-pointer py-1"
                  >
                    <option value="computer">Computer</option>
                    <option value="router">Router</option>
                    <option value="switch">Switch</option>
                    <option value="ap">Access Point</option>
                    <option value="firewall">Firewall</option>
                    <option value="printer">Printer</option>
                    <option value="scanner">Scanner</option>
                    <option value="modem">Modem</option>
                    <option value="extender">Extender</option>
                  </select>
                  <button
                    id="btn_bulk_categorize"
                    onClick={() => triggerBulkCategorize(bulkCategoryChosen)}
                    className="px-2.5 py-1 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 text-[11px] transition cursor-pointer"
                  >
                    Set Category
                  </button>
                </div>

                <div className="h-4 w-[1px] bg-zinc-300 dark:bg-zinc-700 hidden sm:block"></div>

                {/* Batch Delete */}
                <button
                  id="btn_bulk_delete"
                  onClick={triggerBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected</span>
                </button>

                <button
                  id="btn_bulk_clear"
                  onClick={() => setSelectedIds([])}
                  className="px-2.5 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="overflow-x-auto">
          <table id="devices_data_table" className="w-full text-left border-collapse table-auto">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold uppercase text-zinc-500 tracking-wider">
                {/* Checkbox column header */}
                <th className="p-4 w-10 text-center">
                  <input 
                    id="check_select_all"
                    type="checkbox" 
                    checked={isAllSelected} 
                    onChange={handleSelectAll} 
                    className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                    title="Select/Deselect All Visible"
                  />
                </th>
                <th className="p-4 w-28 text-center">Status</th>
                <th className="p-4 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition" onClick={() => handleSort('ip')}>
                  <div className="flex items-center gap-1">
                    IP Address <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                  </div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1">
                    Hostname <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                  </div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition" onClick={() => handleSort('deviceType')}>
                  <div className="flex items-center gap-1">
                    Device Type <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                  </div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition" onClick={() => handleSort('os')}>
                  <div className="flex items-center gap-1">
                    OS Fingerprint <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                  </div>
                </th>
                <th className="p-4 text-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition" onClick={() => handleSort('latency')}>
                  <div className="flex items-center gap-1 justify-center">
                    Latency <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                  </div>
                </th>
                <th className="p-4">Uplink Gateway</th>
                <th className="p-4">OUI Vendor</th>
                <th className="p-4 text-right w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs text-zinc-700 dark:text-zinc-300">
              {paginatedDevices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-zinc-400 font-sans italic">
                    No matching devices found on this active subnet sweep.
                  </td>
                </tr>
              ) : (
                paginatedDevices.map((device) => {
                  const isEditing = editingDeviceId === device.id;
                  const isSelected = selectedIds.includes(device.id);
                  
                  return (
                    <tr 
                      key={device.id} 
                      id={`row-${device.id}`}
                      className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-all duration-200 ${
                        device.isNew ? 'bg-yellow-500/10 dark:bg-yellow-500/5 font-medium' : ''
                      } ${isSelected ? 'bg-blue-50/40 dark:bg-blue-950/10' : ''}`}
                    >
                      {/* Selection checkbox */}
                      <td className="p-4 text-center">
                        <input 
                          id={`check_select_${device.id}`}
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => handleSelectRow(device.id)} 
                          className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                        />
                      </td>

                      {/* STATUS BADGE WITH DISTINCT HIGH-CONTRAST ICONS */}
                      <td className="p-4 text-center">
                        {getStatusBadge(device.status, device.isNew)}
                      </td>

                      {/* IP ADDRESS */}
                      <td className="p-4 font-mono font-semibold text-zinc-950 dark:text-zinc-200">
                        {device.ip}
                      </td>

                      {/* NAME / HOSTNAME */}
                      <td className="p-4">
                        {isEditing ? (
                          <input
                            id={`edit_name_${device.id}`}
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                          />
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">{device.name}</span>
                            {device.notes && (
                              <span className="text-[10.5px] text-zinc-400 italic truncate max-w-[150px]" title={device.notes}>
                                {device.notes}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* DEVICE TYPE */}
                      <td className="p-4 capitalize">
                        {isEditing ? (
                          <select
                            id={`edit_type_${device.id}`}
                            value={editType}
                            onChange={(e) => setEditType(e.target.value as DeviceType)}
                            className="w-full px-2 py-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                          >
                            <option value="modem">Modem</option>
                            <option value="firewall">Firewall</option>
                            <option value="router">Router</option>
                            <option value="switch">Switch</option>
                            <option value="ap">Access Point</option>
                            <option value="extender">Extender</option>
                            <option value="computer">Computer</option>
                            <option value="printer">Printer</option>
                            <option value="scanner">Scanner</option>
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[10.5px] font-medium text-zinc-600 dark:text-zinc-400 capitalize">
                            {getDeviceIcon(device.deviceType, device.status, device.name, "w-3.5 h-3.5")}
                            {device.deviceType}
                          </span>
                        )}
                      </td>

                      {/* OS FINGERPRINT */}
                      <td className="p-4 font-mono text-[11px] truncate max-w-[180px]" title={device.os}>
                        {isEditing ? (
                          <input
                            id={`edit_os_${device.id}`}
                            type="text"
                            value={editOS}
                            onChange={(e) => setEditOS(e.target.value)}
                            className="w-full px-2 py-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                          />
                        ) : (
                          device.os
                        )}
                      </td>

                      {/* PING LATENCY */}
                      <td className="p-4 text-center font-mono font-bold">
                        {device.status === 'online' ? (
                          <span className={`${
                            device.latency < 2 ? 'text-emerald-600 dark:text-emerald-400' :
                            device.latency < 5 ? 'text-blue-500' : 'text-amber-500'
                          }`}>
                            {device.latency} ms
                          </span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>

                      {/* PARENT/UPLINK GATEWAY */}
                      <td className="p-4 text-xs text-zinc-500">
                        {device.parentId ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                              {devices.find(d => d.id === device.parentId)?.name || 'Gateway Switch'}
                            </span>
                            {device.switchPort && (
                              <span className="text-[10px] text-zinc-400 font-mono">Switch Port {device.switchPort}</span>
                            )}
                          </div>
                        ) : (
                          <span className="italic">Core Uplink</span>
                        )}
                      </td>

                      {/* MAC OUI VENDOR */}
                      <td className="p-4 text-zinc-500 font-sans truncate max-w-[120px]" title={device.vendor}>
                        {device.vendor}
                      </td>

                      {/* COMBINED ACTIONS UNDER AN ELLIPSIS DROPDOWN */}
                      <td className="p-4 text-right whitespace-nowrap relative">
                        <div className="flex items-center justify-end gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                id={`btn_save_edit_${device.id}`}
                                onClick={() => saveEdit(device)}
                                className="p-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 rounded border border-emerald-200 dark:border-emerald-900 transition"
                                title="Save device edits"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                id={`btn_cancel_edit_${device.id}`}
                                onClick={cancelEdit}
                                className="p-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 rounded border border-rose-200 dark:border-rose-900 transition"
                                title="Cancel editing"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <div className="relative inline-block text-left">
                              <button
                                id={`btn_actions_menu_${device.id}`}
                                onClick={() => setActiveMenuDeviceId(activeMenuDeviceId === device.id ? null : device.id)}
                                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 transition cursor-pointer"
                                title="Actions Menu"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {/* Action dropdown menu */}
                              <AnimatePresence>
                                {activeMenuDeviceId === device.id && (
                                  <>
                                    {/* Transparent click catcher backing layer */}
                                    <div 
                                      className="fixed inset-0 z-20 cursor-default" 
                                      onClick={() => setActiveMenuDeviceId(null)}
                                    />
                                    <motion.div
                                      id={`actions_dropdown_${device.id}`}
                                      initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                      className="absolute right-0 mt-1 z-30 w-52 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-1.5 rounded-xl shadow-xl text-xs text-left divide-y divide-zinc-100 dark:divide-zinc-800/80"
                                    >
                                      {/* Core utilities */}
                                      <div className="py-1">
                                        <button
                                          id={`btn_menu_edit_${device.id}`}
                                          onClick={() => {
                                            startEditing(device);
                                            setActiveMenuDeviceId(null);
                                          }}
                                          disabled={currentUserRole !== 'admin'}
                                          className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300 disabled:opacity-50 transition text-left cursor-pointer"
                                        >
                                          <Edit2 className="w-3.5 h-3.5 text-zinc-400" />
                                          <span>Edit Specifications</span>
                                        </button>

                                        {onSelectDeviceOnGraph && (
                                          <button
                                            id={`btn_menu_locate_${device.id}`}
                                            onClick={() => {
                                              onSelectDeviceOnGraph(device);
                                              setActiveMenuDeviceId(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300 transition text-left cursor-pointer"
                                          >
                                            <Eye className="w-3.5 h-3.5 text-zinc-400" />
                                            <span>Locate on Map</span>
                                          </button>
                                        )}

                                        {onAnalyzeDevice && (
                                          <button
                                            id={`btn_menu_ai_${device.id}`}
                                            onClick={() => {
                                              onAnalyzeDevice(device);
                                              setActiveMenuDeviceId(null);
                                            }}
                                            disabled={isAnalyzing}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-indigo-600 dark:text-indigo-400 disabled:opacity-50 transition text-left cursor-pointer font-semibold"
                                          >
                                            <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                                            <span>Run Gemini AI Audit</span>
                                          </button>
                                        )}
                                      </div>

                                      {/* New Device Approval/Decline */}
                                      {device.isNew && onAcceptDevice && onRejectDevice && (
                                        <div className="py-1">
                                          <button
                                            id={`btn_menu_accept_${device.id}`}
                                            onClick={async () => {
                                              await onAcceptDevice(device.id);
                                              setActiveMenuDeviceId(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg text-emerald-600 dark:text-emerald-400 font-semibold transition text-left cursor-pointer"
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Approve & Accept</span>
                                          </button>
                                          <button
                                            id={`btn_menu_reject_${device.id}`}
                                            onClick={async () => {
                                              await onRejectDevice(device.id);
                                              setActiveMenuDeviceId(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-rose-600 dark:text-rose-400 font-semibold transition text-left cursor-pointer"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                            <span>Decline & Reject</span>
                                          </button>
                                        </div>
                                      )}

                                      {/* Credentials Mapping Overrides */}
                                      <div className="py-1">
                                        <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                                          Credential Overrides
                                        </div>
                                        <button
                                          id={`btn_menu_cred_none_${device.id}`}
                                          onClick={async () => {
                                            await bindCredentialToDevice(device, null);
                                            setActiveMenuDeviceId(null);
                                          }}
                                          className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 transition text-left cursor-pointer"
                                        >
                                          <Link className="w-3.5 h-3.5 text-zinc-400" />
                                          <span>Default Global</span>
                                        </button>
                                        {credentials.map(c => (
                                          <button
                                            key={c.id}
                                            id={`btn_menu_cred_${c.id}_${device.id}`}
                                            onClick={async () => {
                                              await bindCredentialToDevice(device, c.id);
                                              setActiveMenuDeviceId(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300 transition text-left cursor-pointer"
                                          >
                                            <Link className="w-3.5 h-3.5 text-zinc-400" />
                                            <span className="truncate">{c.label}</span>
                                          </button>
                                        ))}
                                      </div>

                                      {/* Deletion of individual row */}
                                      {onBulkDelete && (
                                        <div className="py-1">
                                          <button
                                            id={`btn_menu_delete_${device.id}`}
                                            onClick={async () => {
                                              if (window.confirm(`Are you sure you want to remove ${device.name} from active network inventory?`)) {
                                                await onBulkDelete([device.id]);
                                              }
                                              setActiveMenuDeviceId(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-rose-600 dark:text-rose-400 font-bold transition text-left cursor-pointer"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Delete Device</span>
                                          </button>
                                        </div>
                                      )}
                                    </motion.div>
                                  </>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Data Grid Pagination Bar & Page Size Selector */}
        <div id="data_grid_pagination_bar" className="px-6 py-3 bg-zinc-50 dark:bg-zinc-800/40 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
          {/* Page Size Selector Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-medium">Show per page:</span>
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 shadow-xs">
              {[25, 50, 75, 100].map(size => (
                <button
                  key={size}
                  id={`btn_pagesize_${size}`}
                  onClick={() => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                    pageSize === size
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Page Info and Prev/Next Navigation */}
          <div className="flex items-center gap-4 text-zinc-600 dark:text-zinc-400">
            <span>
              Showing <strong className="text-zinc-900 dark:text-zinc-100">{totalItems > 0 ? startIndex + 1 : 0}</strong>–<strong className="text-zinc-900 dark:text-zinc-100">{Math.min(startIndex + pageSize, totalItems)}</strong> of <strong className="text-zinc-900 dark:text-zinc-100">{totalItems}</strong> devices
            </span>

            <div className="flex items-center gap-1.5">
              <button
                id="btn_prev_page"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={safeCurrentPage <= 1}
                className="px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 font-mono font-bold text-zinc-900 dark:text-zinc-200">
                {safeCurrentPage} / {totalPages}
              </span>
              <button
                id="btn_next_page"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Editing Area for Notes & Details */}
      <AnimatePresence>
        {editingDeviceId && (
          <motion.div
            id="inline_edit_drawer"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="p-5 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl"
          >
            <h4 className="font-bold text-zinc-950 dark:text-zinc-200 text-sm mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              Advanced Device Configuration Parameters
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-400 text-[10.5px] uppercase tracking-wider font-semibold mb-1">
                  Administrator Audit Notes / Details
                </label>
                <textarea
                  id="textarea_edit_notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Describe location, VLAN assignments, physical port mappings, software packages, or operational status flags..."
                  className="w-full h-24 p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-zinc-400 text-[10.5px] uppercase tracking-wider font-semibold mb-1">
                    Matched OS Specifications Override
                  </label>
                  <input
                    id="input_edit_os"
                    type="text"
                    value={editOS}
                    onChange={(e) => setEditOS(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs rounded-lg focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    id="btn_cancel_drawer"
                    onClick={cancelEdit}
                    className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn_save_drawer"
                    onClick={() => saveEdit(devices.find(d => d.id === editingDeviceId)!)}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition"
                  >
                    Save Specifications
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ICMP PING DIAGNOSTIC RESULT TOAST NOTIFICATION POPOVER */}
      <AnimatePresence>
        {showPingToast && pingingDevice && (
          <motion.div
            id="table_ping_diagnostic_toast"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-96 bg-white/95 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-4 backdrop-blur-md text-left"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Radio className="w-4 h-4 animate-pulse" />
                </span>
                <div>
                  <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">ICMP Ping Diagnostic Test</h4>
                  <p className="text-[11px] font-mono text-zinc-500">{pingingDevice.name} ({pingingDevice.ip})</p>
                </div>
              </div>
              <button
                id="btn_close_table_ping_toast"
                onClick={() => setShowPingToast(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isPinging ? (
              <div className="py-6 flex flex-col items-center justify-center space-y-2">
                <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Transmitting 5 ICMP echo request packets...</p>
                <p className="text-[10px] text-zinc-400">Measuring round-trip time & packet jitter</p>
              </div>
            ) : pingResult ? (
              <div className="pt-3 space-y-3">
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                    <span className="text-zinc-400 block text-[9px] uppercase font-bold">Received</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{pingResult.received} / {pingResult.transmitted}</span>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                    <span className="text-zinc-400 block text-[9px] uppercase font-bold">Packet Loss</span>
                    <span className={`font-mono font-bold ${pingResult.lossPercent > 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {pingResult.lossPercent}%
                    </span>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                    <span className="text-zinc-400 block text-[9px] uppercase font-bold">Avg Latency</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{pingResult.avgMs} ms</span>
                  </div>
                </div>

                {/* Packet log details */}
                <div className="bg-zinc-950 text-emerald-400 p-2.5 rounded-xl font-mono text-[10.5px] space-y-1 max-h-36 overflow-y-auto shadow-inner border border-zinc-800">
                  {pingResult.packets.map((pkt) => (
                    <div key={pkt.seq} className="flex justify-between items-center">
                      <span>64 bytes from {pingResult.device.ip}: icmp_seq={pkt.seq} ttl={pkt.ttl}</span>
                      <span className={pkt.status === 'reply' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {pkt.status === 'reply' ? `${pkt.rttMs} ms` : 'Request Timeout'}
                      </span>
                    </div>
                  ))}
                  <div className="pt-1.5 border-t border-zinc-800 text-[9.5px] text-zinc-400 flex justify-between font-mono">
                    <span>rtt min/avg/max = {pingResult.minMs}/{pingResult.avgMs}/{pingResult.maxMs} ms</span>
                    <span className="text-emerald-500 font-bold">Done</span>
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
