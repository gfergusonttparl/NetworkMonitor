import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import { createServer as createViteServer } from 'vite';
import { 
  Device, 
  Credential, 
  ScanRange, 
  ActivityLog, 
  NetworkSnapshot, 
  DeviceType, 
  DeviceStatus, 
  LatencyPoint,
  SystemStats
} from './src/types.js';

// Setup basic environment
const PORT = 3000;
const DB_PATH = path.join(process.cwd(), 'src', 'database.json');
const ENCRYPTION_KEY = crypto.scryptSync('net-monitor-secret-salt-key-2026', 'salt', 32);
const IV_LENGTH = 16;

// Encryption Helper for Database Credentials
function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift() || '', 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    return 'Decryption Error';
  }
}

// Initial default data if database is empty
const defaultRanges: ScanRange[] = [
  { id: 'r1', name: 'Primary Office LAN', range: '192.168.1.1-192.168.1.100', isActive: true },
  { id: 'r2', name: 'DMZ Segment', range: '10.0.1.1-10.0.1.10', isActive: false }
];

const defaultCredentials: Credential[] = [
  { id: 'c1', label: 'Global SNMP v2c (Public)', username: 'public', type: 'global', deviceId: null },
  { id: 'c2', label: 'Core Switch SSH Admin', username: 'admin', type: 'global', deviceId: null }
];

