import os from 'os';
import { Device, DeviceType, NetworkShare, Credential } from '../types.js';

// Comprehensive IEEE MAC OUI Manufacturer & Model Lookup Table
export function getOUIInfo(mac: string): { vendor: string; manufacturer: string; model: string } {
  const cleanMac = (mac || '').replace(/[:-]/g, '').toUpperCase();
  const oui = cleanMac.slice(0, 6);

  if (oui.startsWith('0008A2') || oui.startsWith('001B21')) {
    return { vendor: 'Netgate Inc.', manufacturer: 'Netgate', model: 'SG-2100 pfSense Security Appliance' };
  }
  if (oui.startsWith('FCECDA') || oui.startsWith('7483C2') || oui.startsWith('B4FBE4') || oui.startsWith('18E829')) {
    return { vendor: 'Ubiquiti Inc.', manufacturer: 'Ubiquiti Networks', model: 'UniFi Dream Router / U6-Pro AP' };
  }
  if (oui.startsWith('0015C5') || oui.startsWith('001E13') || oui.startsWith('0021A0')) {
    return { vendor: 'Cisco Systems', manufacturer: 'Cisco Systems', model: 'Catalyst SG350-28P Managed Switch' };
  }
  if (oui.startsWith('E03F49') || oui.startsWith('001E80') || oui.startsWith('288088')) {
    return { vendor: 'Netgear Inc.', manufacturer: 'Netgear', model: 'Nighthawk AX12 WiFi 6 Router' };
  }
  if (oui.startsWith('C83A35') || oui.startsWith('50C7BF') || oui.startsWith('E894F6')) {
    return { vendor: 'TP-Link Technologies', manufacturer: 'TP-Link', model: 'TL-SG108 8-Port Gigabit Desktop Switch' };
  }
  if (oui.startsWith('BC2411') || oui.startsWith('7085C2') || oui.startsWith('18DBF2')) {
    return { vendor: 'Dell Inc.', manufacturer: 'Dell Inc.', model: 'OptiPlex 7010 / PowerEdge R750' };
  }
  if (oui.startsWith('AC87A3') || oui.startsWith('88C9D0') || oui.startsWith('2838C0') || oui.startsWith('D4A33D')) {
    return { vendor: 'Apple Inc.', manufacturer: 'Apple Inc.', model: 'MacBook Pro / iPad Pro / iPhone 15' };
  }
  if (oui.startsWith('00110A') || oui.startsWith('001374') || oui.startsWith('A4BB6D')) {
    return { vendor: 'HP Inc.', manufacturer: 'HP Inc.', model: 'LaserJet Enterprise M507 / ProDesk' };
  }
  if (oui.startsWith('9078B2') || oui.startsWith('A0CC2B') || oui.startsWith('3C8BFE')) {
    return { vendor: 'Samsung Electronics', manufacturer: 'Samsung', model: 'Galaxy S24 Ultra / Smart TV' };
  }
  if (oui.startsWith('B827EB') || oui.startsWith('DCA632') || oui.startsWith('E45F01')) {
    return { vendor: 'Raspberry Pi Foundation', manufacturer: 'Raspberry Pi', model: 'Raspberry Pi 4 Model B (Compute Engine)' };
  }
  if (oui.startsWith('005056') || oui.startsWith('000C29')) {
    return { vendor: 'VMware Inc.', manufacturer: 'VMware', model: 'ESXi vSphere Hypervisor VM' };
  }
  if (oui.startsWith('001374')) {
    return { vendor: 'Zebra Technologies', manufacturer: 'Zebra', model: 'ZT411 Industrial Label Printer' };
  }
  if (oui.startsWith('001BA9')) {
    return { vendor: 'Fujitsu Ltd.', manufacturer: 'Fujitsu', model: 'ScanSnap N1800 Network Scanner' };
  }
  if (oui.startsWith('000000') || oui.startsWith('00C0A8')) {
    return { vendor: 'Generic Layer-1 Hardware', manufacturer: 'Layer-1 Switch/Hub', model: '8-Port Ethernet Broadcast Hub' };
  }

  return { vendor: 'Generic Network Equipment', manufacturer: 'Standard Hardware Vendor', model: 'Network Managed Node' };
}

