/**
 * SADashboard.jsx
 * Super Admin overview — live stats, module shortcuts, sync failures, recent audit entries
 */
import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { getDatabaseOverview, loadSyncFailures, loadAuditLogs } from '../../utils/superAdminService';
import { getSyncQueueStatus } from '../../utils/syncQueue';
import { StatCard } from '../../components/superadmin/SAComponents';
import {
  Users, Droplet, Receipt, PieChart, AlertTriangle, CheckCircle,
  RefreshCw, Database, ShieldCheck, Activity, Clock, TrendingUp
} from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function SADashboard({ onNavigate }) {
  const { farmers, customers, collections, sales, expenses, todaySummary, dataLoaded } = useAppStore();
  const [dbOverview, setDbOverview] = useState(null);
  const [syncFailures, setSyncFailures] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [queueStatus, setQueueStatus] = useState({ pending: 0, isProcessing: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [overview, failures, auditRes] = await Promise.all([
        getDatabaseOverview(),
        loadSyncFailures(),
        loadAuditLogs({ limitCount: 10 })
      ]);
      if (overview.success) setDbOverview(overview.data);
      if (failures.success) setSyncFailures(failures.data);
      if (auditRes.success) setRecentLogs(auditRes.data);
      setQueueStatus(getSyncQueueStatus());
      setLoading(false);
    };
    load();

    // Refresh queue status every 5 seconds
    const interval = setInterval(() => setQueueStatus(getSyncQueueStatus()), 5000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date().toLocaleDateString('en-CA');
  const todayCollections = collections.filter(c => c.date === today);
  const litersToday = todayCollections.reduce((s, c) => s + (c.quantity || 0), 0);
  const activeFarmers = farmers.filter(f => f.active !== false);
  const activeCustomers = customers.filter(c => c.active !== false);

  const moduleCards = [
    { label: 'Farmers', value: dbOverview?.farmers ?? farmers.length, icon: Droplet, color: 'text-primary', bg: 'bg-primary/10', tab: 'sa-farmers' },
    { label: 'Customers', value: dbOverview?.customers ?? customers.length, icon: Users, color: 'text-accent', bg: 'bg-accent/10', tab: 'sa-customers' },
    { label: 'Collections', value: dbOverview?.collections ?? collections.length, icon: Droplet, color: 'text-primary', bg: 'bg-primary/10', tab: 'sa-collections' },
    { label: 'Sales / Invoices', value: dbOverview?.sales ?? sales.length, icon: Receipt, color: 'text-accent', bg: 'bg-accent/10', tab: 'sa-sales' },
    { label: 'Expenses', value: dbOverview?.expenses ?? expenses.length, icon: Receipt, color: 'text-danger', bg: 'bg-danger/10', tab: 'sa-expenses' },
    { label: 'Users', value: dbOverview?.users ?? '—', icon: ShieldCheck, color: 'text-primary', bg: 'bg-primary/10', tab: 'sa-users' },
    { label: 'Audit Logs', value: dbOverview?.audit_logs ?? '—', icon: Activity, color: 'text-textSecondary', bg: 'bg-black/5', tab: 'sa-audit' },
    { label: 'Sync Failures', value: syncFailures.length, icon: AlertTriangle, color: syncFailures.length > 0 ? 'text-danger' : 'text-primary', bg: syncFailures.length > 0 ? 'bg-danger/10' : 'bg-primary/10', tab: 'sa-sync' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Liters Today" value={`${litersToday.toFixed(1)} L`} icon={Droplet} />
        <StatCard label="Revenue Today" value={fmt(todaySummary.revenueToday)} icon={TrendingUp} color="text-primary" bg="bg-primary/10" />
        <StatCard label="Net Profit" value={fmt(todaySummary.netProfit)} icon={PieChart} color={todaySummary.netProfit >= 0 ? 'text-primary' : 'text-danger'} bg={todaySummary.netProfit >= 0 ? 'bg-primary/10' : 'bg-danger/10'} />
        <StatCard label="Pending Dues" value={fmt(todaySummary.pendingDues)} icon={Clock} color="text-accent" bg="bg-accent/10" />
      </div>

      {/* Sync queue status bar */}
      <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${queueStatus.pending > 0 ? 'border-accent/30 bg-accent/5' : 'border-primary/20 bg-primary/5'}`}>
        <RefreshCw className={`w-4 h-4 ${queueStatus.isProcessing ? 'animate-spin text-accent' : 'text-primary'}`} />
        <p className="text-caption text-textSecondary flex-1">
          <span className="font-semibold text-textPrimary">Sync Queue: </span>
          {queueStatus.pending === 0 ? 'All operations synchronized.' : `${queueStatus.pending} job(s) pending${queueStatus.isProcessing ? ' — processing now' : ''}`}
        </p>
        {syncFailures.length > 0 && (
          <button onClick={() => onNavigate('sa-sync')} className="cta-pill bg-danger text-white">
            {syncFailures.length} failed
          </button>
        )}
      </div>

      {/* Module shortcut grid */}
      <div>
        <p className="label mb-3">Module Control</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {moduleCards.map((m, i) => (
            <StatCard key={i} label={m.label} value={loading ? '…' : m.value} icon={m.icon} color={m.color} bg={m.bg} onClick={() => onNavigate(m.tab)} />
          ))}
        </div>
      </div>

      {/* Bottom row: DB overview + recent audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* DB Overview */}
        <div className="bg-white rounded-card border border-black/[0.07] shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-primary" />
            <h3 className="text-body font-semibold text-textPrimary">Database Health</h3>
          </div>
          {dbOverview ? (
            <div className="space-y-2">
              {Object.entries(dbOverview).map(([col, count]) => (
                <div key={col} className="flex justify-between items-center py-1.5 border-b border-black/[0.04] last:border-0">
                  <span className="text-caption text-textSecondary font-medium capitalize">{col.replace(/_/g, ' ')}</span>
                  <span className="text-caption font-bold text-textPrimary font-mono">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 animate-pulse">
              {[...Array(6)].map((_, i) => <div key={i} className="h-6 bg-black/5 rounded" />)}
            </div>
          )}
        </div>

        {/* Recent audit log */}
        <div className="bg-white rounded-card border border-black/[0.07] shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="text-body font-semibold text-textPrimary">Recent Admin Actions</h3>
            </div>
            <button onClick={() => onNavigate('sa-audit')} className="text-micro text-primary hover:underline font-semibold">View all →</button>
          </div>
          {recentLogs.length === 0 ? (
            <p className="text-caption text-textSecondary py-6 text-center">{loading ? 'Loading…' : 'No audit log entries yet.'}</p>
          ) : (
            <div className="space-y-2.5">
              {recentLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-3 pb-2.5 border-b border-black/[0.04] last:border-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${log.result === 'success' ? 'bg-primary/10' : 'bg-danger/10'}`}>
                    {log.result === 'success' ? <CheckCircle className="w-3.5 h-3.5 text-primary" /> : <AlertTriangle className="w-3.5 h-3.5 text-danger" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-caption font-semibold text-textPrimary truncate">{log.action?.replace(/_/g, ' ')}</p>
                    <p className="text-micro text-textSecondary truncate">{log.actor} · {log.module}</p>
                    <p className="text-micro text-textSecondary">{log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
