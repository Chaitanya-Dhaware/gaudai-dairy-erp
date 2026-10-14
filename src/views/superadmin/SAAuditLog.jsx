/**
 * SAAuditLog.jsx — Super Admin System Audit Log Explorer
 * Immutable audit trail of every administrative mutation, soft delete, restore, and user change
 */
import { useState, useEffect } from 'react';
import { loadAuditLogs } from '../../utils/superAdminService';
import {
  DataTable, RecordDrawer, SearchBar, SASectionHeader, exportToCSV
} from '../../components/superadmin/SAComponents';
import { RefreshCw, Download, Eye, Shield, Filter, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const MODULES = ['all', 'users', 'farmers', 'collections', 'customers', 'sales', 'expenses', 'settings', 'sync'];

export default function SAAuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [viewing, setViewing] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await loadAuditLogs({
        module: moduleFilter === 'all' ? undefined : moduleFilter,
        limitCount: 300
      });
      if (res.success) {
        setLogs(res.data);
      } else {
        toast.error('Failed to load audit trail');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [moduleFilter]);

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    return !search || [l.action, l.module, l.actor, l.recordId, l.reason, l.result]
      .some(v => v && String(v).toLowerCase().includes(q));
  });

  const columns = [
    {
      key: 'timestamp',
      label: 'Timestamp',
      render: (v) => (
        <span className="font-mono text-micro text-textSecondary whitespace-nowrap">
          {v ? new Date(v).toLocaleString('en-IN') : '—'}
        </span>
      )
    },
    {
      key: 'action',
      label: 'Action',
      render: (v) => {
        const isDelete = v?.includes('DELETE') || v?.includes('PURGE');
        const isRestore = v?.includes('RESTORE');
        const color = isDelete
          ? 'bg-danger/10 text-danger'
          : isRestore
            ? 'bg-primary/10 text-primary'
            : 'bg-black/[0.05] text-textPrimary';
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-micro font-bold font-mono ${color}`}>
            {v}
          </span>
        );
      }
    },
    {
      key: 'module',
      label: 'Module',
      render: (v) => <span className="font-mono text-micro uppercase font-semibold text-textSecondary">{v}</span>
    },
    {
      key: 'recordId',
      label: 'Target ID',
      render: (v) => <span className="font-mono text-micro font-semibold text-primary truncate max-w-[120px] block">{v || '—'}</span>
    },
    {
      key: 'actor',
      label: 'Actor UID',
      render: (v, r) => (
        <div>
          <span className="font-mono text-micro text-textSecondary truncate block max-w-[100px]">{v}</span>
          <span className="text-micro text-textSecondary/70 capitalize">{r.actorRole || 'admin'}</span>
        </div>
      )
    },
    {
      key: 'reason',
      label: 'Stated Reason',
      render: (v) => <span className="text-caption text-textPrimary italic line-clamp-1">{v || 'System automated'}</span>
    },
    {
      key: 'actions',
      label: 'Details',
      sortable: false,
      render: (_, r) => (
        <button
          onClick={() => setViewing(r)}
          className="p-1.5 rounded-lg hover:bg-black/5 text-textSecondary hover:text-textPrimary"
          title="Inspect Audit Record"
        >
          <Eye className="w-4 h-4" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <SASectionHeader
        title="Immutable Security Audit Trail"
        subtitle={`Audit events logged in Firestore: ${logs.length} · Filtered: ${filtered.length}`}
        actions={
          <>
            <button
              onClick={refresh}
              disabled={loading}
              className="px-3.5 py-2 border border-black/[0.08] rounded-xl text-caption font-semibold hover:bg-black/[0.02] flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-4 h-4 text-textSecondary ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => exportToCSV(logs, 'audit-trail-export.csv')}
              className="px-3.5 py-2 border border-black/[0.08] rounded-xl text-caption font-semibold hover:bg-black/[0.02] flex items-center gap-1.5 transition-all"
            >
              <Download className="w-4 h-4 text-textSecondary" />
              Export CSV
            </button>
          </>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-black/[0.07] shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by action, record ID, actor, reason..." />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-micro font-semibold uppercase text-textSecondary mr-1">Module:</span>
          {MODULES.map(m => (
            <button
              key={m}
              onClick={() => setModuleFilter(m)}
              className={`px-2.5 py-1 rounded-xl text-micro font-bold uppercase transition-all ${
                moduleFilter === m
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-black/[0.04] text-textSecondary hover:text-textPrimary hover:bg-black/[0.07]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl p-4 border border-black/[0.07] shadow-card">
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={setViewing}
          emptyMessage="No audit logs recorded for this criteria."
        />
      </div>

      {/* Drawer: Detailed Inspection with Before/After Diff */}
      <RecordDrawer
        open={!!viewing}
        title={`Audit Event: ${viewing?.action || ''}`}
        onClose={() => setViewing(null)}
      >
        {viewing && (
          <div className="space-y-4">
            <div className="bg-background rounded-2xl p-4 border border-black/[0.06] space-y-2">
              <div className="flex justify-between items-center">
                <span className="label">Timestamp</span>
                <span className="font-mono text-micro text-textPrimary">{viewing.timestamp}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="label">Module</span>
                <span className="font-mono text-micro font-bold uppercase text-primary">{viewing.module}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="label">Record ID</span>
                <span className="font-mono text-micro text-textPrimary">{viewing.recordId || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="label">Actor UID</span>
                <span className="font-mono text-micro text-textPrimary">{viewing.actor} ({viewing.actorRole})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="label">Execution Result</span>
                <span className="text-micro font-bold text-primary capitalize">{viewing.result || 'success'}</span>
              </div>
            </div>

            {viewing.reason && (
              <div className="p-3 bg-accent/5 border border-accent/15 rounded-xl">
                <p className="label text-accent mb-0.5">Admin Stated Reason</p>
                <p className="text-caption font-medium text-textPrimary">{viewing.reason}</p>
              </div>
            )}

            {/* Before Payload */}
            {viewing.before && (
              <div className="space-y-1.5">
                <label className="label text-danger flex items-center gap-1">
                  <span>State Before Mutation</span>
                </label>
                <pre className="p-3 bg-danger/[0.03] border border-danger/10 rounded-xl text-micro font-mono overflow-x-auto max-h-60">
                  {(() => {
                    try { return JSON.stringify(JSON.parse(viewing.before), null, 2); }
                    catch { return viewing.before; }
                  })()}
                </pre>
              </div>
            )}

            {/* After Payload */}
            {viewing.after && (
              <div className="space-y-1.5">
                <label className="label text-primary flex items-center gap-1">
                  <span>State After Mutation</span>
                </label>
                <pre className="p-3 bg-primary/[0.03] border border-primary/10 rounded-xl text-micro font-mono overflow-x-auto max-h-60">
                  {(() => {
                    try { return JSON.stringify(JSON.parse(viewing.after), null, 2); }
                    catch { return viewing.after; }
                  })()}
                </pre>
              </div>
            )}
          </div>
        )}
      </RecordDrawer>
    </div>
  );
}
