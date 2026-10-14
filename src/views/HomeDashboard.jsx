import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { Droplet, Users, Receipt, PieChart, TrendingUp, TrendingDown, Clock, ShieldCheck, FileSpreadsheet, ExternalLink, ArrowUpRight } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function HomeDashboard() {
  const { t, i18n } = useTranslation();
  const { setWorkspace, todaySummary, user, settings, dataLoaded, collections } = useAppStore();
  const isMarathi = i18n.language === 'mr';

  const formatCurrency = (val) => {
    return new Intl.NumberFormat(isMarathi ? 'mr-IN' : 'en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const today = new Date().toLocaleDateString('en-CA');
  const litersToday = (collections || [])
    .filter(c => c.date === today)
    .reduce((sum, c) => sum + (c.quantity || 0), 0);

  const cards = [
    {
      id: 'collection',
      name: t('nav.collection'),
      desc: isMarathi 
        ? 'दूध संकलन, शेतकऱ्यांची नोंदणी आणि रोजची देयके हाताळा.' 
        : 'Manage farmer registrations, milk collection records, and payments.',
      icon: Droplet,
      accentColor: 'text-primary',
      accentBg: 'bg-primary/10',
      borderHover: 'hover:border-primary/60 hover:shadow-card-hover',
      metricLabel: isMarathi ? 'आज एकूण दूध' : 'Collected Today',
      metric: !dataLoaded ? null : `${litersToday.toFixed(1)} L`,
    },
    {
      id: 'customers',
      name: t('nav.customers'),
      desc: isMarathi 
        ? 'नवीन बिले काढा, दुधाचे पॅकेट्स विक्री आणि ग्राहकांची थकबाकी व्यवस्थापित करा.' 
        : 'Issue new retail bills, control dairy product sales, and track customer dues.',
      icon: Users,
      accentColor: 'text-accent',
      accentBg: 'bg-accent/10',
      borderHover: 'hover:border-accent/60 hover:shadow-card-hover',
      metricLabel: isMarathi ? 'आजचे बिलिंग' : 'Billed Today',
      metric: !dataLoaded ? null : formatCurrency(todaySummary.revenueToday),
    },
    {
      id: 'expenses',
      name: t('nav.expenses'),
      desc: isMarathi 
        ? 'इंधन, पगार आणि इतर व्यावसायिक खर्चाची नोंद ठेवा.' 
        : 'Record operational outlays like fuel, fodder feed, wages and assets.',
      icon: Receipt,
      accentColor: 'text-danger',
      accentBg: 'bg-danger/10',
      borderHover: 'hover:border-danger/60 hover:shadow-card-hover',
      metricLabel: isMarathi ? 'आजचा एकूण खर्च' : 'Expenses Today',
      metric: !dataLoaded ? null : formatCurrency(todaySummary.opExpensesToday + todaySummary.farmerPaymentsToday),
    },
    {
      id: 'accounts',
      name: t('nav.accounts'),
      desc: isMarathi 
        ? 'नफा-तोटा पत्रक, रोख प्रवाह आणि AI आर्थिक सल्ला तपासा.' 
        : 'Inspect profit & loss statements, cash flow indices, and AI insights.',
      icon: PieChart,
      accentColor: 'text-primary',
      accentBg: 'bg-primary/10',
      borderHover: 'hover:border-primary/60 hover:shadow-card-hover',
      metricLabel: isMarathi ? 'निव्वळ नफा' : 'Net Profit',
      metric: !dataLoaded ? null : formatCurrency(todaySummary.netProfit),
    }
  ];

  // Skeleton for loading state
  const Skeleton = ({ w = 'w-20', h = 'h-5' }) => (
    <span className={`inline-block ${w} ${h} bg-black/10 animate-pulse rounded`} />
  );

  return (
    <div className="space-y-6 font-body">

      {/* ── 1. GREETING + ROLE BADGE ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-title font-bold font-head text-primary tracking-tight leading-snug">
            {isMarathi ? `रामराम, ${user?.name || 'चालक'}` : `Welcome back, ${user?.name || 'Admin'}`}
          </h2>
          <p className="text-caption text-textSecondary mt-1">
            {isMarathi 
              ? 'तुमच्या डेअरीचा संपूर्ण ताळेबंद आज अद्ययावत आहे.' 
              : 'Your dairy operations are active and synchronized.'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-primary/8 border border-primary/15 px-3 py-1.5 rounded-pill text-primary self-start sm:self-auto flex-shrink-0">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="text-micro font-semibold capitalize tracking-wide">{user?.role} Access</span>
        </div>
      </div>

      {/* ── 2. KPI SCOREBOARD ─────────────────────────────────────────────── */}
      {/* This is the most important data — users need to see the numbers first */}
      <div className="bg-white rounded-card border border-black/[0.07] shadow-card">
        <div className="px-6 pt-5 pb-2">
          <p className="label">{isMarathi ? 'आजचा एकूण आर्थिक आढावा' : "Today's Summary"}</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-black/[0.06]">
          {[
            {
              icon: TrendingUp,
              iconBg: 'bg-primary/10 text-primary',
              label: t('accounts.revenue'),
              value: !dataLoaded ? <Skeleton w="w-28" h="h-7" /> : formatCurrency(todaySummary.revenueToday),
              valueClass: 'text-textPrimary',
            },
            {
              icon: TrendingDown,
              iconBg: 'bg-danger/10 text-danger',
              label: t('accounts.expenses'),
              value: !dataLoaded ? <Skeleton w="w-28" h="h-7" /> : formatCurrency(todaySummary.opExpensesToday + todaySummary.farmerPaymentsToday),
              valueClass: 'text-textPrimary',
            },
            {
              icon: Clock,
              iconBg: 'bg-accent/10 text-accent',
              label: t('accounts.pendingDues'),
              value: !dataLoaded ? <Skeleton w="w-24" h="h-7" /> : formatCurrency(todaySummary.pendingDues),
              valueClass: 'text-textPrimary',
            },
            {
              icon: TrendingUp,
              iconBg: dataLoaded && todaySummary.netProfit >= 0 ? 'bg-primary/15 text-primary' : 'bg-danger/15 text-danger',
              label: t('accounts.netProfit'),
              value: !dataLoaded ? <Skeleton w="w-28" h="h-7" /> : formatCurrency(todaySummary.netProfit),
              valueClass: !dataLoaded ? '' : todaySummary.netProfit >= 0 ? 'text-primary' : 'text-danger',
            },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="px-5 py-5 flex items-start gap-3.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${stat.iconBg}`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="label mb-1.5">{stat.label}</p>
                  <p className={`stat-number ${stat.valueClass}`}>{stat.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. WORKSPACE ACTION CARDS ─────────────────────────────────────── */}
      <div>
        <p className="label mb-3">{isMarathi ? 'वर्कस्पेस निवडा' : 'Select a Workspace'}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                className={`bg-white rounded-card border shadow-card flex flex-col justify-between transition-all duration-200 cursor-pointer p-6 ${
                  isAllowed 
                    ? `border-black/[0.07] ${card.borderHover} hover:-translate-y-0.5` 
                    : 'opacity-50 cursor-not-allowed border-black/[0.05]'
                }`}
              >
                {/* Card top: icon + optional restricted badge */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.accentBg} ${card.accentColor}`}>
                    <Icon className="w-5.5 h-5.5" />
                  </div>
                  {!isAllowed && (
                    <span className="text-micro bg-danger/10 text-danger px-2.5 py-1 rounded-pill font-semibold">
                      Restricted
                    </span>
                  )}
                </div>

                {/* Card middle: name + description */}
                <div className="flex-1">
                  <h3 className="text-subtitle font-bold font-head text-textPrimary mb-1.5">
                    {card.name}
                  </h3>
                  <p className="text-caption text-textSecondary leading-relaxed">
                    {card.desc}
                  </p>
                </div>

                {/* Card footer: metric + CTA */}
                <div className="mt-5 pt-4 border-t border-black/[0.05] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="label mb-0.5">{card.metricLabel}</p>
                    <p className="text-body font-bold font-mono text-textPrimary">
                      {card.metric ?? <Skeleton w="w-16" h="h-5" />}
                    </p>
                  </div>
                  {isAllowed && (
                    <span className={`cta-pill bg-primary text-white flex-shrink-0 whitespace-nowrap`}>
                      {isMarathi ? 'उघडा' : 'Open'}
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 4. GOOGLE SPREADSHEET QUICK ACCESS ───────────────────────────── */}
      {/* De-emphasized utility section — smallest visual weight */}
      <div className="bg-white rounded-card border border-black/[0.07] shadow-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          <h3 className="text-body font-semibold font-head text-textPrimary">
            {isMarathi ? 'थेट गूगल शीट ॲक्सेस' : 'Google Spreadsheet Access'}
          </h3>
        </div>
        <p className="text-caption text-textSecondary mb-5">
          {isMarathi 
            ? 'तुमच्या गूगल ड्राईव्हमधील संबंधित डेटा शीट्स थेट उघडा.' 
            : 'Directly open the database spreadsheets and registers in Google Drive.'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              emoji: '🥛',
              title: isMarathi ? 'दूध संकलन रजिस्टर' : 'Milk Collections Log',
              desc: isMarathi 
                ? 'शेतकरी दूध संकलन नोंदी आणि प्रलंबित देयके.' 
                : 'All farmer milk entries and outstanding dues.',
              tabName: 'Milk_Collections',
              sheetId: settings?.sheetsIdCollection,
              ctaLabel: isMarathi ? 'शीट उघडा' : 'Open Sheet',
            },
            {
              emoji: '👥',
              title: isMarathi ? 'ग्राहक आणि विक्री रजिस्टर' : 'Customers & Sales Log',
              desc: isMarathi 
                ? 'ग्राहकांची बिले, विक्री इतिहास आणि थकबाकी.' 
                : 'Store balances, invoices and sales history.',
              tabName: 'Sales',
              sheetId: settings?.sheetsIdCustomer,
              ctaLabel: isMarathi ? 'शीट उघडा' : 'Open Sheet',
            },
            {
              emoji: '💸',
              title: isMarathi ? 'खर्च रजिस्टर' : 'Expenses Log',
              desc: isMarathi 
                ? 'सर्व प्रकारच्या व्यावसायिक खर्चाची नोंद.' 
                : 'All operational outlays and expense entries.',
              tabName: 'Expenses',
              sheetId: settings?.sheetsIdExpense,
              ctaLabel: isMarathi ? 'शीट उघडा' : 'Open Sheet',
            },
          ].map((sheet, i) => (
            <div key={i} className="p-4 border border-black/[0.06] rounded-xl bg-background flex flex-col gap-3">
              <div>
                <p className="text-caption font-semibold text-textPrimary mb-1">
                  {sheet.emoji} {sheet.title}
                </p>
                <p className="text-micro text-textSecondary leading-relaxed">{sheet.desc}</p>
                <div className="mt-2 bg-primary/5 border border-primary/10 rounded-lg px-2.5 py-1.5 font-mono text-micro text-primary">
                  {isMarathi ? 'टॅब:' : 'Tab:'} <strong>{sheet.tabName}</strong>
                </div>
              </div>
              {sheet.sheetId ? (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${sheet.sheetId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 bg-primary hover:bg-primary-light text-white text-caption font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
                >
                  {sheet.ctaLabel}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <button disabled className="w-full py-2 bg-black/[0.05] text-textSecondary text-caption font-semibold rounded-xl cursor-not-allowed">
                  {isMarathi ? 'शीट आयडी सेट नाही' : 'Sheet ID not configured'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
export default HomeDashboard;
