// ═══════════════════════════════════════════════════════════════
// Cash-Flow  –  app.js   (Sprint 02 + Sprint 03 features)
//
// Architecture:
//  1. appState  – single source of truth
//  2. initApp   – wire events, load saved state, fetch rate
//  3. Handlers  – handleSalaryUpdate, handleFormSubmit, deleteExpense, etc.
//  4. Render    – renderApp calls individual render* helpers
//  5. Persist   – saveState / loadState via localStorage
//  6. Utils     – formatMoney, convertAmount, getTotals
// ═══════════════════════════════════════════════════════════════

// ─── 1. State ──────────────────────────────────────────────────
var appState = {
  salary: 0,
  expenses: [],
  currency: "INR",
  theme: "light",       // "light" | "dark"
  rates: {
    INR: 1,
    USD: null
  }
};

var STORAGE_KEY = "cashFlowState_v2";
var chartInstance = null;

// ─── 2. DOM References ─────────────────────────────────────────
var salaryInput         = document.getElementById("salaryInput");
var updateSalaryBtn     = document.getElementById("updateSalaryBtn");
var salaryError         = document.getElementById("salaryError");

var expenseForm         = document.getElementById("expenseForm");
var expenseNameInput    = document.getElementById("expenseNameInput");
var expenseAmountInput  = document.getElementById("expenseAmountInput");
var errorMessage        = document.getElementById("errorMessage");

var salaryDisplay       = document.getElementById("salaryDisplay");
var expensesDisplay     = document.getElementById("expensesDisplay");
var balanceDisplay      = document.getElementById("balanceDisplay");
var expenseList         = document.getElementById("expenseList");
var expenseCount        = document.getElementById("expenseCount");
var emptyState          = document.getElementById("emptyState");
var thresholdBanner     = document.getElementById("thresholdBanner");

var inrBtn              = document.getElementById("inrBtn");
var usdBtn              = document.getElementById("usdBtn");
var downloadPdfBtn      = document.getElementById("downloadPdfBtn");
var themeToggle         = document.getElementById("themeToggle");
var themeIcon           = document.getElementById("themeIcon");
var chartCanvas         = document.getElementById("cashFlowChart");

// ─── 3. Boot ───────────────────────────────────────────────────
function initApp() {
  loadState();      // hydrate from localStorage
  bindEvents();     // attach listeners
  fetchUsdRate();   // background fetch – non-blocking
  applyTheme();     // apply saved theme
  renderApp();      // paint UI
}

// ─── 4. Event Binding ──────────────────────────────────────────
function bindEvents() {
  // Salary can be updated independently, any number of times
  updateSalaryBtn.addEventListener("click", handleSalaryUpdate);

  // Allow pressing Enter inside salary field too
  salaryInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); handleSalaryUpdate(); }
  });

  expenseForm.addEventListener("submit", handleFormSubmit);

  inrBtn.addEventListener("click", function () { setCurrency("INR"); });
  usdBtn.addEventListener("click", function () { setCurrency("USD"); });

  downloadPdfBtn.addEventListener("click", downloadPdfReport);

  themeToggle.addEventListener("click", toggleTheme);
}

// ─── 5. Salary Update ──────────────────────────────────────────
// Salary is independent of expense submission so users can revise
// their income freely without clearing the expense list.
function handleSalaryUpdate() {
  var rawValue = salaryInput.value.trim();

  // Validation
  if (rawValue === "") {
    salaryError.textContent = "Please enter a salary amount.";
    return;
  }

  var salary = Number(rawValue);

  if (!Number.isFinite(salary) || salary < 0) {
    salaryError.textContent = "Salary must be a valid non-negative number.";
    return;
  }

  salaryError.textContent = "";
  appState.salary = salary;

  saveState();
  renderApp();

  // Visual feedback: briefly highlight the salary card
  salaryDisplay.classList.add("updated-flash");
  setTimeout(function () { salaryDisplay.classList.remove("updated-flash"); }, 600);
}

