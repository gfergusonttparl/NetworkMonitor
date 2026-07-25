# Complete Deployment Guide: Network Inventory & Topology Platform
## Target Operating System: Ubuntu 24.04 LTS (Noble Numbat)

This document provides complete, step-by-step technical instructions for deploying the **Network Inventory & Topology Platform** on a bare-metal server, virtual machine (KVM/ESXi/Proxmox), or cloud instance running **Ubuntu 24.04 LTS**.

---

## 1. System Requirements & Architecture

### Minimum Specifications
- **CPU**: 2 vCPUs / Cores (x86_64 or ARM64)
- **RAM**: 2 GB (4 GB recommended for networks exceeding 250 active nodes)
- **Storage**: 10 GB SSD/NVMe
- **Network Interface**: Static IP assigned on your target administrative or VLAN network

### Architectural Overview
- **Frontend**: React 18 SPA compiled with Vite & Tailwind CSS
- **Backend Service**: Express.js REST API with automated background ping/SNMP sweep daemon & deployed host IP discovery (`os.networkInterfaces()`)
- **Process Manager**: `systemd` daemon unit
- **Reverse Proxy**: Nginx (handling HTTP/HTTPS termination & WebSocket upgrading)
- **Storage**: JSON file-backed database (`src/database.json`) with AES-256 encrypted credential vault
- **Network Interface Auto-Scan**: "Scan Network Now" automatically detects the server's deployed IPv4 network interface address and sweeps the local host subnet bounds.

---

## 2. Operating System Preparation & Dependencies

Log in to your Ubuntu 24.04 LTS server via SSH as a user with `sudo` privileges:

```bash
ssh adminuser@your-server-ip
```

### Step 2.1: Update System Packages
```bash
sudo apt update && sudo apt upgrade -y
```

### Step 2.2: Install Required System Utilities
Install core build tools, network diagnostic tools, and system utilities:
```bash
sudo apt install -y build-essential curl git ufw nginx fping snmp net-tools traceroute libcap2-bin
```

### Step 2.3: Install Node.js 20 LTS (or Node.js 22)
Use the official NodeSource repository to install the Node.js LTS runtime:
```bash
# Download and setup NodeSource setup script for Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify Node.js and npm installation
node -v   # Should output v20.x.x
npm -v    # Should output 10.x.x
```

### Step 2.4: Create Service Account
For security best practices, run the application under a dedicated unprivileged user account:
```bash
sudo useradd -m -s /bin/bash netmonitor
sudo usermod -aG sudo netmonitor # Optional: only if administrative access needed
```

---

## 3. Application Deployment & Build

### Step 3.1: Clone or Copy Application Files
Directory destination: `/opt/network-inventory`

```bash
# Create target directory
sudo mkdir -p /opt/network-inventory

# Grant ownership to netmonitor user
sudo chown -R netmonitor:netmonitor /opt/network-inventory

# Switch to the service user or copy project repository files
sudo -u netmonitor git clone https://github.com/your-org/network-inventory.git /opt/network-inventory

# Navigate to the workspace
cd /opt/network-inventory
```

*(If deploying from a local ZIP or tarball release, extract the files directly into `/opt/network-inventory` and ensure ownership is set with `sudo chown -R netmonitor:netmonitor /opt/network-inventory`)*

### Step 3.2: Install Application Dependencies
Run `npm ci` or `npm install` as the `netmonitor` user:
```bash
sudo -u netmonitor npm install
```

### Step 3.3: Configure Environment Variables
Create the production `.env` configuration file:
```bash
sudo -u netmonitor cp .env.example .env
```

Edit `.env` using your preferred editor:
```bash
sudo -u netmonitor nano .env
```

Set the following production parameters:
```env
# Application Runtime Configuration
PORT=3000
NODE_ENV=production

# Optional: Gemini AI API Key for Security Audits & CIS Controls Recommendations
GEMINI_API_KEY=your_google_gemini_api_key_here

# Encryption Salt Key for Local Credentials Vault
ENCRYPTION_SECRET=net-monitor-secret-salt-key-2026
```

### Step 3.4: Grant ICMP Raw Socket Capabilities (Crucial for Ping Sweeps)
To allow the Node.js process running under the unprivileged `netmonitor` user to send raw ICMP echo requests (pings) without `sudo`:
```bash
sudo setcap cap_net_raw+ep $(which node)
```

### Step 3.5: Build the Production Artifacts
Compile both the Vite frontend bundle and the esbuild bundled Express server backend:
```bash
sudo -u netmonitor npm run build
```

Verify that the build generated the distribution outputs:
```bash
ls -la dist/
# Output should contain: index.html, server.cjs, assets/
```

---

## 4. Systemd Service Management

Create a systemd service file to manage the application process, handle auto-restarts on server reboot, and log output.

### Step 4.1: Create Systemd Service File
```bash
sudo nano /etc/systemd/system/network-inventory.service
```

