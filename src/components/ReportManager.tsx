import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, Download, Calendar, Plus, RefreshCw, Trash2, Clock, CheckCircle2, ShieldAlert, Award } from 'lucide-react';
import { jsPDF } from 'jspdf';

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

interface ReportManagerProps {
  currentUserRole: string;
}

export default function ReportManager({ currentUserRole }: ReportManagerProps) {
  const [reports, setReports] = useState<DBReport[]>([]);
  const [schedule, setSchedule] = useState<string>('weekly');
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports);
        setSchedule(data.schedule);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSchedule(true);
    setSuccessMsg('');
    try {
      const res = await fetch('/api/reports/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule })
      });
      if (res.ok) {
        setSuccessMsg('Compliance report schedule successfully updated!');
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleCompileReport = async () => {
    setIsCompiling(true);
    try {
      const res = await fetch('/api/reports/generate', { method: 'POST' });
      if (res.ok) {
        await fetchReports();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCompiling(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this archived audit report?')) return;
    try {
      const res = await fetch(`/api/reports/${id}/delete`, { method: 'DELETE' });
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const downloadPDF = (report: DBReport) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Decorative header band
    doc.setFillColor(24, 24, 27); // zinc-900 color
    doc.rect(0, 0, 210, 38, 'F');

    // Title text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('Helvetica', 'bold');
    doc.text('ETHERNET NETWORK SECURITY AUDIT', 15, 18);

    doc.setFontSize(8.5);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(161, 161, 170); // zinc-400
    doc.text('AUTOMATED TOPOLOGY COMPLIANCE & HOST UPTIME REPORT', 15, 26);
    doc.text(`AUDIT COMPLIANCE ID: ${report.id.toUpperCase()} | GENERATED: ${new Date(report.timestamp).toLocaleString()}`, 15, 31);

    // Section 1: Executive Summary & Health Profile
    doc.setTextColor(24, 24, 27); // zinc-900
    doc.setFontSize(13);
    doc.setFont('Helvetica', 'bold');
    doc.text('1. EXECUTIVE SUMMARY & HEALTH PROFILE', 15, 52);

    // Health Score Box
    doc.setDrawColor(228, 228, 231); // zinc-200
    doc.setFillColor(250, 250, 250); // zinc-50
    doc.rect(15, 57, 180, 26, 'FD');

    doc.setTextColor(63, 63, 70); // zinc-600
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'bold');
    doc.text('Overall Network Health Index Score:', 22, 66);
    doc.setFontSize(8.5);
    doc.setFont('Helvetica', 'normal');
    doc.text('Reflects calculated host availability, active ping latency ratings,', 22, 72);
    doc.text('mDNS state confirmations, and credential vault compliance ratios.', 22, 76);

    doc.setFontSize(26);
    doc.setFont('Helvetica', 'bold');
    const scoreColor = report.healthScore >= 90 ? [16, 185, 129] : report.healthScore >= 75 ? [245, 158, 11] : [239, 68, 68];
    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.text(`${report.healthScore}%`, 142, 75);

    // Section 2: Host Inventory & Distribution
    doc.setTextColor(24, 24, 27);
    doc.setFontSize(13);
    doc.setFont('Helvetica', 'bold');
    doc.text('2. HOST INVENTORY & NODE DISTRIBUTION', 15, 96);

    // Table Header
    doc.setDrawColor(161, 161, 170); // zinc-400
    doc.setFillColor(244, 244, 245); // zinc-100
    doc.rect(15, 102, 180, 8, 'FD');

    doc.setFontSize(8.5);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(24, 24, 27);
    doc.text('DEVICE NODE CLASSIFICATION TYPE', 20, 107.5);
    doc.text('ACTIVE HOST COUNT', 140, 107.5);

    // Table Rows
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(63, 63, 70);
    let currentY = 117;
    const distEntries = Object.entries(report.distribution || {});

    if (distEntries.length === 0) {
      doc.text('No active devices indexed in scan database.', 20, currentY);
      currentY += 8;
    } else {
      distEntries.forEach(([type, count]) => {
        // Horizontal cell border line
        doc.setDrawColor(244, 244, 245);
        doc.line(15, currentY + 2, 195, currentY + 2);

        doc.setFont('Helvetica', 'bold');
        doc.text(type.toUpperCase(), 20, currentY);
        doc.setFont('Helvetica', 'normal');
        doc.text(String(count), 140, currentY);
        currentY += 8;
      });
    }

    doc.setDrawColor(161, 161, 170);
    doc.line(15, currentY + 1, 195, currentY + 1);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(24, 24, 27);
    doc.text('TOTAL HOSTS DETECTED ON NETWORK SCAN RANGES', 20, currentY + 6);
    doc.text(String(report.totalDevices), 140, currentY + 6);

    // Section 3: Critical Audit Alerts & Events
    doc.setFontSize(13);
    doc.text('3. SYSTEM AUDIT ALERTS & NETWORK THREATS', 15, currentY + 22);

    let alertY = currentY + 28;
    if (!report.criticalAlerts || report.criticalAlerts.length === 0) {
      doc.setFillColor(240, 253, 244); // emerald-50
      doc.setDrawColor(187, 247, 208); // emerald-200
      doc.rect(15, alertY, 180, 14, 'FD');
      
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(21, 128, 61); // emerald-700
      doc.setFontSize(9);
      doc.text('SYSTEM CONFIRMED STATUS GREEN: NO CRITICAL THREATS DETECTED', 22, alertY + 8.5);
    } else {
      report.criticalAlerts.forEach((alert: string) => {
        doc.setFillColor(254, 242, 242); // red-50
        doc.setDrawColor(254, 226, 226); // red-200
        doc.rect(15, alertY, 180, 14, 'FD');

        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(185, 28, 28); // red-700
        doc.setFontSize(8);
        
        // Trim alert text safely to fit within portrait boundary
        const cleanAlert = alert.length > 105 ? alert.substring(0, 102) + '...' : alert;
        doc.text(`[CRITICAL WARNING]  ${cleanAlert}`, 20, alertY + 8.5);
        alertY += 18;
      });
    }

    // PDF Footer
    doc.setDrawColor(228, 228, 231);
    doc.line(15, 275, 195, 275);
    
    doc.setFontSize(7.5);
    doc.setTextColor(113, 113, 122);
    doc.setFont('Helvetica', 'normal');
    doc.text('This compliance report is generated on a secure offline daemon. Keep stored in locked configurations.', 15, 280);
    doc.text('Page 1 of 1', 185, 280);

    // Save/Download PDF
    doc.save(`ethernet_network_report_${report.id}.pdf`);
  };

  const getNextScheduledDate = () => {
    const d = new Date();
    if (schedule === 'daily') {
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0);
    } else if (schedule === 'weekly') {
      // Find next Sunday
      const resultDate = new Date();
      resultDate.setDate(resultDate.getDate() + (7 - resultDate.getDay()) % 7);
      resultDate.setHours(0, 0, 0, 0);
      return resultDate.toLocaleDateString();
    } else {
      return 'Manual compilation only';
    }
    return d.toLocaleDateString();
  };

  return (
    <div id="report_manager_panel" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COMPILATION ACTION CARD */}
        <div className="bg-white dark:bg-zinc-900 p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-1.5">
              <FileText className="w-5 h-5 text-blue-600" />
              Compile Live Compliance Health Report
            </h4>
            <p className="text-xs text-zinc-500 mt-1">
              Extracts active L2/L3 topology datasets, registers offline packet loss rates, lists unresolved audit alerts, and saves a signed golden audit ledger.
            </p>

            <div className="mt-4 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 flex items-start gap-3">
              <span className="p-2 bg-blue-100 dark:bg-blue-950/40 text-blue-600 rounded-lg">
                <Award className="w-5 h-5" />
              </span>
              <div className="text-xs space-y-1">
                <span className="font-bold text-zinc-800 dark:text-zinc-200 block">Report Specifications:</span>
                <span className="text-zinc-500 block">A4 Document Standard Size, Executive Health scoring system, Host distribution metrics, High-contrast dark header vector template.</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              id="btn_compile_new_report"
              onClick={handleCompileReport}
              disabled={isCompiling || currentUserRole !== 'admin'}
              className={`px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-md ${
                currentUserRole !== 'admin' ? 'cursor-not-allowed opacity-50' : ''
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{isCompiling ? 'Compiling Report...' : 'Compile Audit & Archive Now'}</span>
            </button>
          </div>
        </div>

        {/* SCHEDULER SETTING PANEL */}
        <div className="bg-white dark:bg-zinc-900 p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-1.5 border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
            <Calendar className="w-5 h-5 text-purple-600" />
            Report Auto-Scheduler
          </h4>

          <form onSubmit={handleSaveSchedule} className="space-y-4">
            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider text-zinc-400 block mb-1">
                Compilation Interval
              </label>
              <select
                id="select_report_schedule"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                disabled={currentUserRole !== 'admin'}
                className="w-full text-xs bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <option value="weekly">Weekly (Sunday at Midnight)</option>
                <option value="daily">Daily (Nightly at 00:00)</option>
                <option value="manual">Manual Compilation Only</option>
              </select>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400">
                <Clock className="w-3.5 h-3.5" />
                <span>Next Scheduled Compile Date:</span>
              </div>
              <span className="font-mono text-xs font-bold text-zinc-700 dark:text-zinc-300 block mt-1">
                {getNextScheduledDate()}
              </span>
            </div>

            {successMsg && (
              <div className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              id="btn_save_report_schedule"
              type="submit"
              disabled={isSavingSchedule || currentUserRole !== 'admin'}
              className="w-full py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{isSavingSchedule ? 'Saving Config...' : 'Apply Schedule Configuration'}</span>
            </button>
          </form>
        </div>

      </div>

      {/* ARCHIVED REPORTS LISTING TABLE */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800">
          <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Signed Audit Report Archives</h4>
          <p className="text-[11px] text-zinc-500 mt-0.5">Historical ledger of generated network security reports. All reports are cryptographically catalogued.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px] font-bold">
                <th className="py-3 px-5">Compile Timestamp</th>
                <th className="py-3 px-5">Report Title</th>
                <th className="py-3 px-5">Health Index</th>
                <th className="py-3 px-5">Nodes Count</th>
                <th className="py-3 px-5">Critical Alerts</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-400 italic">
                    No compliance health reports archived in golden ledger. Compile one above.
                  </td>
                </tr>
              ) : (
                reports.map((rep) => (
                  <tr
                    key={rep.id}
                    className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-950/40 transition"
                  >
                    <td className="py-3.5 px-5 font-mono text-[11px] text-zinc-500 font-medium">
                      {new Date(rep.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-5 font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-zinc-400" />
                      <span>{rep.name}</span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`font-bold font-mono text-[11px] px-2 py-0.5 rounded ${
                        rep.healthScore >= 90 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' 
                          : rep.healthScore >= 75 
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                      }`}>
                        {rep.healthScore}%
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-zinc-700 dark:text-zinc-300">
                      {rep.totalDevices} Host Nodes
                    </td>
                    <td className="py-3.5 px-5 font-mono">
                      {rep.alertsCount > 0 ? (
                        <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>{rep.alertsCount} Alert{rep.alertsCount > 1 ? 's' : ''}</span>
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Green</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right space-x-2">
                      <button
                        id={`btn_download_pdf_${rep.id}`}
                        onClick={() => downloadPDF(rep)}
                        className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-950/50 text-[10.5px] font-bold rounded-lg transition inline-flex items-center gap-1"
                        title="Download Formal PDF Report"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PDF</span>
                      </button>
                      
                      <button
                        id={`btn_delete_report_${rep.id}`}
                        onClick={() => handleDeleteReport(rep.id)}
                        disabled={currentUserRole !== 'admin'}
                        className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition disabled:opacity-50 inline-flex items-center"
                        title="Delete Archived Report"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
