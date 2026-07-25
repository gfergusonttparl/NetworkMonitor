# Network Monitor & Topology Management System

An enterprise-grade network topology discovery, active monitoring, ICMP diagnostic, and subnet management platform.

## Key Features & Recent Updates

### 1. Deployed IP Address Network Scan ("Scan Now")
- **Live Interface Detection**: Automatically inspects active host network interfaces (`os.networkInterfaces()`) to detect the container or server's deployed IPv4 address and local network interface subnet.
- **Immediate Deployed Sweep**: Clicking **Scan Network Now** (`POST /api/scan`) targets the server's actual deployed IP subnet (e.g., `10.128.0.0/24`, `172.17.0.0/24`, `192.168.1.0/24`), dynamically probing responding hosts and updating the inventory.
- **REST Telemetry API**: Exposes `GET /api/scan/deployed-network` for real-time interface metadata, IP address, netmask, and target CIDR bounds.

### 2. Automated Network Scan Scheduler
- **Configurable Sweeps**: Choose between **Interval Sweeps** (5m to 24h), **Daily Sweeps** (at specific times like `02:00 AM`), or **Weekly Sweeps** (e.g., `Every Sunday at 03:00 AM`).
- **Subnets & Ranges**: Easily manage active IPv4 CIDR ranges and run automated background daemon scans across configured ranges.

### 3. Real-Time 5-Packet Diagnostic Ping Tool
- **Immediate Diagnostic**: Perform an instant 5-packet ICMP diagnostic test on any device directly from the Topology Canvas context menu, Inspector Drawer, or Device Table.
- **Live Toast Popover**: Displays packet transmission breakdown, round-trip min/avg/max latency, jitter, and packet loss percentages in real-time.

### 4. Spacious Collision-Free Topology Auto-Arrange
- **Hierarchical Layout Engine**: Auto-arranges devices by role (Modem → Firewall/Router → Switches → Endpoints).
- **Label Anti-Collision**: Multi-pass spacing and collision resolution guarantees full device names and IP labels remain clearly visible without overlap across adjacent nodes.

### 5. 24-Hour Active Fleet Performance Monitoring
- **Line Chart Analytics**: Tracks the count of online active devices over the last 24 hours on the Performance tab.
- **Fleet Metrics**: Real-time display of peak online count, lowest off-peak count, and overall fleet uptime consistency.

---

## Deployment Guidelines

### Container & Cloud Run Setup
- **Server Entrypoint**: `server.ts` compiled to `dist/server.cjs` via `esbuild`.
- **Static Assets**: Vite frontend built to `dist/` and served statically by the Express backend in production mode (`NODE_ENV=production`).
- **Port & Host Binding**: Listens on `0.0.0.0:3000`.

### Build & Run Commands

```bash
# Install dependencies
npm install

# Build production bundle (Vite SPA + Express backend)
npm run build

# Start production server
npm start
```

### Environment Variables
Configure environment variables in `.env`:
- `GEMINI_API_KEY`: Required for server-side AI risk analysis and natural language query processing.
- `NODE_ENV`: Set to `production` for container deployments.
- `PORT`: Server port (default: `3000`).

