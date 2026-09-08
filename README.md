# Tab Speed Controller

A Chrome extension for controlling network speed per tab and monitoring data usage.

**Version:** `v1.1.0`

## Features

- Control the speed of each tab independently.
- Choose a speed unit:
  - `%`
  - `KB/s`
  - `MB/s`
- Pause the internet connection for a specific tab.
- Select `No limit` to restore the normal connection speed.
- View the current download rate for each tab.
- View total data usage per tab.
- View total browser usage for monitored tabs.
- Light mode and dark mode support.
- Simple Chrome-compatible popup interface.

## Requirements

- Google Chrome with Manifest V3 support.
- All extension files kept in the same folder.
- No server or additional runtime installation is required.

## Download and Install on Chrome

### 1. Download the project

On GitHub, click **Code**, select **Download ZIP**, and extract the downloaded file to a location on your computer.

> Do not delete or move the project folder after installation. Chrome loads the extension directly from this folder.

### 2. Open the Chrome Extensions page

Open Chrome and enter the following address:

```text
chrome://extensions
```

### 3. Enable Developer mode

Turn on **Developer mode** using the toggle in the top-right corner.

### 4. Load the extension

Click **Load unpacked**, then select the project folder containing:

```text
manifest.json
```

The **Tab Speed Controller** extension will appear in your Chrome extensions list.

### 5. Use the extension

1. Open a website that starts with `https://` or `http://`.
2. Click the Extensions icon in Chrome.
3. Pin **Tab Speed Controller** for quick access, if needed.
4. Open the extension popup.
5. Use the speed slider, or enter a value and select the desired unit.
6. Press Enter or change the unit to apply the speed limit.

## Speed Units

- `%`: Internal percentage-based speed control.
- `KB/s`: Limit the speed in kilobytes per second.
- `MB/s`: Limit the speed in megabytes per second.
- `0 KB/s`: Pause the connection for the selected tab.
- `100%`: Remove the added speed limit and restore normal network behavior.

## Required Permissions

The extension uses the following Chrome permissions:

- `debugger`: Apply network conditions to tabs.
- `tabs`: Read open tabs and their URLs.
- `activeTab`: Access the active tab when needed.
- `storage`: Save the selected light or dark theme.

The extension runs locally in Chrome and does not send browsing data to an external server.

## Important Notes

- Monitoring works on regular web pages only, not Chrome internal pages such as `chrome://extensions`.
- Usage is measured from the time a tab starts being monitored and may reset when the tab is closed or monitoring is disconnected.
- After changing extension files, open `chrome://extensions` and click the extension's reload button.

## Main Files

```text
manifest.json   Extension configuration
background.js   Network monitoring and speed limiting
popup.html      Extension popup interface and styling
popup.js        Popup behavior and interaction logic
```

## Version

`v1.1.0`
