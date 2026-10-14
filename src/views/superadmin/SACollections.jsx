/**
 * SACollections.jsx — Super Admin Milk Collection Management
 */
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { updateCollection, softDeleteCollection } from '../../utils/superAdminService';
import {
  ConfirmDialog, DataTable, RecordDrawer, SearchBar,
  SASectionHeader, StatusBadge, FormField, Input, Select, Textarea, exportToCSV
} from '../../components/superadmin/SAComponents';
import { Download, Edit2, Trash2, Eye, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';

export default function SACollections() {
  const { user: currentUser, collections, farmers, settings, loadAllData } = useAppStore();
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({});
  const [reason, setReason] = useState('');

  const farmerMap = Object.fromEntries(farmers.map(f => [f.farmer_id, f.name]));

  const filtered = collections.filter(c => {
    const matchSearch = !search || [c.entry_id, c.farmer_id, farmerMap[c.farmer_id]].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchDate = !dateFilter || c.date === dateFilter;
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchDate && matchStatus;
  });

  const openEdit = (c) => {
    setEditing(c);
    setForm({ farmer_id: c.farmer_id, date: c.date, quantity: c.quantity, fat: c.fat, snf: c.snf || 8.5, paid_amount: c.paid_amount });
    setReason('');
    setViewing(null);
    setDrawerOpen(true);
  };

  const openView = (c) => { setViewing(c); setEditing(null); setDrawerOpen(true); };

  // Live recalculation preview
  const liveRate = parseFloat(form.fat || 0) * (settings?.baseRate || 8.5);
  const liveTotal = liveRate * parseFloat(form.quantity || 0);
  const liveDue = Math.max(0, liveTotal - parseFloat(form.paid_amount || 0));

  const handleSave = async () => {
    if (!reason.trim()) { toast.error('Please provide a reason for this correction'); return; }
    setBusy(true);
    const res = await updateCollection(editing.entry_id, { ...form, _reason: reason }, settings, currentUser.uid, currentUser.role);
    if (res.success) {
      toast.success('Collection entry updated!');
      await loadAllData();
      setDrawerOpen(false);
    } else {
      toast.error(res.error || 'Update failed');
    }
    setBusy(false);
  };

  const handleDelete = (c) => {
    setConfirm({
      title: 'Delete Collection Entry',
      message: `Delete entry ${c.entry_id} for ${farmerMap[c.farmer_id] || c.farmer_id} on ${fmtDate(c.date)}? The farmer's due balance will be reversed.`,
      danger: true,
      confirmText: 'Delete Entry',
      requireReason: true,
      action: async (rsn) => {
        const res = await softDeleteCollection(c.entry_id, rsn, currentUser.uid, currentUser.role);
        if (res.success) { toast.success('Entry moved to trash!'); await loadAllData(); }
        else toast.error(res.error || 'Delete failed');
        setConfirm(null);
      }
    });
  };

  const columns = [
    { key: 'entry_id', label: 'Entry ID' },
    { key: 'farmer_id', label: 'Farmer', render: (v) => farmerMap[v] || v },
    { key: 'date', label: 'Date', render: fmtDate },
    { key: 'quantity', label: 'Qty (L)', render: (v) => `${(v || 0).toFixed(1)} L` },
    { key: 'fat', label: 'Fat', render: (v) => `${(v || 0).toFixed(1)}` },
    { key: 'total_amount', label: 'Total', render: (v) => fmt(v) },
    { key: 'due_amount', label: 'Due', render: (v) => <span className={parseFloat(v) > 0 ? 'text-danger font-bold' : ''}>{fmt(v)}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: '_actions', label: 'Actions', sortable: false,
      render: (_, row) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => openView(row)} className="p-1.5 rounded-lg hover:bg-black/5"><Eye className="w-3.5 h-3.5 text-textSecondary" /></button>
          <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => handleDelete(row)} className="p-1.5 rounded-lg hover:bg-danger/10 hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-5">
      <SASectionHeader
        title="Milk Collection Management"
        subtitle={`${collections.length} total entries`}
        actions={
          <button onClick={() => exportToCSV(collections, 'collections_export.csv')} className="flex items-center gap-1.5 px-3 py-2 border border-black/[0.08] rounded-xl text-caption font-semibold text-textSecondary hover:border-primary/40 transition-all">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        }
      />

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]"><SearchBar value={search} onChange={setSearch} placeholder="Search by entry ID, farmer..." /></div>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="border border-black/[0.08] rounded-xl px-3 py-2 text-caption focus:outline-none focus:border-primary" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-black/[0.08] rounded-xl px-3 py-2 text-caption focus:outline-none focus:border-primary">
          <option value="all">All Status</option>
          <option value="Paid">Paid</option>
          <option value="Partial">Partial</option>
          <option value="Pending">Pending</option>
        </select>
      </div>

      <DataTable columns={columns} data={filtered} onRowClick={openView} emptyMessage="No collection entries found" />

      {/* View drawer */}
      <RecordDrawer open={drawerOpen && !!viewing && !editing} title={`Collection: ${viewing?.entry_id}`} onClose={() => { setDrawerOpen(false); setViewing(null); }}>
        {viewing && (
          <div className="space-y-3">
            {[
              ['Entry ID', viewing.entry_id],
              ['Farmer', farmerMap[viewing.farmer_id] || viewing.farmer_id],
              ['Date', fmtDate(viewing.date)],
              ['Milk Type', viewing.milk_type || '—'],
              ['Quantity', `${(viewing.quantity || 0).toFixed(2)} L`],
              ['Fat', viewing.fat],
              ['SNF', viewing.snf],
              ['Calculated Rate', `₹${(viewing.calculated_rate || 0).toFixed(2)}`],
              ['Total Amount', fmt(viewing.total_amount)],
              ['Paid Amount', fmt(viewing.paid_amount)],
              ['Due Amount', fmt(viewing.due_amount)],
              ['Status', viewing.status],
              ['Timestamp', viewing.timestamp ? new Date(viewing.timestamp).toLocaleString() : '—'],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between items-start border-b border-black/[0.05] pb-2.5 last:border-0">
                <span className="label">{l}</span>
                <span className="text-caption font-semibold text-right max-w-[55%]">{v}</span>
              </div>
            ))}
            <button onClick={() => openEdit(viewing)} className="w-full py-2.5 bg-primary text-white rounded-xl text-caption font-bold mt-4">Edit this Entry</button>
          </div>
        )}
      </RecordDrawer>

      {/* Edit drawer */}
      <RecordDrawer open={drawerOpen && !!editing} title={`Edit Collection: ${editing?.entry_id}`} onClose={() => setDrawerOpen(false)}>
        <div className="space-y-4">
          <div className="p-3 bg-accent/5 border border-accent/20 rounded-xl">
            <p className="text-micro text-accent font-semibold">⚠ Financial Correction</p>
            <p className="text-micro text-textSecondary mt-0.5">Editing collection values will recalculate totals and adjust farmer dues automatically.</p>
          </div>
          <FormField label="Farmer ID"><Input value={form.farmer_id} disabled className="bg-background" /></FormField>
          <FormField label="Date"><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Quantity (L)">
              <Input type="number" step="0.01" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </FormField>
            <FormField label="Fat %">
              <Input type="number" step="0.1" value={form.fat} onChange={e => setForm(f => ({ ...f, fat: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="SNF">
            <Input type="number" step="0.1" value={form.snf} onChange={e => setForm(f => ({ ...f, snf: e.target.value }))} />
          </FormField>
          <FormField label="Paid Amount (₹)">
            <Input type="number" step="0.01" value={form.paid_amount} onChange={e => setForm(f => ({ ...f, paid_amount: e.target.value }))} />
          </FormField>

          {/* Live recalculation preview */}
          <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 space-y-1">
            <p className="label mb-2">Recalculated Preview</p>
            <div className="flex justify-between text-caption"><span className="text-textSecondary">Rate</span><span className="font-mono font-bold">₹{liveRate.toFixed(2)}/L</span></div>
            <div className="flex justify-between text-caption"><span className="text-textSecondary">Total</span><span className="font-mono font-bold">₹{liveTotal.toFixed(2)}</span></div>
            <div className={`flex justify-between text-caption font-bold ${liveDue > 0 ? 'text-danger' : 'text-primary'}`}><span>Due</span><span className="font-mono">₹{liveDue.toFixed(2)}</span></div>
          </div>

          <FormField label="Reason for Correction" required>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Data entry error — correcting fat value from 3.5 to 4.0" rows={3} />
          </FormField>

          <div className="flex gap-3 pt-4 border-t border-black/[0.06]">
            <button onClick={() => setDrawerOpen(false)} className="flex-1 py-2.5 border border-black/[0.08] rounded-xl text-caption font-semibold text-textSecondary hover:bg-black/5 transition-all">Cancel</button>
            <button onClick={handleSave} disabled={busy} className="flex-1 py-2.5 bg-primary text-white rounded-xl text-caption font-bold transition-all disabled:opacity-50">
              {busy ? 'Saving...' : 'Save Correction'}
            </button>
          </div>
        </div>
      </RecordDrawer>

      {confirm && <ConfirmDialog open={true} title={confirm.title} message={confirm.message} danger={confirm.danger} confirmText={confirm.confirmText} requireReason={confirm.requireReason} onConfirm={confirm.action} onCancel={() => setConfirm(null)} />}
    </div>
  );
}
