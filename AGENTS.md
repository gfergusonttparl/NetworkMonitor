# Project Instructions & Deployment Guidelines

## Overview
This project is an Express + Vite full-stack Network Monitoring and Topology Management system running on port 3000.

## Build and Deployment Architecture
- **Dev Command**: `npm run dev` (`tsx server.ts`)
- **Build Command**: `npm run build` (`vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`)
- **Start Command**: `npm run start` (`node dist/server.cjs`)
- **Host & Port**: Server binds to `0.0.0.0:3000`.

## Recent System Features & Integrations
1. **Deployed IP Address Network Scan ("Scan Now")**:
   - Location: `/server.ts` (`POST /api/scan` & `GET /api/scan/deployed-network`)
   - Dynamically inspects `os.networkInterfaces()` to sweep the server's actual deployed host IPv4 network subnet (e.g. `10.128.0.0/24`, `172.17.0.0/24`).
2. **Automated Network Scan Scheduler**:
   - Location: `/src/components/RangeManager.tsx` & `/server.ts`
   - Configurable for Interval (m), Daily (hh:mm), or Weekly (Day + hh:mm) automated subnet sweeps.
3. **ICMP Diagnostic Ping Tool**:
   - Endpoint: `POST /api/devices/:id/ping`
   - Real-time 5-packet ICMP ping test with min/avg/max latency, loss %, and toast notification popovers.
4. **Spacious Topology Layout Engine**:
   - Location: `/src/components/TopologyGraph.tsx`
   - Hierarchical auto-arrange with multi-pass label anti-collision preventing device name overlap.
5. **24-Hour Active Device Fleet Trend Line Chart**:
   - Location: `/src/components/PerformanceMonitor.tsx`
   - Real-time 24h line chart tracking online devices count over time.