Paste the following systemd configuration:
```ini
[Unit]
Description=Network Inventory & Topology Platform Daemon
After=network.target nginx.service

[Service]
Type=simple
User=netmonitor
Group=netmonitor
WorkingDirectory=/opt/network-inventory
ExecStart=/usr/bin/node dist/server.cjs
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

# Capability bounding set for socket raw pings
CapabilityBoundingSet=CAP_NET_RAW
AmbientCapabilities=CAP_NET_RAW

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=netmonitor

[Install]
WantedBy=multi-user.target
```

### Step 4.2: Enable and Start the Daemon
```bash
# Reload systemd configuration
sudo systemctl daemon-reload

# Enable service to launch on system boot
sudo systemctl enable network-inventory

# Start the service
sudo systemctl start network-inventory

# Verify service status
sudo systemctl status network-inventory
```

---

## 5. Nginx Reverse Proxy & SSL Configuration

Configure Nginx as a reverse proxy to route traffic from port 80/443 to the Node.js application running on port 3000.

### Step 5.1: Create Nginx Site Configuration
```bash
sudo nano /etc/nginx/sites-available/network-inventory
```

Paste the following Nginx site block (replace `netmonitor.local` with your server's domain or static IP):
```nginx
server {
    listen 80;
    server_name netmonitor.local 192.168.1.100; # Replace with your IP or Hostname

    # Client upload limit for audit exports
    client_max_body_size 20M;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Header propagation
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for scan sweeps
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Cache static assets
    location /assets/ {
        proxy_pass http://127.0.0.1:3000/assets/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

### Step 5.2: Enable Site and Restart Nginx
```bash
# Link to enabled sites
sudo ln -sf /etc/nginx/sites-available/network-inventory /etc/nginx/sites-enabled/

# Remove default nginx site if present
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx syntax
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 5.3: (Optional) HTTPS Encryption with Let's Encrypt / Certbot
If your server is accessible via a domain name on port 443:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d netmonitor.yourdomain.com
```

---

## 6. UFW Firewall Configuration

Configure Ubuntu's Uncomplicated Firewall (UFW) to allow web traffic while protecting unused ports:

```bash
# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH access
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable Firewall
sudo ufw enable

# Check Firewall Status
sudo ufw status verbose
```

---

## 7. Subnet Scanning & Network Discovery Permissions

To allow the server to scan across multiple VLANs or subnets:

1. **IP Forwarding / Router Trunk**: Ensure your network switch / router routes ICMP traffic between VLANs to the Ubuntu server's IP.
2. **Promiscuous Mode / Mirroring (Optional)**: If running passive mDNS/ARP eavesdropping, enable promiscuous mode on your network interface:
   ```bash
   sudo ip link set eth0 promisc on
   ```
3. **SNMP Traps / Community Strings**: Ensure your target switches, firewalls, and routers have SNMP v2c/v3 enabled with community string matching your Credential Vault (e.g., `public`).

---

## 8. Database Persistence & Backup Automation

The database file is stored at `/opt/network-inventory/src/database.json`.

### Step 8.1: Create Automated Backup Script
```bash
sudo mkdir -p /var/backups/network-inventory
sudo nano /usr/local/bin/backup-netmonitor.sh
```

Paste the script content:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/network-inventory"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_FILE="/opt/network-inventory/src/database.json"

if [ -f "$DB_FILE" ]; then
    cp "$DB_FILE" "$BACKUP_DIR/database_$TIMESTAMP.json"
    # Keep last 30 daily backups
    find "$BACKUP_DIR" -type f -name "database_*.json" -mtime +30 -delete
    echo "[$(date)] Backup completed successfully."
else
    echo "[$(date)] Database file not found."
fi
```

Make the script executable:
```bash
sudo chmod +x /usr/local/bin/backup-netmonitor.sh
```

### Step 8.2: Schedule Daily Cron Job
```bash
sudo crontab -e
```
Add the following line to run backups every night at 2:00 AM:
```cron
0 2 * * * /usr/local/bin/backup-netmonitor.sh >> /var/log/netmonitor-backup.log 2>&1
```

---

## 9. Verification & Health Audit Checklist

After completing setup, verify system operation:

| Task | Command | Expected Result |
| :--- | :--- | :--- |
| **Check App Service** | `sudo systemctl status network-inventory` | `active (running)` |
| **Check Nginx Status** | `sudo systemctl status nginx` | `active (running)` |
| **Check Port 3000** | `sudo netstat -tulpn \| grep 3000` | Node.js listening on `0.0.0.0:3000` |
| **View Live Logs** | `journalctl -u network-inventory -f` | `Server running on http://0.0.0.0:3000` |
| **HTTP Verification** | `curl -I http://localhost/api/stats` | `200 OK` with JSON telemetry |

---

## 10. Updating & Maintaining the Platform

To update the application in the future:

```bash
cd /opt/network-inventory
sudo -u netmonitor git pull
sudo -u netmonitor npm install
sudo -u netmonitor npm run build
sudo systemctl restart network-inventory
```

---
*Guide compiled for Network Inventory & Topology Platform Deployment on Ubuntu 24.04 LTS.*
