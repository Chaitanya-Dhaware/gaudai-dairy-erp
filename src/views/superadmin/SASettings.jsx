/**
 * SASettings.jsx — Super Admin System Settings & Integration Parameters
 * Manage business metadata, pricing formulas, WhatsApp Cloud credentials, and Google Sheet IDs with audit log
 */
import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { loadSettingsSA, saveSettingsSA } from '../../utils/superAdminService';
import {
  ConfirmDialog, SASectionHeader, FormField, Input, Select
} from '../../components/superadmin/SAComponents';
import {
  Save, RefreshCw, Sliders, MessageSquare, Sheet, ShieldCheck,
  Building, IndianRupee, Bell
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SASettings() {
  const { user: currentUser, loadAllData } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    businessName: 'Gaudai AI Dairy',
    adminMobile: '',
    baseRate: 8.5,
    dueReminderFreq: 2,
    whatsappToken: '',
    whatsappPhoneId: '',
    sheetsIdMaster: '',
    sheetsIdCollection: '',
    sheetsIdCustomer: '',
    sheetsIdExpense: ''
  });

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await loadSettingsSA();
      if (res.success && res.data) {
        setForm(prev => ({
          ...prev,
          ...res.data
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        baseRate: parseFloat(form.baseRate) || 8.5,
        dueReminderFreq: parseInt(form.dueReminderFreq, 10) || 2
      };
      const res = await saveSettingsSA(payload, currentUser.uid, currentUser.role);
      if (res.success) {
        toast.success('System settings saved and audited!');
        await loadAllData();
      } else {
        toast.error(res.error || 'Failed to save settings');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SASectionHeader
        title="System Parameters & Integrations"
        subtitle="Global dairy rates, business configuration, API credentials, and sync endpoints"
        actions={
          <button
            onClick={refresh}
            disabled={loading}
            className="px-3.5 py-2 border border-black/[0.08] rounded-xl text-caption font-semibold hover:bg-black/[0.02] flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-4 h-4 text-textSecondary ${loading ? 'animate-spin' : ''}`} />
            Reload from Firestore
          </button>
        }
      />

      <form onSubmit={handleSave} className="space-y-6">
        {/* Business & Operations */}
        <div className="bg-white rounded-2xl p-6 border border-black/[0.07] shadow-sm space-y-4">
          <h3 className="text-subtitle font-bold text-textPrimary flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" />
            Dairy Business Profile & Operation Rules
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Dairy Business Name" required>
              <Input
                value={form.businessName}
                onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                placeholder="e.g. Gaudai AI Dairy Farm"
              />
            </FormField>

            <FormField label="Administrative Contact Mobile">
              <Input
                type="tel"
                value={form.adminMobile}
                onChange={e => setForm(f => ({ ...f, adminMobile: e.target.value }))}
                placeholder="10-digit primary mobile number"
              />
            </FormField>

            <FormField label="Base Milk Rate per Fat Unit (₹)" required>
              <Input
                type="number"
                step="0.05"
                value={form.baseRate}
                onChange={e => setForm(f => ({ ...f, baseRate: e.target.value }))}
              />
              <p className="text-micro text-textSecondary mt-1">
                Standard formula: Rate per Liter = FAT × Base Rate (e.g. 4.2 FAT × ₹{form.baseRate} = ₹{(4.2 * (parseFloat(form.baseRate) || 0)).toFixed(2)}/L)
              </p>
            </FormField>

            <FormField label="Automated Due Reminder Interval (Days)">
              <Input
                type="number"
                value={form.dueReminderFreq}
                onChange={e => setForm(f => ({ ...f, dueReminderFreq: e.target.value }))}
              />
            </FormField>
          </div>
        </div>

        {/* WhatsApp Cloud API */}
        <div className="bg-white rounded-2xl p-6 border border-black/[0.07] shadow-sm space-y-4">
          <h3 className="text-subtitle font-bold text-textPrimary flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-accent" />
            Meta WhatsApp Cloud API Integration
          </h3>
          <p className="text-caption text-textSecondary">
            Used for automated collection receipts, daily slips, and customer balance reminders sent directly to WhatsApp.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="WhatsApp Phone Number ID">
              <Input
                value={form.whatsappPhoneId}
                onChange={e => setForm(f => ({ ...f, whatsappPhoneId: e.target.value }))}
                placeholder="e.g. 109283746592834"
              />
            </FormField>

            <FormField label="Permanent Access Token">
              <Input
                type="password"
                value={form.whatsappToken}
                onChange={e => setForm(f => ({ ...f, whatsappToken: e.target.value }))}
                placeholder="EAAG..."
              />
            </FormField>
          </div>
        </div>

        {/* Google Spreadsheets Sync Targets */}
        <div className="bg-white rounded-2xl p-6 border border-black/[0.07] shadow-sm space-y-4">
          <h3 className="text-subtitle font-bold text-textPrimary flex items-center gap-2">
            <Sheet className="w-5 h-5 text-primary" />
            Google Spreadsheet Target Documents
          </h3>
          <p className="text-caption text-textSecondary">
            Paste the 44-character Google Sheet ID from your browser URL (<code className="text-micro font-mono">docs.google.com/spreadsheets/d/<b>[SHEET_ID]</b>/edit</code>).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Master Database Sheet ID">
              <Input
                value={form.sheetsIdMaster}
                onChange={e => setForm(f => ({ ...f, sheetsIdMaster: e.target.value }))}
                placeholder="Google Sheet ID"
              />
            </FormField>

            <FormField label="Daily Milk Collection Sheet ID">
              <Input
                value={form.sheetsIdCollection}
                onChange={e => setForm(f => ({ ...f, sheetsIdCollection: e.target.value }))}
                placeholder="Google Sheet ID"
              />
            </FormField>

            <FormField label="Customer Sales & Invoices Sheet ID">
              <Input
                value={form.sheetsIdCustomer}
                onChange={e => setForm(f => ({ ...f, sheetsIdCustomer: e.target.value }))}
                placeholder="Google Sheet ID"
              />
            </FormField>

            <FormField label="Dairy Operational Expenses Sheet ID">
              <Input
                value={form.sheetsIdExpense}
                onChange={e => setForm(f => ({ ...f, sheetsIdExpense: e.target.value }))}
                placeholder="Google Sheet ID"
              />
            </FormField>
          </div>
        </div>

        {/* Save CTA */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-primary hover:bg-primary-light text-white rounded-xl text-caption font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Updating Firestore...' : 'Save Settings & Audit Log'}
          </button>
        </div>
      </form>
    </div>
  );
}