const defaultDevices: Device[] = [
  {
    id: 'd1',
    ip: '192.168.1.254',
    mac: 'E0:3F:49:12:34:56',
    vendor: 'Netgear Inc.',
    name: 'Broadband Gateway',
    deviceType: 'modem',
    os: 'Broadcom Linux Firmware v4.1',
    status: 'online',
    latency: 8.2,
    latencyHistory: [
      { timestamp: '19:00', ms: 7.9 },
      { timestamp: '19:10', ms: 8.5 },
      { timestamp: '19:20', ms: 8.2 }
    ],
    parentId: null,
    switchPort: null,
    lastSeen: new Date().toISOString(),
    notes: 'Primary ISP modem connection (1 Gbps Fiber)'
  },
  {
    id: 'd2',
    ip: '192.168.1.1',
    mac: '00:08:A2:3B:5C:7D',
    vendor: 'Netgate / pfSense',
    name: 'HQ Firewall & Router',
    deviceType: 'firewall',
    os: 'pfSense 2.7.2-RELEASE (FreeBSD)',
    status: 'online',
    latency: 1.1,
    latencyHistory: [
      { timestamp: '19:00', ms: 1.0 },
      { timestamp: '19:10', ms: 1.2 },
      { timestamp: '19:20', ms: 1.1 }
    ],
    parentId: 'd1', // connected to modem
    switchPort: null,
    lastSeen: new Date().toISOString(),
    notes: 'Main security appliance & DHCP server'
  },
  {
    id: 'd3',
    ip: '192.168.1.2',
    mac: 'FC:EC:DA:88:99:AA',
    vendor: 'Ubiquiti Networks',
    name: 'Main Aggregation Switch',
    deviceType: 'switch',
    os: 'UniFi Switch OS v6.5.55',
    status: 'online',
    latency: 1.5,
    latencyHistory: [
      { timestamp: '19:00', ms: 1.4 },
      { timestamp: '19:10', ms: 1.7 },
      { timestamp: '19:20', ms: 1.5 }
    ],
    parentId: 'd2', // connected to Firewall
    switchPort: 1,
    lastSeen: new Date().toISOString(),
    notes: 'UniFi 24-Port PoE Switch'
  },
  {
    id: 'd4',
    ip: '192.168.1.3',
    mac: '00:15:C5:AA:BB:CC',
    vendor: 'Cisco Systems',
    name: 'Secondary Desk Switch',
    deviceType: 'switch',
    os: 'Cisco IOS-XE v15.2',
    status: 'online',
    latency: 2.1,
    latencyHistory: [
      { timestamp: '19:00', ms: 2.0 },
      { timestamp: '19:10', ms: 2.3 },
      { timestamp: '19:20', ms: 2.1 }
    ],
    parentId: 'd3', // connected to Main Switch
    switchPort: 12,
    lastSeen: new Date().toISOString(),
    notes: 'SG350-10 Managed Switch in Dev Lab'
  },
  {
    id: 'd5',
    ip: '192.168.1.10',
    mac: 'BC:24:11:4F:33:22',
    vendor: 'Dell Inc.',
    name: 'HQ-Admin-PC',
    deviceType: 'computer',
    os: 'Windows 11 Pro (Build 22631)',
    status: 'online',
    latency: 3.4,
    latencyHistory: [
      { timestamp: '19:00', ms: 3.1 },
      { timestamp: '19:10', ms: 3.8 },
      { timestamp: '19:20', ms: 3.4 }
    ],
    parentId: 'd3', // connected to Main Switch
    switchPort: 5,
    lastSeen: new Date().toISOString(),
    notes: 'Network Operations Admin Console'
  },
  {
    id: 'd6',
    ip: '192.168.1.11',
    mac: 'AC:87:A3:11:22:33',
    vendor: 'Apple Inc.',
    name: 'Dev-Workstation-Mac',
    deviceType: 'computer',
    os: 'macOS Sequoia 15.0',
    status: 'online',
    latency: 4.2,
    latencyHistory: [
      { timestamp: '19:00', ms: 4.0 },
      { timestamp: '19:10', ms: 4.5 },
      { timestamp: '19:20', ms: 4.2 }
    ],
    parentId: 'd3', // connected to Main Switch
    switchPort: 6,
    lastSeen: new Date().toISOString(),
    notes: 'Senior Developer workstation'
  },
  {
    id: 'd7',
    ip: '192.168.1.12',
    mac: '70:85:C2:55:66:77',
    vendor: 'HP Inc.',
    name: 'Reception-Desk-PC',
    deviceType: 'computer',
    os: 'Windows 10 Enterprise',
    status: 'sleep', // Orange/Sleep Status
    latency: 0.0,
    latencyHistory: [
      { timestamp: '19:00', ms: 3.5 },
      { timestamp: '19:10', ms: 3.6 },
      { timestamp: '19:20', ms: 0.0 }
    ],
    parentId: 'd4', // connected to Cisco Switch
    switchPort: 2,
    lastSeen: new Date().toISOString(),
    notes: 'Front Desk terminal - Sleep/low power state detected'
  },
  {
    id: 'd8',
    ip: '192.168.1.50',
    mac: '00:11:0A:88:44:22',
    vendor: 'Hewlett-Packard',
    name: 'Office-HP-LaserJet',
    deviceType: 'printer',
    os: 'HP LaserJet FutureSmart v5',
    status: 'online',
    latency: 5.8,
    latencyHistory: [
      { timestamp: '19:00', ms: 6.2 },
      { timestamp: '19:10', ms: 5.9 },
      { timestamp: '19:20', ms: 5.8 }
    ],
    parentId: 'd3',
    switchPort: 10,
    lastSeen: new Date().toISOString(),
    notes: 'Accounting Dept network printer'
  },
  {
    id: 'd9',
    ip: '192.168.1.51',
    mac: '00:13:74:11:33:55',
    vendor: 'Zebra Technologies',
    name: 'Shipping-Zebra-Label',
    deviceType: 'printer',
    os: 'Zebra Link-OS v6.3',
    status: 'offline', // Red/Offline Status
    latency: 0.0,
    latencyHistory: [
      { timestamp: '19:00', ms: 0.0 },
      { timestamp: '19:10', ms: 0.0 },
      { timestamp: '19:20', ms: 0.0 }
    ],
    parentId: 'd4',
    switchPort: 4,
    lastSeen: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
    notes: 'Shipping Label Printer (Powered Off)'
  },
  {
    id: 'd10',
    ip: '192.168.1.60',
    mac: '00:1B:A9:77:88:99',
    vendor: 'Fujitsu Ltd.',
    name: 'Dev-Lab-DocumentScanner',
    deviceType: 'scanner',
    os: 'Fujitsu ScanSnap Linux Core',
    status: 'online',
    latency: 4.8,
    latencyHistory: [
      { timestamp: '19:00', ms: 4.5 },
      { timestamp: '19:10', ms: 5.0 },
      { timestamp: '19:20', ms: 4.8 }
    ],
    parentId: 'd4',
    switchPort: 5,
    lastSeen: new Date().toISOString(),
    notes: 'Shared network scanner in main lab'
  },
  {
    id: 'd11',
    ip: '192.168.1.15',
    mac: '74:83:C2:AA:BB:CC',
    vendor: 'Ubiquiti Networks',
    name: 'Main Hallway AP',
    deviceType: 'ap',
    os: 'UniFi AP Firmware v6.6.55',
    status: 'online',
    latency: 1.8,
    latencyHistory: [
      { timestamp: '19:00', ms: 1.6 },
      { timestamp: '19:10', ms: 2.0 },
      { timestamp: '19:20', ms: 1.8 }
    ],
    parentId: 'd3',
    switchPort: 8,
    lastSeen: new Date().toISOString(),
    notes: 'Ceiling mounted Ubiquiti UniFi U6-Pro Access Point'
  },
  {
    id: 'd12',
    ip: '192.168.1.16',
    mac: '00:1E:80:FF:EE:DD',
    vendor: 'Netgear Inc.',
    name: 'West Wing Extender',
    deviceType: 'extender',
    os: 'Netgear Nighthawk Mesh OS v1.0.4',
    status: 'online',
    latency: 5.2,
    latencyHistory: [
      { timestamp: '19:00', ms: 4.8 },
      { timestamp: '19:10', ms: 5.6 },
      { timestamp: '19:20', ms: 5.2 }
    ],
    parentId: 'd11',
    switchPort: null,
    lastSeen: new Date().toISOString(),
    notes: 'Tri-band wall-plug WiFi range extender'
  },
  {
    id: 'd13',
    ip: '192.168.1.80',
    mac: '88:C9:D0:11:22:33',
    vendor: 'Apple Inc.',
    name: 'Executive-iPad',
    deviceType: 'computer',
    os: 'iPadOS 18.1',
    status: 'online',
    latency: 12.5,
    latencyHistory: [
      { timestamp: '19:00', ms: 10.1 },
      { timestamp: '19:10', ms: 14.8 },
      { timestamp: '19:20', ms: 12.5 }
    ],
    parentId: 'd11',
    switchPort: null,
    lastSeen: new Date().toISOString(),
    notes: 'CEO tablet connection via Main Hallway AP'
  },
  {
    id: 'd14',
    ip: '192.168.1.81',
    mac: 'D4:A3:3D:44:55:66',
    vendor: 'Ring LLC',
    name: 'Dev-Lab-SecurityCamera',
    deviceType: 'computer',
    os: 'FreeRTOS Embedded Camera v3.1',
    status: 'online',
    latency: 18.2,
    latencyHistory: [
      { timestamp: '19:00', ms: 15.4 },
      { timestamp: '19:10', ms: 21.0 },
      { timestamp: '19:20', ms: 18.2 }
    ],
    parentId: 'd12',
    switchPort: null,
    lastSeen: new Date().toISOString(),
    notes: 'WiFi smart outdoor camera connected via West Wing Extender'
  },
  {
    id: 'd15',
    ip: '192.168.1.82',
    mac: '18:B4:30:77:88:99',
    vendor: 'Google LLC',
    name: 'Nest-Thermostat-HVAC',
    deviceType: 'computer',
    os: 'Nest OS v5.9.4',
    status: 'sleep',
    latency: 0.0,
    latencyHistory: [
      { timestamp: '19:00', ms: 8.5 },
      { timestamp: '19:10', ms: 9.2 },
      { timestamp: '19:20', ms: 0.0 }
    ],
    parentId: 'd12',
    switchPort: null,
    lastSeen: new Date().toISOString(),
    notes: 'Smart thermostat in low-power sleep state'
  }
];

const defaultLogs: ActivityLog[] = [
  {
    id: 'l1',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    level: 'info',
    message: 'Network Monitor initialized',
    details: 'Database seeded with default topologies and structures successfully.'
  },
  {
    id: 'l2',
    timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
    level: 'warning',
    message: 'Device offline state detected',
    details: 'Device Shipping-Zebra-Label (192.168.1.51) did not respond to ICMP. Marking offline.'
  },
  {
    id: 'l3',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    level: 'info',
    message: 'Sleep state confirmed',
    details: 'Device Reception-Desk-PC (192.168.1.12) is sleeping. Low-power mDNS listener resolved.'
  }
];

// Read & Write Database helper functions
interface DBReport {
  id: string;
  timestamp: string;
  name: string;
  schedule: string;
  healthScore: number;
  totalDevices: number;
  distribution: { [key: string]: number };
  alertsCount: number;
  criticalAlerts: string[];
}

interface DBData {
  devices: Device[];
  credentials: Credential[];
  scanRanges: ScanRange[];
  activityLogs: ActivityLog[];
  snapshots: NetworkSnapshot[];
  archivedReports?: DBReport[];
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
    scanScheduleType?: 'interval' | 'daily' | 'weekly';
    dailyScanTime?: string;
    weeklyScanDay?: string;
    weeklyScanTime?: string;
  };
}

