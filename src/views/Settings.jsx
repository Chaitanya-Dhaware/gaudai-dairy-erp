import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { callAPI } from '../utils/api';
import { Database, MessageSquare, ShieldCheck, Download, Trash2, Archive, RefreshCw, CalendarClock, ExternalLink, Search, CheckCircle, AlertTriangle, FileSpreadsheet, Play, FolderOpen } from 'lucide-react';
import { toast } from 'react-hot-toast';

const YESTERDAY_DATE_STR = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
})();

export function Settings() {
  const { i18n } = useTranslation();
  const isMarathi = i18n.language === 'mr';
  const {
    settings,
    saveSettings,
    farmers,
    customers,
    collections,
    sales,
    expenses,
    clearAllTransactions,
    loading,
    dailySpreadsheets,
    dailySheetsLoaded,
    loadDailySpreadsheets: loadDailySheetsAction,
    resyncDailySpreadsheet: resyncAction,
    verifyDailySpreadsheet: verifyAction,
    migrateToDailySpreadsheets: migrateAction,
    prepareDailySpreadsheet: prepareAction,
    getDailySpreadsheetInfo: getInfoAction
  } = useAppStore();

  const [activeSubTab, setActiveSubTab] = useState('database'); // database, whatsapp, staff, backup, archive

  // Archive state
  const [archiveDate, setArchiveDate] = useState('');
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archivedDates, setArchivedDates] = useState([]);
  const [archiveStatusLoaded, setArchiveStatusLoaded] = useState(false);

  // Daily Spreadsheet admin state
  const [dsSearchDate, setDsSearchDate] = useState('');
  const [dsSearchResult, setDsSearchResult] = useState(null);
  const [dsSearching, setDsSearching] = useState(false);
  const [dsTodayInfo, setDsTodayInfo] = useState(null);
  const [dsLoading, setDsLoading] = useState(false);
  const [dsMigrating, setDsMigrating] = useState(false);
  const [dsMigrationReport, setDsMigrationReport] = useState(null);
  const [dsVerifyResult, setDsVerifyResult] = useState(null);

  const loadArchiveStatus = async () => {
    try {
      const res = await callAPI('getArchiveStatus');
      if (res.success) setArchivedDates(res.data.archivedDates || []);
      setArchiveStatusLoaded(true);
    } catch(e) { console.error(e); }
  };

  const handleArchiveYesterday = async () => {
    setArchiveLoading(true);
    try {
      const res = await callAPI('archivePreviousDayData');
      if (res.success) {
        toast.success(res.message);
        await loadArchiveStatus();
      } else {
        toast.error(res.message || 'Archive failed');
      }
    } catch(e) { toast.error('Archive error: ' + e.message); }
    finally { setArchiveLoading(false); }
  };

  const handleArchiveSpecificDate = async () => {
    if (!archiveDate) { toast.error('Please pick a date first'); return; }
    setArchiveLoading(true);
    try {
      const res = await callAPI('archiveSpecificDate', { date: archiveDate, force: true });
      if (res.success) {
        toast.success(res.message);
        await loadArchiveStatus();
      } else {
        toast.error(res.message || 'Archive failed');
      }
    } catch(e) { toast.error('Archive error: ' + e.message); }
    finally { setArchiveLoading(false); }
  };

  const handleSetupTrigger = async () => {
    setArchiveLoading(true);
    try {
      const res = await callAPI('setupDailyArchiveTrigger');
      if (res.success) toast.success(res.message);
      else toast.error(res.message || 'Trigger setup failed');
    } catch(e) { toast.error(e.message); }
    finally { setArchiveLoading(false); }
  };

  useEffect(() => {
    if (activeSubTab === 'archive' && !archiveStatusLoaded) {
      Promise.resolve().then(() => {
        loadArchiveStatus();
      });
    }
  }, [activeSubTab, archiveStatusLoaded]);

  const loadTodayInfo = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await getInfoAction(today);
      if (res.success) setDsTodayInfo(res.data);
    } catch(e) { console.error('loadTodayInfo:', e); }
  };

  // State bindings for form
  const [baseRate, setBaseRate] = useState(8.5);
  const [businessName, setBusinessName] = useState('Gaudai AI Dairy');
  const [adminMobile, setAdminMobile] = useState('');
  const [whatsappToken, setWhatsappToken] = useState('');
  const [whatsappPhoneId, setWhatsappPhoneId] = useState('');
  
  const [sheetsIdCollection, setSheetsIdCollection] = useState('');
  const [sheetsIdCustomer, setSheetsIdCustomer] = useState('');
  const [sheetsIdExpense, setSheetsIdExpense] = useState('');
  const [sheetsIdMaster, setSheetsIdMaster] = useState('');

  // Sync settings when they are fetched from the store
  useEffect(() => {
    if (settings) {
      Promise.resolve().then(() => {
        setBaseRate(settings.baseRate || 8.5);
        setBusinessName(settings.businessName || 'Gaudai AI Dairy');
        setAdminMobile(settings.adminMobile || '');
        setWhatsappToken(settings.whatsappToken || '');
        setWhatsappPhoneId(settings.whatsappPhoneId || '');
        setSheetsIdCollection(settings.sheetsIdCollection || '');
        setSheetsIdCustomer(settings.sheetsIdCustomer || '');
        setSheetsIdExpense(settings.sheetsIdExpense || '');
        setSheetsIdMaster(settings.sheetsIdMaster || '');
      });
    }
  }, [settings]);

  // User management mockup (state managed locally or in cache)
  const [staffList, setStaffList] = useState([
    { uid: 'adm1', name: 'Ravi Patil', role: 'admin', active: true, email: 'admin@gaudai.com' },
    { uid: 'stf1', name: 'Shankar Rao', role: 'staff', active: true, email: 'staff@gaudai.com' },
    { uid: 'acc1', name: 'Sunita Deshpande', role: 'accountant', active: true, email: 'accountant@gaudai.com' }
  ]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('staff');

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const updated = {
      baseRate: parseFloat(baseRate),
      businessName,
      adminMobile,
      whatsappToken,
      whatsappPhoneId,
      sheetsIdCollection,
      sheetsIdCustomer,
      sheetsIdExpense,
      sheetsIdMaster
    };

    const success = await saveSettings(updated);
    if (success) {
      toast.success(isMarathi ? 'बदल यशस्वी जतन झाले!' : 'Settings updated successfully!');
    }
  };

  const handleAddStaff = (e) => {
    e.preventDefault();
    if (!newStaffName || !newStaffEmail) return;

    const newStaff = {
      uid: 'stf_' + Date.now(),
      name: newStaffName,
      email: newStaffEmail,
      role: newStaffRole,
      active: true
    };

    setStaffList([...staffList, newStaff]);
    setNewStaffName('');
    setNewStaffEmail('');
    toast.success(isMarathi ? 'कर्मचारी नोंदवला!' : 'Staff profile added!');
  };

  const toggleStaffActive = (uid) => {
    setStaffList(staffList.map(s => s.uid === uid ? { ...s, active: !s.active } : s));
    toast.success('स्थिती बदलली / Active status updated');
  };

  // Helper to convert array of objects to CSV download
  const downloadCSV = (filename, dataArray) => {
    if (dataArray.length === 0) {
      toast.error(isMarathi ? 'डेटा रिकामा आहे' : 'No data to export');
      return;
    }
    const headers = Object.keys(dataArray[0]).join(',');
    const rows = dataArray.map(obj => 
      Object.values(obj).map(val => {
        let str = String(val).replace(/"/g, '""');
        if (str.includes(',') || str.includes('\n')) {
          str = `"${str}"`;
        }
        return str;
      }).join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearDatabase = async () => {
    const confirmMessage = isMarathi
      ? 'तुम्हाला खात्री आहे का की तुम्हाला सर्व डेटा (शेतकरी, ग्राहक, उत्पादने आणि सर्व व्यवहार) कायमचे हटवायचे आहेत? हा बदल पूर्ववत करता येणार नाही.'
      : 'Are you absolutely sure you want to delete ALL data (farmers, customers, products, and all transactions) and start completely fresh from scratch? This action CANNOT be undone.';
      
    if (window.confirm(confirmMessage)) {
      try {
        const res = await clearAllTransactions();
        if (res && res.success) {
          toast.success(isMarathi ? 'डेटाबेस यशस्वीरीत्या साफ केला आणि रीसेट केला!' : 'Database cleared and reset successfully!');
        } else {
          const errMsg = res ? res.message : '';
          toast.error((isMarathi ? 'डेटाबेस साफ करण्यात अडचण आली: ' : 'Failed to clear database: ') + errMsg);
        }
      } catch (err) {
        console.error(err);
        toast.error('Error: ' + err.message);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 font-body">
      
      {/* Sidebar sub tabs */}
      <div className="bg-white rounded-2xl p-4 border border-black/[0.08] shadow-subtle lg:col-span-1 space-y-1 h-fit">
        <button
          onClick={() => setActiveSubTab('database')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
            activeSubTab === 'database' ? 'bg-primary/10 text-primary border-l-4 border-primary pl-3' : 'text-textSecondary hover:bg-black/[0.02]'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Rates & Sheets</span>
        </button>
        
        <button
          onClick={() => setActiveSubTab('whatsapp')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
            activeSubTab === 'whatsapp' ? 'bg-primary/10 text-primary border-l-4 border-primary pl-3' : 'text-textSecondary hover:bg-black/[0.02]'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>WhatsApp API</span>
        </button>

        <button
          onClick={() => setActiveSubTab('staff')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
            activeSubTab === 'staff' ? 'bg-primary/10 text-primary border-l-4 border-primary pl-3' : 'text-textSecondary hover:bg-black/[0.02]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Staff registry</span>
        </button>

        <button
          onClick={() => setActiveSubTab('backup')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
            activeSubTab === 'backup' ? 'bg-primary/10 text-primary border-l-4 border-primary pl-3' : 'text-textSecondary hover:bg-black/[0.02]'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>CSV Export</span>
        </button>

        <button
          onClick={() => { setActiveSubTab('archive'); if (!archiveStatusLoaded) loadArchiveStatus(); if (!dailySheetsLoaded) { setDsLoading(true); loadDailySheetsAction().finally(() => setDsLoading(false)); } loadTodayInfo(); }}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
            activeSubTab === 'archive' ? 'bg-primary/10 text-primary border-l-4 border-primary pl-3' : 'text-textSecondary hover:bg-black/[0.02]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Daily Sheets</span>
        </button>

        <button
          onClick={() => setActiveSubTab('danger')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
            activeSubTab === 'danger' ? 'bg-danger/10 text-danger border-l-4 border-danger pl-3' : 'text-textSecondary hover:bg-black/[0.02]'
          }`}
        >
          <Trash2 className="w-4 h-4 text-danger" />
          <span className="text-danger">Danger Zone</span>
        </button>
      </div>

      {/* Settings Form Body */}
      <div className="lg:col-span-3">
        
        {activeSubTab === 'database' && (
          <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl p-6 sm:p-8 border border-black/[0.08] shadow-subtle space-y-6">
            <h3 className="text-lg font-bold font-head text-primary border-b border-black/[0.04] pb-4 flex items-center space-x-2">
              <Database className="w-5 h-5" />
              <span>Database & Milk Rates Settings</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-textSecondary mb-2">Base Milk Rate (per fat unit) (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={baseRate}
                  onChange={(e) => setBaseRate(e.target.value)}
                  className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-textSecondary mb-2">Business Name *</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background font-semibold"
                  required
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-black/[0.04]">
              <h4 className="text-xs font-bold text-textSecondary uppercase tracking-widest">Google Spreadsheets IDs (गूगल शीट लिंक्स)</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-textSecondary mb-1">COLLECTION_DB ID</label>
                  <input
                    type="text"
                    value={sheetsIdCollection}
                    onChange={(e) => setSheetsIdCollection(e.target.value)}
                    placeholder="Spreadsheet ID for Milk Collection"
                    className="w-full px-3 py-2 border border-black/[0.08] rounded-xl font-mono text-xs bg-background"
                  />
                  {sheetsIdCollection && (
                    <a href={`https://docs.google.com/spreadsheets/d/${sheetsIdCollection}/edit`} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline font-bold block mt-1">
                      Open Spreadsheet (शीट उघडा) ➜
                    </a>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-textSecondary mb-1">CUSTOMER_DB ID</label>
                  <input
                    type="text"
                    value={sheetsIdCustomer}
                    onChange={(e) => setSheetsIdCustomer(e.target.value)}
                    placeholder="Spreadsheet ID for Sales"
                    className="w-full px-3 py-2 border border-black/[0.08] rounded-xl font-mono text-xs bg-background"
                  />
                  {sheetsIdCustomer && (
                    <a href={`https://docs.google.com/spreadsheets/d/${sheetsIdCustomer}/edit`} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline font-bold block mt-1">
                      Open Spreadsheet (शीट उघडा) ➜
                    </a>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-textSecondary mb-1">EXPENSE_DB ID</label>
                  <input
                    type="text"
                    value={sheetsIdExpense}
                    onChange={(e) => setSheetsIdExpense(e.target.value)}
                    placeholder="Spreadsheet ID for Expenses"
                    className="w-full px-3 py-2 border border-black/[0.08] rounded-xl font-mono text-xs bg-background"
                  />
                  {sheetsIdExpense && (
                    <a href={`https://docs.google.com/spreadsheets/d/${sheetsIdExpense}/edit`} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline font-bold block mt-1">
                      Open Spreadsheet (शीट उघडा) ➜
                    </a>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-textSecondary mb-1">MASTER_ACCOUNTS_DB ID</label>
                  <input
                    type="text"
                    value={sheetsIdMaster}
                    onChange={(e) => setSheetsIdMaster(e.target.value)}
                    placeholder="Spreadsheet ID for Master financial sheets"
                    className="w-full px-3 py-2 border border-black/[0.08] rounded-xl font-mono text-xs bg-background"
                  />
                  {sheetsIdMaster && (
                    <a href={`https://docs.google.com/spreadsheets/d/${sheetsIdMaster}/edit`} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline font-bold block mt-1">
                      Open Spreadsheet (शीट उघडा) ➜
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-light transition-all cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </form>
        )}

        {activeSubTab === 'whatsapp' && (
          <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl p-6 sm:p-8 border border-black/[0.08] shadow-subtle space-y-6">
            <h3 className="text-lg font-bold font-head text-primary border-b border-black/[0.04] pb-4 flex items-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <span>WhatsApp Cloud API Integration Settings</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-textSecondary mb-2">Admin Mobile (WhatsApp Sender/Contact)</label>
                <input
                  type="tel"
                  value={adminMobile}
                  onChange={(e) => setAdminMobile(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-textSecondary mb-2">WhatsApp API Access Token</label>
                <input
                  type="password"
                  value={whatsappToken}
                  onChange={(e) => setWhatsappToken(e.target.value)}
                  placeholder="EAAGz..."
                  className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-textSecondary mb-2">WhatsApp Phone Number ID</label>
                <input
                  type="text"
                  value={whatsappPhoneId}
                  onChange={(e) => setWhatsappPhoneId(e.target.value)}
                  placeholder="109283..."
                  className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-light transition-all cursor-pointer"
              >
                Save WhatsApp config
              </button>
            </div>
          </form>
        )}

        {activeSubTab === 'staff' && (
          <div className="space-y-6">
            {/* Add Staff form */}
            <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle">
              <h3 className="text-lg font-bold font-head text-primary mb-4 flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5" />
                <span>Add Staff Profile</span>
              </h3>
              <form onSubmit={handleAddStaff} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-textSecondary mb-2">Staff Full Name</label>
                  <input
                    type="text"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="e.g. Ramesh More"
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-background"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-textSecondary mb-2">Email Address</label>
                  <input
                    type="email"
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    placeholder="ramesh@gaudai.com"
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-background font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-textSecondary mb-2">Assigned Role</label>
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-background font-semibold"
                  >
                    <option value="staff">Staff Operator</option>
                    <option value="accountant">Accountant</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <button type="submit" className="w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-xl">
                    Add Account
                  </button>
                </div>
              </form>
            </div>

            {/* Staff list table */}
            <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle">
              <h4 className="text-xs font-bold text-textSecondary uppercase tracking-widest mb-4">Current Staff Accounts</h4>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-black/[0.08] bg-background">
                      <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Name</th>
                      <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Email</th>
                      <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Role</th>
                      <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Status</th>
                      <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Toggle Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04]">
                    {staffList.map((staff) => (
                      <tr key={staff.uid} className="hover:bg-black/[0.01]">
                        <td className="py-3 px-4 font-bold text-textPrimary">{staff.name}</td>
                        <td className="py-3 px-4 font-mono text-textSecondary">{staff.email}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-primary/5 text-primary border border-primary/10">
                            {staff.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                            staff.active ? 'bg-primary/10 text-primary' : 'bg-danger/10 text-danger'
                          }`}>
                            {staff.active ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => toggleStaffActive(staff.uid)}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg cursor-pointer ${
                              staff.active ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'
                            }`}
                          >
                            {staff.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'backup' && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-black/[0.08] shadow-subtle space-y-6">
            <h3 className="text-lg font-bold font-head text-primary border-b border-black/[0.04] pb-4 flex items-center space-x-2">
              <Download className="w-5 h-5" />
              <span>Export Workspace Data sheets (CSV backup)</span>
            </h3>

            <p className="text-xs text-textSecondary leading-relaxed">
              Export and download individual workspace records directly from local cache or sheets backend in CSV format for local backup.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => downloadCSV('GAUDAI_FARMERS', farmers)}
                className="p-5 border border-black/[0.06] hover:border-primary/30 rounded-xl bg-background text-left flex justify-between items-center hover:bg-primary/5 transition-all cursor-pointer"
              >
                <div>
                  <h4 className="text-xs font-bold text-textPrimary uppercase">Farmers Directory</h4>
                  <p className="text-[10px] text-textSecondary mt-1">Export registered farmers ({farmers.length} records)</p>
                </div>
                <Download className="w-5 h-5 text-primary" />
              </button>

              <button
                onClick={() => downloadCSV('GAUDAI_COLLECTIONS', collections)}
                className="p-5 border border-black/[0.06] hover:border-primary/30 rounded-xl bg-background text-left flex justify-between items-center hover:bg-primary/5 transition-all cursor-pointer"
              >
                <div>
                  <h4 className="text-xs font-bold text-textPrimary uppercase">Milk Collections Log</h4>
                  <p className="text-[10px] text-textSecondary mt-1">Export journal collection records ({collections.length} entries)</p>
                </div>
                <Download className="w-5 h-5 text-primary" />
              </button>

              <button
                onClick={() => downloadCSV('GAUDAI_CUSTOMERS', customers)}
                className="p-5 border border-black/[0.06] hover:border-primary/30 rounded-xl bg-background text-left flex justify-between items-center hover:bg-primary/5 transition-all cursor-pointer"
              >
                <div>
                  <h4 className="text-xs font-bold text-textPrimary uppercase">Customers Directory</h4>
                  <p className="text-[10px] text-textSecondary mt-1">Export retail customer profiles ({customers.length} shops)</p>
                </div>
                <Download className="w-5 h-5 text-primary" />
              </button>

              <button
                onClick={() => downloadCSV('GAUDAI_SALES', sales)}
                className="p-5 border border-black/[0.06] hover:border-primary/30 rounded-xl bg-background text-left flex justify-between items-center hover:bg-primary/5 transition-all cursor-pointer"
              >
                <div>
                  <h4 className="text-xs font-bold text-textPrimary uppercase">Sales Bills History</h4>
                  <p className="text-[10px] text-textSecondary mt-1">Export invoice history records ({sales.length} transactions)</p>
                </div>
                <Download className="w-5 h-5 text-primary" />
              </button>

              <button
                onClick={() => downloadCSV('GAUDAI_EXPENSES', expenses)}
                className="p-5 border border-black/[0.06] hover:border-primary/30 rounded-xl bg-background text-left flex justify-between items-center hover:bg-primary/5 transition-all cursor-pointer sm:col-span-2"
              >
                <div>
                  <h4 className="text-xs font-bold text-textPrimary uppercase">Operational Expenses</h4>
                  <p className="text-[10px] text-textSecondary mt-1">Export daily business operational outlays ({expenses.length} records)</p>
                </div>
                <Download className="w-5 h-5 text-primary" />
              </button>
            </div>
          </div>
        )}

        {activeSubTab === 'archive' && (
          <DailySheetsPanel
            isMarathi={isMarathi}
            dsLoading={dsLoading}
            setDsLoading={setDsLoading}
            dsTodayInfo={dsTodayInfo}
            setDsTodayInfo={setDsTodayInfo}
            dsSearchDate={dsSearchDate}
            setDsSearchDate={setDsSearchDate}
            dsSearchResult={dsSearchResult}
            setDsSearchResult={setDsSearchResult}
            dsSearching={dsSearching}
            setDsSearching={setDsSearching}
            dsVerifyResult={dsVerifyResult}
            setDsVerifyResult={setDsVerifyResult}
            dsMigrating={dsMigrating}
            setDsMigrating={setDsMigrating}
            dsMigrationReport={dsMigrationReport}
            setDsMigrationReport={setDsMigrationReport}
            dailySpreadsheets={dailySpreadsheets}
            loadDailySheetsAction={loadDailySheetsAction}
            getInfoAction={getInfoAction}
            resyncAction={resyncAction}
            verifyAction={verifyAction}
            migrateAction={migrateAction}
            prepareAction={prepareAction}
            archiveLoading={archiveLoading}
            handleArchiveYesterday={handleArchiveYesterday}
            handleArchiveSpecificDate={handleArchiveSpecificDate}
            handleSetupTrigger={handleSetupTrigger}
            archiveDate={archiveDate}
            setArchiveDate={setArchiveDate}
            archivedDates={archivedDates}
            loadArchiveStatus={loadArchiveStatus}
          />
        )}

        {activeSubTab === 'danger' && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-danger/20 shadow-subtle space-y-6">
            <h3 className="text-lg font-bold font-head text-danger border-b border-black/[0.04] pb-4 flex items-center space-x-2">
              <Trash2 className="w-5 h-5 text-danger" />
              <span>{isMarathi ? 'डेटाबेस रीसेट / Reset Database' : 'Database Reset & Clean'}</span>
            </h3>

            <p className="text-xs text-textSecondary leading-relaxed">
              {isMarathi
                ? 'खबरदारी: ही क्रिया सर्व डेटा (शेतकरी, ग्राहक, उत्पादने आणि सर्व व्यवहार) कायमचे हटवेल आणि डेटाबेस पूर्णपणे स्वच्छ करेल. हे केवळ नवीन सुरुवात करण्यासाठी वापरा.'
                : 'Caution: This action will permanently delete all database content, including registered farmers, customers, products, and all transaction logs. Use this to start completely fresh from scratch.'}
            </p>

            <div className="bg-danger/5 border border-danger/10 rounded-xl p-4">
              <h4 className="text-xs font-bold text-danger uppercase tracking-wider mb-2">
                {isMarathi ? 'खालील डेटा नष्ट होईल:' : 'The following data will be cleared:'}
              </h4>
              <ul className="list-disc list-inside text-xs text-textSecondary space-y-1">
                <li>{isMarathi ? 'सर्व शेतकरी नोंदणी नोंदी (Farmers Directory)' : 'All registered farmers database'}</li>
                <li>{isMarathi ? 'सर्व ग्राहक प्रोफाईल्स (Customers Directory)' : 'All registered customer profiles'}</li>
                <li>{isMarathi ? 'सर्व उत्पादने (Products seeded to defaults)' : 'All products (re-seeded to default list)'}</li>
                <li>{isMarathi ? 'सर्व दूध संकलन नोंदी (Milk Collections)' : 'All Milk Collection records'}</li>
                <li>{isMarathi ? 'सर्व विक्री बिले आणि खरेदी नोंदी (Sales)' : 'All Sales invoices'}</li>
                <li>{isMarathi ? 'सर्व पेमेंट इतिहास नोंदी (Payments)' : 'All Payment history logs'}</li>
                <li>{isMarathi ? 'सर्व खर्च नोंदी (Expenses)' : 'All Expense entries'}</li>
              </ul>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={handleClearDatabase}
                disabled={loading}
                className="px-6 py-3 bg-danger text-white text-sm font-semibold rounded-xl hover:bg-danger/90 transition-all cursor-pointer flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isMarathi ? 'डेटाबेस आणि सर्व माहिती हटवा' : 'Reset Database & Clear All Data'}</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/** Daily Spreadsheets Admin Panel Component */
function DailySheetsPanel({
  isMarathi, dsLoading, setDsLoading, dsTodayInfo, setDsTodayInfo,
  dsSearchDate, setDsSearchDate, dsSearchResult, setDsSearchResult,
  dsSearching, setDsSearching, dsVerifyResult, setDsVerifyResult,
  dsMigrating, setDsMigrating, dsMigrationReport, setDsMigrationReport,
  dailySpreadsheets, loadDailySheetsAction, getInfoAction,
  resyncAction, verifyAction, migrateAction, prepareAction,
  archiveLoading, handleArchiveYesterday, handleArchiveSpecificDate,
  handleSetupTrigger, archiveDate, setArchiveDate, archivedDates, loadArchiveStatus
}) {

  const handleSearchDate = async () => {
    if (!dsSearchDate) return;
    setDsSearching(true);
    setDsSearchResult(null);
    setDsVerifyResult(null);
    try {
      const res = await getInfoAction(dsSearchDate);
      setDsSearchResult(res.success ? res : { data: null });
    } catch (err) {
      console.error(err);
      setDsSearchResult({ data: null });
    } finally {
      setDsSearching(false);
    }
  };

  const handleVerifyDate = async (dateStr) => {
    try {
      const res = await verifyAction(dateStr);
      if (res.success) setDsVerifyResult(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResync = async (dateStr) => {
    setDsLoading(true);
    try {
      await resyncAction(dateStr);
    } catch (err) {
      console.error(err);
    } finally {
      setDsLoading(false);
    }
  };

  const handleMigrate = async () => {
    if (!window.confirm(isMarathi
      ? 'हे ऐतिहासिक डेटाचे दैनिक स्प्रेडशीट्समध्ये स्थलांतर करेल. सुरू ठेवायचे?'
      : 'This will migrate historical data to daily spreadsheets. Continue?'
    )) return;
    setDsMigrating(true);
    setDsMigrationReport(null);
    try {
      const res = await migrateAction(20);
      if (res.success) setDsMigrationReport(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setDsMigrating(false);
    }
  };

  const handlePrepareToday = async () => {
    setDsLoading(true);
    try {
      const res = await prepareAction();
      if (res.success && res.data) setDsTodayInfo(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setDsLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-primary to-primary-light text-white rounded-2xl p-6 border border-primary/20 space-y-2 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 rounded-full bg-white/5 -translate-y-8 translate-x-8" />
        <div className="absolute right-16 bottom-0 w-20 h-20 rounded-full bg-white/[0.03]" />
        <div className="flex items-center space-x-2">
          <FileSpreadsheet className="w-5 h-5" />
          <h3 className="text-base font-bold font-head">
            {isMarathi ? 'दैनिक संकलन स्प्रेडशीट्स' : 'Daily Collection Spreadsheets'}
          </h3>
        </div>
        <p className="text-xs text-white/80 leading-relaxed max-w-xl">
          {isMarathi
            ? 'प्रत्येक दिवसाचे दूध संकलन एका स्वतंत्र Google Spreadsheet मध्ये स्वयंचलितपणे जतन होते. नाव: "Gaudai_Collection_YYYY-MM-DD". फोल्डर: Gaudai Dairy ERP Collections / Year / Month /'
            : 'Each day\'s milk collections are automatically saved to a separate Google Spreadsheet named "Gaudai_Collection_YYYY-MM-DD", organized in Google Drive under Gaudai Dairy ERP Collections / Year / Month /.'}
        </p>
      </div>

      {/* Today's Spreadsheet Card */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-xs font-bold text-textSecondary uppercase tracking-widest mb-3">
              {isMarathi ? 'आजची स्प्रेडशीट' : "Today's Spreadsheet"}
            </h4>
            {dsTodayInfo ? (
              <div className="space-y-2">
                <p className="text-sm font-bold font-head text-textPrimary">
                  {dsTodayInfo.spreadsheetName || `Gaudai_Collection_${today}`}
                </p>
                <div className="flex items-center space-x-4 text-xs text-textSecondary">
                  <span className="font-mono">{today}</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-primary/5 text-primary border border-primary/10">
                    {dsTodayInfo.recordCount || 0} records
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-accent/5 text-accent border border-accent/10">
                    {dsTodayInfo.month || ''}
                  </span>
                </div>
                {dsTodayInfo.url && (
                  <a
                    href={dsTodayInfo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 text-xs text-primary font-bold hover:underline mt-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{isMarathi ? 'Google Sheets मध्ये उघडा' : 'Open in Google Sheets'}</span>
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-textSecondary">
                {isMarathi ? 'आजची स्प्रेडशीट अद्याप तयार नाही.' : 'Today\'s spreadsheet not yet created.'}
              </p>
            )}
          </div>
          <button
            onClick={handlePrepareToday}
            disabled={dsLoading}
            className="flex items-center space-x-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-light transition-all cursor-pointer disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${dsLoading ? 'animate-spin' : ''}`} />
            <span>{dsTodayInfo ? (isMarathi ? 'रीफ्रेश' : 'Refresh') : (isMarathi ? 'तयार करा' : 'Create Now')}</span>
          </button>
        </div>
      </div>

      {/* Date Search */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-4">
        <h4 className="text-xs font-bold text-textSecondary uppercase tracking-widest">
          {isMarathi ? 'तारखेनुसार शोधा' : 'Search by Date'}
        </h4>
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-[10px] font-bold text-textSecondary uppercase mb-1">
              {isMarathi ? 'तारीख निवडा' : 'Select Date'}
            </label>
            <input
              type="date"
              value={dsSearchDate}
              max={today}
              onChange={(e) => { setDsSearchDate(e.target.value); setDsSearchResult(null); setDsVerifyResult(null); }}
              className="px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background font-mono"
            />
          </div>
          <button
            onClick={handleSearchDate}
            disabled={dsSearching || !dsSearchDate}
            className="flex items-center space-x-1.5 px-4 py-2 bg-accent text-white text-xs font-bold rounded-xl hover:bg-accent/90 transition-all cursor-pointer disabled:opacity-50"
          >
            <Search className={`w-3.5 h-3.5 ${dsSearching ? 'animate-spin' : ''}`} />
            <span>{isMarathi ? 'शोधा' : 'Search'}</span>
          </button>
        </div>

        {/* Search Result */}
        {dsSearchResult && (
          <div className="mt-4 p-4 bg-background rounded-xl border border-black/[0.04]">
            {dsSearchResult.data ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-bold text-textPrimary">{dsSearchResult.data.spreadsheetName}</p>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleVerifyDate(dsSearchDate)}
                      className="flex items-center space-x-1 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-all cursor-pointer"
                    >
                      <CheckCircle className="w-3 h-3" />
                      <span>Verify</span>
                    </button>
                    <button
                      onClick={() => handleResync(dsSearchDate)}
                      className="flex items-center space-x-1 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Re-sync</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div><span className="text-textSecondary block text-[10px]">Records</span><span className="font-bold font-mono">{dsSearchResult.data.recordCount}</span></div>
                  <div><span className="text-textSecondary block text-[10px]">Status</span><span className="font-bold">{dsSearchResult.data.status}</span></div>
                  <div><span className="text-textSecondary block text-[10px]">Month</span><span className="font-bold">{dsSearchResult.data.month}</span></div>
                  <div><span className="text-textSecondary block text-[10px]">Last Sync</span><span className="font-bold font-mono text-[10px]">{dsSearchResult.data.lastSyncAt ? new Date(dsSearchResult.data.lastSyncAt).toLocaleString('en-IN') : '—'}</span></div>
                </div>
                {dsSearchResult.data.url && (
                  <a href={dsSearchResult.data.url} target="_blank" rel="noreferrer" className="inline-flex items-center space-x-1 text-xs text-primary font-bold hover:underline">
                    <ExternalLink className="w-3 h-3" />
                    <span>Open Spreadsheet</span>
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-xs text-textSecondary">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>{isMarathi ? `${dsSearchDate} साठी कोणतीही स्प्रेडशीट सापडली नाही.` : `No spreadsheet found for ${dsSearchDate}.`}</span>
              </div>
            )}
          </div>
        )}

        {/* Verify Result */}
        {dsVerifyResult && (
          <div className={`mt-2 p-3 rounded-xl border text-xs ${dsVerifyResult.isConsistent ? 'bg-primary/5 border-primary/10' : 'bg-danger/5 border-danger/10'}`}>
            <div className="flex items-center space-x-2">
              {dsVerifyResult.isConsistent ? (
                <CheckCircle className="w-4 h-4 text-primary" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-danger" />
              )}
              <span className={`font-bold ${dsVerifyResult.isConsistent ? 'text-primary' : 'text-danger'}`}>
                {dsVerifyResult.message}
              </span>
            </div>
            <div className="flex space-x-4 mt-1.5 text-textSecondary text-[10px]">
              <span>Master: {dsVerifyResult.masterCount} records</span>
              <span>Daily: {dsVerifyResult.dailyCount} records</span>
            </div>
          </div>
        )}
      </div>

      {/* Daily Spreadsheets List */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-bold text-textSecondary uppercase tracking-widest">
            {isMarathi ? 'सर्व दैनिक स्प्रेडशीट्स' : 'All Daily Spreadsheets'} ({dailySpreadsheets.length})
          </h4>
          <button
            onClick={() => { setDsLoading(true); loadDailySheetsAction().finally(() => setDsLoading(false)); }}
            className="text-[10px] text-primary font-bold flex items-center space-x-1 hover:underline cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${dsLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {dailySpreadsheets.length === 0 ? (
          <p className="text-xs text-textSecondary text-center py-6">
            {isMarathi ? 'अद्याप कोणत्याही दैनिक स्प्रेडशीट्स तयार झालेल्या नाहीत.' : 'No daily spreadsheets created yet. Add a collection entry or run migration to get started.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/[0.08] bg-background">
                  <th className="py-2.5 px-3 font-semibold text-textSecondary uppercase text-[10px]">Date</th>
                  <th className="py-2.5 px-3 font-semibold text-textSecondary uppercase text-[10px]">Spreadsheet</th>
                  <th className="py-2.5 px-3 font-semibold text-textSecondary uppercase text-[10px] text-center">Records</th>
                  <th className="py-2.5 px-3 font-semibold text-textSecondary uppercase text-[10px]">Month</th>
                  <th className="py-2.5 px-3 font-semibold text-textSecondary uppercase text-[10px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {dailySpreadsheets.slice(0, 30).map((sheet) => (
                  <tr key={sheet.date} className={`hover:bg-black/[0.01] ${sheet.date === today ? 'bg-primary/[0.02]' : ''}`}>
                    <td className="py-2.5 px-3 font-mono font-bold text-textPrimary">
                      {sheet.date}
                      {sheet.date === today && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-primary/10 text-primary">TODAY</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-textSecondary">{sheet.spreadsheetName}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-primary/5 text-primary border border-primary/10">
                        {sheet.recordCount || 0}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-textSecondary">{sheet.month}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center space-x-1.5">
                        {sheet.url && (
                          <a
                            href={sheet.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-all"
                            title="Open in Google Sheets"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => handleResync(sheet.date)}
                          className="p-1.5 rounded-lg hover:bg-accent/10 text-accent transition-all cursor-pointer"
                          title="Re-sync from master"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dailySpreadsheets.length > 30 && (
              <p className="text-[10px] text-textSecondary text-center mt-2">
                Showing 30 of {dailySpreadsheets.length} spreadsheets
              </p>
            )}
          </div>
        )}
      </div>

      {/* Migration Panel */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-4">
        <h4 className="text-xs font-bold text-textSecondary uppercase tracking-widest">
          {isMarathi ? 'ऐतिहासिक डेटा स्थलांतर' : 'Historical Data Migration'}
        </h4>
        <p className="text-xs text-textSecondary leading-relaxed">
          {isMarathi
            ? 'मास्टर Milk_Collections शीट मधील सर्व ऐतिहासिक डेटा दैनिक स्प्रेडशीट्समध्ये स्थलांतर करा. एकावेळी 20 तारखा प्रक्रिया होतात. अनेक वेळा चालवणे सुरक्षित आहे.'
            : 'Migrate all historical data from the master Milk_Collections sheet to daily spreadsheets. Processes 20 dates per batch. Safe to run multiple times (idempotent).'}
        </p>
        <button
          onClick={handleMigrate}
          disabled={dsMigrating}
          className="flex items-center space-x-2 px-5 py-3 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent/90 transition-all cursor-pointer disabled:opacity-50"
        >
          <FolderOpen className={`w-4 h-4 ${dsMigrating ? 'animate-spin' : ''}`} />
          <span>{dsMigrating ? (isMarathi ? 'स्थलांतर सुरू...' : 'Migrating...') : (isMarathi ? 'स्थलांतर सुरू करा' : 'Start Migration Batch')}</span>
        </button>

        {/* Migration Report */}
        {dsMigrationReport && (
          <div className="mt-3 p-4 bg-background rounded-xl border border-black/[0.04] space-y-3">
            <h5 className="text-[10px] font-bold text-textSecondary uppercase tracking-widest">Migration Report</h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="text-center p-2 bg-white rounded-lg border border-black/[0.04]">
                <span className="block text-[10px] text-textSecondary">Total Records</span>
                <span className="font-bold font-mono text-lg text-textPrimary">{dsMigrationReport.totalRecords}</span>
              </div>
              <div className="text-center p-2 bg-white rounded-lg border border-black/[0.04]">
                <span className="block text-[10px] text-textSecondary">Total Dates</span>
                <span className="font-bold font-mono text-lg text-textPrimary">{dsMigrationReport.totalDates}</span>
              </div>
              <div className="text-center p-2 bg-white rounded-lg border border-primary/10">
                <span className="block text-[10px] text-textSecondary">Created</span>
                <span className="font-bold font-mono text-lg text-primary">{dsMigrationReport.datesCreated}</span>
              </div>
              <div className="text-center p-2 bg-white rounded-lg border border-black/[0.04]">
                <span className="block text-[10px] text-textSecondary">Skipped</span>
                <span className="font-bold font-mono text-lg text-textSecondary">{dsMigrationReport.datesSkipped}</span>
              </div>
            </div>
            {dsMigrationReport.errors && dsMigrationReport.errors.length > 0 && (
              <div className="p-2 bg-danger/5 rounded-lg border border-danger/10 text-xs">
                <span className="font-bold text-danger text-[10px]">Errors ({dsMigrationReport.errors.length}):</span>
                {dsMigrationReport.errors.map((e, i) => (
                  <p key={i} className="text-danger mt-1 text-[10px] font-mono">{e.date}: {e.error}</p>
                ))}
              </div>
            )}
            {dsMigrationReport.details && dsMigrationReport.details.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-[10px] font-bold text-primary hover:underline">Show Details</summary>
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {dsMigrationReport.details.map((d, i) => (
                    <div key={i} className="flex justify-between items-center px-2 py-1 bg-white rounded border border-black/[0.03] text-[10px]">
                      <span className="font-mono font-bold">{d.date}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                        d.action === 'migrated' ? 'bg-primary/10 text-primary' :
                        d.action === 'skipped' ? 'bg-black/[0.04] text-textSecondary' :
                        'bg-danger/10 text-danger'
                      }`}>{d.action}</span>
                      <span className="text-textSecondary">{d.records} rows</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Archive & Trigger Section (Legacy) */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-4">
        <h4 className="text-xs font-bold text-textSecondary uppercase tracking-widest flex items-center space-x-2">
          <Archive className="w-4 h-4" />
          <span>{isMarathi ? 'दैनिक संग्रह आणि ट्रिगर' : 'Daily Archive & Trigger Setup'}</span>
        </h4>
        <p className="text-xs text-textSecondary leading-relaxed">
          {isMarathi
            ? 'मध्यरात्री ट्रिगर सेटअप, मागील दिवसाचा संग्रह, आणि विशिष्ट तारखेचा संग्रह.'
            : 'Configure midnight trigger (archive + daily sheet creation), archive yesterday\'s data, or backfill a specific date.'}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSetupTrigger}
            disabled={archiveLoading}
            className="flex items-center space-x-1.5 px-4 py-2 border border-primary/30 text-primary text-xs font-bold rounded-xl hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-50"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Setup Daily Trigger</span>
          </button>
          <button
            onClick={handleArchiveYesterday}
            disabled={archiveLoading}
            className="flex items-center space-x-1.5 px-4 py-2 bg-primary/10 text-primary text-xs font-bold rounded-xl hover:bg-primary/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${archiveLoading ? 'animate-spin' : ''}`} />
            <span>{isMarathi ? 'काल संग्रहित करा' : 'Archive Yesterday'}</span>
          </button>
        </div>
        <div className="flex gap-3 items-end mt-2">
          <div>
            <label className="block text-[10px] font-bold text-textSecondary uppercase mb-1">Backfill Date</label>
            <input
              type="date"
              value={archiveDate}
              max={YESTERDAY_DATE_STR}
              onChange={(e) => setArchiveDate(e.target.value)}
              className="px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background font-mono"
            />
          </div>
          <button
            onClick={handleArchiveSpecificDate}
            disabled={archiveLoading || !archiveDate}
            className="flex items-center space-x-1.5 px-3 py-2 bg-accent text-white text-xs font-bold rounded-xl hover:bg-accent/90 transition-all cursor-pointer disabled:opacity-50"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Archive Date</span>
          </button>
        </div>
      </div>

      {/* Archive History */}
      {archivedDates.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-textSecondary uppercase tracking-widest">
              {isMarathi ? 'संग्रह इतिहास' : 'Archive History'} ({archivedDates.length})
            </h4>
            <button onClick={loadArchiveStatus} className="text-[10px] text-primary font-bold flex items-center space-x-1 hover:underline cursor-pointer">
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {[...archivedDates].reverse().map((d) => {
              const parts = d.split('-');
              const label = parts[2] + '-' + parts[1] + '-' + parts[0].slice(2);
              return (
                <div key={d} className="flex justify-between items-center text-xs px-3 py-2 bg-background rounded-lg border border-black/[0.03]">
                  <div className="flex items-center space-x-2">
                    <Archive className="w-3 h-3 text-primary" />
                    <span className="font-mono font-bold text-textPrimary text-[11px]">{label}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-primary/5 text-primary">Col</span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-accent/5 text-accent">Sales</span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-danger/5 text-danger">Exp</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

export default Settings;
