document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const paymentForm = document.getElementById('paymentForm');
    const paymentTypeSelect = document.getElementById('paymentType');
    const chequeDetailsDivs = document.querySelectorAll('.cheque-details');
    const paymentsTableBody = document.querySelector('#paymentsTable tbody');
    const dailySummaryTableBody = document.querySelector('#dailySummaryTable tbody');
    const csvFileInput = document.getElementById('csvFile');
    const uploadCsvBtn = document.getElementById('uploadCsvBtn');
    const clearAllPaymentsBtn = document.getElementById('clearAllPayments');

    const calendarDiv = document.getElementById('calendar');
    const currentMonthYearHeader = document.getElementById('currentMonthYear');
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');

    let payments = []; // Array to hold all payment objects
    let currentCalendarDate = new Date(); // To keep track of the month displayed on the calendar

    // --- Helper Functions ---

    // Function to load payments from Local Storage
    const loadPayments = () => {
        const storedPayments = localStorage.getItem('hypermarketPayments');
        payments = storedPayments ? JSON.parse(storedPayments) : [];
        renderAllTables();
    };

    // Function to save payments to Local Storage
    const savePayments = () => {
        localStorage.setItem('hypermarketPayments', JSON.stringify(payments));
        renderAllTables();
    };

    // Function to render all data tables and calendar
    const renderAllTables = () => {
        renderPaymentsTable();
        renderDailySummaryTable();
        renderCalendar();
    };

    // Format amount as currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    // --- Individual Payment Entry Form Logic ---

    // Show/hide cheque details based on payment type
    paymentTypeSelect.addEventListener('change', () => {
        if (paymentTypeSelect.value === 'Cheque') {
            chequeDetailsDivs.forEach(div => div.style.display = 'block');
        } else {
            chequeDetailsDivs.forEach(div => div.style.display = 'none');
            // Clear values if hidden
            document.getElementById('chequeNumber').value = '';
            document.getElementById('bankName').value = '';
        }
    });

    // Handle form submission
    paymentForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Prevent default form submission

        const newPayment = {
            id: Date.now(), // Unique ID for easy deletion
            vendorName: document.getElementById('vendorName').value,
            vendorCategory: document.getElementById('vendorCategory').value,
            paymentType: document.getElementById('paymentType').value,
            paymentAmount: parseFloat(document.getElementById('paymentAmount').value),
            paymentDate: document.getElementById('paymentDate').value,
            chequeNumber: document.getElementById('chequeNumber').value || '',
            bankName: document.getElementById('bankName').value || ''
        };

        payments.push(newPayment);
        savePayments(); // Save and re-render
        paymentForm.reset(); // Clear the form
        // Reset cheque details visibility after form reset
        chequeDetailsDivs.forEach(div => div.style.display = 'none');
    });

    // --- Payments Table Logic ---

    const renderPaymentsTable = () => {
        paymentsTableBody.innerHTML = ''; // Clear existing rows
        payments.forEach(payment => {
            const row = paymentsTableBody.insertRow();
            row.insertCell().textContent = payment.vendorName;
            row.insertCell().textContent = payment.vendorCategory;
            row.insertCell().textContent = payment.paymentType;
            row.insertCell().textContent = formatCurrency(payment.paymentAmount);
            row.insertCell().textContent = payment.paymentDate;
            row.insertCell().textContent = payment.chequeNumber;
            row.insertCell().textContent = payment.bankName;

            const actionsCell = row.insertCell();
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.classList.add('delete-btn');
            deleteButton.addEventListener('click', () => deletePayment(payment.id));
            actionsCell.appendChild(deleteButton);
        });
    };

    const deletePayment = (id) => {
        payments = payments.filter(payment => payment.id !== id);
        savePayments(); // Save and re-render
    };

    clearAllPaymentsBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear ALL scheduled payments? This action cannot be undone.')) {
            payments = [];
            savePayments();
        }
    });

    // --- CSV Upload Logic ---

    uploadCsvBtn.addEventListener('click', () => {
        const file = csvFileInput.files[0];
        if (!file) {
            alert('Please select a CSV file to upload.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            parseCsv(text);
        };
        reader.readAsText(file);
    });

    const parseCsv = (csvText) => {
        const lines = csvText.split('\n').filter(line => line.trim() !== ''); // Filter out empty lines
        if (lines.length === 0) {
            alert('CSV file is empty.');
            return;
        }

        // Assuming header row is present, but we'll manually map for robustness
        // Skipping the header for now, or you can use it to map columns dynamically
        const dataRows = lines.slice(0); // All rows, assume first row is data if no header validation

        let newPaymentsFromCsv = [];
        let errors = [];

        dataRows.forEach((line, index) => {
            const values = line.split(',');
            // Expected format: vendorName,vendorCategory,paymentType,paymentAmount,paymentDate,chequeNumber,bankName
            if (values.length >= 5) { // At least 5 fields are required
                const [vendorName, vendorCategory, paymentType, paymentAmountStr, paymentDate, chequeNumber = '', bankName = ''] = values.map(v => v.trim());

                const parsedAmount = parseFloat(paymentAmountStr);

                if (isNaN(parsedAmount) || parsedAmount <= 0) {
                    errors.push(`Row ${index + 1}: Invalid payment amount '${paymentAmountStr}'.`);
                    return;
                }
                if (!['FMCG', 'Homeware'].includes(vendorCategory)) {
                    errors.push(`Row ${index + 1}: Invalid vendor category '${vendorCategory}'. Must be FMCG or Homeware.`);
                    return;
                }
                if (!['Cheque', 'Bank Transfer', 'Cheque Pending'].includes(paymentType)) {
                    errors.push(`Row ${index + 1}: Invalid payment type '${paymentType}'. Must be Cheque, Bank Transfer, or Cheque Pending.`);
                    return;
                }
                // Basic date format validation (YYYY-MM-DD)
                if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
                     errors.push(`Row ${index + 1}: Invalid payment date format '${paymentDate}'. Expected YYYY-MM-DD.`);
                     return;
                }


                newPaymentsFromCsv.push({
                    id: Date.now() + index, // Ensure unique ID even for same timestamp
                    vendorName,
                    vendorCategory,
                    paymentType,
                    paymentAmount: parsedAmount,
                    paymentDate,
                    chequeNumber: (paymentType === 'Cheque') ? chequeNumber : '', // Only save if type is Cheque
                    bankName: (paymentType === 'Cheque') ? bankName : '' // Only save if type is Cheque
                });
            } else {
                errors.push(`Row ${index + 1}: Insufficient data. Expected at least 5 fields.`);
            }
        });

        if (errors.length > 0) {
            alert('Errors found in CSV upload:\n' + errors.join('\n') + '\n\nNo payments were added due to errors.');
        } else if (newPaymentsFromCsv.length > 0) {
            payments = payments.concat(newPaymentsFromCsv);
            savePayments();
            alert(`${newPaymentsFromCsv.length} payments successfully added from CSV!`);
            csvFileInput.value = ''; // Clear the file input
        } else {
             alert('No valid payments found in CSV file.');
        }
    };

    // --- Daily Payment Summary (Pivot Table) Logic ---

    const renderDailySummaryTable = () => {
        dailySummaryTableBody.innerHTML = ''; // Clear existing rows

        const dailyTotals = {}; // { 'YYYY-MM-DD': totalAmount }

        payments.forEach(payment => {
            const date = payment.paymentDate;
            if (dailyTotals[date]) {
                dailyTotals[date] += payment.paymentAmount;
            } else {
                dailyTotals[date] = payment.paymentAmount;
            }
        });

        // Sort dates for consistent display
        const sortedDates = Object.keys(dailyTotals).sort();

        sortedDates.forEach(date => {
            const row = dailySummaryTableBody.insertRow();
            row.insertCell().textContent = date;
            row.insertCell().textContent = formatCurrency(dailyTotals[date]);
        });
    };

    // --- Calendar Heatmap Logic (MODIFIED) ---

    const renderCalendar = () => {
        calendarDiv.innerHTML = ''; // Clear existing calendar

        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth(); // 0-indexed

        currentMonthYearHeader.textContent = new Date(year, month).toLocaleString('en-US', { month: 'long', year: 'numeric' });

        // Get category-wise total payments per day for the current month
        const monthlyCategoryTotals = {}; // { dayOfMonth: { FMCG: amount, Homeware: amount, total: amount } }
        const daysInMonth = new Date(year, month + 1, 0).getDate(); // Last day of current month

        // Initialize monthlyCategoryTotals for all days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            monthlyCategoryTotals[i] = { FMCG: 0, Homeware: 0, total: 0 };
        }

        payments.forEach(payment => {
            const paymentDate = new Date(payment.paymentDate + 'T00:00:00');
            if (paymentDate.getFullYear() === year && paymentDate.getMonth() === month) {
                const day = paymentDate.getDate();
                const category = payment.vendorCategory;
                const amount = payment.paymentAmount;

                // Ensure the day entry exists before adding amounts
                if (!monthlyCategoryTotals[day]) {
                    monthlyCategoryTotals[day] = { FMCG: 0, Homeware: 0, total: 0 };
                }

                monthlyCategoryTotals[day].total += amount;
                if (category === 'FMCG') {
                    monthlyCategoryTotals[day].FMCG += amount;
                } else if (category === 'Homeware') {
                    monthlyCategoryTotals[day].Homeware += amount;
                }
            }
        });

        // Determine max *total* payment for heatmap scaling (only for current month)
        // Extract all 'total' amounts from monthlyCategoryTotals
        const allDailyTotals = Object.values(monthlyCategoryTotals).map(data => data.total);
        const maxTotalPaymentForMonth = Math.max(0, ...allDailyTotals);


        // Add day headers (Sun, Mon, etc.)
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayNames.forEach(dayName => {
            const headerDiv = document.createElement('div');
            headerDiv.classList.add('calendar-day-header');
            headerDiv.textContent = dayName;
            calendarDiv.appendChild(headerDiv);
        });

        // Get the first day of the month (0 for Sunday, 1 for Monday...)
        const firstDayOfMonth = new Date(year, month, 1).getDay();

        // Add empty divs for preceding days to align first day of month
        for (let i = 0; i < firstDayOfMonth; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.classList.add('calendar-day', 'empty');
            calendarDiv.appendChild(emptyDay);
        }

        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayDiv = document.createElement('div');
            dayDiv.classList.add('calendar-day');

            const dayNumberSpan = document.createElement('span');
            dayNumberSpan.classList.add('day-number');
            dayNumberSpan.textContent = day;
            dayDiv.appendChild(dayNumberSpan);

            const totalsForDay = monthlyCategoryTotals[day];
            const totalAmountForDay = totalsForDay.total;
            const fmcgAmount = totalsForDay.FMCG;
            const homewareAmount = totalsForDay.Homeware;

            // Display FMCG amount if > 0
            if (fmcgAmount > 0) {
                const fmcgSpan = document.createElement('span');
                fmcgSpan.classList.add('payment-amount', 'fmcg-amount');
                fmcgSpan.textContent = `F: ${formatCurrency(fmcgAmount)}`;
                dayDiv.appendChild(fmcgSpan);
            }

            // Display Homeware amount if > 0
            if (homewareAmount > 0) {
                const homewareSpan = document.createElement('span');
                homewareSpan.classList.add('payment-amount', 'homeware-amount');
                homewareSpan.textContent = `H: ${formatCurrency(homewareAmount)}`;
                dayDiv.appendChild(homewareSpan);
            }

            // Apply heatmap class based on *total* amount for the day
            const heatmapLevel = getHeatmapLevel(totalAmountForDay, maxTotalPaymentForMonth);
            dayDiv.classList.add(`heatmap-level-${heatmapLevel}`);

            calendarDiv.appendChild(dayDiv);
        }
    };

    const getHeatmapLevel = (amount, maxAmount) => {
        if (maxAmount === 0) return 0;
        const percentage = amount / maxAmount;
        if (percentage === 0) return 0;
        if (percentage <= 0.1) return 1;
        if (percentage <= 0.25) return 2;
        if (percentage <= 0.4) return 3;
        if (percentage <= 0.6) return 4;
        if (percentage <= 0.8) return 5;
        if (percentage <= 0.95) return 6;
        return 7;
    };

    // Calendar navigation
    prevMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    // --- Initial Load ---
    loadPayments(); // Load existing payments when the page loads
});