/**
 * SASync.jsx — Super Admin Sync & Integration Health
 * Monitor Google Sheets background sync queue, inspect sync failures, clear logs, and verify integration settings
 */
import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { getSyncQueueStatus } from '../../utils/syncQueue';
import { loadSyncFailures, clearSyncFailure } from '../../utils/superAdminService';
import {
  ConfirmDialog, DataTable, RecordDrawer, SearchBar,
  SASectionHeader, StatusBadge
} from '../../components/superadmin/SAComponents';
import {
  RefreshCw, CheckCircle, AlertTriangle, Trash2, Eye,
  CloudSync, Sheet, ArrowUpRight, Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SASync() {
  const { user: currentUser, settings } = useAppStore();
  const [queueStatus, setQueueStatus] = useState({ pending: 0, isProcessing: false, jobs: [] });
  const [failures, setFailures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [viewing, setViewing] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setQueueStatus(getSyncQueueStatus());
      const res = await loadSyncFailures();
      if (res.success) setFailures(res.data);
    } catch (err) {
      toast.error('Failed to update sync health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      setQueueStatus(getSyncQueueStatus());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleClearFailure = (f) => {
    setConfirm({
      title: 'Dismiss Sync Failure',
      message: `Mark failure ${f.id} as resolved and remove it from the monitoring feed?`,
      danger: false,
      confirmText: 'Dismiss Failure',
      requireReason: false,
      action: async () => {
        const res = await clearSyncFailure(f.id, currentUser.uid, currentUser.role);
        if (res.success) {
          toast.success('Failure record dismissed');
          await refresh();
        } else {
          toast.error(res.error || 'Failed to dismiss');
        }
        setConfirm(null);
      }
    });
  };

  const failureColumns = [
    {
      key: 'action',
      label: 'Operation',
      render: (v) => <span className="font-mono text-micro font-bold text-primary">{v}</span>
    },
    {
      key: 'failedAt',
      label: 'Failed At',
      render: (v) => (
        <span className="font-mono text-micro text-textSecondary">
          {v ? new Date(v).toLocaleString('en-IN') : '—'}
        </span>
      )
    },
    {
      key: 'retries',
      label: 'Retries',
      render: (v) => <span className="font-mono text-caption font-semibold">{v} / 5</span>
    },
    {
      key: 'error',
      label: 'Error Message',
      render: (v) => <span className="text-caption text-danger line-clamp-1">{v || 'Max retries exceeded'}</span>
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, r) => (
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setViewing(r)}
            className="p-1.5 rounded-lg hover:bg-black/5 text-textSecondary hover:text-textPrimary"
            title="Inspect Payload"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleClearFailure(r)}
            className="p-1.5 rounded-lg hover:bg-danger/10 text-danger transition-colors"
            title="Dismiss Failure"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <SASectionHeader
        title="Sync & Integration Health Control"
        subtitle="Monitor real-time Google Sheets background queue and failure dispatch"
        actions={
          <button
            onClick={refresh}
            disabled={loading}
            className="px-3.5 py-2 border border-black/[0.08] rounded-xl text-caption font-semibold hover:bg-black/[0.02] flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-4 h-4 text-textSecondary ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* Real-time Status Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-black/[0.07] shadow-sm flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${queueStatus.pending > 0 ? 'bg-accent/10 text-accent animate-pulse' : 'bg-primary/10 text-primary'}`}>
            <CloudSync className="w-6 h-6" />
          </div>
          <div>
            <p className="label">In-Memory Queue</p>
            <h4 className="stat-number text-textPrimary mt-0.5">{queueStatus.pending} pending</h4>
            <p className="text-micro text-textSecondary">
              {queueStatus.isProcessing ? 'Worker active processing jobs' : 'Queue idle'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-black/[0.07] shadow-sm flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${failures.length > 0 ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="label">Sync Failures</p>
            <h4 className="stat-number text-textPrimary mt-0.5">{failures.length} recorded</h4>
            <p className="text-micro text-textSecondary">Logged in Firestore</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-black/[0.07] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="label">System Pipeline</p>
            <h4 className="stat-number text-primary mt-0.5">Online</h4>
            <p className="text-micro text-textSecondary">Firestore-first active</p>
          </div>
        </div>
      </div>

      {/* Connected Google Sheets Configurations */}
      <div className="bg-white rounded-2xl p-5 border border-black/[0.07] shadow-sm space-y-3">
        <h3 className="text-subtitle font-bold text-textPrimary flex items-center gap-2">
          <Sheet className="w-5 h-5 text-primary" />
          Configured Google Spreadsheet Target IDs
        </h3>
        <p className="text-caption text-textSecondary">
          Background jobs sync changes to these target Google Sheet files via Google Apps Script (GAS) Webhook.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {[
            { label: 'Master Sheet ID', id: settings.sheetsIdMaster },
            { label: 'Collection Sheet ID', id: settings.sheetsIdCollection },
            { label: 'Customer Sheet ID', id: settings.sheetsIdCustomer },
            { label: 'Expense Sheet ID', id: settings.sheetsIdExpense }
          ].map((item, idx) => (
            <div key={idx} className="bg-background rounded-xl p-3 border border-black/[0.05]">
              <p className="label">{item.label}</p>
              <p className="font-mono text-micro font-semibold text-textPrimary truncate mt-1">
                {item.id || <span className="text-textSecondary italic">Not Configured</span>}
              </p>
              {item.id && (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${item.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-micro text-primary hover:underline font-semibold mt-2"
                >
                  Open in Google Sheets
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sync Failures Table */}
      <div className="space-y-3">
        <h3 className="text-subtitle font-bold text-textPrimary">Sync Failure Logs</h3>
        <div className="bg-white rounded-2xl p-4 border border-black/[0.07] shadow-card">
          <DataTable
            columns={failureColumns}
            data={failures}
            onRowClick={setViewing}
            emptyMessage="All background sync jobs succeeded! No logged failures."
          />
        </div>
      </div>

      {/* Drawer: Inspect failure payload */}
      <RecordDrawer
        open={!!viewing}
        title={`Sync Failure Payload: ${viewing?.id || ''}`}
        onClose={() => setViewing(null)}
      >
        {viewing && (
          <div className="space-y-4">
            <div className="bg-danger/5 rounded-xl p-3 border border-danger/10">
              <p className="text-caption font-semibold text-danger">Action: {viewing.action}</p>
              <p className="text-caption text-textSecondary mt-1">Failed At: {viewing.failedAt}</p>
              <p className="text-caption text-danger mt-1">Error: {viewing.error}</p>
            </div>

            <div className="space-y-1.5">
              <label className="label">Failed Payload Data</label>
              <pre className="p-4 bg-background border border-black/[0.08] rounded-xl text-micro font-mono overflow-x-auto max-h-96">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(viewing.payload), null, 2);
                  } catch {
                    return viewing.payload;
                  }
                })()}
              </pre>
            </div>

            <div className="flex gap-2 pt-3 border-t border-black/[0.07]">
              <button
                onClick={() => { setViewing(null); handleClearFailure(viewing); }}
                className="flex-1 py-2.5 bg-danger/10 text-danger rounded-xl text-caption font-bold hover:bg-danger/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Dismiss Failure Record
              </button>
            </div>
          </div>
        )}
      </RecordDrawer>

      {/* Confirmation Dialog */}
      {confirm && (
        <ConfirmDialog
          open={!!confirm}
          title={confirm.title}
          message={confirm.message}
          danger={confirm.danger}
          confirmText={confirm.confirmText}
          requireReason={confirm.requireReason}
          onConfirm={confirm.action}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
