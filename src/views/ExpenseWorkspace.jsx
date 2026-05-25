import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { suggestExpenseCategory, generateBusinessInsights } from '../utils/gemini';
import { PlusCircle, Search, Trash2, Calendar, BarChart3, AlertTriangle, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export function ExpenseWorkspace() {
  const { t, i18n } = useTranslation();
  const isMarathi = i18n.language === 'mr';
  const {
    expenses,
    addExpense,
    deleteExpense,
    loading
  } = useAppStore();

  const [activeTab, setActiveTab] = useState('add'); // add, list, monthly, analytics
  const [duplicateWarning, setDuplicateWarning] = useState(null);

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

  // --- SUB-SCREEN 3A: ADD EXPENSE ---
  const AddExpenseForm = () => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [reason, setReason] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('Other');
    const [method, setMethod] = useState('Cash');
    const [notes, setNotes] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);

    // Call Gemini to suggest category on blur of Reason field
    const handleReasonBlur = async () => {
      if (!reason || reason.trim().length < 3) return;
      setIsAiLoading(true);
      try {
        const aiCategory = await suggestExpenseCategory(reason, isMarathi ? 'mr' : 'en');
        // Match response to supported categories
        const categoriesMap = {
          'Fuel': 'Fuel', 'इंधन': 'Fuel',
          'Salary': 'Salary', 'पगार': 'Salary',
          'Packaging': 'Packaging', 'पॅकेजिंग': 'Packaging',
          'Electricity': 'Electricity', 'वीज': 'Electricity',
          'Transport': 'Transport', 'वाहतूक': 'Transport',
          'Maintenance': 'Maintenance', 'देखभाल': 'Maintenance',
          'Supplies': 'Supplies', 'साहित्य': 'Supplies',
          'Marketing': 'Marketing', 'मार्केटिंग': 'Marketing',
          'Other': 'Other', 'इतर': 'Other'
        };
        const mapped = categoriesMap[aiCategory] || 'Other';
        setCategory(mapped);
        toast.success(isMarathi ? `AI ने वर्ग सुचवला: ${t(`expense.cat.${mapped.toLowerCase()}`)}` : `AI suggested category: ${mapped}`);
      } catch (err) {
        console.error(err);
      } finally {
        setIsAiLoading(false);
      }
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!reason || !amount || parseFloat(amount) <= 0) return;

      const amtVal = parseFloat(amount);
      const expenseData = { date, reason, amount: amtVal, category, payment_method: method, notes };

      // Duplicate check: Same Date + Same Amount + Similar Reason
      const isDuplicate = expenses.some(exp => 
        exp.date === date && 
        exp.amount === amtVal && 
        exp.reason.toLowerCase().trim() === reason.toLowerCase().trim()
      );

      if (isDuplicate) {
        setDuplicateWarning(expenseData);
        return;
      }

      await save(expenseData);
    };

    const save = async (data) => {
      const success = await addExpense(data);
      if (success) {
        setReason('');
        setAmount('');
        setNotes('');
        setCategory('Other');
        setMethod('Cash');
        setDuplicateWarning(null);
      }
    };

    // Calculate today's total expenses from cache
    const today = new Date().toISOString().split('T')[0];
    const todayTotal = expenses
      .filter(e => e.date === today)
      .reduce((sum, e) => sum + e.amount, 0);

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-black/[0.08] shadow-subtle space-y-6">
          <h3 className="text-lg font-bold font-head text-primary border-b border-black/[0.04] pb-4 flex items-center space-x-2">
            <PlusCircle className="w-5 h-5" />
            <span>{t('expense.addExpense')}</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-textSecondary mb-2">{t('label.date')}</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-textSecondary mb-2">{t('label.amount')}</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter expense ₹"
                  className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background font-mono font-bold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-2">
                {t('expense.reason')} *
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onBlur={handleReasonBlur}
                placeholder={isMarathi ? 'खर्चाचे सविस्तर वर्णन लिहा' : 'e.g. Tanker Diesel Refill, dry fodder...'}
                className="w-full px-3 py-2.5 border border-black/[0.08] rounded-xl text-sm bg-background"
                required
              />
              <span className="text-[10px] text-textSecondary mt-1 block">
                {isMarathi ? 'टीप: कारण लिहून बाजूला क्लिक केल्यास AI आपोआप वर्ग निवडेल.' : 'Tip: Focus out to trigger AI category suggestions.'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-textSecondary mb-2 flex items-center space-x-1">
                  <span>{t('expense.category')}</span>
                  {isAiLoading && <span className="text-[9px] text-primary animate-pulse flex items-center"><Sparkles className="w-3 h-3 mr-0.5" /> {t('expense.aiCategory')}</span>}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 border border-black/[0.08] rounded-xl text-sm bg-background font-semibold"
                >
                  <option value="Fuel">{t('expense.cat.fuel')}</option>
                  <option value="Salary">{t('expense.cat.salary')}</option>
                  <option value="Packaging">{t('expense.cat.packaging')}</option>
                  <option value="Electricity">{t('expense.cat.electricity')}</option>
                  <option value="Transport">{t('expense.cat.transport')}</option>
                  <option value="Maintenance">{t('expense.cat.maintenance')}</option>
                  <option value="Supplies">{t('expense.cat.supplies')}</option>
                  <option value="Marketing">{t('expense.cat.marketing')}</option>
                  <option value="Other">{t('expense.cat.other')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-textSecondary mb-2">{t('expense.paymentMethod')}</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-3 py-2.5 border border-black/[0.08] rounded-xl text-sm bg-background font-semibold"
                >
                  <option value="Cash">{t('expense.cash')}</option>
                  <option value="UPI">{t('expense.upi')}</option>
                  <option value="Bank Transfer">{t('expense.bank')}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-2">{t('expense.notes')}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-background h-20"
              />
            </div>

            <button
              type="submit"
              disabled={loading || isAiLoading}
              className="w-full py-3 bg-primary hover:bg-primary-light text-white font-bold rounded-xl transition-all cursor-pointer mt-4"
            >
              {t('expense.addExpense')}
            </button>
          </form>

          {/* Today's running total banner */}
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex justify-between items-center text-xs font-semibold">
            <span className="text-primary">{t('expense.todayTotal')}:</span>
            <span className="text-base font-bold font-mono text-primary">{formatCurrency(todayTotal)}</span>
          </div>
        </div>

        {/* Duplicate Warning Dialog Modal */}
        {duplicateWarning && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-black/[0.08] shadow-2xl space-y-6">
              <div className="flex items-center space-x-3 text-accent">
                <AlertTriangle className="w-8 h-8" />
                <h3 className="text-base font-bold font-head text-textPrimary">
                  {isMarathi ? 'एकसमान नोंद आधीच अस्तित्वात आहे' : 'Duplicate Record Alert'}
                </h3>
              </div>
              <p className="text-xs text-textSecondary leading-relaxed">
                {isMarathi 
                  ? `तारीख: ${formatDate(duplicateWarning.date)} आणि रक्कम: ${formatCurrency(duplicateWarning.amount)} ची हुबेहूब नोंद सापडली आहे. तरीही ही नोंद जतन करायची का?`
                  : `A matching expense entry for ₹${duplicateWarning.amount} on ${formatDate(duplicateWarning.date)} already exists. Save this duplicates anyway?`}
              </p>
              <div className="flex space-x-3 justify-end text-xs">
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="px-4 py-2 border border-black/[0.08] rounded-xl font-semibold text-textSecondary hover:bg-black/[0.02]"
                >
                  {t('btn.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => save(duplicateWarning)}
                  className="px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-xl font-semibold"
                >
                  {isMarathi ? 'होय, जतन करा' : 'Yes, Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- SUB-SCREEN 3B: TODAY'S EXPENSES ---
  const TodayExpenses = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayList = expenses.filter(e => e.date === today);

    const handleConfirmDelete = async (id) => {
      await deleteExpense(id);
    };

    return (
      <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-4">
        <h4 className="text-sm font-bold text-textPrimary uppercase tracking-wider border-b border-black/[0.04] pb-4">
          {t('expense.todayExpenses')}
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-black/[0.08] bg-background">
                <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Reason</th>
                <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Category</th>
                <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Method</th>
                <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase">Amount</th>
                <th className="py-2.5 px-4 font-semibold text-textSecondary uppercase text-center">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {todayList.map((e) => (
                <tr key={e.expense_id} className="hover:bg-black/[0.01]">
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-textPrimary">{e.reason}</p>
                    {e.notes && <p className="text-[10px] text-textSecondary mt-0.5 italic">{e.notes}</p>}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-semibold bg-accent/5 text-accent border border-accent/10">
                      {t(`expense.cat.${e.category.toLowerCase()}`)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-textSecondary">{e.payment_method}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-textPrimary">{formatCurrency(e.amount)}</td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => handleConfirmDelete(e.expense_id)}
                      className="p-1 text-danger hover:bg-danger/5 rounded cursor-pointer"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {todayList.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-textSecondary">
                    {isMarathi ? 'आज कोणताही खर्च नोंदवला नाही' : 'No expenses recorded today.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- SUB-SCREEN 3C: MONTHLY VIEW ---
  const MonthlyView = () => {
    // Group expenses by date
    const dateGroups = expenses.reduce((groups, exp) => {
      const d = exp.date;
      if (!groups[d]) groups[d] = [];
      groups[d].push(exp);
      return groups;
    }, {});

    const sortedDates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a));
    const thisMonthTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

    return (
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-black/[0.08] shadow-subtle flex justify-between items-center">
          <div>
            <p className="text-[10px] text-textSecondary font-bold uppercase tracking-wider">{t('expense.monthlyTotal')}</p>
            <p className="text-xl font-bold font-mono text-primary mt-1">{formatCurrency(thisMonthTotal)}</p>
          </div>
          <Calendar className="w-8 h-8 text-primary opacity-20" />
        </div>

        <div className="space-y-4">
          {sortedDates.map((dateKey) => {
            const dayList = dateGroups[dateKey];
            const dayTotal = dayList.reduce((sum, e) => sum + e.amount, 0);

            return (
              <details
                key={dateKey}
                className="group bg-white rounded-xl border border-black/[0.06] shadow-subtle [&_summary::-webkit-details-marker]:hidden overflow-hidden"
              >
                <summary className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-background/50 select-none">
                  <div className="flex items-center space-x-4">
                    <span className="font-bold text-sm text-textPrimary font-mono">{formatDate(dateKey)}</span>
                    <span className="text-[10px] text-textSecondary">({dayList.length} items)</span>
                  </div>
                  <div className="flex items-center space-x-3 font-semibold text-sm">
                    <span className="font-mono text-textPrimary">{formatCurrency(dayTotal)}</span>
                    <span className="transition group-open:-rotate-180">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </span>
                  </div>
                </summary>
                
                <div className="px-6 pb-4 border-t border-black/[0.04] bg-background/25 divide-y divide-black/[0.04]">
                  {dayList.map(item => (
                    <div key={item.expense_id} className="py-3 flex justify-between text-xs items-center">
                      <div>
                        <p className="font-bold text-textPrimary">{item.reason}</p>
                        <span className="px-2 py-0.5 text-[9px] bg-accent/5 text-accent border border-accent/10 rounded-full font-semibold inline-block mt-1">
                          {t(`expense.cat.${item.category.toLowerCase()}`)}
                        </span>
                      </div>
                      <span className="font-mono font-bold">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    );
  };

  // --- SUB-SCREEN 3D: ANALYTICS ---
  const AnalyticsView = () => {
    const [aiInsight, setAiInsight] = useState('');
    const [loadingInsight, setLoadingInsight] = useState(false);

    // Group expenses by category for pie chart
    const catGroups = expenses.reduce((groups, exp) => {
      const c = exp.category || 'Other';
      groups[c] = (groups[c] || 0) + exp.amount;
      return groups;
    }, {});

    const pieData = Object.keys(catGroups).map(c => ({
      name: t(`expense.cat.${c.toLowerCase()}`),
      value: catGroups[c]
    }));

    // Group expenses by date for bar chart (last 30 days)
    const dailyGroups = expenses.reduce((groups, exp) => {
      const d = exp.date.split('-')[2]; // day number
      groups[d] = (groups[d] || 0) + exp.amount;
      return groups;
    }, {});

    const barData = Object.keys(dailyGroups).map(d => ({
      day: d,
      amount: dailyGroups[d]
    })).sort((a,b) => parseInt(a.day) - parseInt(b.day));

    // Fetch Gemini AI insight for expenses
    const handleLoadInsight = async () => {
      setLoadingInsight(true);
      try {
        const insights = await generateBusinessInsights(expenses, isMarathi ? 'mr' : 'en');
        setAiInsight(insights[0] || 'Expenses are optimal.');
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingInsight(false);
      }
    };

    useEffect(() => {
      handleLoadInsight();
    }, []);

    const COLORS = ['#0F6E56', '#854F0B', '#993C1D', '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#6B7280'];

    return (
      <div className="space-y-6">
        {/* AI Insight banner */}
        <div className="bg-primary text-white rounded-2xl p-6 border border-primary/20 shadow-lg space-y-2 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 rounded-full bg-white/5" />
          <h4 className="text-xs font-bold uppercase tracking-wider opacity-85 flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-accent-light" />
            <span>AI Expense Advisor</span>
          </h4>
          <p className="text-sm font-semibold leading-relaxed">
            {loadingInsight ? 'Advisor reading trends...' : aiInsight}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Category Pie Chart */}
          <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-4">
            <h4 className="text-xs font-bold text-textSecondary uppercase tracking-widest">
              {isMarathi ? 'वर्गांनुसार खर्चाचे प्रमाण' : 'Outlays by Category'}
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily Expense Bar Chart */}
          <div className="bg-white rounded-2xl p-6 border border-black/[0.08] shadow-subtle space-y-4">
            <h4 className="text-xs font-bold text-textSecondary uppercase tracking-widest">
              {isMarathi ? 'दैनिक खर्च आलेख' : 'Daily Expenditure Graph'}
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <XAxis dataKey="day" stroke="#5F5E5A" fontSize={10} tickLine={false} />
                  <YAxis stroke="#5F5E5A" fontSize={10} tickFormatter={(v) => `₹${v}`} tickLine={false} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="amount" fill="#0F6E56" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 font-body">
      {/* Workspace Tabs */}
      <div className="flex border-b border-black/[0.08] overflow-x-auto whitespace-nowrap scrollbar-none gap-2">
        <button
          onClick={() => setActiveTab('add')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'add' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {t('expense.addExpense')}
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'list' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {t('expense.todayExpenses')}
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'monthly' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {t('expense.monthlyView')}
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'analytics' ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          {t('expense.analytics')}
        </button>
      </div>

      {/* View router */}
      <div>
        {activeTab === 'add' && <AddExpenseForm />}
        {activeTab === 'list' && <TodayExpenses />}
        {activeTab === 'monthly' && <MonthlyView />}
        {activeTab === 'analytics' && <AnalyticsView />}
      </div>
    </div>
  );
}
export default ExpenseWorkspace;
