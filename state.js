const CATEGORIES = [
  { id: 'food', label: 'Food', color: '#f97316', icon: '🍔' },
  { id: 'transport', label: 'Transport', color: '#3b82f6', icon: '🚗' },
  { id: 'shopping', label: 'Shopping', color: '#ec4899', icon: '🛍️' },
  { id: 'bills', label: 'Bills', color: '#8b5cf6', icon: '📄' },
  { id: 'education', label: 'Education', color: '#6366f1', icon: '📚' },
  { id: 'healthcare', label: 'Healthcare', color: '#ef4444', icon: '❤️' },
  { id: 'entertainment', label: 'Entertainment', color: '#f59e0b', icon: '🎬' },
  { id: 'rent', label: 'Rent', color: '#14b8a6', icon: '🏠' },
  { id: 'savings', label: 'Savings', color: '#10b981', icon: '💰' },
  { id: 'other', label: 'Other', color: '#6b7280', icon: '📦' }
];

const CATEGORY_MAP = CATEGORIES.reduce((m, c) => { m[c.id] = c; return m; }, {});

const DEFAULT_STATE = {
  incomes: [],
  expenses: [],
  budgets: {},
  settings: {
    currency: '$',
    darkMode: false,
    month: null
  }
};

const Store = {
  state: null,
  _listeners: {},

  init() {
    this._load();
    this._ensureSettings();
    this._emit('change');
  },

  _load() {
    try {
      const saved = localStorage.getItem('expenseTrackerV2');
      if (saved) {
        this.state = JSON.parse(saved);
        return;
      }
    } catch (e) { /* ignore */ }
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  },

  _save() {
    try {
      localStorage.setItem('expenseTrackerV2', JSON.stringify(this.state));
    } catch (e) { /* ignore */ }
  },

  _ensureSettings() {
    if (!this.state.settings) this.state.settings = { ...DEFAULT_STATE.settings };
    if (!this.state.budgets) this.state.budgets = {};
    if (!this.state.incomes) this.state.incomes = [];
    if (!this.state.expenses) this.state.expenses = [];
  },

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => {
      this._listeners[event] = this._listeners[event].filter(f => f !== fn);
    };
  },

  _emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  },

  getState() {
    return this.state;
  },

  getSetting(key) {
    return this.state.settings[key];
  },

  updateSetting(key, value) {
    this.state.settings[key] = value;
    this._save();
    this._emit('change');
    this._emit('setting:' + key, value);
  },

  // --- Income ---
  addIncome(data) {
    const income = {
      id: Utils.generateId(),
      source: data.source.trim(),
      amount: parseFloat(data.amount),
      date: data.date || Utils.today()
    };
    this.state.incomes.push(income);
    this._save();
    this._emit('change');
    return income;
  },

  updateIncome(id, data) {
    const idx = this.state.incomes.findIndex(i => i.id === id);
    if (idx === -1) return null;
    const updated = { ...this.state.incomes[idx] };
    if (data.source !== undefined) updated.source = data.source.trim();
    if (data.amount !== undefined) updated.amount = parseFloat(data.amount);
    if (data.date !== undefined) updated.date = data.date;
    this.state.incomes[idx] = updated;
    this._save();
    this._emit('change');
    return updated;
  },

  deleteIncome(id) {
    this.state.incomes = this.state.incomes.filter(i => i.id !== id);
    this._save();
    this._emit('change');
  },

  getIncomes() {
    return [...this.state.incomes];
  },

  getTotalIncome() {
    return this.state.incomes.reduce((s, i) => s + i.amount, 0);
  },

  // --- Expenses ---
  addExpense(data) {
    const expense = {
      id: Utils.generateId(),
      desc: data.desc.trim(),
      amount: parseFloat(data.amount),
      category: data.category || 'other',
      date: data.date || Utils.today(),
      note: data.note || ''
    };
    this.state.expenses.push(expense);
    this._save();
    this._emit('change');
    this._checkBudgets(expense.category);
    return expense;
  },

  updateExpense(id, data) {
    const idx = this.state.expenses.findIndex(e => e.id === id);
    if (idx === -1) return null;
    const updated = { ...this.state.expenses[idx] };
    if (data.desc !== undefined) updated.desc = data.desc.trim();
    if (data.amount !== undefined) updated.amount = parseFloat(data.amount);
    if (data.category !== undefined) updated.category = data.category;
    if (data.date !== undefined) updated.date = data.date;
    if (data.note !== undefined) updated.note = data.note;
    this.state.expenses[idx] = updated;
    this._save();
    this._emit('change');
    return updated;
  },

  deleteExpense(id) {
    this.state.expenses = this.state.expenses.filter(e => e.id !== id);
    this._save();
    this._emit('change');
  },

  getExpenses() {
    return [...this.state.expenses];
  },

  getExpensesByMonth(monthKey) {
    return this.state.expenses.filter(e => {
      const mk = e.date.slice(0, 7);
      return mk === monthKey;
    });
  },

  getTotalExpenses() {
    return this.state.expenses.reduce((s, e) => s + e.amount, 0);
  },

  // --- Computed ---
  getBalance() {
    return this.getTotalIncome() - this.getTotalExpenses();
  },

  getSpendingPct() {
    const totalInc = this.getTotalIncome();
    if (totalInc === 0) return 0;
    return Math.min(this.getTotalExpenses() / totalInc, 1);
  },

  getExpensesByCategory() {
    const grouped = {};
    this.state.expenses.forEach(e => {
      grouped[e.category] = (grouped[e.category] || 0) + e.amount;
    });
    return Object.entries(grouped)
      .map(([cat, total]) => ({ category: cat, total, label: CATEGORY_MAP[cat]?.label || cat }))
      .sort((a, b) => b.total - a.total);
  },

  getIncomeVsExpenseByMonth() {
    const months = {};
    this.state.incomes.forEach(i => {
      const mk = i.date.slice(0, 7);
      if (!months[mk]) months[mk] = { income: 0, expense: 0 };
      months[mk].income += i.amount;
    });
    this.state.expenses.forEach(e => {
      const mk = e.date.slice(0, 7);
      if (!months[mk]) months[mk] = { income: 0, expense: 0 };
      months[mk].expense += e.amount;
    });
    return Object.entries(months)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({ month, ...data }));
  },

  getDailyTotals(days) {
    const totals = {};
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      totals[key] = 0;
    }
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    const startStr = start.toISOString().slice(0, 10);
    this.state.expenses.forEach(e => {
      if (e.date >= startStr && totals[e.date] !== undefined) {
        totals[e.date] += e.amount;
      }
    });
    return Object.entries(totals).map(([date, amount]) => ({ date, amount }));
  },

  getWeeklyComparison() {
    const now = new Date();
    const currWeek = this._getWeekExpenses(now);
    const prevWeek = this._getWeekExpenses(new Date(now.getTime() - 7 * 86400000));
    return { current: currWeek, previous: prevWeek };
  },

  _getWeekExpenses(date) {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    return this.state.expenses
      .filter(e => e.date >= startStr && e.date < endStr)
      .reduce((s, e) => s + e.amount, 0);
  },

  getSavingsTotal() {
    return this.state.expenses
      .filter(e => e.category === 'savings')
      .reduce((s, e) => s + e.amount, 0);
  },

  getSavingsRate() {
    const inc = this.getTotalIncome();
    if (inc === 0) return 0;
    return this.getSavingsTotal() / inc;
  },

  // --- Budgets ---
  getBudget(category) {
    return this.state.budgets[category] || 0;
  },

  setBudget(category, amount) {
    this.state.budgets[category] = parseFloat(amount) || 0;
    this._save();
    this._emit('change');
  },

  getAllBudgets() {
    return { ...this.state.budgets };
  },

  getBudgetStatus(category) {
    const budget = this.getBudget(category);
    if (budget <= 0) return null;
    const spent = this.state.expenses
      .filter(e => e.category === category)
      .reduce((s, e) => s + e.amount, 0);
    const pct = spent / budget;
    return { budget, spent, remaining: budget - spent, pct, over: spent > budget };
  },

  _checkBudgets(category) {
    const status = this.getBudgetStatus(category);
    if (status && status.over) {
      this._emit('budgetOver', { category, ...status });
    }
  },

  // --- Data management ---
  exportData() {
    return JSON.stringify(this.state, null, 2);
  },

  importData(json) {
    try {
      const data = JSON.parse(json);
      if (!data.incomes || !data.expenses) throw new Error('Invalid format');
      this.state = data;
      this._ensureSettings();
      this._save();
      this._emit('change');
      return true;
    } catch (e) {
      return false;
    }
  },

  resetData() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this._save();
    this._emit('change');
  },

  exportCSV() {
    const headers = 'Date,Description,Category,Amount,Notes\n';
    const rows = this.state.expenses
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(e => {
        const cat = CATEGORY_MAP[e.category]?.label || e.category;
        return `${e.date},"${e.desc}",${cat},${e.amount.toFixed(2)},"${(e.note || '').replace(/"/g, '""')}"`;
      })
      .join('\n');
    return headers + rows;
  }
};
