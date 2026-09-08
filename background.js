const tabSessions = new Map();

function runtimeError() {
  return chrome.runtime.lastError?.message;
}

function isControllableUrl(url = '') {
  return /^https?:\/\//i.test(url);
}

function queryTabs() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, (tabs) => {
      const error = runtimeError();
      error ? reject(new Error(error)) : resolve(tabs);
    });
  });
}

function debuggerCommand(tabId, method, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, () => {
      const error = runtimeError();
      error ? reject(new Error(error)) : resolve();
    });
  });
}

function attachDebugger(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, '1.3', () => {
      const error = runtimeError();
      error ? reject(new Error(error)) : resolve();
    });
  });
}

async function monitorTab(tabId) {
  if (tabSessions.has(tabId)) return tabSessions.get(tabId);
  await attachDebugger(tabId);
  try {
    await debuggerCommand(tabId, 'Network.enable');
    const session = {
      speedPercent: 100,
      sampleBytes: 0,
      sampleStartedAt: Date.now(),
      rateBps: 0,
      totalBytes: 0
    };
    tabSessions.set(tabId, session);
    return session;
  } catch (error) {
    chrome.debugger.detach({ tabId }, () => void runtimeError());
    throw error;
  }
}

function percentToKilobytes(percent) {
  // An exponential scale keeps low values genuinely slow while still allowing
  // manual caps up to 50 MB/s: 1% = 8 KB/s and 99% = 50 MB/s.
  return Math.round(8 * Math.pow(51200 / 8, (percent - 1) / 98));
}

function conditionsFor(percent) {
  if (percent === 0) {
    return { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0, connectionType: 'none' };
  }
  if (percent === 100) {
    return { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: 'other' };
  }
  const throughput = percentToKilobytes(percent) * 1024;
  return { offline: false, latency: 0, downloadThroughput: throughput, uploadThroughput: throughput, connectionType: 'other' };
}

function currentRate(session) {
  const now = Date.now();
  const elapsed = now - session.sampleStartedAt;
  if (elapsed >= 250) {
    session.rateBps = Math.round((session.sampleBytes * 1000) / elapsed);
    session.sampleBytes = 0;
    session.sampleStartedAt = now;
  }
  return session.rateBps;
}

async function getMonitoredTab(tab) {
  try {
    const session = await monitorTab(tab.id);
    return {
      id: tab.id,
      title: tab.title || tab.url,
      url: tab.url,
      available: true,
      speedPercent: session.speedPercent,
      rateBps: currentRate(session),
      totalBytes: session.totalBytes
    };
  } catch (error) {
    return { id: tab.id, title: tab.title || tab.url, url: tab.url, available: false, error: error.message };
  }
}

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method !== 'Network.dataReceived' || !source.tabId) return;
  const session = tabSessions.get(source.tabId);
  if (!session) return;
  const receivedBytes = params.encodedDataLength ?? params.dataLength ?? 0;
  session.sampleBytes += receivedBytes;
  session.totalBytes += receivedBytes;
});

chrome.debugger.onDetach.addListener(({ tabId }) => tabSessions.delete(tabId));
chrome.tabs.onRemoved.addListener((tabId) => tabSessions.delete(tabId));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getTabs') {
    (async () => {
      try {
        const tabs = await queryTabs();
        const webTabs = tabs.filter((tab) => isControllableUrl(tab.url));
        const monitoredTabs = await Promise.all(webTabs.map(getMonitoredTab));
        sendResponse({ ok: true, tabs: monitoredTabs });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'setSpeed') {
    const speedPercent = Math.round(Number(message.speedPercent));
    if (!Number.isInteger(speedPercent) || speedPercent < 0 || speedPercent > 100) {
      sendResponse({ ok: false, error: 'Speed must be between 0% and 100%.' });
      return;
    }
    (async () => {
      try {
        const session = await monitorTab(message.tabId);
        await debuggerCommand(message.tabId, 'Network.emulateNetworkConditions', conditionsFor(speedPercent));
        session.speedPercent = speedPercent;
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }
});