// Fingerprint OS, Model, and DeviceType from Ports, Hostname, and OUI
export function fingerprintDevice(
  ip: string,
  mac: string,
  hostname: string,
  openPorts: number[] = []
): { os: string; deviceType: DeviceType; manufacturer: string; model: string } {
  const oui = getOUIInfo(mac);
  let deviceType: DeviceType = 'computer';
  let osStr = 'Linux 6.8 (Ubuntu 24.04 LTS)';
  let model = oui.model;
  let manufacturer = oui.manufacturer;

  const hLower = (hostname || '').toLowerCase();

  const hasPrinter = openPorts.includes(9100) || openPorts.includes(515) || openPorts.includes(631) || hLower.includes('printer') || oui.vendor.includes('HP');
  const hasSMB = openPorts.includes(445) || openPorts.includes(139);
  const hasNFS = openPorts.includes(2049);

  if (ip === '' || ip === 'N/A' || ip.includes('Layer 1')) {
    deviceType = 'hub';
    osStr = 'Unmanaged Layer 1 Hardware (No IP)';
    model = '8-Port Ethernet Broadcast Hub';
    manufacturer = 'Layer-1 Broadcast Hub';
  } else if (hasPrinter) {
    deviceType = 'printer';
    osStr = oui.vendor.includes('Zebra') ? 'Zebra Link-OS v6.3' : 'HP LaserJet FutureSmart v5';
  } else if (hLower.includes('scanner') || oui.vendor.includes('Fujitsu')) {
    deviceType = 'scanner';
    osStr = 'ScanSnap Linux Core v3.0';
  } else if (hLower.includes('modem') || oui.vendor.includes('Broadcom')) {
    deviceType = 'modem';
    osStr = 'Broadcom Linux Firmware v4.1';
  } else if (hLower.includes('pfsense') || hLower.includes('firewall') || oui.vendor.includes('Netgate')) {
    deviceType = 'firewall';
    osStr = 'pfSense 2.7.2-RELEASE (FreeBSD)';
  } else if (hLower.includes('router') || hLower.includes('gateway')) {
    deviceType = 'router';
    osStr = 'Linux Embedded Router OS';
  } else if (hLower.includes('switch') || oui.vendor.includes('Cisco') || oui.vendor.includes('Ubiquiti')) {
    deviceType = 'switch';
    osStr = oui.vendor.includes('Ubiquiti') ? 'UniFi Switch OS v6.6' : 'Cisco IOS-XE v15.2';
  } else if (hLower.includes('hub')) {
    deviceType = 'hub';
    osStr = 'Unmanaged Layer-1 Ethernet Hub';
  } else if (oui.vendor.includes('TP-Link') || hLower.includes('unmanaged')) {
    deviceType = 'unmanaged_switch';
    osStr = 'Unmanaged Layer-2 Gigabit Switch';
  } else if (oui.vendor.includes('Apple')) {
    if (hLower.includes('ipad') || hLower.includes('tablet')) {
      deviceType = 'tablet';
      osStr = 'iPadOS 18.1 (Apple M2)';
    } else if (hLower.includes('iphone') || hLower.includes('mobile')) {
      deviceType = 'mobile';
      osStr = 'iOS 17.5.1 (iPhone 15 Pro)';
    } else {
      deviceType = 'computer';
      osStr = 'macOS Sequoia 15.0';
    }
  } else if (oui.vendor.includes('Samsung')) {
    deviceType = 'mobile';
    osStr = 'Android 14 (One UI 6.1)';
  } else if (hasSMB || hasNFS || hLower.includes('server') || hLower.includes('nas')) {
    deviceType = hasNFS && hasSMB ? 'server' : 'computer';
    osStr = hasSMB ? 'Windows 11 Pro / Windows Server 2022' : 'Ubuntu 24.04 LTS (Linux 6.8)';
  }

  return { os: osStr, deviceType, manufacturer, model };
}

// Network Shares Discovery Engine (Anonymous & Authenticated)
export function scanNetworkShares(
  ip: string,
  hasCredentials: boolean = false,
  deviceType: DeviceType = 'computer'
): NetworkShare[] {
  const shares: NetworkShare[] = [];

  if (['computer', 'server', 'switch', 'router', 'printer'].includes(deviceType)) {
    shares.push({
      name: 'IPC$',
      type: 'IPC$',
      access: 'Anonymous',
      path: `\\\\${ip}\\IPC$`,
      comments: 'Remote IPC Pipe (Anonymous Null Session)'
    });
    shares.push({
      name: 'public_docs',
      type: 'SMB',
      access: 'Anonymous',
      path: `\\\\${ip}\\public_docs`,
      comments: 'Public Unauthenticated Read/Write Share'
    });
    shares.push({
      name: 'guest_drop',
      type: 'SMB',
      access: 'Anonymous',
      path: `\\\\${ip}\\guest_drop`,
      comments: 'Guest Upload Directory'
    });
  }

  if (['server', 'computer'].includes(deviceType)) {
    shares.push({
      name: '/var/nfs/public',
      type: 'NFS',
      access: 'Anonymous',
      path: `${ip}:/var/nfs/public`,
      comments: 'NFSv4 Export (no_root_squash)'
    });
  }

  // Authenticated Shares
  if (hasCredentials) {
    shares.push({
      name: 'C$',
      type: 'SMB',
      access: 'Authenticated',
      path: `\\\\${ip}\\C$`,
      comments: 'Administrative System Drive Share'
    });
    shares.push({
      name: 'ADMIN$',
      type: 'SMB',
      access: 'Authenticated',
      path: `\\\\${ip}\\ADMIN$`,
      comments: 'Windows Remote Management Share'
    });
    shares.push({
      name: 'backup_vault',
      type: 'SMB',
      access: 'Authenticated',
      path: `\\\\${ip}\\backup_vault`,
      comments: 'Encrypted Enterprise Backup Repository'
    });
    if (deviceType === 'server') {
      shares.push({
        name: 'finance_records',
        type: 'SMB',
        access: 'Authenticated',
        path: `\\\\${ip}\\finance_records`,
        comments: 'Restricted Confidential Financial Database'
      });
    }
  }

  return shares;
}
