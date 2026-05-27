import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { Database, MessageSquare, ShieldCheck, Download, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

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
    loading
  } = useAppStore();

  const [activeSubTab, setActiveSubTab] = useState('database'); // database, whatsapp, staff, backup

  // State bindings for form
  const [baseRate, setBaseRate] = useState(settings.baseRate || 8.5);
  const [businessName, setBusinessName] = useState(settings.businessName || 'Gaudai AI Dairy');
  const [adminMobile, setAdminMobile] = useState(settings.adminMobile || '');
  const [whatsappToken, setWhatsappToken] = useState(settings.whatsappToken || '');
  const [whatsappPhoneId, setWhatsappPhoneId] = useState(settings.whatsappPhoneId || '');
  
  const [sheetsIdCollection, setSheetsIdCollection] = useState(settings.sheetsIdCollection || '');
  const [sheetsIdCustomer, setSheetsIdCustomer] = useState(settings.sheetsIdCustomer || '');
  const [sheetsIdExpense, setSheetsIdExpense] = useState(settings.sheetsIdExpense || '');
  const [sheetsIdMaster, setSheetsIdMaster] = useState(settings.sheetsIdMaster || '');

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
      ? 'तुम्हाला खात्री आहे का की तुम्हाला सर्व व्यवहार हटवायचे आहेत? हा बदल पूर्ववत करता येणार नाही.'
      : 'Are you absolutely sure you want to delete all transactions and reset all dues to zero? This action CANNOT be undone.';
      
    if (window.confirm(confirmMessage)) {
      try {
        const success = await clearAllTransactions();
        if (success) {
          toast.success(isMarathi ? 'व्यवहार यशस्वीरीत्या हटवले गेले!' : 'All transactions cleared and dues reset successfully!');
        } else {
          toast.error(isMarathi ? 'डेटाबेस साफ करण्यात अडचण आली' : 'Failed to clear database');
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

        {activeSubTab === 'danger' && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-danger/20 shadow-subtle space-y-6">
            <h3 className="text-lg font-bold font-head text-danger border-b border-black/[0.04] pb-4 flex items-center space-x-2">
              <Trash2 className="w-5 h-5 text-danger" />
              <span>{isMarathi ? 'डेटाबेस रीसेट / Reset Database' : 'Database Reset & Clean'}</span>
            </h3>

            <p className="text-xs text-textSecondary leading-relaxed">
              {isMarathi
                ? 'खबरदारी: ही क्रिया सर्व व्यवहार (दूध संकलन, विक्री बिले, खर्च आणि पेमेंट) कायमची हटवेल आणि शेतकरी/ग्राहकांची थकबाकी शून्य (0) करेल. हे केवळ नवीन हंगाम/वापरासाठी डेटाबेस स्वच्छ करण्यासाठी वापरा.'
                : 'Caution: This action will permanently delete all transactions (milk collections, sales invoices, payment logs, and expenses) and reset all farmer/customer outstanding dues to zero. Registered farmers, customers, products, and system settings will be preserved.'}
            </p>

            <div className="bg-danger/5 border border-danger/10 rounded-xl p-4">
              <h4 className="text-xs font-bold text-danger uppercase tracking-wider mb-2">
                {isMarathi ? 'खालील डेटा नष्ट होईल:' : 'The following data will be cleared:'}
              </h4>
              <ul className="list-disc list-inside text-xs text-textSecondary space-y-1">
                <li>{isMarathi ? 'सर्व दूध संकलन नोंदी (Milk Collections)' : 'All Milk Collection records'}</li>
                <li>{isMarathi ? 'सर्व विक्री बिले आणि खरेदी नोंदी (Sales)' : 'All Sales invoices'}</li>
                <li>{isMarathi ? 'सर्व पेमेंट इतिहास नोंदी (Payments)' : 'All Payment history logs'}</li>
                <li>{isMarathi ? 'सर्व खर्च नोंदी (Expenses)' : 'All Expense entries'}</li>
                <li>{isMarathi ? 'सर्व दैनिक पत्रके (Daily tabs in Google Sheets)' : 'All daily sheet tabs in Google Sheets'}</li>
                <li>{isMarathi ? 'सर्व शेतकरी आणि ग्राहकांची थकीत रक्कम ० वर रीसेट केली जाईल' : 'All Farmer & Customer dues will be reset to ₹0'}</li>
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
                <span>{isMarathi ? 'सर्व व्यवहार हटवा' : 'Delete All Transactions'}</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
export default Settings;
