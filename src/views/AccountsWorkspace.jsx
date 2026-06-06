import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { generateBusinessInsights } from '../utils/gemini';
import { Sparkles, RefreshCw, BarChart3, LineChart as LineChartIcon, Table } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, BarChart, Bar, Cell, ReferenceLine } from 'recharts';

export function AccountsWorkspace() {
  const { t, i18n } = useTranslation();
  const isMarathi = i18n.language === 'mr';
  const {
    todaySummary,
    cashFlow,
    sales,
    collections,
    expenses
  } = useAppStore();

  const [activeTab, setActiveTab] = useState('financials'); // financials, charts, insights, cashflow
  const [aiInsightsList, setAiInsightsList] = useState([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat(isMarathi ? 'mr-IN' : 'en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDate = (dateStr) => {
    const localDate = new Date(String(dateStr).replace(/-/g, '/'));
    return new Intl.DateTimeFormat(isMarathi ? 'mr-IN' : 'en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    }).format(localDate);
  };

  // Fetch AI Financial Insights
  const loadAIInsights = async () => {
    setLoadingInsights(true);
    try {
      const summaryPayload = {
        todaySummary,
        cashFlowSample: cashFlow.slice(0, 5),
        recentSalesCount: sales.length,
        recentExpensesCount: expenses.length,
        recentCollectionsCount: collections.length
      };

      const insights = await generateBusinessInsights(summaryPayload, isMarathi ? 'mr' : 'en');
      setAiInsightsList(insights);
      toast.success(isMarathi ? 'AI अंतर्दृष्टी अद्ययावत केली!' : 'AI Insights updated!');
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInsights(false);
    }
  };

  return (
    <div className="space-y-6 font-body">
      {/* Tabs */}
      <div className="flex border-b border-black/[0.08] overflow-x-auto whitespace-nowrap scrollbar-none gap-2">
        <button
          onClick={() => setActiveTab('financials')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'financials' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {isMarathi ? 'वित्तीय आढावा' : 'Overview'}
        </button>
        <button
          onClick={() => setActiveTab('charts')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'charts' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {isMarathi ? 'आलेख' : 'Charts'}
        </button>
        <button
          onClick={() => {
            setActiveTab('insights');
            if (aiInsightsList.length === 0) {
              loadAIInsights();
            }
          }}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'insights' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {isMarathi ? 'AI सल्ला' : 'AI Advisor'}
        </button>
        <button
          onClick={() => setActiveTab('cashflow')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'cashflow' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {isMarathi ? 'रोख प्रवाह' : 'Cash Flow'}
        </button>
      </div>

      {/* Workspace Router */}
      <div>
        {activeTab === 'financials' && (
          <FinancialOverview
            todaySummary={todaySummary}
            formatCurrency={formatCurrency}
            t={t}
          />
        )}
        {activeTab === 'charts' && (
          <ChartsSection
            cashFlow={cashFlow}
            formatCurrency={formatCurrency}
            t={t}
          />
        )}
        {activeTab === 'insights' && (
          <AIFinancialInsights
            aiInsightsList={aiInsightsList}
            loadingInsights={loadingInsights}
            loadAIInsights={loadAIInsights}
            t={t}
            isMarathi={isMarathi}
          />
        )}
        {activeTab === 'cashflow' && (
          <CashFlowStatement
            cashFlow={cashFlow}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            t={t}
            isMarathi={isMarathi}
          />
        )}
      </div>
    </div>
  );
}

// --- SUB-SCREEN 4A: FINANCIAL OVERVIEW ---
function FinancialOverview({ todaySummary, formatCurrency, t }) {
  return (
    <div className="space-y-6">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle">
          <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">{t('accounts.revenue')}</p>
          <p className="text-xl font-bold font-mono text-textPrimary mt-1">{formatCurrency(todaySummary.revenueToday)}</p>
          <span className="text-[9px] text-primary font-medium mt-1 inline-block">Today Sales</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle">
          <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">{t('accounts.expenses')}</p>
          <p className="text-xl font-bold font-mono text-textPrimary mt-1">
            {formatCurrency(todaySummary.farmerPaymentsToday + todaySummary.opExpensesToday)}
          </p>
          <span className="text-[9px] text-danger font-medium mt-1 inline-block">Farmers + Ops today</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle">
          <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">{t('accounts.pendingDues')}</p>
          <p className="text-xl font-bold font-mono text-accent mt-1">{formatCurrency(todaySummary.pendingDues)}</p>
          <span className="text-[9px] text-accent font-medium mt-1 inline-block">Receivable ledger</span>
        </div>

        <div className={`p-5 rounded-2xl border shadow-subtle ${
          todaySummary.netProfit >= 0 ? 'bg-primary/5 border-primary/20' : 'bg-danger/5 border-danger/20'
        }`}>
          <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">{t('accounts.netProfit')}</p>
          <p className={`text-xl font-bold font-mono mt-1 ${
            todaySummary.netProfit >= 0 ? 'text-primary' : 'text-danger'
          }`}>{formatCurrency(todaySummary.netProfit)}</p>
          <span className="text-[9px] text-textSecondary font-medium mt-1 inline-block">Cash-basis net profit</span>
        </div>
      </div>

      {/* Source Breakdown Row */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-4">
        <h4 className="text-xs font-bold text-textSecondary uppercase tracking-widest">Source breakdown (ताळेबंद स्त्रोत)</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 border border-black/[0.04] rounded-xl bg-background">
            <p className="text-[10px] text-textSecondary font-bold uppercase">{t('accounts.farmerPayments')}</p>
            <p className="text-lg font-bold font-mono text-textPrimary mt-1">{formatCurrency(todaySummary.farmerPaymentsToday)}</p>
            <p className="text-[10px] text-textSecondary mt-2">Payouts made to farmers for collections.</p>
          </div>

          <div className="p-4 border border-black/[0.04] rounded-xl bg-background">
            <p className="text-[10px] text-textSecondary font-bold uppercase">{t('accounts.customerSales')}</p>
            <p className="text-lg font-bold font-mono text-textPrimary mt-1">{formatCurrency(todaySummary.revenueToday)}</p>
            <p className="text-[10px] text-textSecondary mt-2">Billed invoices for retail product purchases.</p>
          </div>

          <div className="p-4 border border-black/[0.04] rounded-xl bg-background">
            <p className="text-[10px] text-textSecondary font-bold uppercase">{t('accounts.operationalExp')}</p>
            <p className="text-lg font-bold font-mono text-textPrimary mt-1">{formatCurrency(todaySummary.opExpensesToday)}</p>
            <p className="text-[10px] text-textSecondary mt-2">Salaries, packaging, fuel, electric outlays.</p>
          </div>
        </div>
      </div>

      {/* Profit Equation Panel */}
      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 text-center text-xs text-primary font-semibold space-y-2">
        <p className="uppercase tracking-wider text-[10px]">Net Profit Equation (नफा मोजण्याचे सूत्र)</p>
        <p className="text-sm font-bold font-mono text-textPrimary">
          Net Profit ({formatCurrency(todaySummary.netProfit)}) = Customer Sales ({formatCurrency(todaySummary.revenueToday)}) − Farmer Payments ({formatCurrency(todaySummary.farmerPaymentsToday)}) − Operational Expenses ({formatCurrency(todaySummary.opExpensesToday)})
        </p>
      </div>
    </div>
  );
}

// --- SUB-SCREEN 4B: CHARTS SECTION ---
function ChartsSection({ cashFlow, formatCurrency, t }) {
  // Process revenue vs expenses chart (last 30 days)
  const chartData = cashFlow.map(cf => ({
    date: cf.date.split('-')[2], // day number
    Revenue: cf.cash_in,
    Expenses: cf.cash_out,
    Profit: cf.cash_in - cf.cash_out
  })).reverse();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Expenses dual line */}
        <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-4">
          <h4 className="text-xs font-bold text-textSecondary uppercase tracking-widest flex items-center space-x-1.5">
            <LineChartIcon className="w-4 h-4 text-primary" />
            <span>{t('accounts.revenueVsExp')}</span>
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" stroke="#5F5E5A" fontSize={10} tickLine={false} />
                <YAxis stroke="#5F5E5A" fontSize={10} tickFormatter={(v) => `₹${v}`} tickLine={false} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend verticalAlign="top" height={36} />
                <Line type="monotone" dataKey="Revenue" stroke="#0F6E56" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Expenses" stroke="#993C1D" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Profit/Loss Bar Chart */}
        <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-4">
          <h4 className="text-xs font-bold text-textSecondary uppercase tracking-widest flex items-center space-x-1.5">
            <BarChart3 className="w-4 h-4 text-accent" />
            <span>{t('accounts.profitLoss')}</span>
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="date" stroke="#5F5E5A" fontSize={10} tickLine={false} />
                <YAxis stroke="#5F5E5A" fontSize={10} tickFormatter={(v) => `₹${v}`} tickLine={false} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <ReferenceLine y={0} stroke="#E5E7EB" />
                <Bar dataKey="Profit" fill="#0F6E56" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.Profit >= 0 ? '#0F6E56' : '#993C1D'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- SUB-SCREEN 4C: AI FINANCIAL INSIGHTS ---
function AIFinancialInsights({
  aiInsightsList,
  loadingInsights,
  loadAIInsights,
  t,
  isMarathi
}) {
  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-black/[0.08] shadow-subtle space-y-6">
      <div className="flex justify-between items-center border-b border-black/[0.04] pb-4">
        <h3 className="text-sm font-bold text-textPrimary uppercase tracking-wider flex items-center space-x-2">
          <Sparkles className="w-4.5 h-4.5 text-accent" />
          <span>{t('accounts.aiInsights')}</span>
        </h3>
        <button
          onClick={loadAIInsights}
          disabled={loadingInsights}
          className="flex items-center space-x-1.5 px-3 py-1.5 border border-primary/20 hover:border-primary/50 text-primary text-xs font-bold rounded-lg bg-primary/5 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingInsights ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loadingInsights ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-xs text-textSecondary animate-pulse">
            {isMarathi ? 'AI आर्थिक अहवालाचा अभ्यास करत आहे...' : 'Gemini is auditing spreadsheet journals...'}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {aiInsightsList.map((insight, idx) => (
            <li
              key={idx}
              className="p-4 rounded-xl border border-black/[0.04] bg-background text-xs font-semibold leading-relaxed text-textPrimary flex items-start space-x-3 hover:border-primary/20 transition-all"
            >
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 font-bold font-mono">
                {idx + 1}
              </span>
              <span className="pt-0.5">{insight.replace(/^•\s*/, '')}</span>
            </li>
          ))}
          {aiInsightsList.length === 0 && (
            <p className="text-xs text-textSecondary text-center py-6">
              Click Refresh to generate business insights.
            </p>
          )}
        </ul>
      )}
    </div>
  );
}

// --- SUB-SCREEN 4D: CASH FLOW STATEMENT ---
function CashFlowStatement({
  cashFlow,
  formatCurrency,
  formatDate,
  t,
  isMarathi
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-4">
      <h4 className="text-sm font-bold text-textPrimary uppercase tracking-wider border-b border-black/[0.04] pb-4 flex items-center space-x-1.5">
        <Table className="w-4 h-4 text-primary" />
        <span>{t('accounts.cashFlow')}</span>
      </h4>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-black/[0.08] bg-background font-semibold text-textSecondary uppercase">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">{t('accounts.openingBal')}</th>
              <th className="py-3 px-4 text-primary">{t('accounts.cashIn')} (Sales)</th>
              <th className="py-3 px-4 text-danger">{t('accounts.cashOut')} (Exp/Col)</th>
              <th className="py-3 px-4">{t('accounts.closingBal')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04] font-mono">
            {cashFlow.map((cf, idx) => (
              <tr key={idx} className="hover:bg-black/[0.01] text-textPrimary">
                <td className="py-3.5 px-4 font-body">{formatDate(cf.date)}</td>
                <td className="py-3.5 px-4">{formatCurrency(cf.opening_balance)}</td>
                <td className="py-3.5 px-4 text-primary font-bold">+{formatCurrency(cf.cash_in)}</td>
                <td className="py-3.5 px-4 text-danger font-bold">-{formatCurrency(cf.cash_out)}</td>
                <td className="py-3.5 px-4 font-bold">{formatCurrency(cf.closing_balance)}</td>
              </tr>
            ))}
            {cashFlow.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-textSecondary font-body">
                  {isMarathi ? 'रोख प्रवाहाची आकडेवारी उपलब्ध नाही' : 'No cashflow transactions recorded.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AccountsWorkspace;
