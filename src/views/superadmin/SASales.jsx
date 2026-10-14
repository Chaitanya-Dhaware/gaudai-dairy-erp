/**
 * SASales.jsx — Super Admin Sales & Invoices Management
 * View, edit financial amounts, update payment status, reverse/soft-delete, export CSV
 */
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { updateSale, softDeleteSale } from '../../utils/superAdminService';
import {
  ConfirmDialog, DataTable, RecordDrawer, SearchBar,
  SASectionHeader, StatusBadge, FormField, Input, Select, exportToCSV
} from '../../components/superadmin/SAComponents';
import { RefreshCw, Download, Edit2, Trash2, Eye, Receipt, Calendar, CreditCard } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SASales() {
  const { user: currentUser, sales, loadAllData } = useAppStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    total_amount: 0,
    paid_amount: 0,
    payment_mode: 'Cash',
    reason: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const filtered = sales.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !search || [s.bill_id, s.id, s.customer_name, s.customer_id, s.payment_mode].some(v => v?.toLowerCase().includes(q));
    const matchStatus = statusFilter === 'all'
      ? true
      : statusFilter === 'payment_only'
        ? s.is_payment_record === true
        : s.status?.toLowerCase() === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  const openView = (s) => {
    setViewing(s);
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      total_amount: s.total_amount || 0,
      paid_amount: s.paid_amount || 0,
      payment_mode: s.payment_mode || 'Cash',
      reason: ''
    });
    setFormErrors({});
    setViewing(null);
    setDrawerOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!form.reason.trim()) errs.reason = 'A reason is required for administrative financial updates';
    if (isNaN(parseFloat(form.total_amount)) || parseFloat(form.total_amount) < 0) errs.total_amount = 'Total amount must be 0 or greater';
    if (isNaN(parseFloat(form.paid_amount)) || parseFloat(form.paid_amount) < 0) errs.paid_amount = 'Paid amount must be 0 or greater';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const billId = editing.bill_id || editing.id;
      const res = await updateSale(
        billId,
        {
          total_amount: parseFloat(form.total_amount),
          paid_amount: parseFloat(form.paid_amount),
          payment_mode: form.payment_mode,
          _reason: form.reason.trim()
        },
        currentUser.uid,
        currentUser.role
      );
      if (res.success) {
        toast.success('Sale record updated!');
        await loadAllData();
        setDrawerOpen(false);
      } else {
        toast.error(res.error || 'Failed to update sale');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (s) => {
    const billId = s.bill_id || s.id;
    setConfirm({
      title: 'Move Sale to Trash',
      message: `Are you sure you want to delete invoice ${billId} (${s.customer_name})? Any linked customer due will be automatically adjusted.`,
      danger: true,
      confirmText: 'Move to Trash',
      requireReason: true,
      action: async (reason) => {
        setBusy(true);
        const res = await softDeleteSale(billId, reason, currentUser.uid, currentUser.role);
        if (res.success) {
          toast.success('Sale record moved to trash');
          await loadAllData();
        } else {
          toast.error(res.error || 'Delete failed');
        }
        setBusy(false);
        setConfirm(null);
      }
    });
  };

  const columns = [
    {
      key: 'bill_id',
      label: 'Invoice / Bill ID',
      render: (_, r) => (
        <span className="font-mono text-micro font-bold text-primary">
          {r.bill_id || r.id || '—'}
        </span>
      )
    },
    {
      key: 'date',
      label: 'Date',
      render: (v) => <span className="font-mono text-micro text-textSecondary">{v || '—'}</span>
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (v, r) => (
        <div>
          <p className="font-semibold text-textPrimary leading-snug">{v || 'Walk-in / Cash'}</p>
          <p className="text-micro text-textSecondary font-mono">{r.customer_id || ''}</p>
        </div>
      )
    },
    {
      key: 'total_amount',
      label: 'Total (₹)',
      render: (v) => <span className="font-mono font-bold text-caption">₹{(v || 0).toLocaleString('en-IN')}</span>
    },
    {
      key: 'paid_amount',
      label: 'Paid (₹)',
      render: (v) => <span className="font-mono text-caption text-primary">₹{(v || 0).toLocaleString('en-IN')}</span>
    },
    {
      key: 'due_amount',
      label: 'Due (₹)',
      render: (v) => (
        <span className={`font-mono font-bold text-caption ${(v || 0) > 0 ? 'text-danger' : 'text-textSecondary'}`}>
          ₹{(v || 0).toLocaleString('en-IN')}
        </span>
      )
    },
    {
      key: 'payment_mode',
      label: 'Mode',
      render: (v) => <span className="text-micro font-semibold px-2 py-0.5 rounded-md bg-black/[0.04] text-textSecondary">{v || 'Cash'}</span>
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v || 'Pending'} />
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, r) => (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => openView(r)}
            className="p-1.5 rounded-lg hover:bg-black/5 text-textSecondary hover:text-textPrimary transition-colors"
            title="View Invoice"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => openEdit(r)}
            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
            title="Edit Financials"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(r)}
            className="p-1.5 rounded-lg hover:bg-danger/10 text-danger transition-colors"
            title="Delete Sale"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const previewDue = Math.max(0, (parseFloat(form.total_amount) || 0) - (parseFloat(form.paid_amount) || 0));

  return (
    <div className="space-y-6">
      <SASectionHeader
        title="Sales & Invoices Master Control"
        subtitle={`Total recorded sales: ${sales.length} · Showing ${filtered.length}`}
        actions={
          <>
            <button
              onClick={() => loadAllData()}
              className="px-3.5 py-2 border border-black/[0.08] rounded-xl text-caption font-semibold hover:bg-black/[0.02] flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className="w-4 h-4 text-textSecondary" />
              Refresh
            </button>
            <button
              onClick={() => exportToCSV(sales, 'sales-invoices-export.csv')}
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
          <SearchBar value={search} onChange={setSearch} placeholder="Search by bill ID, customer name, mode..." />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-micro font-semibold uppercase text-textSecondary">Status:</span>
          {['all', 'Paid', 'Partial', 'Pending', 'payment_only'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-micro font-bold capitalize transition-all ${
                statusFilter === f
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-black/[0.04] text-textSecondary hover:text-textPrimary hover:bg-black/[0.07]'
              }`}
            >
              {f === 'payment_only' ? 'Direct Payments' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl p-4 border border-black/[0.07] shadow-card">
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={openView}
          emptyMessage="No sales found matching your criteria."
        />
      </div>

      {/* Drawer: View or Edit */}
      <RecordDrawer
        open={drawerOpen}
        title={viewing ? 'Invoice Details' : 'Super Admin Edit Invoice'}
        onClose={() => setDrawerOpen(false)}
      >
        {viewing ? (
          <div className="space-y-5">
            <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 flex items-center justify-between">
              <div>
                <h4 className="text-title font-bold text-textPrimary">{viewing.bill_id || viewing.id}</h4>
                <p className="text-caption text-textSecondary mt-0.5">{viewing.date} · {viewing.customer_name || 'Walk-in'}</p>
              </div>
              <StatusBadge status={viewing.status || 'Paid'} />
            </div>

            {/* Line items if available */}
            {Array.isArray(viewing.items) && viewing.items.length > 0 && (
              <div className="border border-black/[0.07] rounded-xl overflow-hidden">
                <div className="bg-background px-4 py-2.5 border-b border-black/[0.06] text-micro font-bold uppercase text-textSecondary">
                  Purchased Items
                </div>
                <div className="divide-y divide-black/[0.04]">
                  {viewing.items.map((it, idx) => (
                    <div key={idx} className="px-4 py-2.5 flex items-center justify-between text-caption">
                      <div>
                        <p className="font-semibold text-textPrimary">{it.product_name || it.name}</p>
                        <p className="text-micro text-textSecondary font-mono">{it.quantity} × ₹{it.rate}</p>
                      </div>
                      <p className="font-mono font-bold">₹{(it.amount || 0).toLocaleString('en-IN')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-background rounded-xl p-3 border border-black/[0.05]">
                <p className="label">Total Amount</p>
                <p className="stat-number text-textPrimary mt-1">₹{(viewing.total_amount || 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
                <p className="label text-primary">Paid Amount</p>
                <p className="stat-number text-primary mt-1">₹{(viewing.paid_amount || 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-danger/5 rounded-xl p-3 border border-danger/10">
                <p className="label text-danger">Due Amount</p>
                <p className="stat-number text-danger mt-1">₹{(viewing.due_amount || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-black/[0.07]">
              <button
                onClick={() => openEdit(viewing)}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-caption font-bold hover:bg-primary-light transition-all flex items-center justify-center gap-1.5"
              >
                <Edit2 className="w-4 h-4" />
                Modify Financials
              </button>
              <button
                onClick={() => { setDrawerOpen(false); handleDelete(viewing); }}
                className="px-4 py-2.5 bg-danger/10 text-danger rounded-xl text-caption font-bold hover:bg-danger/20 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-caption text-textPrimary">
              <strong>Admin Notice:</strong> Changing total or paid amount will recalculate this invoice's due and update the customer's overall dues balance.
            </div>

            <FormField label="Total Amount (₹)" required error={formErrors.total_amount}>
              <Input
                type="number"
                step="any"
                value={form.total_amount}
                onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
              />
            </FormField>

            <FormField label="Paid Amount (₹)" required error={formErrors.paid_amount}>
              <Input
                type="number"
                step="any"
                value={form.paid_amount}
                onChange={e => setForm(f => ({ ...f, paid_amount: e.target.value }))}
              />
            </FormField>

            <div className="p-3 bg-background rounded-xl border border-black/[0.05] flex justify-between items-center">
              <span className="label">Recalculated Due:</span>
              <span className={`font-mono font-bold ${previewDue > 0 ? 'text-danger' : 'text-primary'}`}>
                ₹{previewDue.toLocaleString('en-IN')}
              </span>
            </div>

            <FormField label="Payment Mode">
              <Select
                value={form.payment_mode}
                onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))}
              >
                <option value="Cash">Cash</option>
                <option value="Online">Online / UPI</option>
                <option value="Bank">Bank Transfer</option>
                <option value="Credit">Store Credit</option>
              </Select>
            </FormField>

            <FormField label="Reason for Modification" required error={formErrors.reason}>
              <Input
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Corrected cash received typo or customer dispute adjustment"
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-4 border-t border-black/[0.07]">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="px-4 py-2.5 text-caption font-semibold text-textSecondary hover:bg-black/5 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={busy}
                className="px-6 py-2.5 bg-primary text-white rounded-xl text-caption font-bold hover:bg-primary-light transition-all disabled:opacity-50"
              >
                {busy ? 'Saving...' : 'Save Adjustments'}
              </button>
            </div>
          </div>
        )}
      </RecordDrawer>

      {/* Confirm Dialog */}
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
