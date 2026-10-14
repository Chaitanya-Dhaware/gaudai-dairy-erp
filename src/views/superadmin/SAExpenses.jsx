/**
 * SAExpenses.jsx — Super Admin Expense Management
 * Full CRUD, category filters, soft-delete with mandatory audit, CSV export
 */
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { updateExpense, softDeleteExpense } from '../../utils/superAdminService';
import {
  ConfirmDialog, DataTable, RecordDrawer, SearchBar,
  SASectionHeader, FormField, Input, Select, Textarea, exportToCSV
} from '../../components/superadmin/SAComponents';
import { Plus, RefreshCw, Download, Edit2, Trash2, Eye, Receipt, Calendar, Tag } from 'lucide-react';
import { toast } from 'react-hot-toast';

const EXPENSE_CATEGORIES = [
  'Fuel', 'Salary', 'Packaging', 'Electricity', 'Transport',
  'Maintenance', 'Supplies', 'Marketing', 'Farmer Advance', 'Other'
];

export default function SAExpenses() {
  const { user: currentUser, expenses, addExpense, loadAllData } = useAppStore();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    reason: '',
    amount: '',
    category: 'Other',
    method: 'Cash',
    notes: '',
    auditReason: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const filtered = expenses.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !search || [e.reason, e.expense_id, e.id, e.notes, e.category, e.method].some(v => v?.toLowerCase().includes(q));
    const matchCat = categoryFilter === 'all' || e.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const totalExpenseVal = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  const openView = (e) => {
    setViewing(e);
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (e) => {
    setEditing(e);
    setForm({
      date: e.date || new Date().toISOString().split('T')[0],
      reason: e.reason || '',
      amount: e.amount || '',
      category: e.category || 'Other',
      method: e.method || 'Cash',
      notes: e.notes || '',
      auditReason: ''
    });
    setFormErrors({});
    setViewing(null);
    setDrawerOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      date: new Date().toISOString().split('T')[0],
      reason: '',
      amount: '',
      category: 'Other',
      method: 'Cash',
      notes: '',
      auditReason: ''
    });
    setFormErrors({});
    setDrawerOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!form.reason.trim()) errs.reason = 'Expense reason / title is required';
    if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) {
      errs.amount = 'Valid positive amount is required';
    }
    if (editing && !form.auditReason.trim()) {
      errs.auditReason = 'Reason is required for modifying financial records';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      if (editing) {
        const expenseId = editing.expense_id || editing.id;
        const res = await updateExpense(
          expenseId,
          {
            date: form.date,
            reason: form.reason.trim(),
            amount: parseFloat(form.amount),
            category: form.category,
            method: form.method,
            notes: form.notes.trim(),
            _reason: form.auditReason.trim()
          },
          currentUser.uid,
          currentUser.role
        );
        if (res.success) {
          toast.success('Expense updated successfully!');
          await loadAllData();
          setDrawerOpen(false);
        } else {
          toast.error(res.error || 'Failed to update expense');
        }
      } else {
        const ok = await addExpense({
          date: form.date,
          reason: form.reason.trim(),
          amount: parseFloat(form.amount),
          category: form.category,
          method: form.method,
          notes: form.notes.trim()
        });
        if (ok) {
          toast.success('Expense recorded successfully!');
          await loadAllData();
          setDrawerOpen(false);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (e) => {
    const expenseId = e.expense_id || e.id;
    setConfirm({
      title: 'Move Expense to Trash',
      message: `Are you sure you want to delete expense "${e.reason}" (₹${e.amount})? This will be moved to the Trash collection and can be restored.`,
      danger: true,
      confirmText: 'Move to Trash',
      requireReason: true,
      action: async (reason) => {
        setBusy(true);
        const res = await softDeleteExpense(expenseId, reason, currentUser.uid, currentUser.role);
        if (res.success) {
          toast.success('Expense moved to trash');
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
      key: 'date',
      label: 'Date',
      render: (v) => <span className="font-mono text-micro text-textSecondary">{v || '—'}</span>
    },
    {
      key: 'reason',
      label: 'Description / Reason',
      render: (v, r) => (
        <div>
          <p className="font-semibold text-textPrimary leading-snug">{v}</p>
          {r.notes && <p className="text-micro text-textSecondary italic mt-0.5 line-clamp-1">{r.notes}</p>}
        </div>
      )
    },
    {
      key: 'category',
      label: 'Category',
      render: (v) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-micro font-semibold bg-black/[0.05] text-textSecondary">
          <Tag className="w-2.5 h-2.5" />
          {v || 'Other'}
        </span>
      )
    },
    {
      key: 'amount',
      label: 'Amount (₹)',
      render: (v) => <span className="font-mono font-bold text-caption text-danger">₹{(parseFloat(v) || 0).toLocaleString('en-IN')}</span>
    },
    {
      key: 'method',
      label: 'Method',
      render: (v) => <span className="text-micro font-semibold px-2 py-0.5 rounded-md bg-black/[0.04] text-textSecondary">{v || 'Cash'}</span>
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
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => openEdit(r)}
            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
            title="Edit Expense"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(r)}
            className="p-1.5 rounded-lg hover:bg-danger/10 text-danger transition-colors"
            title="Delete Expense"
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
        title="Expense Master Control"
        subtitle={`Total registered expenses: ₹${totalExpenseVal.toLocaleString('en-IN')} across ${expenses.length} records`}
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
              onClick={() => exportToCSV(expenses, 'expenses-export.csv')}
              className="px-3.5 py-2 border border-black/[0.08] rounded-xl text-caption font-semibold hover:bg-black/[0.02] flex items-center gap-1.5 transition-all"
            >
              <Download className="w-4 h-4 text-textSecondary" />
              Export CSV
            </button>
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-xl text-caption font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Record Expense
            </button>
          </>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-black/[0.07] shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by reason, category, notes..." />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-micro font-semibold uppercase text-textSecondary">Category:</span>
          <Select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="w-44 py-1.5 text-micro"
          >
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl p-4 border border-black/[0.07] shadow-card">
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={openView}
          emptyMessage="No expenses found matching your criteria."
        />
      </div>

      {/* Drawer: View or Edit */}
      <RecordDrawer
        open={drawerOpen}
        title={viewing ? 'Expense Details' : (editing ? 'Edit Expense Record' : 'Record New Expense')}
        onClose={() => setDrawerOpen(false)}
      >
        {viewing ? (
          <div className="space-y-5">
            <div className="bg-danger/5 rounded-2xl p-4 border border-danger/10 flex items-center justify-between">
              <div>
                <p className="label text-danger">Expense Amount</p>
                <h4 className="stat-number text-danger mt-1">₹{(parseFloat(viewing.amount) || 0).toLocaleString('en-IN')}</h4>
              </div>
              <span className="text-micro font-semibold px-2.5 py-1 rounded-pill bg-black/5 text-textSecondary">
                {viewing.category || 'Other'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background rounded-xl p-3 border border-black/[0.05]">
                <p className="label">Date</p>
                <p className="text-caption font-semibold font-mono mt-1">{viewing.date}</p>
              </div>
              <div className="bg-background rounded-xl p-3 border border-black/[0.05]">
                <p className="label">Payment Method</p>
                <p className="text-caption font-semibold mt-1">{viewing.method || 'Cash'}</p>
              </div>
              <div className="col-span-2 bg-background rounded-xl p-3 border border-black/[0.05]">
                <p className="label">Purpose / Reason</p>
                <p className="text-caption font-semibold mt-1">{viewing.reason}</p>
              </div>
              {viewing.notes && (
                <div className="col-span-2 bg-background rounded-xl p-3 border border-black/[0.05]">
                  <p className="label">Additional Notes</p>
                  <p className="text-caption text-textSecondary mt-1">{viewing.notes}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t border-black/[0.07]">
              <button
                onClick={() => openEdit(viewing)}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-caption font-bold hover:bg-primary-light transition-all flex items-center justify-center gap-1.5"
              >
                <Edit2 className="w-4 h-4" />
                Edit Expense
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
            <FormField label="Date" required>
              <Input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </FormField>

            <FormField label="Expense Title / Reason" required error={formErrors.reason}>
              <Input
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Diesel for chilling generator"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Amount (₹)" required error={formErrors.amount}>
                <Input
                  type="number"
                  step="any"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </FormField>
              <FormField label="Category">
                <Select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </FormField>
            </div>

            <FormField label="Payment Method">
              <Select
                value={form.method}
                onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
              >
                <option value="Cash">Cash</option>
                <option value="Online">UPI / Online</option>
                <option value="Bank">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
              </Select>
            </FormField>

            <FormField label="Notes / Remarks">
              <Textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional supplier name, bill number or details"
              />
            </FormField>

            {editing && (
              <FormField label="Reason for Administrative Edit" required error={formErrors.auditReason}>
                <Input
                  value={form.auditReason}
                  onChange={e => setForm(f => ({ ...f, auditReason: e.target.value }))}
                  placeholder="Explain why this expense is being altered..."
                />
              </FormField>
            )}

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
                {busy ? 'Saving...' : (editing ? 'Update Expense' : 'Save Expense')}
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
