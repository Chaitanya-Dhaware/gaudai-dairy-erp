import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { Search, UserPlus, FileInput, IndianRupee, BarChart2, ShieldAlert, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function CollectionWorkspace() {
  const { t, i18n } = useTranslation();
  const isMarathi = i18n.language === 'mr';
  const {
    farmers,
    collections,
    settings,
    registerFarmer,
    addMilkCollection,
    markFarmerPaid,
    loading
  } = useAppStore();

  const [activeTab, setActiveTab] = useState('milk-entry'); // milk-entry, farmer-reg, payment-tracking, summary

  const formatCurrency = (val) => {
    return new Intl.NumberFormat(isMarathi ? 'mr-IN' : 'en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDate = (dateStr) => {
    return new Intl.DateTimeFormat(isMarathi ? 'mr-IN' : 'en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    }).format(new Date(dateStr));
  };

  return (
    <div className="space-y-6 font-body">
      {/* Tab Selectors */}
      <div className="flex border-b border-black/[0.08] overflow-x-auto whitespace-nowrap scrollbar-none gap-2">
        <button
          onClick={() => setActiveTab('milk-entry')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'milk-entry' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {t('collection.milkEntry')}
        </button>
        <button
          onClick={() => setActiveTab('farmer-reg')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'farmer-reg' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {t('collection.farmerReg')}
        </button>
        <button
          onClick={() => setActiveTab('payment-tracking')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'payment-tracking' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {t('collection.payments')}
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'summary' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {t('collection.summary')}
        </button>
        <button
          onClick={() => setActiveTab('daily-transactions')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'daily-transactions' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {isMarathi ? 'दैनिक व्यवहार' : 'Daily Transactions'}
        </button>
      </div>

      {/* Render sub tab */}
      <div>
        {activeTab === 'farmer-reg' && (
          <FarmerRegistration
            farmers={farmers}
            registerFarmer={registerFarmer}
            loading={loading}
            t={t}
            isMarathi={isMarathi}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === 'milk-entry' && (
          <MilkCollectionEntry
            farmers={farmers}
            settings={settings}
            addMilkCollection={addMilkCollection}
            loading={loading}
            t={t}
            isMarathi={isMarathi}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === 'payment-tracking' && (
          <PaymentTracking
            farmers={farmers}
            collections={collections}
            markFarmerPaid={markFarmerPaid}
            t={t}
            isMarathi={isMarathi}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
          />
        )}
        {activeTab === 'summary' && (
          <DailySummary
            collections={collections}
            t={t}
            isMarathi={isMarathi}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === 'daily-transactions' && (
          <DailyTransactions
            farmers={farmers}
            collections={collections}
            t={t}
            isMarathi={isMarathi}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
          />
        )}
      </div>
    </div>
  );
}

// --- SUB-SCREEN 1A: FARMER REGISTRATION ---
function FarmerRegistration({
  farmers,
  registerFarmer,
  loading,
  t,
  isMarathi,
  formatCurrency
}) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [milkType, setMilkType] = useState('Cow');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error(isMarathi ? 'नाव किमान २ अक्षरी असावे' : 'Name must be at least 2 chars');
      return;
    }
    if (!/^\d{10}$/.test(mobile)) {
      toast.error(isMarathi ? 'मोबाईल नंबर १० अंकी असावा' : 'Mobile must be exactly 10 digits');
      return;
    }
    const success = await registerFarmer({ name, mobile, address, milk_type: milkType });
    if (success) {
      setName('');
      setMobile('');
      setAddress('');
      setMilkType('Cow');
    }
  };

  const filteredFarmers = farmers.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.farmer_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle">
        <h3 className="text-lg font-bold font-head text-primary mb-4 flex items-center space-x-2">
          <UserPlus className="w-5 h-5" />
          <span>{t('collection.farmerReg')}</span>
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-2">{t('collection.farmerName')} *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isMarathi ? 'नाव लिहा' : 'Enter name'}
              className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-2">{t('label.mobile')} *</label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="10-digit number"
              className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-2">{t('label.address')}</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={isMarathi ? 'पत्ता / गाव' : 'Village / address'}
              className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-2">{t('collection.milkType')}</label>
            <select
              value={milkType}
              onChange={(e) => setMilkType(e.target.value)}
              className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary"
            >
              <option value="Cow">{t('collection.cow')}</option>
              <option value="Buffalo">{t('collection.buffalo')}</option>
              <option value="Mixed">{t('collection.mixed')}</option>
            </select>
          </div>
          <div className="md:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-primary hover:bg-primary-light text-white text-sm font-semibold rounded-xl transition-all cursor-pointer"
            >
              {t('collection.registerBtn')}
            </button>
          </div>
        </form>
      </div>

      {/* Farmer List */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h4 className="text-sm font-bold text-textPrimary uppercase tracking-wider">
            {isMarathi ? 'नोंदणीकृत शेतकरी यादी' : 'Registered Farmers Directory'}
          </h4>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-textSecondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isMarathi ? 'नाव किंवा आयडी शोधा' : 'Search name or ID'}
              className="w-full pl-9 pr-3 py-1.5 border border-black/[0.08] rounded-lg text-xs bg-background focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-black/[0.08] bg-background">
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('collection.farmerId')}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('collection.farmerName')}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('label.mobile')}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('collection.milkType')}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('customer.currentDue')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {filteredFarmers.map((f) => (
                <tr key={f.farmer_id} className="hover:bg-black/[0.01]">
                  <td className="py-3.5 px-4 font-mono font-medium text-textPrimary">{f.farmer_id}</td>
                  <td className="py-3.5 px-4 font-semibold text-textPrimary">{f.name}</td>
                  <td className="py-3.5 px-4 font-mono text-textSecondary">{f.mobile}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/5 text-primary border border-primary/10">
                      {t(`collection.${f.milk_type.toLowerCase()}`)}
                    </span>
                  </td>
                  <td className={`py-3.5 px-4 font-mono font-semibold ${f.current_due > 0 ? 'text-danger' : 'text-textSecondary'}`}>
                    {formatCurrency(f.current_due)}
                  </td>
                </tr>
              ))}
              {filteredFarmers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-textSecondary">
                    {isMarathi ? 'शेतकरी आढळले नाहीत' : 'No farmers found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- SUB-SCREEN 1B: MILK COLLECTION ENTRY ---
function MilkCollectionEntry({
  farmers,
  settings,
  addMilkCollection,
  loading,
  t,
  isMarathi,
  formatCurrency
}) {
  const [selectedFarmerId, setSelectedFarmerId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState('');
  const [fat, setFat] = useState('');
  const [snf, setSNF] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [milkType, setMilkType] = useState('Cow');

  const baseRate = settings.baseRate || 8.5;

  // Live calculations
  const qtyVal = parseFloat(quantity) || 0;
  const fatVal = parseFloat(fat) || 0;
  const paidVal = parseFloat(paidAmount) || 0;

  const calculatedRate = fatVal * baseRate;
  const totalAmount = calculatedRate * qtyVal;
  const dueAmount = Math.max(0, totalAmount - paidVal);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFarmerId) {
      toast.error(isMarathi ? 'कृपया शेतकरी निवडा' : 'Please select a farmer');
      return;
    }
    if (qtyVal <= 0 || fatVal <= 0) {
      toast.error(isMarathi ? 'प्रमाण आणि फॅटची रक्कम शून्यपेक्षा जास्त असावी' : 'Quantity and Fat must be greater than zero');
      return;
    }

    const success = await addMilkCollection({
      farmer_id: selectedFarmerId,
      date,
      milk_type: milkType,
      quantity: qtyVal,
      fat: fatVal,
      snf: parseFloat(snf) || 8.5,
      paidAmount: paidVal,
      paid_amount: paidVal
    });

    if (success) {
      setQuantity('');
      setFat('');
      setSNF('');
      setPaidAmount('');
      // Keep farmer selected for speed re-entry as instructed in specs!
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form panel */}
      <div className="lg:col-span-2 bg-white rounded-2xl p-6 sm:p-8 border border-black/[0.08] shadow-subtle space-y-6">
        <h3 className="text-lg font-bold font-head text-primary flex items-center space-x-2 border-b border-black/[0.04] pb-4">
          <FileInput className="w-5 h-5" />
          <span>{t('collection.milkEntry')}</span>
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-2">{t('customer.selectCustomer')} *</label>
              <select
                value={selectedFarmerId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedFarmerId(nextId);
                  const f = farmers.find(farm => farm.farmer_id === nextId);
                  if (f) setMilkType(f.milk_type);
                }}
                className="w-full px-3 py-2.5 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary font-semibold"
                required
              >
                <option value="">-- {isMarathi ? 'निवडा' : 'Select Farmer'} --</option>
                {farmers.map(f => (
                  <option key={f.farmer_id} value={f.farmer_id}>
                    {f.farmer_id} - {f.name} ({f.milk_type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-2">{t('label.date')}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-2">{t('collection.quantity')} *</label>
              <input
                type="number"
                step="0.1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Liters"
                className="w-full px-3 py-2.5 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary font-mono font-semibold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-2">{t('collection.fat')} *</label>
              <input
                type="number"
                step="0.1"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                placeholder="Fat"
                className="w-full px-3 py-2.5 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary font-mono font-semibold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-2">{t('collection.snf')}</label>
              <input
                type="number"
                step="0.1"
                value={snf}
                onChange={(e) => setSNF(e.target.value)}
                placeholder="SNF"
                className="w-full px-3 py-2.5 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary font-mono font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-2">{t('collection.milkType')}</label>
              <select
                value={milkType}
                onChange={(e) => setMilkType(e.target.value)}
                className="w-full px-3 py-2.5 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary"
              >
                <option value="Cow">{t('collection.cow')}</option>
                <option value="Buffalo">{t('collection.buffalo')}</option>
                <option value="Mixed">{t('collection.mixed')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-2">{t('collection.paidAmount')}</label>
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="Paid amount (₹)"
                className="w-full px-3 py-2.5 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary font-mono font-semibold"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary hover:bg-primary-light text-white font-bold rounded-xl transition-all cursor-pointer mt-4"
          >
            {t('collection.saveBtn')}
          </button>
        </form>
      </div>

      {/* Live Calculation Panel */}
      <div className="space-y-6">
        <div className="bg-primary text-white rounded-2xl p-6 sm:p-8 border border-primary/20 shadow-lg flex flex-col justify-between h-full">
          <div>
            <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider opacity-80">{t('collection.liveCalc')}</h4>
              <IndianRupee className="w-5 h-5" />
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="opacity-80">{t('collection.calcRate')}</span>
                <span className="font-mono font-bold text-lg">{formatCurrency(calculatedRate)}/L</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="opacity-80">{t('collection.totalAmount')}</span>
                <span className="font-mono font-bold text-xl">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="opacity-80">{t('collection.paidAmount')}</span>
                <span className="font-mono font-bold text-lg">{formatCurrency(paidVal)}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 bg-black/10 -mx-6 -mb-6 p-6 rounded-b-2xl">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider opacity-90">{t('collection.dueAmount')}</span>
              <span className="text-2xl font-bold font-mono text-accent-light">{formatCurrency(dueAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- SUB-SCREEN 1C: PAYMENT TRACKING ---
function PaymentTracking({
  farmers,
  collections,
  markFarmerPaid,
  t,
  isMarathi,
  formatCurrency,
  formatDate
}) {
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchName, setSearchName] = useState('');
  const [modalEntry, setModalEntry] = useState(null);
  const [clearAmount, setClearAmount] = useState('');

  const filteredCols = collections.filter(c => {
    const statusMatch = filterStatus === 'All' || c.status === filterStatus;
    const farmer = farmers.find(f => f.farmer_id === c.farmer_id);
    const farmerName = farmer?.name || '';
    const nameMatch = farmerName.toLowerCase().includes(searchName.toLowerCase()) || 
                      c.farmer_id.toLowerCase().includes(searchName.toLowerCase());
    return statusMatch && nameMatch;
  });

  // Summary calculations
  const totalCollected = collections.reduce((s, c) => s + c.total_amount, 0);
  const totalPaid = collections.reduce((s, c) => s + c.paid_amount, 0);
  const totalDue = collections.reduce((s, c) => s + c.due_amount, 0);

  const handleConfirmPayment = async () => {
    if (!modalEntry) return;
    const amtVal = parseFloat(clearAmount);
    if (isNaN(amtVal) || amtVal <= 0 || amtVal > modalEntry.due_amount) {
      toast.error(isMarathi ? 'कृपया वैध रक्कम प्रविष्ट करा' : 'Please enter a valid amount');
      return;
    }
    const success = await markFarmerPaid(modalEntry.entry_id, amtVal);
    if (success) {
      setModalEntry(null);
      setClearAmount('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle">
          <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">
            {isMarathi ? 'एकूण जमा दूध किंमत' : 'Total Amount Payable'}
          </p>
          <p className="text-lg font-bold font-mono text-textPrimary mt-1">{formatCurrency(totalCollected)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle">
          <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">
            {isMarathi ? 'एकूण दिलेली रक्कम' : 'Total Amount Paid'}
          </p>
          <p className="text-lg font-bold font-mono text-primary mt-1">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle">
          <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">
            {isMarathi ? 'शेतकऱ्यांना प्रलंबित देणे' : 'Total Outstanding Dues'}
          </p>
          <p className="text-lg font-bold font-mono text-danger mt-1">{formatCurrency(totalDue)}</p>
        </div>
      </div>

      {/* Ledger view */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-black/[0.04] pb-4">
          <h4 className="text-sm font-bold text-textPrimary uppercase tracking-wider">
            {t('collection.payments')}
          </h4>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-textSecondary" />
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder={isMarathi ? 'नाव किंवा क्रमांक शोधा' : 'Search name or ID'}
                className="w-full pl-8 pr-3 py-1 border border-black/[0.08] rounded-lg text-xs bg-background focus:outline-none focus:border-primary"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1 border border-black/[0.08] rounded-lg text-xs bg-background focus:outline-none cursor-pointer"
            >
              <option value="All">{isMarathi ? 'सर्व स्थिती' : 'All Statuses'}</option>
              <option value="Paid">{t('status.paid')}</option>
              <option value="Partial">{t('status.partial')}</option>
              <option value="Pending">{t('status.pending')}</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-black/[0.08] bg-background">
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('label.date')}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('collection.farmerName')}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{isMarathi ? 'प्रमाण (L)' : 'Qty (L)'}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('collection.fat')}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('collection.calcRate')}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('collection.totalAmount')}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('label.paid')}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('label.due')}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">Status</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{t('label.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {filteredCols.map((c) => {
                const farmer = farmers.find(f => f.farmer_id === c.farmer_id);
                return (
                  <tr key={c.entry_id} className="hover:bg-black/[0.01]">
                    <td className="py-3 px-4 font-mono text-textSecondary">{formatDate(c.date)}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-textPrimary">{farmer?.name || 'Unknown Farmer'}</p>
                      <p className="text-[10px] text-textSecondary font-mono">{c.farmer_id}</p>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium">{c.quantity} L</td>
                    <td className="py-3 px-4 font-mono">{c.fat}</td>
                    <td className="py-3 px-4 font-mono">{formatCurrency(c.calculated_rate)}</td>
                    <td className="py-3 px-4 font-mono font-semibold">{formatCurrency(c.total_amount)}</td>
                    <td className="py-3 px-4 font-mono text-primary">{formatCurrency(c.paid_amount)}</td>
                    <td className={`py-3 px-4 font-mono font-semibold ${c.due_amount > 0 ? 'text-danger' : 'text-textSecondary'}`}>
                      {formatCurrency(c.due_amount)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                        c.status === 'Paid' ? 'bg-primary/5 text-primary border-primary/20' : 
                        c.status === 'Partial' ? 'bg-accent/5 text-accent border-accent/20' : 
                        'bg-danger/5 text-danger border-danger/20'
                      }`}>
                        {t(`status.${c.status.toLowerCase()}`)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {c.due_amount > 0 ? (
                        <button
                          onClick={() => {
                            setModalEntry(c);
                            setClearAmount(c.due_amount.toString());
                          }}
                          className="px-2.5 py-1 bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20 text-[10px] font-bold rounded-md transition-all cursor-pointer"
                        >
                          {t('btn.markPaid')}
                        </button>
                      ) : (
                        <span className="text-[10px] text-textSecondary font-semibold">Cleared</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredCols.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-textSecondary">
                    {isMarathi ? 'नोंदी आढळल्या नाहीत' : 'No records found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Confirmation Modal */}
      {modalEntry && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-black/[0.08] shadow-2xl space-y-5">
            <div className="flex items-center space-x-3 text-primary">
              <IndianRupee className="w-6 h-6" />
              <h3 className="text-base font-bold font-head text-textPrimary">
                {isMarathi ? 'भरणा नोंदवा' : 'Record Due Clearance'}
              </h3>
            </div>
            
            <div className="text-xs text-textSecondary space-y-1">
              <p>
                {isMarathi 
                  ? `शेतकरी: ${farmers.find(f => f.farmer_id === modalEntry.farmer_id)?.name} (${modalEntry.farmer_id})`
                  : `Farmer: ${farmers.find(f => f.farmer_id === modalEntry.farmer_id)?.name} (${modalEntry.farmer_id})`}
              </p>
              <p>
                {isMarathi 
                  ? `एकूण प्रलंबित बाकी: ${formatCurrency(modalEntry.due_amount)}`
                  : `Total Pending Due: ${formatCurrency(modalEntry.due_amount)}`}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-textSecondary uppercase">
                {isMarathi ? 'जमा करायची रक्कम (₹)' : 'Amount to Clear (₹)'}
              </label>
              <input
                type="number"
                min="0.01"
                max={modalEntry.due_amount}
                step="any"
                value={clearAmount}
                onChange={(e) => setClearAmount(e.target.value)}
                className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background focus:outline-none focus:border-primary font-mono font-semibold"
                placeholder={isMarathi ? 'रक्कम प्रविष्ट करा' : 'Enter amount'}
                required
              />
            </div>

            <div className="flex space-x-3 justify-end text-xs pt-2">
              <button
                onClick={() => {
                  setModalEntry(null);
                  setClearAmount('');
                }}
                className="px-4 py-2 border border-black/[0.08] rounded-xl font-semibold text-textSecondary hover:bg-black/[0.02] cursor-pointer"
              >
                {t('btn.cancel')}
              </button>
              <button
                onClick={handleConfirmPayment}
                className="px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-xl font-semibold cursor-pointer"
              >
                {isMarathi ? 'निश्चित करा' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUB-SCREEN 1D: DAILY SUMMARY ---
function DailySummary({ collections, t, isMarathi, formatCurrency }) {
  // Basic sums
  const totalQty = collections.reduce((s, c) => s + c.quantity, 0);
  const totalFarmers = new Set(collections.map(c => c.farmer_id)).size;
  const totalAmount = collections.reduce((s, c) => s + c.total_amount, 0);
  const totalDue = collections.reduce((s, c) => s + c.due_amount, 0);

  const cowLiters = collections.filter(c => c.milk_type === 'Cow').reduce((s, c) => s + c.quantity, 0);
  const bufLiters = collections.filter(c => c.milk_type === 'Buffalo').reduce((s, c) => s + c.quantity, 0);
  const mixLiters = collections.filter(c => c.milk_type === 'Mixed').reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle">
          <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">{t('collection.totalLiters')}</p>
          <p className="text-xl font-bold font-mono text-primary mt-1">{totalQty.toFixed(1)} L</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle">
          <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">{t('collection.totalFarmers')}</p>
          <p className="text-xl font-bold font-mono text-accent mt-1">{totalFarmers}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle">
          <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">{t('collection.totalPayable')}</p>
          <p className="text-xl font-bold font-mono text-textPrimary mt-1">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle">
          <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">{isMarathi ? 'एकूण बाकी' : 'Total Pending Dues'}</p>
          <p className="text-xl font-bold font-mono text-danger mt-1">{formatCurrency(totalDue)}</p>
        </div>
      </div>

      {/* Milk type breakdown using HTML percentages visual grid */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-6">
        <h4 className="text-sm font-bold text-textPrimary uppercase tracking-wider flex items-center space-x-2 border-b border-black/[0.04] pb-4">
          <BarChart2 className="w-4.5 h-4.5 text-primary" />
          <span>{isMarathi ? 'दुधाचे प्रकारानुसार वर्गीकरण' : 'Milk Types Yield Breakdown'}</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 border border-black/[0.04] bg-background rounded-xl space-y-2">
            <p className="text-xs font-bold text-textSecondary uppercase">{t('collection.cow')}</p>
            <p className="text-2xl font-bold font-mono text-primary">{cowLiters.toFixed(1)} L</p>
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${totalQty > 0 ? (cowLiters/totalQty)*100 : 0}%` }} />
            </div>
          </div>
          <div className="p-4 border border-black/[0.04] bg-background rounded-xl space-y-2">
            <p className="text-xs font-bold text-textSecondary uppercase">{t('collection.buffalo')}</p>
            <p className="text-2xl font-bold font-mono text-accent">{bufLiters.toFixed(1)} L</p>
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${totalQty > 0 ? (bufLiters/totalQty)*100 : 0}%` }} />
            </div>
          </div>
          <div className="p-4 border border-black/[0.04] bg-background rounded-xl space-y-2">
            <p className="text-xs font-bold text-textSecondary uppercase">{t('collection.mixed')}</p>
            <p className="text-2xl font-bold font-mono text-textPrimary">{mixLiters.toFixed(1)} L</p>
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-textPrimary" style={{ width: `${totalQty > 0 ? (mixLiters/totalQty)*100 : 0}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- SUB-SCREEN 1E: DAILY TRANSACTIONS ---
function DailyTransactions({
  farmers,
  collections,
  t,
  isMarathi,
  formatCurrency,
  formatDate
}) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Filter collections by date
  const filteredCols = collections.filter(c => c.date === selectedDate);

  // Summary calculations for selected date
  const totalQty = filteredCols.reduce((s, c) => s + c.quantity, 0);
  const totalAmount = filteredCols.reduce((s, c) => s + c.total_amount, 0);
  const totalPaid = filteredCols.reduce((s, c) => s + c.paid_amount, 0);
  const totalDue = filteredCols.reduce((s, c) => s + c.due_amount, 0);

  return (
    <div className="space-y-6">
      {/* Date Filter Panel */}
      <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h4 className="text-sm font-bold text-textPrimary uppercase tracking-wider">
            {isMarathi ? 'दैनिक व्यवहार शोध' : 'Daily Transactions Search'}
          </h4>
          <p className="text-[11px] text-textSecondary mt-0.5">
            {isMarathi ? 'व्यवहार पाहण्यासाठी तारीख निवडा' : 'Select a date to view transactions'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-primary" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 border border-black/[0.08] rounded-xl text-xs bg-background focus:outline-none focus:border-primary font-mono"
          />
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle">
          <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">
            {isMarathi ? 'एकूण प्रमाण' : 'Total Liters'}
          </p>
          <p className="text-lg font-bold font-mono text-primary mt-1">{totalQty.toFixed(1)} L</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle">
          <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">
            {isMarathi ? 'एकूण दूध किंमत' : 'Total Amount'}
          </p>
          <p className="text-lg font-bold font-mono text-textPrimary mt-1">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle">
          <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">
            {isMarathi ? 'एकूण दिलेली रक्कम' : 'Total Paid'}
          </p>
          <p className="text-lg font-bold font-mono text-accent mt-1">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle">
          <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">
            {isMarathi ? 'एकूण बाकी' : 'Total Due'}
          </p>
          <p className="text-lg font-bold font-mono text-danger mt-1">{formatCurrency(totalDue)}</p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-4">
        <h4 className="text-sm font-bold text-textPrimary uppercase tracking-wider border-b border-black/[0.04] pb-4">
          {isMarathi ? 'दुधाचे व्यवहार यादी' : 'Daily Milk Collections List'}
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-black/[0.08] bg-background">
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{isMarathi ? 'तारीख' : 'Date'}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{isMarathi ? 'शेतकऱ्याचे नाव' : 'Farmer Name'}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{isMarathi ? 'प्रमाण (L)' : 'Qty (L)'}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{isMarathi ? 'फॅट' : 'Fat'}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{isMarathi ? 'दर' : 'Rate'}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{isMarathi ? 'एकूण रक्कम' : 'Total Amount'}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{isMarathi ? 'जमा' : 'Paid'}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{isMarathi ? 'बाकी' : 'Due'}</th>
                <th className="py-3 px-4 font-semibold text-textSecondary uppercase">{isMarathi ? 'स्थिती' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {filteredCols.map((c) => {
                const farmer = farmers.find(f => f.farmer_id === c.farmer_id);
                return (
                  <tr key={c.entry_id} className="hover:bg-black/[0.01]">
                    <td className="py-3 px-4 font-mono text-textSecondary">{formatDate(c.date)}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-textPrimary">{farmer?.name || 'Unknown Farmer'}</p>
                      <p className="text-[10px] text-textSecondary font-mono">{c.farmer_id}</p>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium">{c.quantity} L</td>
                    <td className="py-3 px-4 font-mono">{c.fat}</td>
                    <td className="py-3 px-4 font-mono">{formatCurrency(c.calculated_rate)}</td>
                    <td className="py-3 px-4 font-mono font-semibold">{formatCurrency(c.total_amount)}</td>
                    <td className="py-3 px-4 font-mono text-primary">{formatCurrency(c.paid_amount)}</td>
                    <td className={`py-3 px-4 font-mono font-semibold ${c.due_amount > 0 ? 'text-danger' : 'text-textSecondary'}`}>
                      {formatCurrency(c.due_amount)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                        c.status === 'Paid' ? 'bg-primary/5 text-primary border-primary/20' : 
                        c.status === 'Partial' ? 'bg-accent/5 text-accent border-accent/20' : 
                        'bg-danger/5 text-danger border-danger/20'
                      }`}>
                        {t(`status.${c.status.toLowerCase()}`)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredCols.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-textSecondary">
                    {isMarathi ? 'निवडलेल्या तारखेसाठी व्यवहार आढळले नाहीत.' : 'No transactions found for the selected date.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default CollectionWorkspace;
