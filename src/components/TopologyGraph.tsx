import React, { useState, useRef, useEffect } from 'react';
import { Device, DeviceType, DeviceStatus, PingResult } from '../types.js';
import { 
  Globe, 
  Shield, 
  Network, 
  Router, 
  Monitor, 
  Printer, 
  Scan, 
  HelpCircle,
  Eye,
  Info,
  ChevronDown,
  ChevronRight,
  Maximize2,
  RefreshCw,
  Sparkles,
  Check,
  X,
  Trash2,
  Edit3,
  Server,
  Laptop,
  Wifi,
  Radio,
  Filter,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TopologyGraphProps {
  devices: Device[];
  onSelectDevice: (device: Device) => void;
  selectedDevice: Device | null;
  onAnalyzeDevice?: (device: Device) => void;
  isAnalyzing?: boolean;
  aiAnalysisResult?: string | null;
  onUpdateDevice?: (updated: Device) => Promise<void>;
  onAcceptDevice?: (id: string) => Promise<void>;
  onRejectDevice?: (id: string) => Promise<void>;
}

interface NodePosition {
  id: string;
  x: number;
  y: number;
  originalX: number;
  originalY: number;
  level: number;
}

export default function TopologyGraph({ 
  devices, 
  onSelectDevice, 
  selectedDevice,
  onAnalyzeDevice,
  isAnalyzing = false,
  aiAnalysisResult = null,
  onUpdateDevice,
  onAcceptDevice,
  onRejectDevice
}: TopologyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [collapsedSwitches, setCollapsedSwitches] = useState<Record<string, boolean>>({});
  const [hoveredNode, setHoveredNode] = useState<Device | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<{
    device: Device;
    x: number;
    y: number;
  } | null>(null);
  const [isLegendOpen, setIsLegendOpen] = useState(true);

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
        console.error('Ping diagnostic request failed');
      }
    } catch (err) {
      console.error('Ping execution error:', err);
    } finally {
      setIsPinging(false);
    }
  };

  // Close context menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, device: Device) => {
    e.preventDefault();
    e.stopPropagation();

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    const menuWidth = 210;
    const menuHeight = 220;
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    if (x + menuWidth > rect.width) {
      x = Math.max(10, rect.width - menuWidth - 10);
    }
    if (y + menuHeight > rect.height) {
      y = Math.max(10, rect.height - menuHeight - 10);
    }

    setContextMenu({ device, x, y });
  };

  const trimmedSearch = searchQuery.trim().toLowerCase();
  const isSearching = trimmedSearch.length > 0;

  // Compute set of device IDs that match the search query
  const matchingDeviceIds = React.useMemo(() => {
    if (!isSearching) return new Set<string>();

    return new Set(
      devices
        .filter(d => 
          d.name.toLowerCase().includes(trimmedSearch) ||
          d.ip.toLowerCase().includes(trimmedSearch) ||
          (d.mac && d.mac.toLowerCase().includes(trimmedSearch)) ||
          (d.vendor && d.vendor.toLowerCase().includes(trimmedSearch)) ||
          (d.deviceType && d.deviceType.toLowerCase().includes(trimmedSearch))
        )
        .map(d => d.id)
    );
  }, [devices, trimmedSearch, isSearching]);

  // Center canvas viewport on a specific node
  const handleCenterOnNode = (deviceId: string) => {
    const pos = positions[deviceId];
    if (!pos || !containerRef.current) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2 - pos.x * zoomScale;
    const centerY = rect.height / 2 - pos.y * zoomScale;
    setPanOffset({ x: centerX, y: centerY });

    const dev = devices.find(d => d.id === deviceId);
    if (dev) {
      onSelectDevice(dev);
    }
  };

  // Inspector local editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Sync editing fields with selected device
  useEffect(() => {
    if (selectedDevice) {
      setEditName(selectedDevice.name);
      setEditNotes(selectedDevice.notes || '');
      setIsEditing(false);
    }
  }, [selectedDevice]);

  // Compute visible devices based on status filter (including preserving infrastructure nodes for rejected devices)
  const visibleDeviceIds = React.useMemo(() => {
    if (statusFilter === 'all') {
      return new Set(devices.map(d => d.id));
    }

    if (statusFilter === 'rejected') {
      const rejectedSet = new Set<string>();
      const rejectedDevices = devices.filter(d => d.status === 'rejected');
      
      // Add all rejected devices
      rejectedDevices.forEach(d => rejectedSet.add(d.id));

      // Trace parent chains up to modem/router to preserve connected switch/AP topology context
      rejectedDevices.forEach(dev => {
        let currentParentId = dev.parentId;
        while (currentParentId) {
          rejectedSet.add(currentParentId);
          const parentDev = devices.find(d => d.id === currentParentId);
          currentParentId = parentDev ? parentDev.parentId : null;
        }
      });

      // Always include core infrastructure devices (Ethernet network switches, APs, routers, modems, firewalls)
      const infrastructureTypes: DeviceType[] = ['modem', 'firewall', 'router', 'switch', 'ap', 'extender'];
      devices.forEach(d => {
        if (infrastructureTypes.includes(d.deviceType)) {
          rejectedSet.add(d.id);
        }
      });

      return rejectedSet;
    }

    return new Set(devices.filter(d => d.status === statusFilter).map(d => d.id));
  }, [devices, statusFilter]);

  // Helper function to calculate spacious, non-overlapping hierarchical positions
  const computeSpaciousLayout = (deviceList: Device[]) => {
    if (!deviceList || deviceList.length === 0) return {};

    const modem = deviceList.find(d => d.deviceType === 'modem');
    const firewall = deviceList.find(d => d.deviceType === 'firewall');
    const routers = deviceList.filter(d => d.deviceType === 'router');
    const switches = deviceList.filter(d => d.deviceType === 'switch');

    const newPositions: Record<string, NodePosition> = {};
    const width = 1200; // Spacious 1200px width

    const assign = (id: string, x: number, y: number, level: number) => {
      newPositions[id] = { id, x, y, originalX: x, originalY: y, level };
    };

    // Level 0: Modem at top-center
    if (modem) assign(modem.id, width / 2, 50, 0);

    // Level 1: Firewalls & Routers
    const l1Devices = [...routers];
    if (firewall) l1Devices.unshift(firewall);
    const l1Gap = Math.max(240, width / (l1Devices.length + 1));
    l1Devices.forEach((d, idx) => {
      const x = l1Devices.length === 1 ? width / 2 : l1Gap * (idx + 1);
      assign(d.id, x, 145, 1);
    });

    // Level 2: Ethernet Switches
    const swGap = Math.max(260, width / (switches.length + 1));
    switches.forEach((sw, idx) => {
      const x = switches.length === 1 ? width / 2 : swGap * (idx + 1);
      assign(sw.id, x, 245, 2);
    });

    // Recursive placement of leaf nodes & endpoints with ample clearance for full device names
    const placeChildrenOf = (parentId: string, currentLevel: number, startY: number) => {
      const children = deviceList.filter(d => d.parentId === parentId && !newPositions[d.id]);
      if (children.length === 0) return;

      const parentPos = newPositions[parentId];
      if (!parentPos) return;

      const parentX = parentPos.x;
      const totalChildren = children.length;

      // Minimum horizontal distance between node centers to fit full device names without label collision (210px)
      const NODE_CENTER_GAP = 210;
      const totalSpan = (totalChildren - 1) * NODE_CENTER_GAP;
      const startX = parentX - totalSpan / 2;

      children.forEach((child, idx) => {
        const x = totalChildren === 1 ? parentX : startX + idx * NODE_CENTER_GAP;
        // Stagger Y position slightly if there are many sibling nodes to prevent side-by-side or label crowding
        const staggerY = totalChildren > 3 ? (idx % 2 === 0 ? 0 : 55) : 0;
        const y = startY + 115 + staggerY;

        assign(child.id, x, y, currentLevel);
        placeChildrenOf(child.id, currentLevel + 1, y);
      });
    };

    switches.forEach(sw => placeChildrenOf(sw.id, 3, 245));
    routers.forEach(r => placeChildrenOf(r.id, 2, 145));
    if (firewall) placeChildrenOf(firewall.id, 2, 145);

    // Any unparented devices
    const unassigned = deviceList.filter(d => !newPositions[d.id]);
    if (unassigned.length > 0) {
      const unGap = Math.max(210, width / (unassigned.length + 1));
      unassigned.forEach((d, idx) => {
        assign(d.id, unGap * (idx + 1), 520, 4);
      });
    }

    // MULTI-PASS COLLISION RESOLUTION to guarantee zero overlap of device labels
    const posArray = Object.values(newPositions);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < posArray.length; i++) {
        for (let j = i + 1; j < posArray.length; j++) {
          const n1 = posArray[i];
          const n2 = posArray[j];

          // Check nodes on similar vertical bands
          if (Math.abs(n1.y - n2.y) < 55) {
            const dx = n2.x - n1.x;
            const minDist = 200; // minimum gap
            if (Math.abs(dx) < minDist) {
              const overlap = minDist - Math.abs(dx);
              const shift = overlap / 2 + 5;
              if (dx >= 0) {
                n1.x -= shift;
                n2.x += shift;
              } else {
                n1.x += shift;
                n2.x -= shift;
              }
            }
          }
        }
      }
    }

    return newPositions;
  };

  // Explicit Auto-Arrange positioning layout function
  const handleAutoArrange = () => {
    if (!devices || devices.length === 0) return;
    const computed = computeSpaciousLayout(devices);
    setPositions(computed);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Calculate hierarchical positions whenever devices list changes
  useEffect(() => {
    if (!devices || devices.length === 0) return;
    const newPositions = computeSpaciousLayout(devices);

    // Merge or maintain custom dragged offsets if positions already exist
    setPositions(prev => {
      const merged = { ...newPositions };
      Object.keys(prev).forEach(key => {
        if (merged[key] && prev[key] && (prev[key].x !== prev[key].originalX || prev[key].y !== prev[key].originalY)) {
          merged[key].x = prev[key].x;
          merged[key].y = prev[key].y;
        }
      });
      return merged;
    });
  }, [devices]);

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (e.button !== 0) return; // Only left click
    setDraggedNodeId(id);
    const node = positions[id];
    if (node) {
      // Calculate coordinates scaled by zoom
      const clientX = e.clientX;
      const clientY = e.clientY;
      setDragOffset({
        x: (clientX / zoomScale) - node.x,
        y: (clientY / zoomScale) - node.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNodeId) {
      const clientX = e.clientX;
      const clientY = e.clientY;
      const newX = (clientX / zoomScale) - dragOffset.x;
      const newY = (clientY / zoomScale) - dragOffset.y;
      
      setPositions(prev => ({
        ...prev,
        [draggedNodeId]: {
          ...prev[draggedNodeId],
          x: Math.max(20, Math.min(1180, newX)),
          y: Math.max(20, Math.min(780, newY))
        }
      }));
    } else if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPanOffset(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setDraggedNodeId(null);
    setIsPanning(false);
  };

  const startPan = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as SVGElement).tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const toggleCollapseSwitch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedSwitches(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Reset positions to default layout
  const handleResetLayout = () => {
    setPositions(prev => {
      const reset: Record<string, NodePosition> = {};
      Object.keys(prev).forEach(key => {
        reset[key] = {
          ...prev[key],
          x: prev[key].originalX,
          y: prev[key].originalY
        };
      });
      return reset;
    });
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const getNodeColorClass = (type: DeviceType, status: DeviceStatus, isSelected: boolean) => {
    if (isSelected) {
      return "fill-blue-50/95 stroke-blue-500 dark:fill-blue-950/40 dark:stroke-blue-400 stroke-[2.5px]";
    }
    if (status === 'offline') {
      return "fill-rose-50/95 stroke-rose-400 dark:fill-rose-950/20 dark:stroke-rose-800 stroke-[1.5px]";
    }
    if (status === 'sleep') {
      return "fill-amber-50/95 stroke-amber-400 dark:fill-amber-950/20 dark:stroke-amber-700 stroke-[1.5px]";
    }

    switch (type) {
      case 'modem':
        return "fill-slate-50/95 stroke-slate-500 dark:fill-slate-900/40 dark:stroke-slate-600 stroke-[1.5px]";
      case 'firewall':
        return "fill-rose-50/95 stroke-rose-500 dark:fill-rose-950/20 dark:stroke-rose-600 stroke-[1.5px]";
      case 'router':
        return "fill-amber-50/95 stroke-amber-500 dark:fill-amber-950/20 dark:stroke-amber-600 stroke-[1.5px]";
      case 'switch':
        return "fill-indigo-50/95 stroke-indigo-500 dark:fill-indigo-950/20 dark:stroke-indigo-600 stroke-[1.5px]";
      case 'computer':
        return "fill-zinc-50/95 stroke-zinc-400 dark:fill-zinc-900/40 dark:stroke-zinc-500 stroke-[1.5px]";
      case 'printer':
        return "fill-emerald-50/95 stroke-emerald-400 dark:fill-emerald-950/20 dark:stroke-emerald-600 stroke-[1.5px]";
      case 'scanner':
        return "fill-sky-50/95 stroke-sky-400 dark:fill-sky-950/20 dark:stroke-sky-600 stroke-[1.5px]";
      default:
        return "fill-white stroke-zinc-200 dark:fill-zinc-900 dark:stroke-zinc-800 stroke-[1.5px]";
    }
  };

  const renderRealisticDeviceHardware = (type: DeviceType, status: DeviceStatus, name: string, isSelected: boolean) => {
    const isOnline = status === 'online';
    const isSleep = status === 'sleep';
    const isOffline = status === 'offline';
    const isRejected = status === 'rejected';
    
    // Plate border color based on status
    let statusGlow = "rgba(113, 113, 122, 0.1)";
    if (isOnline) {
      statusGlow = "rgba(16, 185, 129, 0.15)";
    } else if (isSleep) {
      statusGlow = "rgba(245, 158, 11, 0.15)";
    } else if (isOffline) {
      statusGlow = "rgba(239, 68, 68, 0.15)";
    } else if (isRejected) {
      statusGlow = "rgba(161, 161, 170, 0.15)";
    }

    if (isSelected) {
      statusGlow = "rgba(59, 130, 246, 0.25)";
    }

    const nameLower = (name || '').toLowerCase();

    return (
      <g>
        {/* Glow filter underlay */}
        <circle r="26" fill={isSelected ? "rgba(59,130,246,0.15)" : statusGlow} className="transition-all duration-300 filter blur-[2px]" />

        {/* Selection Rotating Orbital Ring */}
        {isSelected && (
          <rect
            x="-29"
            y="-29"
            width="58"
            height="58"
            rx="13"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            className="animate-[spin_12s_linear_infinite]"
          />
        )}

        {/* Device Platform baseplate - Smaller, Lighter, Neater! */}
        <rect
          x="-24"
          y="-24"
          width="48"
          height="48"
          rx="10"
          className="transition-all duration-300 fill-white dark:fill-zinc-900 shadow-sm"
          stroke={isSelected ? "#3b82f6" : "rgba(228, 228, 231, 0.9)"} // very soft neutral border
          strokeWidth={isSelected ? 1.8 : 1}
        />
        {/* Subtle physical inner groove */}
        <rect
          x="-21"
          y="-21"
          width="42"
          height="42"
          rx="8"
          fill="none"
          stroke="rgba(0,0,0,0.02)"
          className="dark:stroke-white/5"
          strokeWidth="0.8"
        />

        {/* Specific realistic hardware models - Lighter & Neater! */}
        {(() => {
          if (type === 'modem') {
            return (
              <g id="modem-hardware">
                {/* Slim vertical body */}
                <rect x="-6" y="-14" width="12" height="28" rx="2.5" fill="#f8fafc" className="dark:fill-zinc-800" stroke="#cbd5e1" strokeWidth="0.8" />
                <rect x="-1.5" y="-14" width="3" height="28" fill="#e2e8f0" className="dark:fill-zinc-700" />
                <circle cx="2.5" cy="-8" r="0.7" fill={isOnline ? "#10b981" : "#ef4444"} />
                <circle cx="2.5" cy="-4" r="0.7" fill={isOnline ? "#10b981" : "#cbd5e1"} />
                <circle cx="2.5" cy="0" r="0.7" fill={isOnline ? "#3b82f6" : "#cbd5e1"} />
                <circle cx="2.5" cy="4" r="0.7" fill={isOnline ? "#10b981" : "#cbd5e1"} />
                <circle cx="2.5" cy="8" r="0.7" fill={isOnline ? "#10b981" : "#cbd5e1"} />
              </g>
            );
          }
          
          if (type === 'firewall') {
            return (
              <g id="firewall-hardware">
                {/* 1U soft-red device */}
                <rect x="-18" y="-8" width="36" height="16" rx="1.5" fill="#fee2e2" className="dark:fill-rose-950/40" stroke="#fca5a5" strokeWidth="0.8" />
                <rect x="-14" y="-5" width="28" height="10" fill="#fef2f2" className="dark:fill-zinc-950" rx="1" />
                <line x1="-10" y1="-2" x2="10" y2="-2" stroke="#fca5a5" strokeWidth="0.6" opacity="0.5" />
                <line x1="-10" y1="1" x2="10" y2="1" stroke="#fca5a5" strokeWidth="0.6" opacity="0.5" />
                <circle cx="-16" cy="-4" r="0.7" fill={isOnline ? "#10b981" : "#ef4444"} />
                <circle cx="-16" cy="2" r="0.7" fill={isOnline ? "#6366f1" : "#cbd5e1"} />
              </g>
            );
          }

          if (type === 'router') {
            return (
              <g id="router-hardware">
                {/* Sleek round Cisco style */}
                <ellipse cx="0" cy="3" rx="15" ry="8" fill="#f1f5f9" className="dark:fill-zinc-800" stroke="#cbd5e1" strokeWidth="0.8" />
                <ellipse cx="0" cy="1.5" rx="12.5" ry="6" fill="#f8fafc" className="dark:fill-zinc-700" />
                <ellipse cx="0" cy="0" rx="9.5" ry="4.5" fill="#e2e8f0" className="dark:fill-zinc-900" />
                
                {/* Delicate antennas */}
                <line x1="-9" y1="-1" x2="-12" y2="-15" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="9" y1="-1" x2="13" y2="-15" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />

                {/* Wireless active signal pulses */}
                {isOnline && (
                  <path d="M-10,-17 Q0,-21 10,-17" fill="none" stroke="#60a5fa" strokeWidth="0.8" className="animate-pulse" />
                )}
              </g>
            );
          }

          if (type === 'switch') {
            return (
              <g id="switch-hardware">
                {/* Modern light gray rack-switch */}
                <rect x="-19" y="-8" width="38" height="16" rx="1.5" fill="#f1f5f9" className="dark:fill-zinc-800" stroke="#cbd5e1" strokeWidth="0.8" />
                <rect x="-15" y="-2" width="30" height="7" fill="#e2e8f0" className="dark:fill-zinc-950" rx="1" />
                
                {/* Square Ports */}
                <rect x="-12" y="-0.5" width="2.2" height="2.2" fill="#94a3b8" rx="0.3" />
                <rect x="-7" y="-0.5" width="2.2" height="2.2" fill="#94a3b8" rx="0.3" />
                <rect x="-2" y="-0.5" width="2.2" height="2.2" fill="#94a3b8" rx="0.3" />
                <rect x="3" y="-0.5" width="2.2" height="2.2" fill="#94a3b8" rx="0.3" />
                <rect x="8" y="-0.5" width="2.2" height="2.2" fill="#94a3b8" rx="0.3" />

                {/* Soft port links */}
                <circle cx="-10.9" cy="-1.2" r="0.5" fill={isOnline ? "#10b981" : "#94a3b8"} />
                <circle cx="-5.9" cy="-1.2" r="0.5" fill={isOnline ? "#10b981" : "#94a3b8"} />
                <circle cx="-0.9" cy="-1.2" r="0.5" fill={isOnline ? "#3b82f6" : "#94a3b8"} />
                <circle cx="4.1" cy="-1.2" r="0.5" fill={isOnline ? "#10b981" : "#94a3b8"} />
                <circle cx="9.1" cy="-1.2" r="0.5" fill={isOnline ? "#10b981" : "#94a3b8"} />
              </g>
            );
          }

          if (type === 'ap') {
            return (
              <g id="ap-hardware">
                {/* Elegant White Dome AP */}
                <circle cx="0" cy="0" r="14" fill="#ffffff" className="dark:fill-zinc-800" stroke="#e2e8f0" strokeWidth="0.8" />
                {/* Blue halo ring */}
                <circle cx="0" cy="0" r="7" fill="none" stroke="#3b82f6" strokeWidth="0.8" strokeDasharray="2 1" opacity="0.8" className={isOnline ? "animate-pulse" : ""} />
                {/* Status LED center dot */}
                <circle cx="0" cy="0" r="2" fill={isOnline ? "#3b82f6" : (isSleep ? "#f59e0b" : "#ef4444")} />
                {/* Wave indicators */}
                {isOnline && (
                  <g opacity="0.5">
                    <circle cx="0" cy="0" r="11" fill="none" stroke="#60a5fa" strokeWidth="0.6" strokeDasharray="1 3" />
                  </g>
                )}
              </g>
            );
          }

          if (type === 'extender') {
            return (
              <g id="extender-hardware">
                {/* Sleek Wall-plug Extender */}
                <rect x="-10" y="-14" width="20" height="28" rx="3.5" fill="#ffffff" className="dark:fill-zinc-800" stroke="#e2e8f0" strokeWidth="0.8" />
                {/* Vertical ridges */}
                <line x1="-5" y1="-6" x2="-5" y2="10" stroke="#f1f5f9" className="dark:stroke-zinc-700" strokeWidth="0.8" />
                <line x1="0" y1="-6" x2="0" y2="10" stroke="#f1f5f9" className="dark:stroke-zinc-700" strokeWidth="0.8" />
                <line x1="5" y1="-6" x2="5" y2="10" stroke="#f1f5f9" className="dark:stroke-zinc-700" strokeWidth="0.8" />
                {/* Central signal dot */}
                <circle cx="0" cy="-10" r="1.5" fill={isOnline ? "#10b981" : (isSleep ? "#f59e0b" : "#ef4444")} />
                {/* Faint Wi-Fi symbol lines */}
                {isOnline && (
                  <path d="M-4,3 Q0,-1 4,3" fill="none" stroke="#10b981" strokeWidth="0.8" />
                )}
              </g>
            );
          }

          if (type === 'computer') {
            if (nameLower.includes('server')) {
              return (
                <g id="server-hardware">
                  {/* Miniature server blade */}
                  <rect x="-13" y="-16" width="26" height="32" rx="2" fill="#f8fafc" className="dark:fill-zinc-800" stroke="#cbd5e1" strokeWidth="0.8" />
                  <rect x="-10" y="-12" width="20" height="6" rx="0.5" fill="#e2e8f0" className="dark:fill-zinc-950" />
                  <circle cx="6" cy="-9" r="0.6" fill={isOnline ? "#10b981" : "#cbd5e1"} />
                  <rect x="-10" y="-3" width="20" height="6" rx="0.5" fill="#e2e8f0" className="dark:fill-zinc-950" />
                  <circle cx="6" cy="0" r="0.6" fill={isOnline ? "#10b981" : "#cbd5e1"} />
                  <rect x="-10" y="6" width="20" height="6" rx="0.5" fill="#e2e8f0" className="dark:fill-zinc-950" />
                  <circle cx="6" cy="9" r="0.6" fill={isOnline ? "#10b981" : "#cbd5e1"} />
                </g>
              );
            }

            if (nameLower.includes('mac') || nameLower.includes('laptop') || nameLower.includes('workstation')) {
              return (
                <g id="laptop-hardware">
                  {/* Clean open laptop */}
                  <rect x="-11" y="-10" width="22" height="13" rx="1" fill="#f1f5f9" className="dark:fill-zinc-800" stroke="#cbd5e1" strokeWidth="0.8" />
                  <rect x="-9.5" y="-8.5" width="19" height="10" fill="#0f172a" />
                  <polygon points="-15,8 15,8 12,3 -12,3" fill="#cbd5e1" className="dark:fill-zinc-600" stroke="#cbd5e1" strokeWidth="0.6" />
                  <rect x="-3" y="6" width="6" height="1.5" fill="#94a3b8" rx="0.2" />
                </g>
              );
            }

            // Minimalist desktop PC
            return (
              <g id="workstation-hardware">
                {/* Thin-bezel Monitor */}
                <rect x="-15" y="-12" width="22" height="14" rx="1" fill="#f8fafc" className="dark:fill-zinc-800" stroke="#cbd5e1" strokeWidth="0.8" />
                <rect x="-13.5" y="-10.5" width="19" height="11" fill="#0f172a" />
                <rect x="-6" y="2" width="4" height="4" fill="#94a3b8" />
                <ellipse cx="-4" cy="6.5" rx="6" ry="1" fill="#cbd5e1" />
                {/* Slim desktop tower */}
                <rect x="9" y="-7" width="6" height="15" rx="0.5" fill="#f1f5f9" className="dark:fill-zinc-800" stroke="#cbd5e1" strokeWidth="0.8" />
                <circle cx="12" cy="-4" r="0.6" fill={isOnline ? "#10b981" : "#cbd5e1"} />
              </g>
            );
          }

          if (type === 'printer') {
            return (
              <g id="printer-hardware">
                {/* Sleek office printer */}
                <rect x="-12" y="-7" width="24" height="14" rx="1.5" fill="#f8fafc" className="dark:fill-zinc-800" stroke="#cbd5e1" strokeWidth="0.8" />
                <polygon points="-10,-7 10,-7 8,-11 -8,-11" fill="#e2e8f0" className="dark:fill-zinc-700" stroke="#cbd5e1" strokeWidth="0.8" />
                <rect x="-7" y="2.5" width="14" height="4.5" fill="#ffffff" className="dark:fill-zinc-950" stroke="#cbd5e1" strokeWidth="0.5" />
                <circle cx="9" cy="-3" r="0.7" fill={isOnline ? "#10b981" : "#cbd5e1"} />
              </g>
            );
          }

          if (type === 'scanner') {
            return (
              <g id="scanner-hardware">
                <rect x="-13" y="-6" width="26" height="12" rx="1" fill="#f8fafc" className="dark:fill-zinc-800" stroke="#cbd5e1" strokeWidth="0.8" />
                <polygon points="-11,-6 11,-6 9,-9 -9,-9" fill="#e2e8f0" className="dark:fill-zinc-700" stroke="#cbd5e1" strokeWidth="0.8" />
                <line x1="-9" y1="0" x2="9" y2="0" stroke="#22d3ee" strokeWidth="1.2" className={isOnline ? "animate-pulse" : ""} />
                <circle cx="10" cy="-3" r="0.7" fill={isOnline ? "#10b981" : "#cbd5e1"} />
              </g>
            );
          }

          return null;
        })()}

        {/* Small physical status badge overlay bottom-right */}
        <circle
          cx="17"
          cy="17"
          r="4"
          className={`${isOnline ? "fill-emerald-500" : isSleep ? "fill-amber-500" : isOffline ? "fill-rose-500" : isRejected ? "fill-zinc-400" : "fill-zinc-400"} stroke-white dark:stroke-zinc-900`}
          strokeWidth="1.2"
        />
      </g>
    );
  };

  const getDeviceIcon = (type: DeviceType, status: DeviceStatus, name?: string) => {
    const baseClass = "w-6 h-6 transition-all duration-300";
    let color = "text-zinc-600 dark:text-zinc-300";
    if (status === 'online') color = "text-emerald-600 dark:text-emerald-400";
    if (status === 'sleep') color = "text-amber-500 dark:text-amber-400";
    if (status === 'offline') color = "text-rose-500 dark:text-rose-400";
    if (status === 'rejected') color = "text-zinc-400 dark:text-zinc-500";

    const nameLower = (name || '').toLowerCase();

    switch (type) {
      case 'modem':
        return <Globe id="ic_modem" className={`${baseClass} ${color}`} />;
      case 'firewall':
        return <Shield id="ic_firewall" className={`${baseClass} ${color}`} />;
      case 'router':
        return <Router id="ic_router" className={`${baseClass} ${color}`} />;
      case 'switch':
        return <Network id="ic_switch" className={`${baseClass} ${color}`} />;
      case 'ap':
        return <Wifi id="ic_ap" className={`${baseClass} ${color}`} />;
      case 'extender':
        return <Radio id="ic_extender" className={`${baseClass} ${color}`} />;
      case 'computer':
        if (nameLower.includes('server')) {
          return <Server id="ic_server" className={`${baseClass} ${color}`} />;
        }
        if (nameLower.includes('mac') || nameLower.includes('laptop') || nameLower.includes('workstation')) {
          return <Laptop id="ic_laptop" className={`${baseClass} ${color}`} />;
        }
        return <Monitor id="ic_pc" className={`${baseClass} ${color}`} />;
      case 'printer':
        return <Printer id="ic_printer" className={`${baseClass} ${color}`} />;
      case 'scanner':
        return <Scan id="ic_scanner" className={`${baseClass} ${color}`} />;
      default:
        return <HelpCircle id="ic_help" className={`${baseClass} ${color}`} />;
    }
  };

  const getStatusColor = (status: DeviceStatus, flashing: boolean = false) => {
    if (flashing) return 'bg-yellow-400 animate-pulse ring-4 ring-yellow-400/30';
    switch (status) {
      case 'online':
        return 'bg-emerald-500 ring-4 ring-emerald-500/20';
      case 'sleep':
        return 'bg-amber-500 ring-4 ring-amber-500/20';
      case 'offline':
        return 'bg-rose-500 ring-4 ring-rose-500/20';
      default:
        return 'bg-zinc-400';
    }
  };

  // Build active connections lists based on layout map & switch collapse states
  const links: { sourceId: string; targetId: string; source: NodePosition; target: NodePosition; status: DeviceStatus }[] = [];
  
  devices.forEach(device => {
    // If device has a parent, draw a line between their coordinates
    if (device.parentId) {
      const sourceNode = positions[device.parentId];
      const targetNode = positions[device.id];
      
      // Don't show link if the parent switch is collapsed
      const isParentCollapsed = collapsedSwitches[device.parentId];
      if (isParentCollapsed && device.deviceType !== 'switch') {
        return;
      }

      if (sourceNode && targetNode) {
        links.push({
          sourceId: device.parentId,
          targetId: device.id,
          source: sourceNode,
          target: targetNode,
          status: device.status
        });
      }
    }
  });

  return (
    <div id="topology_graph_wrapper">
      {/* TOPOLOGY SEARCH & HIGHLIGHT BAR ABOVE GRAPH */}
      <div id="topology_graph_search_bar" className="mb-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-xl shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input Field */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="input_topology_graph_search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search topology nodes by IP address or device name (e.g. 192.168.1.1, Switch, NAS, Printer)..."
            className="w-full pl-9 pr-24 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
          />
          {searchQuery && (
            <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-md text-[10px] font-bold font-mono">
                {matchingDeviceIds.size} match{matchingDeviceIds.size === 1 ? '' : 'es'}
              </span>
              <button
                id="btn_clear_topology_search"
                onClick={() => setSearchQuery('')}
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md transition cursor-pointer"
                title="Clear search filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Quick Focus Chips when searching */}
        {isSearching && matchingDeviceIds.size > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-0.5">
            <span className="text-[10.5px] font-medium text-zinc-400 whitespace-nowrap">Focus:</span>
            {devices.filter(d => matchingDeviceIds.has(d.id)).slice(0, 4).map(dev => (
              <button
                key={dev.id}
                id={`btn_focus_node_${dev.id}`}
                onClick={() => handleCenterOnNode(dev.id)}
                className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 rounded-md text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition flex items-center gap-1 whitespace-nowrap cursor-pointer shadow-xs"
              >
                <span>{dev.name}</span>
                <span className="text-[9.5px] text-blue-400/80 font-normal">({dev.ip})</span>
              </button>
            ))}
            {matchingDeviceIds.size > 4 && (
              <span className="text-[10px] text-zinc-400 font-mono">+{matchingDeviceIds.size - 4} more</span>
            )}
          </div>
        )}
      </div>

      <div 
        id="topology_canvas_container"
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseDown={(e) => {
          setContextMenu(null);
          startPan(e);
        }}
        onClick={() => setContextMenu(null)}
        className="relative w-full h-[600px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none"
      >
      {/* Zoom / Pan Controls */}
      <div id="canvas_overlay_controls" className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          id="btn_reset_zoom"
          onClick={handleResetLayout}
          title="Reset Viewport & Positions"
          className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          id="btn_zoom_in"
          onClick={() => setZoomScale(z => Math.min(2, z + 0.1))}
          className="px-3 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shadow-sm"
        >
          +
        </button>
        <button
          id="btn_zoom_out"
          onClick={() => setZoomScale(z => Math.max(0.5, z - 0.1))}
          className="px-3 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shadow-sm"
        >
          -
        </button>
        <div id="zoom_label" className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg text-zinc-500 text-xs flex items-center border border-transparent">
          {(zoomScale * 100).toFixed(0)}%
        </div>
      </div>

      {/* L2 Controls & Auto-Arrange - Top Right */}
      <div id="canvas_status_filter" className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          id="btn_auto_arrange_topology"
          onClick={handleAutoArrange}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-lg text-xs shadow-sm transition cursor-pointer"
          title="Auto-arrange layout of all discovered devices"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Auto-Arrange</span>
        </button>

        <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-lg text-xs text-zinc-600 dark:text-zinc-400 shadow-sm">
          <Filter className="w-3.5 h-3.5" />
          <span>Status:</span>
          <select
            id="select_graph_status_filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent border-none text-zinc-900 dark:text-zinc-100 font-semibold focus:outline-none focus:ring-0 ml-1 cursor-pointer text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="online">Online</option>
            <option value="sleep">Sleep Mode</option>
            <option value="offline">Offline</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div id="canvas_legend" className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-x-4 gap-y-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border border-zinc-200 dark:border-zinc-800 p-3 rounded-lg text-xs shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
          <span className="text-zinc-600 dark:text-zinc-400">Online / Reachable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
          <span className="text-zinc-600 dark:text-zinc-400">Sleep / Low Power</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
          <span className="text-zinc-600 dark:text-zinc-400">Offline / No Reply</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse"></div>
          <span className="text-zinc-600 dark:text-zinc-400">New Device Sweep alert</span>
        </div>
      </div>

      {/* Interactive Main SVG Stage */}
      <svg
        id="topology_canvas_svg"
        className="w-full h-full"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
          transformOrigin: '0 0',
          transition: draggedNodeId || isPanning ? 'none' : 'transform 0.15s ease-out'
        }}
      >
        <defs>
          <linearGradient id="linkGradientOnline" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="linkGradientOffline" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="linkGradientSleep" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="platformOnline" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="platformSleep" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="100%" stopColor="#fde68a" />
          </linearGradient>
          <linearGradient id="platformOffline" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fff5f5" />
            <stop offset="100%" stopColor="#fecaca" />
          </linearGradient>
        </defs>

        {/* CONNECTION CABLES / LINKS */}
        <g id="topology_links_group">
          {links.map((link, idx) => {
            // Check visibility based on visibleDeviceIds set (preserves connected infrastructure for rejected devices)
            const sourceDev = devices.find(d => d.id === link.sourceId);
            const targetDev = devices.find(d => d.id === link.targetId);
            const sourceVisible = !sourceDev || visibleDeviceIds.has(sourceDev.id);
            const targetVisible = !targetDev || visibleDeviceIds.has(targetDev.id);
            if (!sourceVisible || !targetVisible) {
              return null;
            }

            const isOnline = link.status === 'online';
            const isSleep = link.status === 'sleep';
            const strokeColor = isOnline 
              ? 'url(#linkGradientOnline)' 
              : isSleep 
                ? 'url(#linkGradientSleep)' 
                : 'url(#linkGradientOffline)';
            
            const isConnectedToMatch = isSearching && (
              (sourceDev && matchingDeviceIds.has(sourceDev.id)) ||
              (targetDev && matchingDeviceIds.has(targetDev.id))
            );
            const linkOpacity = isSearching ? (isConnectedToMatch ? 0.95 : 0.15) : 0.6;

            return (
              <g key={`link-${idx}`} style={{ opacity: linkOpacity, transition: 'opacity 0.2s ease' }}>
                {/* Visual Connection Cable */}
                <line
                  x1={link.source.x}
                  y1={link.source.y}
                  x2={link.target.x}
                  y2={link.target.y}
                  stroke={isOnline ? '#059669' : isSleep ? '#d97706' : '#f43f5e'}
                  strokeWidth={isOnline ? 1.5 : 1}
                  strokeDasharray={link.status === 'offline' ? '4 4' : undefined}
                  className="transition-all duration-300 opacity-60"
                />
                
                {/* Moving Packet Dot Animation on active links */}
                {isOnline && (
                  <circle r="3.5" fill="#34d399" className="opacity-90">
                    <animateMotion
                      dur={`${Math.max(1.5, Math.min(4, 5 / (link.source.level + 1)))}s`}
                      repeatCount="indefinite"
                      path={`M ${link.source.x} ${link.source.y} L ${link.target.x} ${link.target.y}`}
                    />
                  </circle>
                )}
              </g>
            );
          })}
        </g>

        {/* TOPOLOGY NODES */}
        <g id="topology_nodes_group">
          {devices.map((device) => {
            const pos = positions[device.id];
            if (!pos) return null;

            // Filter out nodes based on computed visibleDeviceIds set
            if (!visibleDeviceIds.has(device.id)) {
              return null;
            }

            // If node is an endpoint and its parent is collapsed, do not render it on the graph
            const isParentCollapsed = device.parentId && collapsedSwitches[device.parentId];
            if (isParentCollapsed && device.deviceType !== 'switch') {
              return null;
            }

            const isSelected = selectedDevice?.id === device.id;
            const isSwitch = device.deviceType === 'switch';
            const isCollapsed = collapsedSwitches[device.id];
            const isMatch = isSearching && matchingDeviceIds.has(device.id);
            const nodeOpacity = isSearching ? (isMatch ? 1 : 0.22) : 1;

            // Count endpoints connected to this switch
            const connectedEndpointsCount = devices.filter(d => d.parentId === device.id && d.deviceType !== 'switch').length;

            return (
              <g
                key={device.id}
                id={`node-${device.id}`}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseDown={(e) => handleMouseDown(e, device.id)}
                onClick={() => {
                  setContextMenu(null);
                  onSelectDevice(device);
                }}
                onContextMenu={(e) => handleContextMenu(e, device)}
                onMouseEnter={() => setHoveredNode(device)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ opacity: nodeOpacity, transition: 'opacity 0.2s ease' }}
                className="cursor-grab active:cursor-grabbing group"
              >
                {/* Search Match Glowing Pulsing Highlight Ring */}
                {isMatch && (
                  <g id={`match-highlight-${device.id}`}>
                    <circle
                      r="42"
                      fill="rgba(59, 130, 246, 0.2)"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                      className="animate-pulse"
                    />
                    <circle
                      r="48"
                      fill="none"
                      stroke="#60a5fa"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                      className="animate-spin"
                      style={{ animationDuration: '6s' }}
                    />
                    <g transform="translate(0, -46)">
                      <rect
                        x="-24"
                        y="-9"
                        width="48"
                        height="15"
                        rx="4"
                        fill="#3b82f6"
                        className="shadow-sm"
                      />
                      <text
                        textAnchor="middle"
                        dy="2"
                        fontSize="8.5"
                        fontWeight="bold"
                        fill="#ffffff"
                        className="font-sans uppercase tracking-wider"
                      >
                        MATCH
                      </text>
                    </g>
                  </g>
                )}

                {/* Flashing Ring Highlight for New Devices */}
                {device.isNew && !isMatch && (
                  <circle
                    r="40"
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="3"
                    className="animate-ping opacity-60"
                  />
                )}

                {/* Realistic Hardware Module Drawing */}
                {renderRealisticDeviceHardware(device.deviceType, device.status, device.name, isSelected)}

                {/* Switch Expand/Collapse Badge overlay */}
                {isSwitch && connectedEndpointsCount > 0 && (
                  <g 
                    transform="translate(24, -24)"
                    onClick={(e) => toggleCollapseSwitch(device.id, e)}
                    className="cursor-pointer"
                  >
                    <circle r="10" fill="#3b82f6" className="stroke-white dark:stroke-zinc-900" strokeWidth="1.5" />
                    <text
                      textAnchor="middle"
                      dy="3.5"
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      {isCollapsed ? `+${connectedEndpointsCount}` : '-'}
                    </text>
                  </g>
                )}

                {/* Device Name Labels */}
                <text
                  textAnchor="middle"
                  y="44"
                  fontSize="11"
                  fontWeight="600"
                  fill="currentColor"
                  className={isMatch ? "text-blue-600 dark:text-blue-400 font-bold pointer-events-none drop-shadow-sm font-sans" : "text-zinc-800 dark:text-zinc-200 pointer-events-none drop-shadow-sm font-sans"}
                >
                  {device.name}
                </text>

                {/* Device IP labels */}
                <text
                  textAnchor="middle"
                  y="56"
                  fontSize="9.5"
                  fill="currentColor"
                  className={isMatch ? "text-blue-600 dark:text-blue-400 font-bold font-mono pointer-events-none" : "text-zinc-500 dark:text-zinc-400 font-mono pointer-events-none"}
                >
                  {device.ip}
                </text>

                {/* Interactive Node Port Overlay if attached to switch */}
                {device.parentId && device.switchPort && (
                  <g transform="translate(0, -38)">
                    <rect
                      x="-14"
                      y="-8"
                      width="28"
                      height="14"
                      rx="3"
                      fill="currentColor"
                      className="text-zinc-100 dark:text-zinc-800 stroke-zinc-200 dark:stroke-zinc-700"
                      strokeWidth="1"
                    />
                    <text
                      textAnchor="middle"
                      dy="2"
                      fontSize="8"
                      fontWeight="bold"
                      fill="currentColor"
                      className="text-zinc-600 dark:text-zinc-400 font-mono"
                    >
                      P{device.switchPort}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Hover Details Box */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            id="hover_detail_tooltip"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute right-4 top-4 z-20 w-72 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xl text-xs pointer-events-none"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{hoveredNode.name}</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${
                hoveredNode.status === 'online' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' :
                hoveredNode.status === 'sleep' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' :
                hoveredNode.status === 'rejected' ? 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300' :
                'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
              }`}>
                {hoveredNode.status}
              </span>
            </div>

            <div className="space-y-1.5 text-zinc-600 dark:text-zinc-400">
              <div className="flex justify-between">
                <span>IP Address:</span>
                <span className="font-mono text-zinc-950 dark:text-zinc-200 font-semibold">{hoveredNode.ip}</span>
              </div>
              <div className="flex justify-between">
                <span>MAC OUI:</span>
                <span className="font-mono text-zinc-950 dark:text-zinc-200">{hoveredNode.mac}</span>
              </div>
              <div className="flex justify-between">
                <span>Vendor:</span>
                <span className="text-zinc-950 dark:text-zinc-200 font-medium">{hoveredNode.vendor}</span>
              </div>
              <div className="flex justify-between">
                <span>OS Type:</span>
                <span className="text-zinc-950 dark:text-zinc-200 truncate max-w-[150px]" title={hoveredNode.os}>
                  {hoveredNode.os}
                </span>
              </div>
              {hoveredNode.status === 'online' && (
                <div className="flex justify-between">
                  <span>Ping Latency:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{hoveredNode.latency} ms</span>
                </div>
              )}
              {hoveredNode.parentId && (
                <div className="flex justify-between">
                  <span>Parent Node:</span>
                  <span className="text-zinc-800 dark:text-zinc-300 font-medium truncate max-w-[150px]">
                    {devices.find(d => d.id === hoveredNode.parentId)?.name || 'Switch Gateway'}
                    {hoveredNode.switchPort ? ` [Port ${hoveredNode.switchPort}]` : ''}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING LEGEND COMPONENT */}
      <div
        id="topology_floating_legend"
        className="absolute bottom-4 left-4 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg transition-all duration-200 max-w-[280px]"
      >
        <div className="flex items-center justify-between p-2.5 px-3 border-b border-zinc-100 dark:border-zinc-800/60">
          <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900 dark:text-zinc-100">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <span>Topology Legend</span>
          </div>
          <button
            id="btn_toggle_topology_legend"
            onClick={(e) => {
              e.stopPropagation();
              setIsLegendOpen(!isLegendOpen);
            }}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md transition cursor-pointer"
            title={isLegendOpen ? "Collapse legend" : "Expand legend"}
          >
            {isLegendOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>

        <AnimatePresence>
          {isLegendOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 pt-2 text-[11px] space-y-2.5 overflow-hidden"
            >
              {/* Device Statuses */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Device Statuses
                </div>
                <div className="grid grid-cols-2 gap-1.5 font-medium">
                  <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-xs" />
                    <span>Online</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 shadow-xs" />
                    <span>Sleep Mode</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 shadow-xs" />
                    <span>Offline</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 shrink-0 shadow-xs" />
                    <span>Rejected</span>
                  </div>
                </div>
              </div>

              {/* Link Types */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Link Connections
                </div>
                <div className="space-y-1 text-zinc-600 dark:text-zinc-400 font-medium">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-1 rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 shrink-0" />
                    <span>Active Uplink Cable</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-1 rounded-full bg-amber-500/80 shrink-0" />
                    <span>Standby / Sleep Link</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-1 rounded-full bg-rose-500/80 shrink-0" />
                    <span>Disconnected Link</span>
                  </div>
                </div>
              </div>

              {/* Quick tip */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60 text-[10px] text-zinc-400 italic">
                💡 Right-click any node for Quick AI Analysis, Accept, or Reject!
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* RIGHT-CLICK CONTEXT MENU POPOVER */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            id="node_context_menu_popover"
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
            onClick={(e) => e.stopPropagation()}
            className="absolute z-50 w-52 bg-white/95 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-1.5 backdrop-blur-md"
          >
            {/* Header */}
            <div className="px-2.5 py-2 border-b border-zinc-100 dark:border-zinc-800/80 mb-1 flex items-center justify-between">
              <div className="truncate pr-1">
                <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                  {contextMenu.device.name}
                </div>
                <div className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                  {contextMenu.device.ip}
                </div>
              </div>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                contextMenu.device.status === 'online' ? 'bg-emerald-500' :
                contextMenu.device.status === 'sleep' ? 'bg-amber-500' :
                contextMenu.device.status === 'offline' ? 'bg-rose-500' : 'bg-zinc-400'
              }`} />
            </div>

            {/* Menu options */}
            <div className="space-y-0.5 text-xs">
              {/* Ping Diagnostic */}
              <button
                id="ctx_btn_ping_device"
                onClick={() => {
                  const dev = contextMenu.device;
                  setContextMenu(null);
                  handleRunPing(dev);
                }}
                className="w-full text-left px-2.5 py-1.5 text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg flex items-center gap-2 transition cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                <span>Ping Device (5 Packets)</span>
              </button>

              {/* Analyze with AI */}
              {onAnalyzeDevice && (
                <button
                  id="ctx_btn_analyze_ai"
                  onClick={() => {
                    const dev = contextMenu.device;
                    setContextMenu(null);
                    onSelectDevice(dev);
                    onAnalyzeDevice(dev);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg flex items-center gap-2 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                  <span>Analyze with AI</span>
                </button>
              )}

              {/* Accept Device */}
              {onAcceptDevice && (
                <button
                  id="ctx_btn_accept_device"
                  onClick={async () => {
                    const devId = contextMenu.device.id;
                    setContextMenu(null);
                    await onAcceptDevice(devId);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-emerald-600 dark:text-emerald-400 font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg flex items-center gap-2 transition cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Accept Device</span>
                </button>
              )}

              {/* Reject / Blacklist Device */}
              {onRejectDevice && (
                <button
                  id="ctx_btn_reject_device"
                  onClick={async () => {
                    const devId = contextMenu.device.id;
                    setContextMenu(null);
                    await onRejectDevice(devId);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg flex items-center gap-2 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 text-rose-500" />
                  <span>Reject / Blacklist</span>
                </button>
              )}

              <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

              {/* View Details / Inspect */}
              <button
                id="ctx_btn_view_details"
                onClick={() => {
                  const dev = contextMenu.device;
                  setContextMenu(null);
                  onSelectDevice(dev);
                }}
                className="w-full text-left px-2.5 py-1.5 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-2 transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-zinc-400" />
                <span>Inspect Node</span>
              </button>

              {/* Focus / Center in view */}
              <button
                id="ctx_btn_center_node"
                onClick={() => {
                  const devId = contextMenu.device.id;
                  setContextMenu(null);
                  handleCenterOnNode(devId);
                }}
                className="w-full text-left px-2.5 py-1.5 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-2 transition cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5 text-zinc-400" />
                <span>Center Viewport</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Node Details Slideout inside graph */}
      <AnimatePresence>
        {selectedDevice && (
          <motion.div
            id="graph_selected_slideout"
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            className="absolute right-0 top-0 bottom-0 z-10 w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-l border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl flex flex-col overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800 mb-4">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Info className="w-4 h-4 text-zinc-500" />
                Device Inspector
              </h3>
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <button
                    id="btn_slideout_edit"
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded"
                    title="Edit device specifications"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                )}
                <button 
                  id="btn_close_slideout"
                  onClick={() => onSelectDevice(null as any)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg font-bold p-1"
                >
                  &times;
                </button>
              </div>
            </div>

            {selectedDevice.isNew && (
              <div id="new_device_sweep_banner" className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-xl">
                <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-400 mb-2">
                  ⚠️ New device discovered on active subnet sweep! Choose an action:
                </p>
                <div className="flex gap-2">
                  {onAcceptDevice && (
                    <button
                      id="btn_accept_device_inspector"
                      onClick={() => onAcceptDevice(selectedDevice.id)}
                      className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-sm transition cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      Accept
                    </button>
                  )}
                  {onRejectDevice && (
                    <button
                      id="btn_reject_device_inspector"
                      onClick={() => onRejectDevice(selectedDevice.id)}
                      className="flex-1 py-1.5 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-sm transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Reject
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col items-center py-3 mb-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <div className="mb-2 relative">
                <svg viewBox="-40 -40 80 80" className="w-16 h-16 drop-shadow-md">
                  {renderRealisticDeviceHardware(selectedDevice.deviceType, selectedDevice.status, selectedDevice.name, false)}
                </svg>
              </div>
              
              {isEditing ? (
                <div className="w-full px-4 space-y-2 text-left">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Device Name</label>
                    <input
                      id="inspector_input_name"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-center">{selectedDevice.name}</h4>
                  <span className="text-zinc-500 dark:text-zinc-400 text-xs font-mono">{selectedDevice.ip}</span>
                </>
              )}
            </div>

            <div className="space-y-3 text-xs flex-1">
              <div>
                <span className="text-zinc-400 block mb-0.5">Hardware Vendor</span>
                <span className="text-zinc-800 dark:text-zinc-200 font-medium">{selectedDevice.vendor}</span>
              </div>
              <div>
                <span className="text-zinc-400 block mb-0.5">Physical MAC Address</span>
                <span className="text-zinc-800 dark:text-zinc-200 font-mono">{selectedDevice.mac}</span>
              </div>
              <div>
                <span className="text-zinc-400 block mb-0.5">Operating System Fingerprint</span>
                <span className="text-zinc-800 dark:text-zinc-200 font-mono text-[11px] leading-relaxed block bg-zinc-50 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-100 dark:border-zinc-900">
                  {selectedDevice.os}
                </span>
              </div>
              {selectedDevice.status === 'online' && (
                <div>
                  <span className="text-zinc-400 block mb-0.5">ICMP Ping Response</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                    {selectedDevice.latency} ms
                  </span>
                </div>
              )}
              {selectedDevice.parentId && (
                <div>
                  <span className="text-zinc-400 block mb-0.5">Logical Uplink</span>
                  <span className="text-zinc-800 dark:text-zinc-200">
                    Connected to parent ID: <span className="font-semibold">{selectedDevice.parentId}</span>
                    {selectedDevice.switchPort ? ` on Ethernet Port #${selectedDevice.switchPort}` : ''}
                  </span>
                </div>
              )}
              
              {isEditing ? (
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Administrator Notes</label>
                  <textarea
                    id="inspector_input_notes"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Enter device location, inventory IDs, or other administrative notes..."
                    className="w-full h-20 p-2 text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      id="btn_inspector_save"
                      onClick={async () => {
                        if (onUpdateDevice) {
                          const updated = {
                            ...selectedDevice,
                            name: editName,
                            notes: editNotes
                          };
                          await onUpdateDevice(updated);
                          setIsEditing(false);
                          onSelectDevice(updated);
                        }
                      }}
                      className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs flex items-center justify-center gap-1 shadow transition cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save
                    </button>
                    <button
                      id="btn_inspector_cancel"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-1.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded font-bold text-xs flex items-center justify-center gap-1 hover:bg-zinc-300 transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="text-zinc-400 block mb-0.5">Administrator Notes</span>
                  {selectedDevice.notes ? (
                    <p className="text-zinc-600 dark:text-zinc-400 bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/10 text-[11px] leading-relaxed italic">
                      {selectedDevice.notes}
                    </p>
                  ) : (
                    <p className="text-zinc-400 bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-lg border border-transparent text-[11px] italic">
                      No admin notes configured. Click Edit above to add device information.
                    </p>
                  )}
                </div>
              )}

              {/* ICMP PING DIAGNOSTIC BUTTON */}
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  id="btn_inspector_ping"
                  onClick={() => handleRunPing(selectedDevice)}
                  disabled={isPinging}
                  className="w-full py-2 px-3 bg-zinc-800 dark:bg-zinc-800 hover:bg-zinc-900 dark:hover:bg-zinc-700 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 shadow transition text-xs cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                  <span>{isPinging ? 'Pinging Node...' : 'Run 5-Packet Ping Diagnostic'}</span>
                </button>
              </div>

              {/* AI RISK SECURITY AGENT MODULE */}
              {onAnalyzeDevice && (
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 mt-4">
                  <button
                    id="btn_ai_analyze_graph"
                    onClick={() => onAnalyzeDevice(selectedDevice)}
                    disabled={isAnalyzing}
                    className="w-full py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-zinc-300 disabled:to-zinc-400 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 shadow transition-all duration-300 text-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    {isAnalyzing ? 'AI Auditing...' : 'Run AI Security Scan'}
                  </button>

                  <AnimatePresence>
                    {aiAnalysisResult && (
                      <motion.div
                        id="ai_analysis_viewport_graph"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-lg text-[11px] text-indigo-900 dark:text-indigo-300 leading-relaxed font-sans shadow-inner max-h-[160px] overflow-y-auto"
                      >
                        <strong className="block mb-1 text-[10px] uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Gemini Security Intelligence</strong>
                        {aiAnalysisResult}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ICMP PING DIAGNOSTIC RESULT TOAST NOTIFICATION POPOVER */}
      <AnimatePresence>
        {showPingToast && pingingDevice && (
          <motion.div
            id="ping_diagnostic_toast"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-96 bg-white/95 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-4 backdrop-blur-md"
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
                id="btn_close_ping_toast"
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
  </div>
);
}
