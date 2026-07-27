# Project Instructions & Deployment Guidelines

## Overview
This project is an Express + Vite full-stack Network Monitoring and Topology Management system running on port 3000.

## Build and Deployment Architecture
- **Dev Command**: `npm run dev` (`tsx server.ts`)
- **Build Command**: `npm run build` (`vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`)
- **Start Command**: `npm run start` (`node dist/server.cjs`)
- **Host & Port**: Server binds to `0.0.0.0:3000`.

## Key System Features & Integrations
1. **Multi-Subnet IP Address Network Scan & Persistence**:
   - Location: `/server.ts` (`POST /api/scan`, `GET/POST /api/ranges`)
   - Sweeps active subnets and custom CIDR ranges without resetting or losing user-configured ranges. Automatically preserves fresh DB states during background scanning loops.
2. **Collapsible Topology Nodes (Access Points, Extenders, Switches, Routers)**:
   - Location: `/src/components/TopologyGraph.tsx`
   - Access Points, Extenders, Switches, and Routers feature interactive collapse badges (`+N` or `-`). Collapsing any node recursively hides all child and descendant nodes in its sub-tree.
3. **Streamlined Header Action Controls (Icon Buttons)**:
   - Location: `/src/App.tsx`
   - Compact icon buttons for "Scan Network Now" (`RefreshCw`) and "Ubuntu Deployment Guide" (`Download`), providing clean UI spacing with full tooltips and accessible titles.
4. **Automated Network Scan Scheduler**:
   - Location: `/src/components/RangeManager.tsx` & `/server.ts`
   - Configurable for Interval (m), Daily (hh:mm), or Weekly (Day + hh:mm) automated subnet sweeps.
5. **ICMP Diagnostic Ping Tool**:
   - Endpoint: `POST /api/devices/:id/ping`
   - Real-time 5-packet ICMP ping test with min/avg/max latency, loss %, and toast notification popovers.
6. **Spacious Topology Layout Engine**:
   - Location: `/src/components/TopologyGraph.tsx`
   - Hierarchical auto-arrange with multi-pass label anti-collision preventing device name overlap.
7. **24-Hour Active Device Fleet Trend Line Chart**:
   - Location: `/src/components/PerformanceMonitor.tsx`
   - Real-time 24h line chart tracking online devices count over time.
8. **Unmanaged Ethernet Switches & Collapsible Subtrees**:
   - Location: `/src/components/TopologyGraph.tsx` & `/src/components/DeviceTable.tsx`
   - Native recognition and hardware visualizer for desktop 5/8-port unmanaged switches. Supports sub-tree collapse (`+N`/`-` badge) to hide/expand downstream connected devices.
9. **Realistic SVG Hardware Graphics Engine**:
   - Location: `/src/components/TopologyGraph.tsx` (`renderRealisticDeviceHardware`)
   - High-fidelity SVG renders for rackmount managed switches, unmanaged switches, WiFi 6 routers, ceiling dome APs, range extenders, smartphones (with camera notch, home bar, and OLED wallpaper gradient), tablets, 2U rack servers, and workstations.
10. **Mobile Device & Operating System Fingerprinting**:
   - Location: `/server.ts`, `/src/types.ts`, & `/src/components/DeviceTable.tsx`
   - Automated detection and category separation for smartphones (`mobile`/`phone`) and tablets (`tablet`), with detailed OS fingerprinting (`iOS 17.5.1 (iPhone 15 Pro)`, `Android 14 (One UI 6.1)`, `iPadOS 18.1`).
11. **Real-time Search & Zebra-Striped Data Grid**:
   - Location: `/src/components/DeviceTable.tsx`
   - Real-time search filter input for instantaneous matching across device name, IP address, OS, or vendor, paired with alternating zebra-striping row styling for enhanced visual data legibility.
12. **Comprehensive Vector SVG Icon Library (`/public/icons/`)**:
   - Location: `/public/icons/`
   - Custom standalone SVG icons covering core infrastructure (routers, managed/unmanaged switches, firewalls, WAPs), datacenter hardware (domain controllers, file/database servers, hypervisors, NAS), endpoints (workstations, laptops, mobile phones, tablets, guest devices), and IoT peripherals (printers, IP cameras, VoIP desk phones, smart TVs, sensors).


