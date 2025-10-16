class CurrencyConverter {
    constructor() {
        this.apiBase = 'http://localhost:8000';
        this.currencies = {};
        this.init();
    }

    async init() {
        await this.loadCurrencies();
        this.setupEventListeners();
        this.convertCurrency();
    }

    async loadCurrencies() {
        try {
            this.showLoading(true);
            const response = await fetch(`${this.apiBase}/currencies`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.currencies = data.currencies;

            this.populateCurrencySelects();
            this.displayCurrenciesList();
            this.hideError();

        } catch (error) {
            console.error('Ошибка загрузки валют:', error);
            this.showError('Не удалось загрузить список валют. Проверьте, запущен ли бэкенд на localhost:8000');
        } finally {
            this.showLoading(false);
        }
    }

    populateCurrencySelects() {
        const fromSelect = document.getElementById('currencyFrom');
        const toSelect = document.getElementById('currencyTo');

        fromSelect.innerHTML = '';
        toSelect.innerHTML = '';

        // Добавляем доступные валюты
        const sortedCurrencies = Object.keys(this.currencies).sort();

        sortedCurrencies.forEach(currency => {
            const optionFrom = new Option(currency, currency);
            const optionTo = new Option(currency, currency);

            fromSelect.add(optionFrom);
            toSelect.add(optionTo);
        });

        fromSelect.value = 'USD';
        toSelect.value = 'BYN';
    }

    displayCurrenciesList() {
        const list = document.getElementById('currenciesList');
        list.innerHTML = '';

        Object.entries(this.currencies)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([currency, rate]) => {
                const item = document.createElement('div');
                item.className = 'currency-item';
                item.innerHTML = `
                    <strong>${currency}</strong>
                    <span>1 ${currency} = ${rate.toFixed(4)} BYN</span>
                `;
                list.appendChild(item);
            });
    }

    setupEventListeners() {
        document.getElementById('convertBtn').addEventListener('click', () => {
            this.convertCurrency();
        });

        document.getElementById('swapBtn').addEventListener('click', () => {
            this.swapCurrencies();
        });

        document.getElementById('amount').addEventListener('input', () => {
            this.debounce(() => this.convertCurrency(), 500);
        });

        document.getElementById('currencyFrom').addEventListener('change', () => {
            this.convertCurrency();
        });

        document.getElementById('currencyTo').addEventListener('change', () => {
            this.convertCurrency();
        });

        // Добавляем возможность ручного ввода в select
        this.enableManualInput('currencyFrom');
        this.enableManualInput('currencyTo');
    }

    enableManualInput(selectId) {
        const select = document.getElementById(selectId);

        select.addEventListener('click', (e) => {
            // Позволяем редактировать select
            select.style.pointerEvents = 'auto';
        });

        select.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const value = e.target.value.toUpperCase().trim();
                if (this.isValidCurrencyCode(value)) {
                    e.target.value = value;
                    this.convertCurrency();
                } else {
                    this.showWarning('Пожалуйста, введите корректный код валюты (3 латинские буквы)');
                }
            }
        });

        select.addEventListener('blur', (e) => {
            const value = e.target.value.toUpperCase().trim();
            if (value && this.isValidCurrencyCode(value)) {
                e.target.value = value;
                this.convertCurrency();
            }
        });
    }

    isValidCurrencyCode(code) {
        return /^[A-Z]{3}$/.test(code);
    }

    debounce(func, wait) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(func, wait);
    }

    async convertCurrency() {
        const amount = parseFloat(document.getElementById('amount').value);
        const from = document.getElementById('currencyFrom').value.toUpperCase().trim();
        const to = document.getElementById('currencyTo').value.toUpperCase().trim();

        // Скрываем предупреждение при новой конвертации
        this.hideWarning();

        if (!amount || amount <= 0) {
            this.hideResult();
            return;
        }

        // Проверяем валидность кодов валют
        if (!this.isValidCurrencyCode(from)) {
            this.showWarning('Пожалуйста, введите корректный код исходной валюты (3 латинские буквы)');
            this.hideResult();
            return;
        }

        if (!this.isValidCurrencyCode(to)) {
            this.showWarning('Пожалуйста, введите корректный код целевой валюты (3 латинские буквы)');
            this.hideResult();
            return;
        }

        try {
            this.setLoading(true);
            this.hideError();

            const response = await fetch(`${this.apiBase}/convert`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: amount,
                    currencyAbbreviationFrom: from,
                    currencyAbbreviationTo: to
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 404) {
                    this.showWarning('Извините, одна из выбранных валют не найдена!');
                    this.hideResult();
                    return;
                }
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.displayResult(result);

        } catch (error) {
            console.error('Ошибка конвертации:', error);
            if (error.message.includes('404') || error.message.includes('не найдена')) {
                this.showWarning('Извините, одна из выбранных валют не найдена!');
            } else {
                this.showError(error.message || 'Ошибка конвертации. Проверьте подключение к серверу.');
            }
            this.hideResult();
        } finally {
            this.setLoading(false);
        }
    }

    displayResult(data) {
        const resultDiv = document.getElementById('result');
        const resultAmount = document.getElementById('resultAmount');
        const exchangeRate = document.getElementById('exchangeRate');
        const exchangeDate = document.getElementById('exchangeDate');

        resultAmount.textContent =
            `${this.formatNumber(data.amount)} ${data.currencyAbbreviationFrom} = ${this.formatNumber(data.convertedAmount)} ${data.currencyAbbreviationTo}`;

        exchangeRate.textContent = data.currencyOfficialRate.toFixed(6);
        exchangeDate.textContent = new Date(data.exchangeDate).toLocaleDateString('ru-RU');

        resultDiv.style.display = 'block';
    }

    formatNumber(num) {
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6
        }).format(num);
    }

    hideResult() {
        document.getElementById('result').style.display = 'none';
    }

    swapCurrencies() {
        const fromSelect = document.getElementById('currencyFrom');
        const toSelect = document.getElementById('currencyTo');

        const temp = fromSelect.value;
        fromSelect.value = toSelect.value;
        toSelect.value = temp;

        this.convertCurrency();
    }

    setLoading(loading) {
        const btn = document.getElementById('convertBtn');
        if (loading) {
            btn.textContent = 'Конвертация...';
            btn.disabled = true;
            btn.classList.add('loading');
        } else {
            btn.textContent = 'Конвертировать';
            btn.disabled = false;
            btn.classList.remove('loading');
        }
    }

    showLoading(show) {
        const currenciesList = document.getElementById('currenciesList');
        if (show) {
            currenciesList.innerHTML = '<div>Загрузка...</div>';
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    hideError() {
        document.getElementById('error').style.display = 'none';
    }

    showWarning(message) {
        let warningDiv = document.getElementById('warning');
        if (!warningDiv) {
            warningDiv = document.createElement('div');
            warningDiv.id = 'warning';
            warningDiv.className = 'warning';
            document.querySelector('.converter-card').appendChild(warningDiv);
        }
        warningDiv.textContent = message;
        warningDiv.style.display = 'block';
    }

    hideWarning() {
        const warningDiv = document.getElementById('warning');
        if (warningDiv) {
            warningDiv.style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CurrencyConverter();
});