// ─── 6. Expense Submission ──────────────────────────────────────
function handleFormSubmit(event) {
  event.preventDefault();

  var name   = expenseNameInput.value.trim();
  var amount = Number(expenseAmountInput.value);

  // Salary must be set before adding expenses
  if (appState.salary === 0) {
    errorMessage.textContent = "Please set your salary first.";
    return;
  }

  // Validate expense fields
  if (!validateExpense(name, expenseAmountInput.value.trim(), amount)) {
    return;
  }

  // Push new expense into state
  appState.expenses.push({
    id:     Date.now(),
    name:   name,
    amount: amount
  });

  // Clear expense inputs only (not salary)
  expenseNameInput.value  = "";
  expenseAmountInput.value = "";
  errorMessage.textContent = "";

  saveState();
  renderApp();
}

// ─── 7. Expense Validation ─────────────────────────────────────
function validateExpense(name, rawAmount, amount) {
  if (name === "") {
    errorMessage.textContent = "Expense name cannot be empty.";
    return false;
  }

  if (rawAmount === "") {
    errorMessage.textContent = "Expense amount cannot be empty.";
    return false;
  }

  if (!Number.isFinite(amount) || amount < 0) {
    errorMessage.textContent = "Expense amount must be a valid non-negative number.";
    return false;
  }

  return true;
}

// ─── 8. Delete Expense ─────────────────────────────────────────
function deleteExpense(expenseId) {
  // Filter out the deleted item; balance recalculates automatically
  appState.expenses = appState.expenses.filter(function (exp) {
    return exp.id !== expenseId;
  });

  saveState();
  renderApp();
}

// ─── 9. Calculations ───────────────────────────────────────────
function getTotalExpenses() {
  return appState.expenses.reduce(function (sum, exp) {
    return sum + Number(exp.amount);
  }, 0);
}

function getRemainingBalance() {
  return appState.salary - getTotalExpenses();
}

// ─── 10. Currency Conversion ────────────────────────────────────
function convertAmount(amountInr) {
  if (appState.currency === "USD" && appState.rates.USD) {
    return amountInr * appState.rates.USD;
  }
  return amountInr;   // default: INR, no conversion
}

function getCurrencySymbol() {
  return appState.currency === "USD" ? "$ " : "₹ ";
}

function formatMoney(amountInr) {
  return getCurrencySymbol() + convertAmount(amountInr).toFixed(2);
}

// ─── 11. Master Render ─────────────────────────────────────────
// All sub-renders are called here so the DOM is always consistent.
function renderApp() {
  var totalExpenses    = getTotalExpenses();
  var remainingBalance = getRemainingBalance();

  // Summary cards
  salaryDisplay.textContent   = formatMoney(appState.salary);
  expensesDisplay.textContent = formatMoney(totalExpenses);
  balanceDisplay.textContent  = formatMoney(remainingBalance);

  renderExpenses(totalExpenses);
  renderThreshold(remainingBalance);
  renderChart(totalExpenses, remainingBalance);
  renderCurrencyButtons();
}

