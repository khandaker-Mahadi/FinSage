const App = {
  currentPage: 'dashboard',
  editId: null,
  editType: null,

  init() {
    Store.on('change', () => this.render());
    Store.on('budgetOver', (data) => {
      const cat = CATEGORY_MAP[data.category]?.label || data.category;
      this.showToast(`Overspent ${cat} budget! Limit: ${Utils.formatCurrency(data.budget)}, Spent: ${Utils.formatCurrency(data.spent)}`, 'warning');
    });
    Store.init();
    this._setupNavigation();
    this._setupTheme();
    this._populateCategories();
    this._populateFilterCategories();
    this._setupFilterListeners();
    this._setupResizeHandler();
    document.getElementById('incomeDate').value = Utils.today();
    document.getElementById('expenseDate').value = Utils.today();
    this.render();
    this._applyTheme();
  },

  _setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        item.classList.add('active');
        document.getElementById('page-' + page).classList.add('active');
        this.currentPage = page;

        const titles = { dashboard: 'Dashboard', income: 'Income', expenses: 'Expenses', analytics: 'Analytics', settings: 'Settings' };
        document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';

        if (page === 'dashboard' || page === 'analytics') {
          setTimeout(() => this._drawCharts(page), 100);
        }
        if (page === 'settings') {
          this._renderSettings();
        }
      });
    });
  },

  _setupTheme() {
    const saved = Store.getSetting('darkMode');
    if (saved) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.setAttribute('data-theme', 'light');
    document.getElementById('darkModeToggle').classList.toggle('active', saved);

    document.getElementById('themeToggle').addEventListener('click', () => this.toggleDarkMode());
  },

  _applyTheme() {
    const dark = Store.getSetting('darkMode');
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.getElementById('darkModeToggle').classList.toggle('active', dark);
    document.getElementById('currencySelect').value = Store.getSetting('currency') || '$';
  },

  toggleDarkMode() {
    const dark = !Store.getSetting('darkMode');
    Store.updateSetting('darkMode', dark);
    this._applyTheme();
    setTimeout(() => this._drawAllCharts(), 150);
  },

  updateCurrency(val) {
    Store.updateSetting('currency', val);
    this.render();
  },

  _populateCategories() {
    const sel = document.getElementById('expenseCategory');
    sel.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
  },

  _populateFilterCategories() {
    const sel = document.getElementById('expenseFilterCat');
    sel.innerHTML = '<option value="">All Categories</option>' +
      CATEGORIES.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
  },

  _setupFilterListeners() {
    const debouncedRender = Utils.debounce(() => this.renderExpenses(), 250);
    ['expenseSearch', 'expenseFilterCat', 'expenseFilterFrom', 'expenseFilterTo'].forEach(id => {
      document.getElementById(id).addEventListener('input', debouncedRender);
      document.getElementById(id).addEventListener('change', debouncedRender);
    });
  },

  _setupResizeHandler() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this._drawAllCharts(), 250);
    });
  },

  _drawAllCharts() {
    this._drawCharts('dashboard');
    this._drawCharts('analytics');
  },

  _drawCharts(page) {
    if (page === 'dashboard') {
      setTimeout(() => {
        const canvas = document.getElementById('donutChart');
        if (canvas) Charts.drawDonut(canvas, Store.getSpendingPct());

        const trendCanvas = document.getElementById('trendChart');
        if (trendCanvas) {
          const trendData = Store.getDailyTotals(7);
          Charts.drawLineChart(trendCanvas, trendData);
        }
      }, 50);
    }
    if (page === 'analytics') {
      setTimeout(() => {
        const pieCanvas = document.getElementById('pieChart');
        if (pieCanvas) {
          const catData = Store.getExpensesByCategory();
          Charts.drawCategoryPie(pieCanvas, catData);
        }

        const compCanvas = document.getElementById('comparisonChart');
        if (compCanvas) {
          const data = Store.getIncomeVsExpenseByMonth();
          const labels = data.map(d => {
            const parts = d.month.split('-');
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            return months[parseInt(parts[1]) - 1];
          });
          const incomeData = data.map(d => d.income);
          const expenseData = data.map(d => d.expense);
          Charts.drawGroupedBars(compCanvas, [incomeData, expenseData], labels);
        }
      }, 50);
    }
  },

  render() {
    const page = this.currentPage;
    document.getElementById('monthDisplay').textContent = Utils.currentMonth();
    this._renderDashboard();
    this._renderIncome();
    this.renderExpenses();
    this._renderAnalytics();
    if (page === 'dashboard' || page === 'analytics') {
      setTimeout(() => this._drawCharts(page), 100);
    }
  },

  // ==================== DASHBOARD ====================

  _renderDashboard() {
    const totalInc = Store.getTotalIncome();
    const totalExp = Store.getTotalExpenses();
    const balance = Store.getBalance();
    const pct = Store.getSpendingPct();
    const savings = Store.getSavingsTotal();

    document.getElementById('dashIncome').textContent = Utils.formatCurrency(totalInc);
    document.getElementById('dashExpenses').textContent = Utils.formatCurrency(totalExp);
    document.getElementById('dashBalance').textContent = Utils.formatCurrency(balance);

    const savingsTotalEl = document.getElementById('dashSavings');
    if (savingsTotalEl) savingsTotalEl.textContent = Utils.formatCurrency(savings);

    const donutPct = document.getElementById('donutPct');
    donutPct.textContent = Math.round(pct * 100) + '%';
    donutPct.className = 'pct';
    if (pct > 0.75) donutPct.classList.add('danger-color');
    else if (pct > 0.5) donutPct.classList.add('warning-color');
    else donutPct.classList.add('income-color');

    const budgetStatus = document.getElementById('dashBudgetStatus');
    if (totalInc === 0) {
      budgetStatus.textContent = 'Add income';
      budgetStatus.style.color = 'var(--text-secondary)';
    } else if (balance < 0) {
      budgetStatus.textContent = 'Over budget!';
      budgetStatus.style.color = 'var(--danger)';
    } else {
      const remainPct = Math.round((balance / totalInc) * 100);
      budgetStatus.textContent = `${remainPct}% remaining`;
      budgetStatus.style.color = remainPct > 20 ? 'var(--success)' : 'var(--warning)';
    }

    this._renderStatCards(totalInc, totalExp, balance, savings);
    this._renderCategoryBars();
    this._renderRecentTransactions();
    this._renderInsights();
  },

  _renderStatCards(totalInc, totalExp, balance, savings) {
    const container = document.getElementById('statCards');
    const savingsRate = Store.getSavingsRate();
    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon income">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="stat-info"><div class="stat-label">Income</div><div class="stat-value income">${Utils.formatCurrency(totalInc)}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon expense">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="stat-info"><div class="stat-label">Expenses</div><div class="stat-value expense">${Utils.formatCurrency(totalExp)}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon balance">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/></svg>
        </div>
        <div class="stat-info"><div class="stat-label">Balance</div><div class="stat-value balance">${Utils.formatCurrency(balance)}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon savings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </div>
        <div class="stat-info"><div class="stat-label">Savings Rate</div><div class="stat-value balance">${(savingsRate * 100).toFixed(1)}%</div></div>
      </div>
    `;
  },

  _renderCategoryBars() {
    const container = document.getElementById('categoryBars');
    const catData = Store.getExpensesByCategory();
    if (catData.length === 0) {
      container.innerHTML = '<div class="empty">No expenses recorded yet.</div>';
      return;
    }
    const total = catData.reduce((s, c) => s + c.total, 0);
    container.innerHTML = '<div class="cat-bars">' +
      catData.map(c => {
        const pct = (c.total / total) * 100;
        return `
          <div class="cat-bar-row">
            <span class="cat-label">${CATEGORY_MAP[c.category]?.icon || ''} ${c.label}</span>
            <div class="cat-track"><div class="cat-fill bar-${c.category}" style="width:${pct}%"></div></div>
            <span class="cat-amount" style="color:${CATEGORY_MAP[c.category]?.color || '#6b7280'}">${Utils.formatCurrency(c.total)}</span>
          </div>`;
      }).join('') + '</div>';
  },

  _renderRecentTransactions() {
    const container = document.getElementById('recentTransactions');
    const recent = Utils.sortBy(Store.getExpenses(), 'date', true).slice(0, 6);
    if (recent.length === 0) {
      container.innerHTML = '<div class="empty">No transactions yet.</div>';
      return;
    }
    container.innerHTML = recent.map(e => {
      const cat = CATEGORY_MAP[e.category];
      return `
        <div class="list-item">
          <div class="info">
            <div class="name">${Utils.escapeHtml(e.desc)}</div>
            <div class="meta">${Utils.formatDate(e.date)} · <span class="cat-badge cat-${e.category}">${cat ? cat.icon + ' ' + cat.label : e.category}</span>${e.note ? ' · ' + Utils.escapeHtml(e.note) : ''}</div>
          </div>
          <div class="amount expense">${Utils.formatCurrency(e.amount)}</div>
        </div>`;
    }).join('');
  },

  _renderInsights() {
    const container = document.getElementById('insightsList');
    const tips = this._generateInsights();
    if (tips.length === 0) {
      container.innerHTML = '<div class="empty">Add income and expenses to see insights.</div>';
      return;
    }
    container.innerHTML = tips.map(t => `
      <div class="insight-item ${t.type}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>${t.text}</span>
      </div>`).join('');
  },

  _generateInsights() {
    const tips = [];
    const totalInc = Store.getTotalIncome();
    const totalExp = Store.getTotalExpenses();
    const balance = Store.getBalance();
    const catData = Store.getExpensesByCategory();
    const catTotal = catData.reduce((s, c) => s + c.total, 0);

    if (totalInc === 0) {
      tips.push({ text: 'Start by adding your income sources to see your financial overview.', type: 'info' });
      return tips;
    }

    const pct = totalInc > 0 ? totalExp / totalInc : 0;

    if (pct > 1) {
      tips.push({ text: `Expenses (${Utils.formatCurrency(totalExp)}) exceed income (${Utils.formatCurrency(totalInc)}). Consider cutting non-essential spending.`, type: 'danger' });
    } else if (pct > 0.8) {
      tips.push({ text: `You've used ${Math.round(pct * 100)}% of your income. Only ${Utils.formatCurrency(balance)} remaining this month.`, type: 'warning' });
    } else if (pct < 0.5 && totalExp > 0) {
      tips.push({ text: `Great job! You've only spent ${Math.round(pct * 100)}% of your income. Keep saving!`, type: 'success' });
    }

    const foodCat = catData.find(c => c.category === 'food');
    if (foodCat && catTotal > 0) {
      const foodPct = (foodCat.total / catTotal) * 100;
      if (foodPct > 35) {
        tips.push({ text: `Food is ${Math.round(foodPct)}% of your spending (${Utils.formatCurrency(foodCat.total)}). Try meal prepping to save more.`, type: 'warning' });
      }
    }

    const savingsCat = catData.find(c => c.category === 'savings');
    if (savingsCat) {
      const savingsPct = (savingsCat.total / totalInc) * 100;
      if (savingsPct >= 10) {
        tips.push({ text: `Savings rate is ${Math.round(savingsPct)}% of income. Excellent savings habit!`, type: 'success' });
      }
    }

    const entertainmentCat = catData.find(c => c.category === 'entertainment');
    if (entertainmentCat && catTotal > 0) {
      const entPct = (entertainmentCat.total / catTotal) * 100;
      if (entPct > 20) {
        tips.push({ text: `Entertainment is ${Math.round(entPct)}% of spending — consider trimming subscription costs.`, type: 'info' });
      }
    }

    const rentCat = catData.find(c => c.category === 'rent');
    if (!rentCat && totalExp > 0) {
      tips.push({ text: 'No rent/housing expense recorded. Make sure all major costs are tracked.', type: 'info' });
    }

    if (tips.length < 2 && pct < 0.6 && totalExp > 0) {
      tips.push({ text: `Your balance of ${Utils.formatCurrency(balance)} is healthy. Consider moving some to savings.`, type: 'success' });
    }

    if (tips.length === 0 && totalExp > 0) {
      tips.push({ text: `You've spent ${Utils.formatCurrency(totalExp)} this month. Check the analytics tab for detailed breakdowns.`, type: 'info' });
    }

    return tips.slice(0, 4);
  },

  // ==================== INCOME ====================

  _renderIncome() {
    const list = document.getElementById('incomeList');
    const incomes = Store.getIncomes();
    const total = Store.getTotalIncome();
    document.getElementById('incomeTotalLabel').textContent = Utils.formatCurrency(total);

    if (incomes.length === 0) {
      list.innerHTML = '<div class="empty">No income sources added yet. Add your first source above.</div>';
      return;
    }
    list.innerHTML = incomes.map(i => `
      <div class="list-item">
        <div class="info">
          <div class="name">${Utils.escapeHtml(i.source)}</div>
          <div class="meta">${Utils.formatDate(i.date)}</div>
        </div>
        <div class="amount income">${Utils.formatCurrency(i.amount)}</div>
        <div class="actions">
          <button class="btn-icon" onclick="App.editIncome('${i.id}')" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon" onclick="App.deleteIncome('${i.id}')" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>`).join('');
  },

  addIncome() {
    const source = document.getElementById('incomeSource').value.trim();
    const amount = document.getElementById('incomeAmount').value;
    const date = document.getElementById('incomeDate').value || Utils.today();
    if (!source) return this.showToast('Please enter a source name.', 'error');
    if (!amount || parseFloat(amount) <= 0) return this.showToast('Please enter a valid amount.', 'error');
    Store.addIncome({ source, amount, date });
    document.getElementById('incomeSource').value = '';
    document.getElementById('incomeAmount').value = '';
    document.getElementById('incomeDate').value = Utils.today();
    this.showToast('Income source added!', 'success');
  },

  editIncome(id) {
    const income = Store.getIncomes().find(i => i.id === id);
    if (!income) return;
    this.editId = id;
    this.editType = 'income';
    document.getElementById('modalTitle').textContent = 'Edit Income Source';
    document.getElementById('modalBody').innerHTML = `
      <div class="form-group"><label>Source Name</label><input type="text" id="editSource" value="${Utils.escapeHtml(income.source)}"></div>
      <div class="form-group"><label>Amount</label><input type="number" id="editAmount" value="${income.amount}" step="0.01" min="0"></div>
      <div class="form-group"><label>Date</label><input type="date" id="editDate" value="${income.date}"></div>`;
    document.getElementById('modalConfirm').onclick = () => this._saveEdit();
    document.getElementById('modalOverlay').classList.add('open');
  },

  deleteIncome(id) {
    if (!confirm('Delete this income source?')) return;
    Store.deleteIncome(id);
    this.showToast('Income source deleted.', 'info');
  },

  // ==================== EXPENSES ====================

  renderExpenses() {
    const list = document.getElementById('expenseList');
    const search = document.getElementById('expenseSearch').value.toLowerCase().trim();
    const catFilter = document.getElementById('expenseFilterCat').value;
    const from = document.getElementById('expenseFilterFrom').value;
    const to = document.getElementById('expenseFilterTo').value;

    let expenses = Store.getExpenses();

    if (search) expenses = expenses.filter(e => e.desc.toLowerCase().includes(search));
    if (catFilter) expenses = expenses.filter(e => e.category === catFilter);
    if (from) expenses = expenses.filter(e => e.date >= from);
    if (to) expenses = expenses.filter(e => e.date <= to);

    expenses = Utils.sortBy(expenses, 'date', true);
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    document.getElementById('expenseTotalLabel').textContent = Utils.formatCurrency(total);

    if (expenses.length === 0) {
      list.innerHTML = '<div class="empty">No expenses found. Add your first expense above.</div>';
      return;
    }
    list.innerHTML = expenses.map(e => {
      const cat = CATEGORY_MAP[e.category];
      return `
        <div class="list-item">
          <div class="info">
            <div class="name">${Utils.escapeHtml(e.desc)}</div>
            <div class="meta">${Utils.formatDate(e.date)} · <span class="cat-badge cat-${e.category}">${cat ? cat.icon + ' ' + cat.label : e.category}</span>${e.note ? ' · ' + Utils.escapeHtml(e.note) : ''}</div>
          </div>
          <div class="amount expense">${Utils.formatCurrency(e.amount)}</div>
          <div class="actions">
            <button class="btn-icon" onclick="App.editExpense('${e.id}')" title="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon" onclick="App.deleteExpense('${e.id}')" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');
  },

  addExpense() {
    const desc = document.getElementById('expenseDesc').value.trim();
    const amount = document.getElementById('expenseAmount').value;
    const category = document.getElementById('expenseCategory').value;
    const date = document.getElementById('expenseDate').value || Utils.today();
    const note = document.getElementById('expenseNote').value.trim();
    if (!desc) return this.showToast('Please enter a description.', 'error');
    if (!amount || parseFloat(amount) <= 0) return this.showToast('Please enter a valid amount.', 'error');
    Store.addExpense({ desc, amount, category, date, note });
    document.getElementById('expenseDesc').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseNote').value = '';
    document.getElementById('expenseDate').value = Utils.today();
    this.showToast('Expense added!', 'success');
  },

  editExpense(id) {
    const expense = Store.getExpenses().find(e => e.id === id);
    if (!expense) return;
    this.editId = id;
    this.editType = 'expense';
    document.getElementById('modalTitle').textContent = 'Edit Expense';
    const catOptions = CATEGORIES.map(c =>
      `<option value="${c.id}"${c.id === expense.category ? ' selected' : ''}>${c.label}</option>`
    ).join('');
    document.getElementById('modalBody').innerHTML = `
      <div class="form-group"><label>Description</label><input type="text" id="editDesc" value="${Utils.escapeHtml(expense.desc)}"></div>
      <div class="form-group"><label>Amount</label><input type="number" id="editAmount" value="${expense.amount}" step="0.01" min="0"></div>
      <div class="form-group"><label>Category</label><select id="editCategory">${catOptions}</select></div>
      <div class="form-group"><label>Date</label><input type="date" id="editDate" value="${expense.date}"></div>
      <div class="form-group"><label>Notes</label><input type="text" id="editNote" value="${Utils.escapeHtml(expense.note || '')}"></div>`;
    document.getElementById('modalConfirm').onclick = () => this._saveEdit();
    document.getElementById('modalOverlay').classList.add('open');
  },

  deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;
    Store.deleteExpense(id);
    this.showToast('Expense deleted.', 'info');
  },

  clearFilters() {
    document.getElementById('expenseSearch').value = '';
    document.getElementById('expenseFilterCat').value = '';
    document.getElementById('expenseFilterFrom').value = '';
    document.getElementById('expenseFilterTo').value = '';
    this.renderExpenses();
  },

  // ==================== MODAL ====================

  _saveEdit() {
    const type = this.editType;
    const id = this.editId;
    if (type === 'income') {
      const source = document.getElementById('editSource').value.trim();
      const amount = document.getElementById('editAmount').value;
      const date = document.getElementById('editDate').value;
      if (!source || !amount || parseFloat(amount) <= 0) {
        return this.showToast('Please fill all fields correctly.', 'error');
      }
      Store.updateIncome(id, { source, amount, date });
      this.showToast('Income updated!', 'success');
    } else if (type === 'expense') {
      const desc = document.getElementById('editDesc').value.trim();
      const amount = document.getElementById('editAmount').value;
      const category = document.getElementById('editCategory').value;
      const date = document.getElementById('editDate').value;
      const note = document.getElementById('editNote').value.trim();
      if (!desc || !amount || parseFloat(amount) <= 0) {
        return this.showToast('Please fill all fields correctly.', 'error');
      }
      Store.updateExpense(id, { desc, amount, category, date, note });
      this.showToast('Expense updated!', 'success');
    }
    this.closeModal();
  },

  closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    this.editId = null;
    this.editType = null;
  },

  // ==================== ANALYTICS ====================

  _renderAnalytics() {
    this._renderPieLegend();
    this._renderMonthlySummary();
  },

  _renderPieLegend() {
    const container = document.getElementById('pieLegend');
    const catData = Store.getExpensesByCategory();
    if (catData.length === 0) {
      container.innerHTML = '<div class="empty">No data to display.</div>';
      return;
    }
    const total = catData.reduce((s, c) => s + c.total, 0);
    container.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">' +
      catData.map(c => {
        const pct = ((c.total / total) * 100).toFixed(1);
        const cat = CATEGORY_MAP[c.category];
        return `<span class="cat-badge cat-${c.category}">${cat ? cat.icon : ''} ${c.label} ${Utils.formatCurrency(c.total)} (${pct}%)</span>`;
      }).join('') + '</div>';
  },

  _renderMonthlySummary() {
    const container = document.getElementById('monthlySummary');
    const data = Store.getIncomeVsExpenseByMonth();
    if (data.length === 0) {
      container.innerHTML = '<div class="empty">No monthly data yet.</div>';
      return;
    }
    const rows = [...data].reverse();
    container.innerHTML = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="border-bottom:2px solid var(--border);color:var(--text-secondary);font-weight:500;text-align:left">
              <th style="padding:8px 12px">Month</th>
              <th style="padding:8px 12px">Income</th>
              <th style="padding:8px 12px">Expenses</th>
              <th style="padding:8px 12px">Balance</th>
              <th style="padding:8px 12px">Savings Rate</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              const parts = r.month.split('-');
              const label = months[parseInt(parts[1]) - 1] + ' ' + parts[0];
              const balance = r.income - r.expense;
              const savingsExpenses = Store.getExpenses().filter(e => e.date.startsWith(r.month) && e.category === 'savings');
              const savingsTotal = savingsExpenses.reduce((s, e) => s + e.amount, 0);
              const actualRate = r.income > 0 ? ((savingsTotal / r.income) * 100).toFixed(1) : '0.0';
              return `
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px 12px;font-weight:500">${label}</td>
                  <td style="padding:8px 12px;color:var(--success);font-weight:600">${Utils.formatCurrency(r.income)}</td>
                  <td style="padding:8px 12px;color:var(--danger);font-weight:600">${Utils.formatCurrency(r.expense)}</td>
                  <td style="padding:8px 12px;font-weight:600;color:${balance >= 0 ? 'var(--success)' : 'var(--danger)'}">${Utils.formatCurrency(balance)}</td>
                  <td style="padding:8px 12px">${actualRate}%</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  },

  exportCSV() {
    const csv = Store.exportCSV();
    const lines = csv.trim().split('\n');
    if (lines.length <= 1) return this.showToast('No expenses to export.', 'warning');
    Utils.downloadFile('expenses_' + Utils.today() + '.csv', csv);
    this.showToast('CSV exported!', 'success');
  },

  exportJSON() {
    const data = Store.exportData();
    Utils.downloadFile('finance_data_' + Utils.today() + '.json', data, 'application/json');
    this.showToast('JSON exported!', 'success');
  },

  importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const success = Store.importData(e.target.result);
      if (success) {
        this.showToast('Data imported successfully!', 'success');
        this.render();
        this._drawAllCharts();
      } else {
        this.showToast('Invalid file format.', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  },

  resetData() {
    if (!confirm('Are you sure? This will permanently delete ALL your data.')) return;
    if (!confirm('This cannot be undone. Continue?')) return;
    Store.resetData();
    this.showToast('All data has been reset.', 'info');
    this.render();
    this._drawAllCharts();
  },

  // ==================== SETTINGS ====================

  _renderSettings() {
    const grid = document.getElementById('budgetGrid');
    grid.innerHTML = CATEGORIES.map(c => {
      const budget = Store.getBudget(c.id);
      const status = Store.getBudgetStatus(c.id);
      let alertHtml = '';
      if (status && budget > 0 && status.over) {
        alertHtml = `<div class="budget-alert">Overspent by ${Utils.formatCurrency(status.spent - budget)}</div>`;
      } else if (status && budget > 0 && status.pct > 0.8) {
        alertHtml = `<div class="budget-status-text" style="font-size:11px;color:var(--warning);margin-top:2px">${Math.round(status.pct * 100)}% used · ${Utils.formatCurrency(status.spent)} spent</div>`;
      } else if (status && budget > 0) {
        alertHtml = `<div class="budget-status-text" style="font-size:11px;color:var(--text-tertiary);margin-top:2px">${Utils.formatCurrency(status.spent)} spent (${Math.round(status.pct * 100)}%)</div>`;
      }
      return `
        <div class="budget-item">
          <label>${c.icon} ${c.label}</label>
          <div style="flex:1">
            <input type="number" class="budget-input" data-cat="${c.id}" value="${budget || ''}" placeholder="0" min="0" step="10">
            ${alertHtml}
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('.budget-input').forEach(input => {
      input.addEventListener('change', () => {
        const cat = input.dataset.cat;
        const val = input.value;
        Store.setBudget(cat, val);
        this._updateBudgetItem(input, cat, parseFloat(val) || 0);
      });
    });
  },

  _updateBudgetItem(input, category, budget) {
    const container = input.parentElement;
    const oldStatus = container.querySelector('.budget-alert, .budget-status-text');
    if (oldStatus) oldStatus.remove();
    if (budget <= 0) return;
    const spent = Store.getExpenses()
      .filter(e => e.category === category)
      .reduce((s, e) => s + e.amount, 0);
    const pct = spent / budget;
    const el = document.createElement('div');
    el.className = pct > 1 ? 'budget-alert' : 'budget-status-text';
    if (pct > 1) {
      el.textContent = `Overspent by ${Utils.formatCurrency(spent - budget)}`;
      el.style.cssText = 'font-size:12px;color:var(--danger);font-weight:500;margin-top:2px';
    } else if (pct > 0.8) {
      el.textContent = `${Math.round(pct * 100)}% used · ${Utils.formatCurrency(spent)} spent`;
      el.style.cssText = 'font-size:11px;color:var(--warning);margin-top:2px';
    } else {
      el.textContent = `${Utils.formatCurrency(spent)} spent (${Math.round(pct * 100)}%)`;
      el.style.cssText = 'font-size:11px;color:var(--text-tertiary);margin-top:2px';
    }
    container.appendChild(el);
  },

  // ==================== TOAST ====================

  showToast(message, type, duration) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'info');
    const icons = { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.25s ease forwards';
      setTimeout(() => toast.remove(), 250);
    }, duration || 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