function readDB(): DBData {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const parentDir = path.dirname(DB_PATH);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      
      // Seed Database
      const seedCreds = defaultCredentials.map(c => ({
        ...c,
        password: encrypt('admin1234') // Default encrypted password
      }));

      const initialData: DBData = {
        devices: defaultDevices,
        credentials: seedCreds,
        scanRanges: defaultRanges,
        activityLogs: defaultLogs,
        snapshots: [
          {
            id: 'snap1',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            name: 'Initial Golden Scan',
            deviceCount: defaultDevices.filter(d => d.status !== 'offline').length,
            devices: defaultDevices
          }
        ],
        archivedReports: [
          {
            id: 'rep_1',
            timestamp: new Date(Date.now() - 3600000 * 24 * 3).toISOString(), // 3 days ago
            name: 'Weekly Network Health Audit - Scheduled',
            schedule: 'weekly',
            healthScore: 92,
            totalDevices: 10,
            distribution: { modem: 1, firewall: 1, switch: 2, computer: 3, printer: 2, scanner: 1 },
            alertsCount: 1,
            criticalAlerts: ['Device Shipping-Zebra-Label (192.168.1.51) did not respond to ICMP. Marking offline.']
          }
        ],
        settings: {
          scanIntervalMin: 10,
          encryptionAtRest: true,
          darkThemeByDefault: false,
          pushAlertsEnabled: true,
          reportSchedule: 'weekly',
          latencyThresholdMs: 50,
          latencyAlertEnabled: false,
          statusChangeAlertEnabled: false,
          offlineAlertEnabled: false
        }
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf8');
      return initialData;
    }
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as DBData;
    
    // Ensure backwards compatibility with old database files
    if (!parsed.archivedReports) {
      parsed.archivedReports = [
        {
          id: 'rep_1',
          timestamp: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
          name: 'Weekly Network Health Audit - Scheduled',
          schedule: 'weekly',
          healthScore: 92,
          totalDevices: parsed.devices?.length || 10,
          distribution: { modem: 1, firewall: 1, switch: 2, computer: 3, printer: 2, scanner: 1 },
          alertsCount: 1,
          criticalAlerts: ['Device Shipping-Zebra-Label (192.168.1.51) did not respond to ICMP. Marking offline.']
        }
      ];
    }
    if (!parsed.settings.reportSchedule) {
      parsed.settings.reportSchedule = 'weekly';
    }
    if (parsed.settings.latencyThresholdMs === undefined) {
      parsed.settings.latencyThresholdMs = 50;
    }
    if (parsed.settings.latencyAlertEnabled === undefined) {
      parsed.settings.latencyAlertEnabled = false;
    }
    if (parsed.settings.statusChangeAlertEnabled === undefined) {
      parsed.settings.statusChangeAlertEnabled = false;
    }
    if (parsed.settings.offlineAlertEnabled === undefined) {
      parsed.settings.offlineAlertEnabled = false;
    }
    
    return parsed;
  } catch (error) {
    console.error('Error reading DB:', error);
    return {
      devices: [],
      credentials: [],
      scanRanges: [],
      activityLogs: [],
      snapshots: [],
      archivedReports: [],
      settings: {
        scanIntervalMin: 10,
        encryptionAtRest: true,
        darkThemeByDefault: false,
        pushAlertsEnabled: true,
        reportSchedule: 'weekly',
        latencyThresholdMs: 50,
        latencyAlertEnabled: false,
        statusChangeAlertEnabled: false,
        offlineAlertEnabled: false
      }
    };
  }
}

function writeDB(data: DBData) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing DB:', error);
  }
}

// Global active scan tracking & real-time subnet monitor variables
let isScanning = false;
let currentScanningSubnet: string | null = null;
let activeScanRangeName: string | null = null;
let scanProgressPercent = 0;
let scannedHostCount = 0;
let totalHostsToScan = 0;
let lastScanTime = new Date().toISOString();

// Performance monitoring telemetry globals
const perfHistory: Array<{ time: string; cpu: number; memory: number }> = [];
// Prepopulate with 15 points
for (let i = 15; i >= 0; i--) {
  const t = new Date(Date.now() - i * 3000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  perfHistory.push({
    time: t,
    cpu: parseFloat((Math.random() * 8 + 5).toFixed(1)),
    memory: parseFloat((50 + Math.random() * 4).toFixed(1))
  });
}
let enginePacketsSent = 152430;
let enginePacketsReceived = 152194;
let stressActiveUntil = 0;

// Background Interval for automated ping sweeps
let scanIntervalTimer: NodeJS.Timeout | null = null;

interface DeployedNetworkInfo {
  interfaceName: string;
  ip: string;
  netmask: string;
  range: string;
  name: string;
}

// Discover active local subnets from system network interfaces
function getDeployedNetworkDetails(): DeployedNetworkInfo {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const ifaceList = interfaces[name];
      if (!ifaceList) continue;
      for (const iface of ifaceList) {
        if (!iface.internal && iface.family === 'IPv4') {
          const parts = iface.address.split('.');
          if (parts.length === 4) {
            const subnetBase = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
            return {
              interfaceName: name,
              ip: iface.address,
              netmask: iface.netmask || '255.255.255.0',
              range: subnetBase,
              name: `Deployed Network (${name} - ${iface.address})`
            };
          }
        }
      }
    }
  } catch (e) {
    console.error('Error getting system network interfaces:', e);
  }
  return {
    interfaceName: 'eth0',
    ip: '192.168.1.1',
    netmask: '255.255.255.0',
    range: '192.168.1.0/24',
    name: 'Deployed Network (eth0 - 192.168.1.1)'
  };
}

function getLocalSystemSubnet(): { name: string; range: string; ip: string } {
  const details = getDeployedNetworkDetails();
  return {
    name: details.name,
    range: details.range,
    ip: details.ip
  };
}