// ─── 12. Render Expense List ───────────────────────────────────
function renderExpenses() {
  expenseList.innerHTML = "";

  // Toggle empty state message
  var hasExpenses = appState.expenses.length > 0;
  emptyState.style.display = hasExpenses ? "none" : "block";
  expenseCount.textContent = appState.expenses.length + " item" + (appState.expenses.length === 1 ? "" : "s");

  appState.expenses.forEach(function (expense, index) {
    var li         = document.createElement("li");
    var nameSpan   = document.createElement("span");
    var amountSpan = document.createElement("span");
    var deleteBtn  = document.createElement("button");
    var numBadge   = document.createElement("span");

    li.className          = "expense-item";
    nameSpan.className    = "expense-name";
    amountSpan.className  = "expense-amount";
    deleteBtn.className   = "delete-btn";
    numBadge.className    = "expense-num";

    numBadge.textContent    = index + 1;
    nameSpan.textContent    = expense.name;
    amountSpan.textContent  = formatMoney(Number(expense.amount));

    deleteBtn.type          = "button";
    deleteBtn.textContent   = "🗑";
    deleteBtn.setAttribute("aria-label", "Delete " + expense.name);

    // Closure captures the specific expense id
    deleteBtn.addEventListener("click", function () {
      deleteExpense(expense.id);
    });

    // Assemble: [num] name | amount | 🗑
    var nameWrapper = document.createElement("span");
    nameWrapper.style.display     = "flex";
    nameWrapper.style.alignItems  = "center";
    nameWrapper.appendChild(numBadge);
    nameWrapper.appendChild(nameSpan);

    li.appendChild(nameWrapper);
    li.appendChild(amountSpan);
    li.appendChild(deleteBtn);
    expenseList.appendChild(li);
  });
}

// ─── 13. Threshold Banner ─────────────────────────────────────
function renderThreshold(remainingBalance) {
  var isLow = appState.salary > 0 && remainingBalance < appState.salary * 0.1;

  // Red balance text
  balanceDisplay.classList.toggle("low-balance", isLow);

  // Alert banner
  thresholdBanner.classList.toggle("visible", isLow);
}

// ─── 14. Currency Buttons State ───────────────────────────────
function renderCurrencyButtons() {
  inrBtn.classList.toggle("active", appState.currency === "INR");
  usdBtn.classList.toggle("active", appState.currency === "USD");
}

// ─── 15. Pie Chart ────────────────────────────────────────────
function renderChart(totalExpenses, remainingBalance) {
  // Destroy previous instance to avoid canvas reuse error
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  // Clamp balance so chart never shows negative slice
  var chartBalance = Math.max(remainingBalance, 0);

  // If both values are zero, show a placeholder chart
  var expData    = convertAmount(totalExpenses);
  var balData    = convertAmount(chartBalance);
  var isEmpty    = expData === 0 && balData === 0;

  var isDark     = appState.theme === "dark";
  var legendColor = isDark ? "#94a3b8" : "#475569";

  chartInstance = new Chart(chartCanvas, {
    type: "pie",
    data: {
      labels:   isEmpty ? ["No data"] : ["Expenses", "Balance"],
      datasets: [{
        data: isEmpty ? [1] : [expData, balData],
        backgroundColor: isEmpty
          ? ["#e2e8f0"]
          : ["#f59e0b", "#0f766e"],
        borderColor:     isDark ? "#141d2e" : "#ffffff",
        borderWidth:     3,
        hoverOffset:     8
      }]
    },
    options: {
      responsive:      true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color:    legendColor,
            font:     { family: "'DM Sans', sans-serif", size: 13, weight: "700" },
            padding:  16,
            boxWidth: 14,
            boxHeight: 14
          }
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              if (isEmpty) return "Add data";
              return " " + ctx.label + ": " + getCurrencySymbol() + ctx.parsed.toFixed(2);
            }
          }
        }
      }
    }
  });
}

// ─── 16. Set Currency ─────────────────────────────────────────
function setCurrency(currency) {
  appState.currency = currency;

  // Trigger a fresh fetch if USD rate is not yet loaded
  if (currency === "USD" && !appState.rates.USD) {
    fetchUsdRate();
  }

  renderApp();
}

// ─── 17. Fetch Exchange Rate ──────────────────────────────────
function fetchUsdRate() {
  fetch("https://api.frankfurter.dev/v2/rate/INR/USD")
    .then(function (response) { return response.json(); })
    .then(function (data) {
      if (data && data.rate) {
        appState.rates.USD = Number(data.rate);
        // Re-render only if user is currently viewing USD
        if (appState.currency === "USD") {
          renderApp();
        }
      }
    })
    .catch(function () {
      // Silently fall back; only show error if user explicitly switches to USD
      if (appState.currency === "USD") {
        errorMessage.textContent = "Currency conversion unavailable. Showing INR values.";
        appState.currency = "INR";
        renderApp();
      }
    });
}

