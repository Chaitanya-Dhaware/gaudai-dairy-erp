import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { Droplet, Users, Receipt, PieChart, TrendingUp, TrendingDown, Clock, ShieldCheck, FileSpreadsheet, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function HomeDashboard() {
  const { t, i18n } = useTranslation();
  const { setWorkspace, todaySummary, user, settings } = useAppStore();
  const isMarathi = i18n.language === 'mr';

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const handleOpenSpreadsheet = (type) => {
    const appScriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL || '';
    const isMockMode = !appScriptUrl || appScriptUrl.includes('placeholder');

    const sheetId = type === 'collection' 
      ? settings?.sheetsIdCollection 
      : type === 'customer' 
        ? settings?.sheetsIdCustomer 
        : settings?.sheetsIdExpense;

    if (!sheetId) {
      toast.error(isMarathi ? 'शीट आयडी सेट नाही' : 'Sheet ID not set');
      return;
    }

    if (isMockMode) {
      const baseUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
      window.open(baseUrl, '_blank');
    } else {
      const redirectUrl = `${appScriptUrl}?action=openTab&type=${type}&date=${selectedDate}`;
      window.open(redirectUrl, '_blank');
    }
  };

  const formatSheetDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    const year = parts[0];
    const monthNum = parseInt(parts[1], 10);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthName = months[monthNum - 1] || "Jan";
    return `${parts[2]}_${monthName}_${year}`;
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat(isMarathi ? 'mr-IN' : 'en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const cards = [
    {
      id: 'collection',
      name: t('nav.collection'),
      desc: isMarathi 
        ? 'दूध संकलन, शेतकऱ्यांची नोंदणी आणि रोजची देयके हाताळा.' 
        : 'Manage farmer registrations, milk collection records, and payments.',
      icon: Droplet,
      color: 'border-primary/20 hover:border-primary',
      iconBg: 'bg-primary/10 text-primary',
      metric: `${isMarathi ? 'आज एकूण दूध: ' : 'Liters Collected: '} 35.7 L`
    },
    {
      id: 'customers',
      name: t('nav.customers'),
      desc: isMarathi 
        ? 'नवीन बिले काढा, दुधाचे पॅकेट्स विक्री आणि ग्राहकांची थकबाकी व्यवस्थापित करा.' 
        : 'Issue new retail bills, control dairy product sales, and track customer dues.',
      icon: Users,
      color: 'border-accent/20 hover:border-accent',
      iconBg: 'bg-accent/10 text-accent',
      metric: `${isMarathi ? 'आजचे बिलिंग: ' : 'Billed Today: '} ${formatCurrency(todaySummary.revenueToday)}`
    },
    {
      id: 'expenses',
      name: t('nav.expenses'),
      desc: isMarathi 
        ? 'इंधन, पगार आणि इतर व्यावसायिक खर्चाची नोंद ठेवा.' 
        : 'Record operational outlays like fuel, fodder feed, wages and assets.',
      icon: Receipt,
      color: 'border-danger/20 hover:border-danger',
      iconBg: 'bg-danger/10 text-danger',
      metric: `${isMarathi ? 'आजचा एकूण खर्च: ' : 'Expenses Today: '} ${formatCurrency(todaySummary.opExpensesToday + todaySummary.farmerPaymentsToday)}`
    },
    {
      id: 'accounts',
      name: t('nav.accounts'),
      desc: isMarathi 
        ? 'नफा-तोटा पत्रक, रोख प्रवाह आणि AI आर्थिक सल्ला तपासा.' 
        : 'Inspect profit & loss statements, cash flow indices, and AI insights.',
      icon: PieChart,
      color: 'border-primary/20 hover:border-primary',
      iconBg: 'bg-primary/10 text-primary',
      metric: `${isMarathi ? 'निव्वळ नफा: ' : 'Net Profit: '} ${formatCurrency(todaySummary.netProfit)}`
    }
  ];

  return (
    <div className="space-y-8 font-body">
      
      {/* Top Banner Message */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-black/[0.08] shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-head text-primary tracking-tight">
            {isMarathi ? `रामराम, ${user?.name || 'चालक'}` : `Welcome back, ${user?.name || 'Admin'}`}
          </h2>
          <p className="text-textSecondary text-xs mt-1">
            {isMarathi 
              ? 'तुमच्या डेअरीचा संपूर्ण ताळेबंद आज अद्ययावत आहे. खालील कोणत्याही डॅशबोर्डवर क्लिक करा.' 
              : 'Your dairy operations are active and synchronized. Select a workspace below to start operating.'}
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-primary/5 px-4 py-2 rounded-xl text-primary text-xs font-semibold self-start md:self-auto">
          <ShieldCheck className="w-4 h-4" />
          <span className="capitalize">{user?.role} Access Profile</span>
        </div>
      </div>

      {/* Grid of Workspaces */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          const isAllowed = user?.role === 'admin' || 
            (card.id !== 'accounts' && user?.role === 'staff') ||
            (card.id === 'accounts' && user?.role === 'accountant') ||
            (card.id === 'collection' && user?.role === 'staff') ||
            (card.id === 'customers' && user?.role === 'staff') ||
            (card.id === 'expenses' && user?.role === 'staff') ||
            (card.id === 'settings' && user?.role === 'admin');

          return (
            <div
              key={card.id}
              onClick={() => {
                if (isAllowed) {
                  setWorkspace(card.id);
                } else {
                  toast.error(isMarathi ? 'तुम्हाला या डॅशबोर्डवर जाण्याची परवानगी नाही' : 'Access restricted for your profile role');
                }
              }}
              className={`bg-white rounded-2xl p-6 sm:p-8 border shadow-subtle flex flex-col justify-between transition-all duration-300 cursor-pointer ${
                isAllowed 
                  ? `${card.color} hover:-translate-y-1` 
                  : 'opacity-50 cursor-not-allowed border-black/5'
              }`}
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  {!isAllowed && (
                    <span className="text-[9px] bg-danger/10 text-danger px-2 py-0.5 rounded-full font-semibold">
                      Restricted
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold font-head text-textPrimary">{card.name}</h3>
                  <p className="text-textSecondary text-xs leading-relaxed">{card.desc}</p>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-black/[0.04] flex justify-between items-center text-xs font-semibold text-textPrimary">
                <span className="font-mono">{card.metric}</span>
                <span className="text-primary hover:underline text-[10px] uppercase tracking-wider">
                  {isMarathi ? 'उघडा →' : 'Enter Workspace →'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Today's Combined Summary Bar */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle">
        <h3 className="text-xs font-bold text-textSecondary uppercase tracking-widest mb-4">
          {isMarathi ? 'आजचा एकूण आर्थिक आढावा' : 'Today\'s Combined Summary'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-textSecondary font-semibold uppercase">{t('accounts.revenue')}</p>
              <p className="text-lg font-bold font-mono text-textPrimary mt-0.5">
                {formatCurrency(todaySummary.revenueToday)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center text-danger">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-textSecondary font-semibold uppercase">{t('accounts.expenses')}</p>
              <p className="text-lg font-bold font-mono text-textPrimary mt-0.5">
                {formatCurrency(todaySummary.opExpensesToday + todaySummary.farmerPaymentsToday)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-textSecondary font-semibold uppercase">{t('accounts.pendingDues')}</p>
              <p className="text-lg font-bold font-mono text-textPrimary mt-0.5">
                {formatCurrency(todaySummary.pendingDues)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3.5">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              todaySummary.netProfit >= 0 ? 'bg-primary/15 text-primary' : 'bg-danger/15 text-danger'
            }`}>
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-textSecondary font-semibold uppercase">{t('accounts.netProfit')}</p>
              <p className={`text-lg font-bold font-mono mt-0.5 ${
                todaySummary.netProfit >= 0 ? 'text-primary' : 'text-danger'
              }`}>
                {formatCurrency(todaySummary.netProfit)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Google Spreadsheet Quick Access Section */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-base font-bold font-head text-primary flex items-center space-x-2">
              <FileSpreadsheet className="w-5 h-5" />
              <span>{isMarathi ? 'थेट गूगल शीट ॲक्सेस' : 'Google Spreadsheet Access'}</span>
            </h3>
            <p className="text-textSecondary text-[11px] mt-1">
              {isMarathi 
                ? 'निवडलेल्या तारखेनुसार तुमच्या गूगल ड्राईव्हमधील संबंधित डेटा शीट उघडा.' 
                : 'Directly open database spreadsheets and daily journals for your selected date.'}
            </p>
          </div>
          
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <label className="text-xs font-bold text-textSecondary uppercase tracking-wider whitespace-nowrap">
              {isMarathi ? 'तारीख निवडा:' : 'Select Date:'}
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-black/[0.08] rounded-xl text-xs bg-background font-mono font-bold focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Milk Collections */}
          <div className="p-5 border border-black/[0.06] rounded-2xl bg-background flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-textPrimary uppercase tracking-wider">
                {isMarathi ? '🥛 दूध संकलन रजिस्टर' : '🥛 Milk Collections Log'}
              </h4>
              <p className="text-[10px] text-textSecondary leading-relaxed">
                {isMarathi 
                  ? 'शेतकरी दूध संकलन नोंदी आणि प्रलंबित देयके पाहण्यासाठी मुख्य शीट उघडा.' 
                  : 'Open the collection spreadsheet to review all farmer milk entries and dues.'}
              </p>
            </div>
            {settings?.sheetsIdCollection ? (
              <button
                onClick={() => handleOpenSpreadsheet('collection')}
                className="w-full py-2.5 bg-primary hover:bg-primary-light text-white text-center text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <span>{isMarathi ? 'शीट उघडा' : 'Go to Spreadsheet'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button disabled className="w-full py-2.5 bg-black/[0.05] text-textSecondary text-xs font-bold rounded-xl cursor-not-allowed">
                {isMarathi ? 'शीट आयडी सेट नाही' : 'Sheet ID not set'}
              </button>
            )}
          </div>

          {/* Card 2: Customers & Sales */}
          <div className="p-5 border border-black/[0.06] rounded-2xl bg-background flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-textPrimary uppercase tracking-wider">
                {isMarathi ? '👥 ग्राहक आणि विक्री रजिस्टर' : '👥 Customers & Sales Log'}
              </h4>
              <p className="text-[10px] text-textSecondary leading-relaxed">
                {isMarathi 
                  ? 'ग्राहकांची बिले, विक्री इतिहास आणि दुकानदारांची थकबाकी पाहण्यासाठी मुख्य शीट उघडा.' 
                  : 'Open the customer sales spreadsheet to manage store balances and invoices.'}
              </p>
            </div>
            {settings?.sheetsIdCustomer ? (
              <button
                onClick={() => handleOpenSpreadsheet('customer')}
                className="w-full py-2.5 bg-primary hover:bg-primary-light text-white text-center text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <span>{isMarathi ? 'शीट उघडा' : 'Go to Spreadsheet'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button disabled className="w-full py-2.5 bg-black/[0.05] text-textSecondary text-xs font-bold rounded-xl cursor-not-allowed">
                {isMarathi ? 'शीट आयडी सेट नाही' : 'Sheet ID not set'}
              </button>
            )}
          </div>

          {/* Card 3: Expenses */}
          <div className="p-5 border border-black/[0.06] rounded-2xl bg-background flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-textPrimary uppercase tracking-wider">
                {isMarathi ? '💸 दैनिक खर्च रजिस्टर' : '💸 Daily Expenses Log'}
              </h4>
              <p className="text-[10px] text-textSecondary leading-relaxed">
                {isMarathi 
                  ? `खर्च मुख्य रजिस्टरमध्ये आणि दैनिक विभागात जतन केले जातात.` 
                  : `Expenses are archived by date. Open sheet and check the bottom tab bar.`}
              </p>
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-2 font-mono text-[9px] text-primary mt-1">
                {isMarathi ? 'खर्च टॅबचे नाव:' : 'Target Tab Name:'} <strong className="underline">Daily_{formatSheetDate(selectedDate)}</strong>
              </div>
            </div>
            {settings?.sheetsIdExpense ? (
              <button
                onClick={() => handleOpenSpreadsheet('expense')}
                className="w-full py-2.5 bg-primary hover:bg-primary-light text-white text-center text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <span>{isMarathi ? 'शीट उघडा' : 'Go to Spreadsheet'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button disabled className="w-full py-2.5 bg-black/[0.05] text-textSecondary text-xs font-bold rounded-xl cursor-not-allowed">
                {isMarathi ? 'शीट आयडी सेट नाही' : 'Sheet ID not set'}
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
export default HomeDashboard;