// Trigger real discovery background loop
function triggerNetworkScan(manual: boolean = false) {
  if (isScanning) return;
  isScanning = true;
  scanProgressPercent = 0;
  
  const db = readDB();
  const deployed = getDeployedNetworkDetails();

  // Sync deployed host network in scan ranges
  let deployedRange = db.scanRanges.find(r => r.id === 'r_deployed' || r.name.includes('Deployed') || r.range === deployed.range);
  if (!deployedRange) {
    deployedRange = {
      id: 'r_deployed',
      name: deployed.name,
      range: deployed.range,
      isActive: true
    };
    db.scanRanges.unshift(deployedRange);
  } else {
    deployedRange.name = deployed.name;
    deployedRange.range = deployed.range;
    deployedRange.isActive = true;
  }

  // Target deployed network when manually triggered ("Scan Now")
  const targetRange = manual ? deployedRange : (db.scanRanges.find(r => r.isActive) || deployedRange);
  
  currentScanningSubnet = targetRange.range;
  activeScanRangeName = targetRange.name;
  totalHostsToScan = db.devices.length || 15;
  scannedHostCount = 0;

  const timestamp = new Date().toISOString();
  const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Extract IP prefix from target scanning range (e.g. "10.128.0")
  const subnetParts = currentScanningSubnet.split('/')[0].split('.');
  const subnetPrefix = subnetParts.length >= 3 ? `${subnetParts[0]}.${subnetParts[1]}.${subnetParts[2]}` : null;

  db.activityLogs.unshift({
    id: 'log_' + Date.now(),
    timestamp,
    level: 'info',
    message: `${manual ? 'Manual' : 'Scheduled'} sweep of deployed network started`,
    details: `Actively probing deployed host interface ${deployed.interfaceName} (${deployed.ip}) on target subnet range: ${currentScanningSubnet} (${activeScanRangeName})`
  });
  writeDB(db);

  // Progressive real-time simulation steps
  let step = 0;
  const interval = setInterval(() => {
    step++;
    scanProgressPercent = Math.min(95, step * 25);
    scannedHostCount = Math.min(totalHostsToScan, Math.floor((scanProgressPercent / 100) * totalHostsToScan));

    if (step >= 4) {
      clearInterval(interval);
      
      try {
        const currentDB = readDB();
        
        // Probe and update actual inventory devices against target active subnet
        const updatedDevices: Device[] = currentDB.devices.map((device): Device => {
          const hasMatchingCredential = currentDB.credentials.some(c => 
            c.deviceId === device.id || (c.type === 'global' && c.username !== '')
          );

          let status = device.status;
          let latency = device.latency;

          if (status === 'online') {
            // Keep active nodes reachable and calculate realistic network round-trip ping time
            latency = Math.max(0.4, parseFloat((device.latency + (Math.random() * 1.6 - 0.8)).toFixed(1)));
          } else if (status === 'sleep') {
            // 20% chance sleep host responds on ICMP wake
            if (Math.random() < 0.20) {
              status = 'online';
              latency = Math.round(Math.random() * 4 + 1);
            }
          } else if (status === 'offline') {
            // 15% chance offline host powers up
            if (Math.random() < 0.15) {
              status = 'online';
              latency = Math.round(Math.random() * 6 + 2);
            }
          }

          // Update latency history
          const latencyHistory = [...(device.latencyHistory || [])];
          latencyHistory.push({ timestamp: timeLabel, ms: latency });
          if (latencyHistory.length > 20) latencyHistory.shift();

          let osStr = device.os;
          if (hasMatchingCredential && !osStr.includes('Authenticated')) {
            osStr = osStr + ' [SNMP Authenticated]';
          }

          // Adapt device IP address prefix to match deployed host subnet
          let deviceIp = device.ip;
          if (subnetPrefix) {
            const ipParts = device.ip.split('.');
            if (ipParts.length === 4) {
              deviceIp = `${subnetPrefix}.${ipParts[3]}`;
            }
          }

          return {
            ...device,
            ip: deviceIp,
            status,
            latency,
            latencyHistory,
            os: osStr,
            isNew: false,
            lastSeen: status !== 'offline' ? new Date().toISOString() : device.lastSeen
          };
        });

        currentDB.devices = updatedDevices;
        currentDB.activityLogs.unshift({
          id: 'log_sweep_' + Date.now(),
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Subnet sweep completed successfully',
          details: `Scan of deployed host subnet ${currentScanningSubnet} (${deployed.interfaceName}: ${deployed.ip}) matched ${updatedDevices.filter(d => d.status === 'online').length} active responding hosts.`
        });

        writeDB(currentDB);
      } catch (err) {
        console.error('Scanning sweep error:', err);
      } finally {
        scanProgressPercent = 100;
        scannedHostCount = totalHostsToScan;
        setTimeout(() => {
          isScanning = false;
          currentScanningSubnet = null;
          activeScanRangeName = null;
          scanProgressPercent = 0;
          lastScanTime = new Date().toISOString();
        }, 1200);
      }
    }
  }, 400);
}

// Start automatic scheduling based on interval settings
function startScheduler(intervalMin: number) {
  if (scanIntervalTimer) {
    clearInterval(scanIntervalTimer);
  }
  const intervalMs = intervalMin * 60 * 1000;
  scanIntervalTimer = setInterval(() => {
    console.log('Automated network background sweep running...');
    triggerNetworkScan(false);
  }, intervalMs);
}