// ─── 18. Theme Toggle ─────────────────────────────────────────
function toggleTheme() {
  appState.theme = appState.theme === "light" ? "dark" : "light";
  applyTheme();
  saveState();

  // Re-render chart to update legend/border colours for the new theme
  var totalExpenses    = getTotalExpenses();
  var remainingBalance = getRemainingBalance();
  renderChart(totalExpenses, remainingBalance);
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", appState.theme);
  themeIcon.textContent = appState.theme === "dark" ? "☀️" : "🌙";
}

// ─── 19. Persist State ────────────────────────────────────────
function saveState() {
  var data = {
    salary:   appState.salary,
    expenses: appState.expenses,
    currency: appState.currency,
    theme:    appState.theme
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadState() {
  var raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    var parsed = JSON.parse(raw);

    appState.salary   = Number(parsed.salary)  || 0;
    appState.expenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];
    appState.currency = parsed.currency || "INR";
    appState.theme    = parsed.theme    || "light";

    // Populate salary field with saved value
    if (appState.salary > 0) {
      salaryInput.value = appState.salary;
    }
  } catch (e) {
    // Corrupted data – start fresh
    localStorage.removeItem(STORAGE_KEY);
  }
}

// ─── 20. PDF Report ───────────────────────────────────────────
function downloadPdfReport() {
  var jsPDF            = window.jspdf.jsPDF;
  var doc              = new jsPDF();
  var totalExpenses    = getTotalExpenses();
  var remainingBalance = getRemainingBalance();
  var y                = 20;

  // ── Header ──────────────────────────────────────────────────
  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, 210, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("CASH-FLOW  |  Salary & Expense Report", 14, 9.5);

  doc.setTextColor(24, 32, 47);
  y = 28;

  // ── Summary ─────────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Financial Summary", 14, y); y += 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  var summaryLines = [
    ["Total Salary",       formatMoney(appState.salary)],
    ["Total Expenses",     formatMoney(totalExpenses)],
    ["Remaining Balance",  formatMoney(remainingBalance)]
  ];

  summaryLines.forEach(function (row) {
    doc.setFont("helvetica", "bold");
    doc.text(row[0] + ":", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(row[1], 80, y);
    y += 8;
  });

  y += 8;
  doc.setDrawColor(220, 230, 240);
  doc.line(14, y, 196, y);
  y += 10;

  // ── Expense List ─────────────────────────────────────────────
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Expense Breakdown", 14, y); y += 10;

  doc.setFontSize(10);

  if (appState.expenses.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.text("No expenses recorded.", 14, y);
  } else {
    appState.expenses.forEach(function (exp, i) {
      if (y > 275) { doc.addPage(); y = 20; }

      // Alternating row background
      if (i % 2 === 0) {
        doc.setFillColor(246, 249, 252);
        doc.rect(12, y - 5, 184, 9, "F");
      }

      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 118, 110);
      doc.text(String(i + 1) + ".", 14, y);

      doc.setTextColor(24, 32, 47);
      doc.setFont("helvetica", "normal");
      doc.text(exp.name, 24, y);
      doc.text(formatMoney(Number(exp.amount)), 150, y);
      y += 10;
    });
  }

  // ── Footer ──────────────────────────────────────────────────
  var pageCount = doc.internal.getNumberOfPages();
  for (var p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "Generated by Cash-Flow  •  " + new Date().toLocaleDateString(),
      14,
      doc.internal.pageSize.height - 8
    );
    doc.text(
      "Page " + p + " of " + pageCount,
      186,
      doc.internal.pageSize.height - 8,
      { align: "right" }
    );
  }

  doc.save("cash-flow-report.pdf");
}

// ─── Boot ─────────────────────────────────────────────────────
initApp();