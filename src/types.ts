export type DeviceType = 'computer' | 'printer' | 'switch' | 'unmanaged_switch' | 'hub' | 'router' | 'modem' | 'firewall' | 'scanner' | 'ap' | 'extender' | 'mobile' | 'phone' | 'tablet' | 'server';

export type DeviceStatus = 'online' | 'offline' | 'sleep' | 'rejected';

export interface LatencyPoint {
  timestamp: string;
  ms: number;
}

export interface NetworkShare {
  name: string;
  type: 'SMB' | 'NFS' | 'HTTP' | 'FTP' | 'IPC$';
  access: 'Anonymous' | 'Authenticated' | 'Denied';
  path?: string;
  comments?: string;
}

export interface Device {
  id: string;
  ip: string;
  mac: string;
  vendor: string;
  manufacturer?: string;
  model?: string;
  name: string;
  deviceType: DeviceType;
  os: string;
  status: DeviceStatus;
  latency: number;
  latencyHistory: LatencyPoint[];
  parentId: string | null; // connected to this device ID (e.g., switch, router, modem, hub)
  switchPort: number | null; // switch port number if parent is a switch or hub
  lastSeen: string;
  isNew?: boolean; // temporary flag for flashing highlight
  notes?: string;
  networkShares?: NetworkShare[];
  credentialsStatus?: 'With Credentials' | 'Without Credentials' | 'None';
  openPorts?: number[];
}

export interface Credential {
  id: string;
  label: string;
  username: string;
  password?: string; // masked/hidden on client unless explicitly reading
  type: 'global' | 'device';
  deviceId: string | null; // if target is specific device
}

export interface ScanRange {
  id: string;
  name: string;
  range: string; // e.g., "192.168.1.1-192.168.1.50" or "10.0.0.1/24"
  isActive: boolean;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'alert';
  message: string;
  details: string;
}

export interface NetworkSnapshot {
  id: string;
  timestamp: string;
  name: string;
  deviceCount: number;
  devices: Device[];
}

export type UserRole = 'admin' | 'operator';

export interface PingPacket {
  seq: number;
  bytes: number;
  rttMs: number;
  ttl: number;
  status: 'reply' | 'timeout';
}

export interface PingResult {
  success: boolean;
  device: {
    id: string;
    name: string;
    ip: string;
    status: DeviceStatus;
  };
  transmitted: number;
  received: number;
  lossPercent: number;
  minMs: number;
  avgMs: number;
  maxMs: number;
  packets: PingPacket[];
}

export interface SystemStats {
  totalDevices: number;
  onlineCount: number;
  offlineCount: number;
  sleepCount: number;
  avgLatency: number;
  newDevicesToday: number;
  rejectedCount: number;
}
