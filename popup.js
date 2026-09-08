const tabsContainer = document.getElementById('tabs');
const browserTotal = document.getElementById('browser-total');
const message = document.getElementById('message');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle.querySelector('.theme-icon');
const themeLabel = themeToggle.querySelector('span:last-child');
const draftSpeeds = new Map();
let refreshTimer;
let isUpdating = false;
let isRefreshing = false;
let editingTabId = null;

function sendMessage(payload) {
  return new Promise((resolve) => { 
    chrome.runtime.sendMessage(payload, (response) => {
      const error = chrome.runtime.lastError;
      resolve(error ? { ok: false, error: error.message } : response);
    });
  });
}

function setMessage(text = '', isError = false) {
  message.textContent = text;
  message.classList.toggle('error', isError);
}

function setBrowserTotal(tabs) {
  const totalBytes = tabs.reduce((sum, tab) => sum + (tab.available ? tab.totalBytes : 0), 0);
  browserTotal.querySelector('strong').textContent = formatData(totalBytes);
}

function formatRate(bytesPerSecond) {
  if (!bytesPerSecond) return '0 KB/s';
  if (bytesPerSecond < 1024 * 1024) return `${Math.max(1, Math.round(bytesPerSecond / 1024))} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatData(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(0.1, Math.round((bytes / 1024) * 10) / 10)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  document.documentElement.dataset.theme = theme;
  themeIcon.textContent = theme === 'dark' ? '☀' : '◐';
  themeLabel.textContent = theme === 'dark' ? 'Light' : 'Dark';
}

function setSliderProgress(slider, percent) {
  slider.style.setProperty('--progress', `${percent}%`);
}

function percentToKilobytes(percent) {
  return Math.round(8 * Math.pow(51200 / 8, (percent - 1) / 98));
}

function kilobytesToPercent(kilobytes) {
  if (kilobytes <= 0) return 0;
  return Math.max(1, Math.min(99, Math.round(1 + (Math.log(kilobytes / 8) / Math.log(51200 / 8)) * 98)));
}

function formatSpeed(kilobytes) {
  if (kilobytes < 1024) return `${kilobytes} KB/s`;
  return `${(kilobytes / 1024).toFixed(kilobytes % 1024 === 0 ? 0 : 1)} MB/s`;
}

function formatSpeedInput(percent) {
  if (percent === 100) return { value: '100', unit: '%' };
  if (percent === 0) return { value: '0', unit: 'KB/s' };
  return { value: String(percentToKilobytes(percent)), unit: 'KB/s' };
}

function parseSpeedInput(value, unit) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (unit === '%') return Math.max(0, Math.min(100, Math.round(amount)));
  const kilobytes = unit === 'MB/s' ? amount * 1024 : amount;
  return kilobytesToPercent(kilobytes);
}

function speedLabel(percent) {
  if (percent === 0) return 'Offline';
  if (percent === 100) return 'No limit';
  return formatSpeed(percentToKilobytes(percent));
}

function limitLabel(percent) {
  if (percent === 0) return 'Internet is paused for this tab';
  if (percent === 100) return 'No added speed limit';
  return 'Enter a value and choose %, KB/s, or MB/s.';
}

function createTabCard(tab) {
  const card = document.createElement('section');
  card.className = `tab-card${tab.available ? '' : ' unavailable'}`;

  const top = document.createElement('div');
  top.className = 'tab-top';
  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title || 'Untitled tab';
  title.title = title.textContent;
  const rate = document.createElement('div');
  rate.className = 'rate';
  rate.textContent = tab.available ? `Using ${formatRate(tab.rateBps)}` : 'Unavailable';
  top.append(title, rate);

  const url = document.createElement('div');
  url.className = 'tab-url';
  url.textContent = tab.url;
  url.title = tab.url;

  const total = document.createElement('div');
  total.className = 'total';
  const totalLabel = document.createElement('span');
  totalLabel.textContent = 'Total used';
  const totalValue = document.createElement('strong');
  totalValue.className = 'total-value';
  totalValue.textContent = tab.available ? formatData(tab.totalBytes) : '';
  total.append(totalLabel, totalValue);

  const details = document.createElement('div');
  details.className = 'details';
  const label = document.createElement('span');
  label.className = 'speed-label';
  label.textContent = 'Speed limit';
  const value = document.createElement('strong');
  value.className = 'speed-value';
  const speed = draftSpeeds.get(tab.id) ?? tab.speedPercent;
  value.textContent = speedLabel(speed);
  details.append(label, value);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '1';
  slider.value = speed;
  slider.disabled = !tab.available;
  slider.setAttribute('aria-label', `Speed limit for ${title.textContent}`);
  setSliderProgress(slider, speed);

  const numberControl = document.createElement('label');
  numberControl.className = 'number-control';
  numberControl.title = 'Choose a unit and enter a speed limit';
  const numberInput = document.createElement('input');
  numberInput.type = 'number';
  numberInput.inputMode = 'decimal';
  numberInput.min = '0';
  numberInput.step = 'any';
  const speedInput = formatSpeedInput(speed);
  numberInput.value = speedInput.value;
  numberInput.disabled = !tab.available;
  numberInput.setAttribute('aria-label', `Type speed for ${title.textContent}. Use percent, KB/s, or MB/s.`);
  const unitSelect = document.createElement('select');
  unitSelect.setAttribute('aria-label', `Speed unit for ${title.textContent}`);
  ['%', 'KB/s', 'MB/s'].forEach((unit) => {
    const option = document.createElement('option');
    option.value = unit;
    option.textContent = unit;
    unitSelect.append(option);
  });
  unitSelect.value = speedInput.unit;
  unitSelect.disabled = !tab.available;
  numberControl.append(numberInput, unitSelect);

  const sliderRow = document.createElement('div');
  sliderRow.className = 'slider-row';
  sliderRow.append(slider, numberControl);

  const limit = document.createElement('div');
  limit.className = 'limit';
  limit.textContent = limitLabel(speed);

  function syncSpeed(nextSpeed, formatInput = true) {
    draftSpeeds.set(tab.id, nextSpeed);
    slider.value = nextSpeed;
    if (formatInput) {
      const nextInput = formatSpeedInput(nextSpeed);
      numberInput.value = nextInput.value;
      unitSelect.value = nextInput.unit;
    }
    setSliderProgress(slider, nextSpeed);
    value.textContent = speedLabel(nextSpeed);
    limit.textContent = limitLabel(nextSpeed);
  }

  function restoreCommittedSpeed() {
    draftSpeeds.delete(tab.id);
    slider.value = tab.speedPercent;
    const committedInput = formatSpeedInput(tab.speedPercent);
    numberInput.value = committedInput.value;
    unitSelect.value = committedInput.unit;
    setSliderProgress(slider, tab.speedPercent);
    value.textContent = speedLabel(tab.speedPercent);
    limit.textContent = limitLabel(tab.speedPercent);
  }

  function startEditing() {
    editingTabId = tab.id;
  }

  function finishEditing() {
    window.setTimeout(() => {
      if (editingTabId === tab.id) editingTabId = null;
    }, 0);
  }

  slider.addEventListener('focus', startEditing);
  slider.addEventListener('blur', finishEditing);
  slider.addEventListener('input', () => {
    syncSpeed(Number(slider.value));
  });
  slider.addEventListener('change', () => updateSpeed(tab.id, Number(slider.value)));

  numberInput.addEventListener('focus', startEditing);
  numberInput.addEventListener('blur', finishEditing);
  unitSelect.addEventListener('focus', startEditing);
  unitSelect.addEventListener('blur', finishEditing);
  numberInput.addEventListener('input', () => {
    const typedSpeed = parseSpeedInput(numberInput.value, unitSelect.value);
    if (typedSpeed !== null) syncSpeed(typedSpeed, false);
  });
  numberInput.addEventListener('change', () => {
    const typedSpeed = parseSpeedInput(numberInput.value, unitSelect.value);
    if (typedSpeed === null) {
      restoreCommittedSpeed();
      return;
    }
    syncSpeed(typedSpeed);
    updateSpeed(tab.id, typedSpeed);
  });
  unitSelect.addEventListener('change', () => {
    const typedSpeed = parseSpeedInput(numberInput.value, unitSelect.value);
    if (typedSpeed === null) {
      restoreCommittedSpeed();
      return;
    }
    syncSpeed(typedSpeed, false);
    updateSpeed(tab.id, typedSpeed);
  });
  numberInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    numberInput.blur();
  });

  card.append(top, url, total, details, sliderRow, limit);
  if (!tab.available) {
    const error = document.createElement('div');
    error.className = 'tab-error';
    error.textContent = tab.error || 'Chrome could not monitor this tab.';
    card.append(error);
  }
  return card;
}

function renderTabs(tabs) {
  setBrowserTotal(tabs);
  tabsContainer.replaceChildren();
  if (!tabs.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Open a regular website to control its speed.';
    tabsContainer.append(empty);
    return;
  }
  tabs.forEach((tab) => tabsContainer.append(createTabCard(tab)));
}

async function refreshTabs() {
  if (isUpdating || isRefreshing || editingTabId !== null) return;
  isRefreshing = true;
  try {
    const response = await sendMessage({ type: 'getTabs' });
    if (!response?.ok) {
      setMessage(response?.error || 'Could not load tabs.', true);
      return;
    }
    renderTabs(response.tabs);
    const availableTabs = response.tabs.filter((tab) => tab.available).length;
    setMessage(`${availableTabs} tab${availableTabs === 1 ? '' : 's'} ready to monitor.`);
  } finally {
    isRefreshing = false;
  }
}

async function updateSpeed(tabId, speedPercent) {
  isUpdating = true;
  setMessage('Applying speed limit…');
  const response = await sendMessage({ type: 'setSpeed', tabId, speedPercent });
  isUpdating = false;
  draftSpeeds.delete(tabId);
  if (!response?.ok) setMessage(`Could not apply speed limit: ${response?.error || 'unknown error'}`, true);
  else setMessage('Speed limit updated.');
  await refreshTabs();
}

document.addEventListener('DOMContentLoaded', async () => {
  const saved = await chrome.storage.local.get('theme');
  const defaultTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(saved.theme || defaultTheme);
  await refreshTabs();
  refreshTimer = setInterval(refreshTabs, 1000);
});

themeToggle.addEventListener('click', async () => {
  const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
  await chrome.storage.local.set({ theme: nextTheme });
});

window.addEventListener('unload', () => clearInterval(refreshTimer));
