/**
 * SADatabase.jsx — Super Admin Database Health & Trash Recovery Center
 * Manage Firestore collections, inspect counts, restore deleted records, permanently purge with audit
 */
import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import {
  getDatabaseOverview, loadTrash, restoreFromTrash, purgeFromTrash
} from '../../utils/superAdminService';
import {
  ConfirmDialog, DataTable, RecordDrawer, SearchBar,
  SASectionHeader, exportToCSV
} from '../../components/superadmin/SAComponents';
import {
  Database, Trash2, RotateCcw, AlertTriangle, RefreshCw,
  Archive, ShieldCheck, Download, Layers, Eye
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SADatabase() {
  const { user: currentUser, loadAllData } = useAppStore();
  const [counts, setCounts] = useState({});
  const [trashItems, setTrashItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [confirm, setConfirm] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [activeTab, setActiveTab] = useState('trash'); // 'trash' or 'collections'

  const refresh = async () => {
    setLoading(true);
    try {
      const [ovRes, trRes] = await Promise.all([
        getDatabaseOverview(),
        loadTrash()
      ]);
      if (ovRes.success) setCounts(ovRes.data);
      if (trRes.success) setTrashItems(trRes.data);
    } catch (err) {
      toast.error('Failed to load database overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const filteredTrash = trashItems.filter(item => {
    const q = search.toLowerCase();
    const matchSearch = !search || [item._collection, item._trashId, item._reason, item.name, item.customer_name, item.reason]
      .some(v => v && String(v).toLowerCase().includes(q));
    const matchCol = collectionFilter === 'all' || item._collection === collectionFilter;
    return matchSearch && matchCol;
  });

  const handleRestore = (item) => {
    setConfirm({
      title: 'Restore Record',
      message: `Restore this ${item._collection} record (${item._trashId}) back to the live database? It will immediately reappear in all active views.`,
      danger: false,
      confirmText: 'Restore Record',
      requireReason: false,
      action: async () => {
        const res = await restoreFromTrash(item._trashId, currentUser.uid, currentUser.role);
        if (res.success) {
          toast.success('Record successfully restored!');
          await refresh();
          await loadAllData();
        } else {
          toast.error(res.error || 'Restore failed');
        }
        setConfirm(null);
      }
    });
  };

  const handlePurge = (item) => {
    setConfirm({
      title: 'Permanently Purge Record',
      message: `WARNING: This action is irreversible. The record (${item._trashId}) will be permanently deleted from the database.`,
      danger: true,
      confirmText: 'Permanently Purge',
      requireReason: true,
      action: async (reason) => {
        const res = await purgeFromTrash(item._trashId, reason, currentUser.uid, currentUser.role);
        if (res.success) {
          toast.success('Record permanently purged');
          await refresh();
        } else {
          toast.error(res.error || 'Purge failed');
        }
        setConfirm(null);
      }
    });
  };

  const trashColumns = [
    {
      key: '_collection',
      label: 'Collection',
      render: (v) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-micro font-bold uppercase bg-primary/10 text-primary">
          {v}
        </span>
      )
    },
    {
      key: '_trashId',
      label: 'Original ID',
      render: (v) => <span className="font-mono text-micro font-bold text-textPrimary">{v}</span>
    },
    {
      key: '_deleted_at',
      label: 'Deleted At',
      render: (v) => (
        <span className="font-mono text-micro text-textSecondary">
          {v ? new Date(v).toLocaleString('en-IN') : '—'}
        </span>
      )
    },
    {
      key: '_reason',
      label: 'Deletion Reason',
      render: (v) => <span className="text-caption text-textPrimary italic">{v || 'No reason specified'}</span>
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
            title="Inspect Data"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleRestore(r)}
            className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-micro font-bold flex items-center gap-1 transition-all"
            title="Restore to Live Database"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore
          </button>
          <button
            onClick={() => handlePurge(r)}
            className="p-1.5 rounded-lg hover:bg-danger/10 text-danger transition-colors"
            title="Permanently Purge"
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
        title="Database Health & Trash Recovery Center"
        subtitle="Live collection stats, soft-delete trash bin, and data recovery"
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
              onClick={() => exportToCSV(trashItems, 'trash-archive.csv')}
              className="px-3.5 py-2 border border-black/[0.08] rounded-xl text-caption font-semibold hover:bg-black/[0.02] flex items-center gap-1.5 transition-all"
            >
              <Download className="w-4 h-4 text-textSecondary" />
              Export Trash Log
            </button>
          </>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-black/[0.08] pb-1">
        <button
          onClick={() => setActiveTab('trash')}
          className={`py-2 px-4 rounded-xl text-caption font-bold flex items-center gap-2 transition-all ${
            activeTab === 'trash'
              ? 'bg-primary text-white shadow-xs'
              : 'text-textSecondary hover:bg-black/[0.04]'
          }`}
        >
          <Archive className="w-4 h-4" />
          Trash Bin & Recovery ({trashItems.length})
        </button>
        <button
          onClick={() => setActiveTab('collections')}
          className={`py-2 px-4 rounded-xl text-caption font-bold flex items-center gap-2 transition-all ${
            activeTab === 'collections'
              ? 'bg-primary text-white shadow-xs'
              : 'text-textSecondary hover:bg-black/[0.04]'
          }`}
        >
          <Database className="w-4 h-4" />
          Firestore Collections Overview
        </button>
      </div>

      {activeTab === 'trash' ? (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-black/[0.07] shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex-1 max-w-md">
              <SearchBar value={search} onChange={setSearch} placeholder="Search deleted records by ID, reason, or name..." />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-micro font-semibold uppercase text-textSecondary">Collection:</span>
              <select
                value={collectionFilter}
                onChange={e => setCollectionFilter(e.target.value)}
                className="border border-black/[0.08] rounded-xl px-3 py-1.5 text-micro bg-white focus:outline-none focus:border-primary"
              >
                <option value="all">All Deleted Collections</option>
                <option value="farmers">farmers</option>
                <option value="collections">collections</option>
                <option value="customers">customers</option>
                <option value="sales">sales</option>
                <option value="expenses">expenses</option>
              </select>
            </div>
          </div>

          {/* Trash Table */}
          <div className="bg-white rounded-2xl p-4 border border-black/[0.07] shadow-card">
            <DataTable
              columns={trashColumns}
              data={filteredTrash}
              onRowClick={setViewing}
              emptyMessage="Trash bin is clean. No soft-deleted records."
            />
          </div>
        </div>
      ) : (
        /* Collections Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Object.entries(counts).map(([colName, count]) => (
            <div
              key={colName}
              className="bg-white rounded-2xl p-5 border border-black/[0.07] shadow-sm flex items-center justify-between"
            >
              <div>
                <p className="label font-mono">{colName}</p>
                <h4 className="stat-number text-textPrimary mt-1.5">{count}</h4>
                <p className="text-micro text-textSecondary mt-0.5">Firestore documents</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer: Inspect raw deleted document payload */}
      <RecordDrawer
        open={!!viewing}
        title={`Trash Record: ${viewing?._trashId || ''}`}
        onClose={() => setViewing(null)}
      >
        {viewing && (
          <div className="space-y-4">
            <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
              <p className="text-caption font-semibold">Source Collection: <span className="font-mono">{viewing._collection}</span></p>
              <p className="text-caption text-textSecondary mt-1">Deleted By UID: <span className="font-mono text-micro">{viewing._deleted_by}</span></p>
              <p className="text-caption text-textSecondary mt-0.5">Reason: {viewing._reason || 'None'}</p>
            </div>

            <div className="space-y-1.5">
              <label className="label">Full JSON Snapshot at Deletion</label>
              <pre className="p-4 bg-background border border-black/[0.08] rounded-xl text-micro font-mono overflow-x-auto max-h-96">
                {JSON.stringify(viewing, null, 2)}
              </pre>
            </div>

            <div className="flex gap-2 pt-3 border-t border-black/[0.07]">
              <button
                onClick={() => { setViewing(null); handleRestore(viewing); }}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-caption font-bold hover:bg-primary-light transition-all flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Restore to Live Database
              </button>
              <button
                onClick={() => { setViewing(null); handlePurge(viewing); }}
                className="px-4 py-2.5 bg-danger/10 text-danger rounded-xl text-caption font-bold hover:bg-danger/20 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Purge
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
