export type DeviceType = 'computer' | 'printer' | 'switch' | 'router' | 'modem' | 'firewall' | 'scanner' | 'ap' | 'extender';

export type DeviceStatus = 'online' | 'offline' | 'sleep' | 'rejected';

export interface LatencyPoint {
  timestamp: string;
  ms: number;
}

export interface Device {
  id: string;
  ip: string;
  mac: string;
  vendor: string;
  name: string;
  deviceType: DeviceType;
  os: string;
  status: DeviceStatus;
  latency: number;
  latencyHistory: LatencyPoint[];
  parentId: string | null; // connected to this device ID (e.g., switch, router, modem)
  switchPort: number | null; // switch port number if parent is a switch
  lastSeen: string;
  isNew?: boolean; // temporary flag for flashing highlight
  notes?: string;
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

export interface SystemStats {
  totalDevices: number;
  onlineCount: number;
  offlineCount: number;
  sleepCount: number;
  avgLatency: number;
  newDevicesToday: number;
  rejectedCount: number;
}