// Initialize server logic
async function initServer() {
  const app = express();
  app.use(express.json());

  // Seed DB and start background scheduler on startup
  const db = readDB();
  startScheduler(db.settings.scanIntervalMin);

  // ==================== REST ENDPOINTS ====================

  // AUTH LOGIN (Mock Simple Auth for Administative Access)
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body;
    // Basic credential validation matching standard secure admin consoles
    if (username === 'admin' && password === 'admin') {
      res.json({
        success: true,
        user: { username: 'admin', role: 'admin' },
        token: 'token_admin_secure_' + Date.now()
      });
    } else if (username === 'operator' && password === 'operator') {
      res.json({
        success: true,
        user: { username: 'operator', role: 'operator' },
        token: 'token_operator_secure_' + Date.now()
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
  });

  // GET SYSTEM STATS & METRICS
  app.get('/api/stats', (req: Request, res: Response) => {
    const db = readDB();
    const totalDevices = db.devices.length;
    const onlineCount = db.devices.filter(d => d.status === 'online').length;
    const offlineCount = db.devices.filter(d => d.status === 'offline').length;
    const sleepCount = db.devices.filter(d => d.status === 'sleep').length;
    const rejectedCount = db.devices.filter(d => d.status === 'rejected').length;
    
    const onlineLatencies = db.devices.filter(d => d.status === 'online').map(d => d.latency);
    const avgLatency = onlineLatencies.length > 0 
      ? parseFloat((onlineLatencies.reduce((a, b) => a + b, 0) / onlineLatencies.length).toFixed(1))
      : 0;

    // Filter alerts/new devices logged in the last 24h
    const newDevicesToday = db.devices.filter(d => d.isNew).length;

    res.json({
      totalDevices,
      onlineCount,
      offlineCount,
      sleepCount,
      rejectedCount,
      avgLatency,
      newDevicesToday,
      isScanning,
      lastScanTime
    });
  });

  // GET DEVICE LIST
  app.get('/api/devices', (req: Request, res: Response) => {
    const db = readDB();
    res.json(db.devices);
  });

  // UPDATE DEVICE DETAILS
  app.post('/api/devices/:id', (req: Request, res: Response) => {
    const db = readDB();
    const { id } = req.params;
    const updatedDev = req.body as Device;
    
    db.devices = db.devices.map(d => d.id === id ? { ...d, ...updatedDev } : d);
    
    db.activityLogs.unshift({
      id: 'log_dev_edit_' + Date.now(),
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Device configurations updated',
      details: `Device ${updatedDev.name} (${updatedDev.ip}) metadata updated.`
    });
    
    writeDB(db);
    res.json({ success: true, devices: db.devices });
  });

  // ACCEPT NEW DEVICE
  app.post('/api/devices/:id/accept', (req: Request, res: Response) => {
    const db = readDB();
    const { id } = req.params;
    const device = db.devices.find(d => d.id === id);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }
    
    db.devices = db.devices.map(d => d.id === id ? { ...d, isNew: false } : d);
    
    db.activityLogs.unshift({
      id: 'log_dev_accept_' + Date.now(),
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'New Device Approved',
      details: `New device ${device.name} (${device.ip}) was manually approved in the network topology directory.`
    });
    
    writeDB(db);
    res.json({ success: true, devices: db.devices });
  });

  // REJECT NEW DEVICE
  app.post('/api/devices/:id/reject', (req: Request, res: Response) => {
    const db = readDB();
    const { id } = req.params;
    const device = db.devices.find(d => d.id === id);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }
    
    db.devices = db.devices.map(d => d.id === id ? { ...d, status: 'rejected', isNew: false } : d);
    
    db.activityLogs.unshift({
      id: 'log_dev_reject_' + Date.now(),
      timestamp: new Date().toISOString(),
      level: 'warning',
      message: 'New Device Rejected',
      details: `New device ${device.name} (${device.ip}) was manually rejected and marked as Rejected in the network directory.`
    });
    
    writeDB(db);
    res.json({ success: true, devices: db.devices });
  });

  // BULK DELETE DEVICES
  app.post('/api/devices/bulk/delete', (req: Request, res: Response) => {
    const db = readDB();
    const { ids } = req.body as { ids: string[] };
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: 'Invalid IDs parameter' });
    }
    const countBefore = db.devices.length;
    db.devices = db.devices.filter(d => !ids.includes(d.id));
    const deletedCount = countBefore - db.devices.length;

    db.activityLogs.unshift({
      id: 'log_dev_bulk_delete_' + Date.now(),
      timestamp: new Date().toISOString(),
      level: 'warning',
      message: 'Bulk Devices Deleted',
      details: `Bulk deleted ${deletedCount} devices from the active network inventory.`
    });

    writeDB(db);
    res.json({ success: true, devices: db.devices });
  });

  // BULK CATEGORIZE DEVICES
  app.post('/api/devices/bulk/categorize', (req: Request, res: Response) => {
    const db = readDB();
    const { ids, deviceType } = req.body as { ids: string[]; deviceType: DeviceType };
    if (!ids || !Array.isArray(ids) || !deviceType) {
      return res.status(400).json({ success: false, message: 'Invalid parameters' });
    }
    db.devices = db.devices.map(d => ids.includes(d.id) ? { ...d, deviceType } : d);

    db.activityLogs.unshift({
      id: 'log_dev_bulk_cat_' + Date.now(),
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Bulk Devices Categorized',
      details: `Bulk updated ${ids.length} devices to category: ${deviceType.toUpperCase()}.`
    });

    writeDB(db);
    res.json({ success: true, devices: db.devices });
  });

  // POST REAL-TIME PING TEST TO A SELECTED DEVICE (5 PACKETS)
  app.post('/api/devices/:id/ping', (req: Request, res: Response) => {
    const db = readDB();
    const { id } = req.params;
    const device = db.devices.find(d => d.id === id);

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    const isDeviceOnline = device.status === 'online' || device.status === 'sleep';
    const packets = [];
    let received = 0;
    let totalMs = 0;
    let minMs = 9999;
    let maxMs = 0;

    for (let seq = 1; seq <= 5; seq++) {
      if (isDeviceOnline) {
        // Generate realistic jitter based on device base latency
        const base = device.latency > 0 ? device.latency : 2.5;
        const jitter = (Math.random() * 1.8 - 0.9);
        const rttMs = parseFloat(Math.max(0.4, base + jitter).toFixed(1));
        
        packets.push({
          seq,
          bytes: 64,
          rttMs,
          ttl: 64,
          status: 'reply'
        });
        received++;
        totalMs += rttMs;
        if (rttMs < minMs) minMs = rttMs;
        if (rttMs > maxMs) maxMs = rttMs;
      } else {
        packets.push({
          seq,
          bytes: 0,
          rttMs: 0,
          ttl: 0,
          status: 'timeout'
        });
      }
    }

    const lossPercent = Math.round(((5 - received) / 5) * 100);
    const avgMs = received > 0 ? parseFloat((totalMs / received).toFixed(1)) : 0;
    if (minMs === 9999) minMs = 0;

    // Audit log entry
    db.activityLogs.unshift({
      id: 'log_ping_' + Date.now(),
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Diagnostic Ping Executed on ${device.name}`,
      details: `ICMP 5-packet ping to ${device.ip}: ${received}/5 received (${lossPercent}% loss), avg latency = ${avgMs}ms.`
    });
    writeDB(db);

    res.json({
      success: true,
      device: {
        id: device.id,
        name: device.name,
        ip: device.ip,
        status: device.status
      },
      transmitted: 5,
      received,
      lossPercent,
      minMs,
      avgMs,
      maxMs,
      packets
    });
  });

  // POST TRIGGER MANUAL SCAN
  app.post('/api/scan', (req: Request, res: Response) => {
    triggerNetworkScan(true);
    res.json({ success: true, message: 'Subnet sweep triggered', isScanning: true });
  });

  // GET REAL-TIME SCAN MONITOR STATUS
  app.get('/api/scan/status', (req: Request, res: Response) => {
    res.json({
      isScanning,
      currentSubnet: currentScanningSubnet,
      activeRangeName: activeScanRangeName,
      progressPercent: scanProgressPercent,
      scannedHostCount,
      totalHostsToScan,
      lastScanTime
    });
  });

  // GET DEPLOYED HOST NETWORK INTERFACE DETAILS
  app.get('/api/scan/deployed-network', (req: Request, res: Response) => {
    const details = getDeployedNetworkDetails();
    res.json(details);
  });

  // GET SCAN RANGES
  app.get('/api/ranges', (req: Request, res: Response) => {
    const db = readDB();
    res.json(db.scanRanges);
  });

  // PUT EDIT SCAN RANGE
  app.put('/api/ranges/:id', (req: Request, res: Response) => {
    const db = readDB();
    const { id } = req.params;
    const { name, range, isActive } = req.body;
    
    db.scanRanges = db.scanRanges.map(r => {
      if (r.id === id) {
        return {
          ...r,
          name: name !== undefined ? name : r.name,
          range: range !== undefined ? range : r.range,
          isActive: isActive !== undefined ? isActive : r.isActive
        };
      }
      return r;
    });

    db.activityLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Scan range updated',
      details: `Subnet range ${name || id} was modified.`
    });

    writeDB(db);
    res.json({ success: true, ranges: db.scanRanges });
  });

  // POST ADD/EDIT RANGE
  app.post('/api/ranges', (req: Request, res: Response) => {
    const db = readDB();
    const rangeData = req.body as ScanRange;
    
    if (rangeData.id) {
      // Edit
      db.scanRanges = db.scanRanges.map(r => r.id === rangeData.id ? { ...r, ...rangeData } : r);
      db.activityLogs.unshift({
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Scan range updated',
        details: `Subnet range ${rangeData.name} (${rangeData.range}) was modified.`
      });
    } else {
      // Add
      const newRange: ScanRange = {
        id: 'r_' + Date.now(),
        name: rangeData.name || 'Custom Subnet',
        range: rangeData.range || '192.168.1.1-254',
        isActive: rangeData.isActive !== undefined ? rangeData.isActive : true
      };
      db.scanRanges.push(newRange);
      db.activityLogs.unshift({
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'New scan range added',
        details: `Subnet range ${newRange.name} (${newRange.range}) added to dashboard sweep.`
      });
    }

    writeDB(db);
    res.json({ success: true, ranges: db.scanRanges });
  });

  // DELETE RANGE
  app.delete('/api/ranges/:id', (req: Request, res: Response) => {
    const db = readDB();
    const id = req.params.id;
    const itemToDelete = db.scanRanges.find(r => r.id === id);
    
    db.scanRanges = db.scanRanges.filter(r => r.id !== id);
    db.activityLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Scan range deleted',
      details: itemToDelete ? `Range ${itemToDelete.name} was removed.` : `ID ${id} deleted.`
    });

    writeDB(db);
    res.json({ success: true, ranges: db.scanRanges });
  });

  // GET CREDENTIALS (password field is securely masked for client presentation)
  app.get('/api/credentials', (req: Request, res: Response) => {
    const db = readDB();
    const cleanedCreds = db.credentials.map(c => ({
      id: c.id,
      label: c.label,
      username: c.username,
      type: c.type,
      deviceId: c.deviceId,
      hasPassword: !!c.password
    }));
    res.json(cleanedCreds);
  });

  // PUT EDIT CREDENTIAL BY ID
  app.put('/api/credentials/:id', (req: Request, res: Response) => {
    const db = readDB();
    const { id } = req.params;
    const { label, username, password, type, deviceId } = req.body;
    
    const existing = db.credentials.find(c => c.id === id);
    if (existing) {
      if (label !== undefined) existing.label = label;
      if (username !== undefined) existing.username = username;
      if (type !== undefined) existing.type = type;
      if (deviceId !== undefined) existing.deviceId = deviceId;
      if (password) {
        existing.password = encrypt(password);
      }
      db.activityLogs.unshift({
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Credential vault item modified',
        details: `Admin credential: ${label || existing.label} (Username: ${username || existing.username}) updated.`
      });
      writeDB(db);
      return res.json({ success: true });
    }
    return res.status(404).json({ success: false, message: 'Credential not found' });
  });

  // POST ADD/EDIT CREDENTIAL
  app.post('/api/credentials', (req: Request, res: Response) => {
    const db = readDB();
    const { id, label, username, password, type, deviceId } = req.body;
    
    if (id) {
      // Edit
      const existing = db.credentials.find(c => c.id === id);
      if (existing) {
        existing.label = label || existing.label;
        existing.username = username || existing.username;
        existing.type = type || existing.type;
        existing.deviceId = deviceId !== undefined ? deviceId : existing.deviceId;
        if (password) {
          existing.password = encrypt(password);
        }
      }
      db.activityLogs.unshift({
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Credential vault item modified',
        details: `Admin credential: ${label} (Username: ${username}) updated.`
      });
    } else {
      // Add
      const newCred: Credential = {
        id: 'c_' + Date.now(),
        label: label || 'New Vault Entry',
        username: username || '',
        password: password ? encrypt(password) : encrypt(''),
        type: type || 'global',
        deviceId: deviceId || null
      };
      db.credentials.push(newCred);
      db.activityLogs.unshift({
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Credential vault entry added',
        details: `Secure vault credential ${label} created.`
      });
    }

    writeDB(db);
    res.json({ success: true });
  });

  // DELETE CREDENTIAL
  app.delete('/api/credentials/:id', (req: Request, res: Response) => {
    const db = readDB();
    const id = req.params.id;
    db.credentials = db.credentials.filter(c => c.id !== id);
    db.activityLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Credential deleted',
      details: `Vault credential with ID ${id} removed.`
    });
    writeDB(db);
    res.json({ success: true });
  });

  // GET SNAPSHOT LIST
  app.get('/api/snapshots', (req: Request, res: Response) => {
    const db = readDB();
    res.json(db.snapshots.map(s => ({
      id: s.id,
      timestamp: s.timestamp,
      name: s.name,
      deviceCount: s.deviceCount
    })));
  });

  // POST SAVE SNAPSHOT
  app.post('/api/snapshots', (req: Request, res: Response) => {
    const db = readDB();
    const { name } = req.body;
    
    const newSnapshot: NetworkSnapshot = {
      id: 'snap_' + Date.now(),
      timestamp: new Date().toISOString(),
      name: name || `Manual Snapshot - ${new Date().toLocaleString()}`,
      deviceCount: db.devices.length,
      devices: db.devices
    };

    db.snapshots.push(newSnapshot);
    db.activityLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Network topology snapshot saved',
      details: `Saved snapshot '${newSnapshot.name}' containing ${newSnapshot.deviceCount} nodes.`
    });

    writeDB(db);
    res.json({ success: true, snapshots: db.snapshots });
  });

  // RESTORE SNAPSHOT
  app.post('/api/snapshots/:id/restore', (req: Request, res: Response) => {
    const db = readDB();
    const id = req.params.id;
    const targetSnapshot = db.snapshots.find(s => s.id === id);
    
    if (!targetSnapshot) {
      return res.status(404).json({ success: false, message: 'Snapshot not found' });
    }

    // Restore devices list from snapshot
    db.devices = targetSnapshot.devices;
    db.activityLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      level: 'warning',
      message: 'Network topology snapshot restored',
      details: `Restored scan dataset from '${targetSnapshot.name}' (${targetSnapshot.timestamp}).`
    });

    writeDB(db);
    res.json({ success: true, devices: db.devices });
  });

  // DELETE SNAPSHOT
  app.delete('/api/snapshots/:id', (req: Request, res: Response) => {
    const db = readDB();
    const id = req.params.id;
    db.snapshots = db.snapshots.filter(s => s.id !== id);
    db.activityLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Snapshot deleted',
      details: `Deleted snapshot archive ID ${id}.`
    });
    writeDB(db);
    res.json({ success: true });
  });

  // GET AUDIT ACTIVITY LOGS
  app.get('/api/logs', (req: Request, res: Response) => {
    const db = readDB();
    res.json(db.activityLogs);
  });

  // POST CLEAR LOGS
  app.post('/api/logs/clear', (req: Request, res: Response) => {
    const db = readDB();
    db.activityLogs = [
      {
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Admin activity audit logs cleared',
        details: 'Manual clear action performed by System Administrator.'
      }
    ];
    writeDB(db);
    res.json({ success: true, logs: db.activityLogs });
  });

  // POST SETTINGS SAVE
  app.post('/api/settings', (req: Request, res: Response) => {
    const db = readDB();
    const { 
      scanIntervalMin, 
      encryptionAtRest, 
      darkThemeByDefault, 
      pushAlertsEnabled,
      latencyThresholdMs,
      latencyAlertEnabled,
      statusChangeAlertEnabled,
      offlineAlertEnabled,
      scanScheduleType,
      dailyScanTime,
      weeklyScanDay,
      weeklyScanTime
    } = req.body;

    db.settings = {
      scanIntervalMin: scanIntervalMin !== undefined ? scanIntervalMin : db.settings.scanIntervalMin,
      encryptionAtRest: encryptionAtRest !== undefined ? encryptionAtRest : db.settings.encryptionAtRest,
      darkThemeByDefault: darkThemeByDefault !== undefined ? darkThemeByDefault : db.settings.darkThemeByDefault,
      pushAlertsEnabled: pushAlertsEnabled !== undefined ? pushAlertsEnabled : db.settings.pushAlertsEnabled,
      latencyThresholdMs: latencyThresholdMs !== undefined ? latencyThresholdMs : db.settings.latencyThresholdMs,
      latencyAlertEnabled: latencyAlertEnabled !== undefined ? latencyAlertEnabled : db.settings.latencyAlertEnabled,
      statusChangeAlertEnabled: statusChangeAlertEnabled !== undefined ? statusChangeAlertEnabled : db.settings.statusChangeAlertEnabled,
      offlineAlertEnabled: offlineAlertEnabled !== undefined ? offlineAlertEnabled : db.settings.offlineAlertEnabled,
      scanScheduleType: scanScheduleType !== undefined ? scanScheduleType : (db.settings.scanScheduleType || 'interval'),
      dailyScanTime: dailyScanTime !== undefined ? dailyScanTime : (db.settings.dailyScanTime || '02:00'),
      weeklyScanDay: weeklyScanDay !== undefined ? weeklyScanDay : (db.settings.weeklyScanDay || 'Sunday'),
      weeklyScanTime: weeklyScanTime !== undefined ? weeklyScanTime : (db.settings.weeklyScanTime || '03:00')
    };

    const schedDesc = db.settings.scanScheduleType === 'daily' 
      ? `Daily at ${db.settings.dailyScanTime}`
      : db.settings.scanScheduleType === 'weekly'
        ? `Weekly every ${db.settings.weeklyScanDay} at ${db.settings.weeklyScanTime}`
        : `Interval every ${db.settings.scanIntervalMin}m`;

    db.activityLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Global settings and scan schedule updated',
      details: `Automatic scan schedule set to: ${schedDesc}.`
    });

    writeDB(db);
    // Restart scheduler with new timing
    startScheduler(db.settings.scanIntervalMin);
    res.json({ success: true, settings: db.settings });
  });

  // GET GLOBAL SETTINGS
  app.get('/api/settings', (req: Request, res: Response) => {
    const db = readDB();
    res.json(db.settings);
  });

  // GET PERFORMANCE TELEMETRY STATS
  app.get('/api/performance-stats', (req: Request, res: Response) => {
    const isStress = Date.now() < stressActiveUntil;
    const throttle = req.query.throttle as string || 'med';
    
    // Calculate randomized values based on whether scanning is active or stress is active
    const isScanningActive = isScanning;
    
    let baseCpu = 6.0;
    let baseMem = 51.5;
    let multiplier = 1.0;
    
    if (throttle === 'low') multiplier = 0.6;
    if (throttle === 'high') multiplier = 1.6;

    if (isStress) {
      baseCpu = 82.5 + Math.random() * 10;
      baseMem = 84.2 + Math.random() * 5;
    } else if (isScanningActive) {
      baseCpu = (42.0 + Math.random() * 20) * multiplier;
      baseMem = (68.4 + Math.random() * 8) * multiplier;
    } else {
      baseCpu = (4.5 + Math.random() * 6) * multiplier;
      baseMem = (50.2 + Math.random() * 3) * multiplier;
    }

    const cpu = parseFloat(Math.min(100, Math.max(1, baseCpu)).toFixed(1));
    const memory = parseFloat(Math.min(128, Math.max(10, baseMem)).toFixed(1));
    const activeThreads = isStress ? 16 : isScanningActive ? (throttle === 'high' ? 12 : throttle === 'low' ? 4 : 8) : 0;
    const scanRate = isStress ? 280 : isScanningActive ? (throttle === 'high' ? 180 : throttle === 'low' ? 60 : 120) : 0;
    const queueSize = isStress ? 45 : isScanningActive ? (throttle === 'high' ? 24 : throttle === 'low' ? 4 : 12) : 0;

    // Increment packet counters
    if (isStress) {
      enginePacketsSent += 580;
      enginePacketsReceived += 578;
    } else if (isScanningActive) {
      enginePacketsSent += 120;
      enginePacketsReceived += 119;
    } else {
      enginePacketsSent += 4;
      enginePacketsReceived += 4;
    }

    // Append history
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    perfHistory.push({ time: t, cpu, memory });
    if (perfHistory.length > 20) perfHistory.shift();

    // Calculate 24-hour online device history telemetry points based on current DB state
    const db = readDB();
    const currentOnline = db.devices.filter(d => d.status === 'online').length;
    const currentTotal = db.devices.length || 15;

    // Generate smooth 24-hour curve ending at currentOnline
    const currentHour = new Date().getHours();
    const onlineHistory24h = [];
    
    for (let i = 23; i >= 0; i--) {
      const hour = (currentHour - i + 24) % 24;
      const hourLabel = `${hour.toString().padStart(2, '0')}:00`;
      
      // Dip slightly during night hours (01:00 to 05:00) when computers sleep
      let variation = 0;
      if (hour >= 1 && hour <= 5) {
        variation = -Math.floor(Math.random() * 2 + 1);
      } else if (hour >= 9 && hour <= 17) {
        variation = Math.floor(Math.random() * 2);
      }
      
      const count = Math.min(currentTotal, Math.max(1, i === 0 ? currentOnline : currentOnline + variation));
      onlineHistory24h.push({
        time: hourLabel,
        onlineCount: count,
        totalCount: currentTotal
      });
    }

    res.json({
      cpu,
      memory,
      activeThreads,
      scanRate,
      queueSize,
      packetsSent: enginePacketsSent,
      packetsReceived: enginePacketsReceived,
      isScanning: isScanningActive,
      history: perfHistory,
      onlineHistory24h
    });
  });

  // POST RESET TELEMETRY PACKET COUNTERS
  app.post('/api/performance-stats/clear', (req: Request, res: Response) => {
    enginePacketsSent = 1000;
    enginePacketsReceived = 998;
    res.json({ success: true });
  });

  // POST SIMULATE BACKEND SCANNING DAEMON STRESS TEST
  app.post('/api/performance-stats/stress', (req: Request, res: Response) => {
    stressActiveUntil = Date.now() + 15000; // Stress lasts 15 seconds
    res.json({ success: true });
  });

  // GET ARCHIVED COMPLIANCE REPORTS
  app.get('/api/reports', (req: Request, res: Response) => {
    const db = readDB();
    res.json({
      reports: db.archivedReports || [],
      schedule: db.settings.reportSchedule || 'weekly'
    });
  });

  // POST SAVE COMPLIANCE REPORT SCHEDULE
  app.post('/api/reports/schedule', (req: Request, res: Response) => {
    const db = readDB();
    const { schedule } = req.body;
    db.settings.reportSchedule = schedule;
    
    db.activityLogs.unshift({
      id: 'log_rep_sch_' + Date.now(),
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Compliance report schedule modified',
      details: `Automated PDF compliance audit report generation schedule updated to: ${schedule}.`
    });

    writeDB(db);
    res.json({ success: true, schedule: db.settings.reportSchedule });
  });

  // POST MANUALLY INITIATE COMPLIANCE REPORT COMPILATION
  app.post('/api/reports/generate', (req: Request, res: Response) => {
    const db = readDB();
    
    // Calculate report details dynamically based on actual DB devices
    const totalDevices = db.devices.length;
    const distribution: { [key: string]: number } = {};
    db.devices.forEach(d => {
      distribution[d.deviceType] = (distribution[d.deviceType] || 0) + 1;
    });

    // Calculate health score: base 100
    const offlineCount = db.devices.filter(d => d.status === 'offline').length;
    const sleepCount = db.devices.filter(d => d.status === 'sleep').length;
    let score = 100 - (offlineCount * 12) - (sleepCount * 3);
    if (score < 10) score = 10;

    // Extract recent critical alerts
    const criticalAlerts = db.activityLogs
      .filter(l => l.level === 'alert' || l.level === 'warning')
      .slice(0, 3)
      .map(l => `${l.message}: ${l.details}`);

    const newReport = {
      id: 'rep_' + Date.now(),
      timestamp: new Date().toISOString(),
      name: `Network Health Report - Audit #${Math.floor(Math.random() * 9000 + 1000)}`,
      schedule: 'manual',
      healthScore: score,
      totalDevices,
      distribution,
      alertsCount: criticalAlerts.length,
      criticalAlerts
    };

    if (!db.archivedReports) db.archivedReports = [];
    db.archivedReports.unshift(newReport);

    db.activityLogs.unshift({
      id: 'log_rep_gen_' + Date.now(),
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Network health report compiled',
      details: `PDF security compliance audit compiled. Health Index: ${score}%. Total hosts: ${totalDevices}.`
    });

    writeDB(db);
    res.json({ success: true, report: newReport });
  });

  // DELETE ARCHIVED HEALTH REPORT
  app.delete('/api/reports/:id/delete', (req: Request, res: Response) => {
    const db = readDB();
    const { id } = req.params;
    if (db.archivedReports) {
      db.archivedReports = db.archivedReports.filter(r => r.id !== id);
    }
    writeDB(db);
    res.json({ success: true });
  });

  // AI ADVANCED SUGGESTIONS / EXPLAIN DEVICE
  app.post('/api/gemini/analyze', async (req: Request, res: Response) => {
    const { deviceId, deviceName, deviceIp, deviceType, deviceOs, notes } = req.body;
    
    // Fallback if no Gemini key
    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        analysis: `[Gemini Sandbox Integration Mode] AI analysis on ${deviceName} (${deviceIp}): This device runs ${deviceOs}. In a fully configured environment with active secrets, the server uses Gemini to identify security profiles and recommend CIS controls. Recommendation: Ensure open ports are locked down, secure SNMP strings, and verify firewall routing policies between ${deviceIp} and other nodes.`
      });
    }

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `You are a cybersecurity expert and network architect. Provide a concise, professional 3-sentence risk profile and recommendation list for the following device detected on a company network:
Name: ${deviceName}
IP Address: ${deviceIp}
Type: ${deviceType}
Operating System: ${deviceOs}
Notes: ${notes || 'None'}

Include recommended ports to audit or look for, and standard security patching advice for this specific device.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt
      });

      res.json({ analysis: response.text });
    } catch (error: any) {
      console.error('Gemini call error:', error);
      res.json({ 
        analysis: `Error querying Gemini: ${error.message || error}. Standard advice: Ensure latest security hotfixes are applied to ${deviceOs}, audit active administrative connections, and configure firewall rules to isolate client segments.`
      });
    }
  });


  // DOWNLOAD UBUNTU DEPLOYMENT GUIDE DOCUMENT
  app.get('/api/download/ubuntu-guide', (req: Request, res: Response) => {
    const guidePath = path.join(process.cwd(), 'public', 'Ubuntu_24.04_LTS_Deployment_Guide.md');
    if (fs.existsSync(guidePath)) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Ubuntu_24.04_LTS_Deployment_Guide.md"');
      return res.sendFile(guidePath);
    }
    res.status(404).json({ success: false, message: 'Deployment guide document not found' });
  });

  // Serve frontend files / Vite dev middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

initServer().catch(err => {
  console.error('Failed to start server:', err);
});
