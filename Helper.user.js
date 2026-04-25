// ==UserScript==
// @name         TMN TDS Auto v17.04
// @namespace    http://tampermonkey.net/
// @version      17.04
// @description  v17.04 — OC Team Creation, Hot City, crusher system, whitelist, protection timer, draggable UI, Telegram alerts
// @author       You
// @match        *://www.tmn2010.net/login.aspx*
// @match        *://www.tmn2010.net/authenticated/*
// @match        *://www.tmn2010.net/Login.aspx*
// @match        *://www.tmn2010.net/Authenticated/*
// @match        *://www.tmn2010.net/Default.aspx*
// @match        *://www.tmn2010.net/default.aspx*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      api.telegram.org
// @updateURL    https://raw.githubusercontent.com/scoobyghub/v16/refs/heads/main/Helper.meta.js
// @downloadURL  https://raw.githubusercontent.com/scoobyghub/v16/refs/heads/main/Helper.user.js
// ==/UserScript==


(function () {
    try {
        const script = document.createElement('script');
        script.textContent = `
            window.confirm = function(msg) {
                console.log('[TMN][AUTO-CONFIRM]:', msg);
                return true;
            };
        `;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    } catch (e) {
        console.warn('[TMN] Failed to inject auto-confirm override:', e);
    }
})();

(function () {
  'use strict';

  // ---------------------------
  // LOCALE-INDEPENDENT DATE FORMATTER
  // Always outputs DD.MM.YYYY HH:MM:SS regardless of OS locale.
  // Fixes bug where US-locale machines sent dates as MM/DD/YYYY,
  // causing Telegram TTS to misread (e.g. "04.07.26" -> "July 4th").
  // ---------------------------
  function formatDateUK(d) {
    if (!(d instanceof Date)) d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ` +
           `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // ---------------------------
  // PAGE EXCLUSIONS — don't run automation UI on these pages
  // ---------------------------
  const EXCLUDED_PAGES = [
    '/authenticated/forum.aspx',
    '/authenticated/personal.aspx',
    '/authenticated/store.aspx?p=b',
    '/authenticated/statistics.aspx?p=C',
    '/authenticated/statistics.aspx?p=G',
    '/authenticated/statistics.aspx?p=p',
    '/authenticated/statistics.aspx?p=n'
  ];
  const currentPathLower = (window.location.pathname + window.location.search).toLowerCase();
  if (EXCLUDED_PAGES.some(page => currentPathLower.includes(page.toLowerCase()))) {
    console.log('[TMN] Excluded page — automation disabled on', currentPathLower);
    return; // Exit entire script
  }

  // ---------------------------
  // Minimal global CSS so host container sits above the page (always on top)
  // ---------------------------
  GM_addStyle(`
    #tmn-automation-host {
      position: fixed !important;
      top: 12px;
      right: 12px;
      z-index: 2147483647 !important;
      pointer-events: auto !important;
      visibility: hidden !important;
    }
    #tmn-automation-host.tmn-ready {
      visibility: visible !important;
    }
  `);

  // ---------------------------

  // ============================================================
  // AUTO-LOGIN CONFIGURATION
  // ============================================================
  const LOGIN_CONFIG = {
  USERNAME: GM_getValue('loginUsername', "username"),
  PASSWORD: GM_getValue('loginPassword', "password"),
  AUTO_SUBMIT_ENABLED: GM_getValue('autoSubmitEnabled', true),
  MAX_LOGIN_ATTEMPTS: 3,
  AUTO_SUBMIT_DELAY: 3000
};

  // ---------------------------
  // Logout Alert Configuration (defined early so it's available on login page)
  // ---------------------------
  const logoutAlertConfig = {
    tabFlash: GM_getValue('logoutTabFlash', true),
    browserNotify: GM_getValue('logoutBrowserNotify', true)
  };

  function saveLogoutAlertConfig() {
    GM_setValue('logoutTabFlash', logoutAlertConfig.tabFlash);
    GM_setValue('logoutBrowserNotify', logoutAlertConfig.browserNotify);
  }

  // Tab title flash state
  let titleFlashInterval = null;
  const originalTitle = document.title;

  function flashTabTitle() {
    if (titleFlashInterval) return; // Already flashing
    let toggle = false;
    titleFlashInterval = setInterval(() => {
      document.title = toggle ? '🔴 LOGIN NEEDED' : originalTitle;
      toggle = !toggle;
    }, 1000);
  }

  function stopFlashTabTitle() {
    if (titleFlashInterval) {
      clearInterval(titleFlashInterval);
      titleFlashInterval = null;
      document.title = originalTitle;
    }
  }

  function showLogoutBrowserNotification() {
    if (Notification.permission === 'granted') {
      new Notification('TMN2010 Session Expired', {
        body: 'Click to switch to tab and log back in',
        requireInteraction: true,
        icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
      });
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') {
          new Notification('TMN2010 Session Expired', {
            body: 'Click to switch to tab and log back in',
            requireInteraction: true
          });
        }
      });
    }
  }

  function triggerLogoutAlerts() {
    if (logoutAlertConfig.tabFlash) {
      flashTabTitle();
    }
    if (logoutAlertConfig.browserNotify) {
      showLogoutBrowserNotification();
    }
  }

  // ============================================================
  // CHECK IF WE'RE ON DEFAULT PAGE (SESSION REFRESH) - REDIRECT TO LOGIN
  // ============================================================
  const currentPath = window.location.pathname.toLowerCase();
  const currentSearch = window.location.search.toLowerCase();

  if (currentPath.includes("/default.aspx") && currentSearch.includes("show=1")) {
    console.log("[TMN] On Default.aspx?show=1 - waiting 6 seconds then redirecting to login...");
    // Create overlay to show status
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed", top: "10px", right: "10px",
      background: "rgba(0,0,0,0.85)", color: "#fff",
      padding: "12px", borderRadius: "8px",
      fontFamily: "system-ui, sans-serif", fontSize: "14px",
      zIndex: "9999", textAlign: "center",
      minWidth: "250px", border: "2px solid #f59e0b"
    });
    overlay.innerHTML = "🔄 <b>Session Refresh</b><br>Redirecting to login in <span id='tmn-countdown'>6</span>s...";
    document.body.appendChild(overlay);

    let countdown = 6;
    const countdownEl = document.getElementById('tmn-countdown');
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdownEl) countdownEl.textContent = countdown;
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        window.location.href = 'https://www.tmn2010.net/login.aspx';
      }
    }, 1000);

    return; // Don't run rest of script
  }

  // ============================================================
  // CHECK IF WE'RE ON LOGIN PAGE - HANDLE AUTO-LOGIN FIRST
  // ============================================================
  const isLoginPage = currentPath.includes("/login.aspx");

  if (isLoginPage) {
    // Trigger logout alerts (tab flash, browser notification) when redirected to login page
    triggerLogoutAlerts();

    // AUTO-LOGIN CODE
    const USERNAME_ID = "ctl00_main_txtUsername";
    const PASSWORD_ID = "ctl00_main_txtPassword";
    const LOGIN_BTN_ID = "ctl00_main_btnLogin";
    const TOKEN_SEL = "textarea[name='g-recaptcha-response'], #g-recaptcha-response";
    const ERROR_SEL = ".TMNErrorFont";

    const LS_LOGIN_ATTEMPTS = "tmnLoginAttempts";
    const LS_LOGIN_PAUSED = "tmnLoginPaused";
    const LS_LAST_TOKEN = "tmnLastTokenUsed";

    let loginAttempts = parseInt(localStorage.getItem(LS_LOGIN_ATTEMPTS) || "0", 10);
    let loginPaused = localStorage.getItem(LS_LOGIN_PAUSED) === "true";
    let lastTokenUsed = localStorage.getItem(LS_LAST_TOKEN) || "";
    let submitTimer = null;
    let countdownTimer = null;
    let loginOverlay = null;
    let submitLocked = false;  // Once countdown starts, block all re-scheduling
    let submitEndTime = 0;     // Fixed timestamp when submit will fire

    function log(...args) {
      console.log("[TMN AutoLogin]", ...args);
    }

    function updateLoginOverlay(message) {
      if (!loginOverlay) {
        loginOverlay = document.createElement("div");
        Object.assign(loginOverlay.style, {
          position: "fixed", top: "10px", right: "10px",
          background: "rgba(0,0,0,0.85)", color: "#fff",
          padding: "12px", borderRadius: "8px",
          fontFamily: "system-ui, sans-serif", fontSize: "14px",
          zIndex: "9999", whiteSpace: "pre-line",
          lineHeight: "1.4em", textAlign: "center",
          minWidth: "250px", border: "2px solid #007bff"
        });
        document.body.appendChild(loginOverlay);
      }
      console.log("[TMN AutoLogin]", message);
      loginOverlay.textContent = `TMN TDS AutoLogin v17.04\n${message}`;
    }

    function clearTimers() {
      if (submitTimer) { clearTimeout(submitTimer); submitTimer = null; }
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
      submitLocked = false;
      submitEndTime = 0;
    }

    function resetLoginState() {
      if (loginPaused || loginAttempts >= LOGIN_CONFIG.MAX_LOGIN_ATTEMPTS) {
        log("Resetting login state on login page");
        localStorage.setItem(LS_LOGIN_ATTEMPTS, "0");
        localStorage.setItem(LS_LOGIN_PAUSED, "false");
        loginAttempts = 0;
        loginPaused = false;
      }
    }

    function getCaptchaToken() {
      const element = document.querySelector(TOKEN_SEL);
      return element && typeof element.value === "string" ? element.value.trim() : "";
    }

    function isCaptchaCompleted() {
      const recaptchaResponse = document.querySelector('textarea[name="g-recaptcha-response"]');
      if (recaptchaResponse && recaptchaResponse.value && recaptchaResponse.value.length > 0) {
        return true;
      }
      const loginBtn = document.getElementById(LOGIN_BTN_ID);
      const usernameField = document.getElementById(USERNAME_ID);
      const passwordField = document.getElementById(PASSWORD_ID);
      if (loginBtn && !loginBtn.disabled &&
          usernameField && usernameField.value.length > 0 &&
          passwordField && passwordField.value.length > 0) {
        return true;
      }
      return false;
    }

    function fillCredentials() {
      if (LOGIN_CONFIG.USERNAME === "your_username_here" || LOGIN_CONFIG.PASSWORD === "your_password_here") {
        updateLoginOverlay("⚠️ Please set your USERNAME and PASSWORD\nin the script configuration.");
        return false;
      }
      const usernameField = document.getElementById(USERNAME_ID);
      const passwordField = document.getElementById(PASSWORD_ID);
      if (usernameField && passwordField) {
        usernameField.value = LOGIN_CONFIG.USERNAME;
        passwordField.value = LOGIN_CONFIG.PASSWORD;
        log("Credentials filled successfully");
        return true;
      }
      return false;
    }

    function canAutoLogin() {
      if (LOGIN_CONFIG.USERNAME === "your_username_here" || LOGIN_CONFIG.PASSWORD === "your_password_here") {
        return false;
      }
      if (!LOGIN_CONFIG.AUTO_SUBMIT_ENABLED) {
        updateLoginOverlay("🟢 Credentials filled.\nAuto-submit disabled.\nSolve captcha manually.");
        return false;
      }
      return true;
    }

    function attemptLogin() {
      // Don't clear timers yet — check if we can actually submit first
      const loginBtn = document.getElementById(LOGIN_BTN_ID);
      const currentToken = getCaptchaToken();
      if (!loginBtn || loginBtn.disabled || !currentToken) {
        // Token may have flickered — retry up to 3 times over 1.5s before giving up
        if (!attemptLogin._retries) attemptLogin._retries = 0;
        attemptLogin._retries++;
        if (attemptLogin._retries <= 3) {
          log(`Login not ready on attempt ${attemptLogin._retries}/3 — retrying in 500ms...`);
          updateLoginOverlay(`⚠️ Verifying captcha... retry ${attemptLogin._retries}/3`);
          setTimeout(attemptLogin, 500);
          return;
        }
        // Gave up — reset everything
        attemptLogin._retries = 0;
        clearTimers();
        updateLoginOverlay("⚠️ Login not ready - waiting for new captcha...");
        return;
      }
      attemptLogin._retries = 0;
      clearTimers();
      loginAttempts++;
      localStorage.setItem(LS_LOGIN_ATTEMPTS, loginAttempts.toString());
      lastTokenUsed = currentToken;
      localStorage.setItem(LS_LAST_TOKEN, lastTokenUsed);
      updateLoginOverlay(`🔐 Submitting login ${loginAttempts}/${LOGIN_CONFIG.MAX_LOGIN_ATTEMPTS}...`);
      loginBtn.click();
    }

    function scheduleAutoSubmit(delay = LOGIN_CONFIG.AUTO_SUBMIT_DELAY) {
      if (submitLocked) {
        log("Submit already locked — ignoring duplicate schedule request");
        return;
      }
      clearTimers();
      submitLocked = true;
      submitEndTime = Date.now() + delay;
      // Display uses the fixed end time — can never jump backwards
      function updateCountdownDisplay() {
        const remaining = Math.ceil((submitEndTime - Date.now()) / 1000);
        if (remaining > 0) {
          updateLoginOverlay(`✅ Captcha completed – submitting in ${remaining}s...`);
        }
      }
      updateCountdownDisplay();
      countdownTimer = setInterval(updateCountdownDisplay, 500); // Update twice per second for smoother display
      submitTimer = setTimeout(() => {
        clearInterval(countdownTimer);
        countdownTimer = null;
        attemptLogin();
      }, delay);
    }

    function checkLoginPage() {
      // If submit countdown is locked in, don't touch anything — just let it finish
      if (submitLocked) { return; }

      const errorElement = document.querySelector(ERROR_SEL);
      if (errorElement) {
        const errorMsg = (errorElement.textContent || "").trim().toLowerCase();
        if (errorMsg.includes("incorrect validation") || errorMsg.includes("invalid")) {
          // Login failed — clear everything and redirect Home → Login for a fresh session
          clearTimers();
          lastTokenUsed = "";
          localStorage.removeItem(LS_LAST_TOKEN);
          localStorage.setItem(LS_LOGIN_ATTEMPTS, "0");
          localStorage.setItem(LS_LOGIN_PAUSED, "false");
          const errorType = errorMsg.includes("incorrect validation") ? "Incorrect Validation" : "Invalid credentials";
          updateLoginOverlay(`❌ ${errorType}\n🔄 Redirecting Home for fresh session...`);
          log(`Login error: ${errorType} — redirecting to Default.aspx?show=1`);
          setTimeout(() => {
            window.location.href = 'https://www.tmn2010.net/Default.aspx?show=1';
          }, 2000);
          return;
        }
      }
      if (!canAutoLogin()) { return; }
      const loginBtn = document.getElementById(LOGIN_BTN_ID);
      const captchaCompleted = isCaptchaCompleted();
      const currentToken = getCaptchaToken();
      if (loginBtn && !loginBtn.disabled && captchaCompleted && currentToken && currentToken !== lastTokenUsed) {
        if (!submitTimer) {
          updateLoginOverlay("✅ Captcha completed - auto-submitting...");
          scheduleAutoSubmit(LOGIN_CONFIG.AUTO_SUBMIT_DELAY + Math.floor(Math.random() * 2000));
        }
      } else {
        if (submitTimer && (!captchaCompleted || !currentToken || (loginBtn && loginBtn.disabled))) {
          clearTimers();
          if (!captchaCompleted) {
            updateLoginOverlay("⏳ Waiting for captcha completion...");
          } else if (!currentToken) {
            updateLoginOverlay("⏳ Waiting for captcha token...");
          } else {
            updateLoginOverlay("⏳ Waiting for login button...");
          }
        }
      }
    }

    function initializeAutoLogin() {
      log("TMN AutoLogin initialized");
      resetLoginState();
      const credentialsFilled = fillCredentials();
      if (!credentialsFilled) { return; }
      if (canAutoLogin()) {
        updateLoginOverlay("🟢 Auto-login enabled.\nSolve captcha to continue...");
        const checkInterval = setInterval(checkLoginPage, 1000);
        window.addEventListener('beforeunload', () => {
          clearInterval(checkInterval);
          clearTimers();
        });
      }
    }

    // Initialize auto-login
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeAutoLogin);
    } else {
      setTimeout(initializeAutoLogin, 500);
    }

    // Exit early - don't run main automation on login page
    return;
  }

  // ============================================================
  // RESET LOGIN ATTEMPTS WHEN SUCCESSFULLY AUTHENTICATED
  // ============================================================
  if (currentPath.includes("/authenticated/")) {
    const loginAttempts = parseInt(localStorage.getItem("tmnLoginAttempts") || "0", 10);
    const loginPaused = localStorage.getItem("tmnLoginPaused") === "true";
    if (loginAttempts > 0 || loginPaused) {
      console.log("[TMN] Successfully logged in - resetting login attempts");
      localStorage.setItem("tmnLoginAttempts", "0");
      localStorage.setItem("tmnLoginPaused", "false");
      localStorage.removeItem("tmnLastTokenUsed");
    }
  }

// ============================================================
// CAPTCHA HANDLER FOR AUTHENTICATED PAGES
// ============================================================
if (currentPath.includes("/authenticated/")) {
  function handleAuthenticatedCaptcha() {
    const captchaFrame = document.querySelector('iframe[src*="recaptcha"]');
    const captchaResponse = document.querySelector('textarea[name="g-recaptcha-response"]');

    if (captchaFrame || captchaResponse) {
      const token = captchaResponse?.value?.trim();

      if (token && token.length > 0) {
        // Captcha completed - find and click submit
        const submitBtn = document.querySelector('input[type="submit"], button[type="submit"]') ||
                         document.getElementById('ctl00_main_btnVerify') ||
                         Array.from(document.querySelectorAll('input, button')).find(b =>
                           b.value?.toLowerCase().includes('verify') ||
                           b.textContent?.toLowerCase().includes('verify')
                         );

        if (submitBtn && !submitBtn.disabled) {
          console.log('[TMN] Captcha completed - submitting...');
          setTimeout(() => submitBtn.click(), 1000);
        }
      }
    }
  }

  setInterval(handleAuthenticatedCaptcha, 1000);
}

  // Config + State
  // ---------------------------
  const config = {
    crimeInterval: GM_getValue('crimeInterval', 125),
    gtaInterval: GM_getValue('gtaInterval', 245),
    jailbreakInterval: GM_getValue('jailbreakInterval', 3),
    jailCheckInterval: GM_getValue('jailCheckInterval', 5),
    boozeInterval: GM_getValue('boozeInterval', 120),
    boozeBuyAmount: GM_getValue('boozeBuyAmount', 5),
    boozeSellAmount: GM_getValue('boozeSellAmount', 1),
    healthCheckInterval: GM_getValue('healthCheckInterval', 30),
    garageInterval: GM_getValue('garageInterval', 300),
    minHealthThreshold: GM_getValue('minHealthThreshold', 90),
    targetHealth: GM_getValue('targetHealth', 100)
  };

  // ---------------------------
  // Human-like Delays (anti-detection)
  // ---------------------------
  const DELAYS = {
    quick: [1100, 1900],
    normal: [1200, 3000],
    slow: [2500, 6000],
    error: [5000, 15000]
  };

  function randomDelay(range = DELAYS.normal) {
    const r = Array.isArray(range) ? range : DELAYS.normal;
    const min = Math.max(0, Number(r[0] || 0));
    const max = Math.max(min, Number(r[1] || min));
    const u = (Math.random() + Math.random() + Math.random()) / 3;
    let ms = Math.floor(min + (max - min) * u);
    ms += Math.floor((Math.random() - 0.5) * 240);
    if (Math.random() < 0.03) ms += 400 + Math.floor(Math.random() * 1200);
    return Math.max(0, ms);
  }

  function humanDelay(range = DELAYS.normal) {
    return new Promise(resolve => setTimeout(resolve, randomDelay(range)));
  }

    // ---------------------------
  // Telegram Configuration
  // ---------------------------
  const telegramConfig = {
    botToken: GM_getValue('telegramBotToken', ''),
    chatId: GM_getValue('telegramChatId', ''),
    enabled: GM_getValue('telegramEnabled', false),
    notifyCaptcha: GM_getValue('notifyCaptcha', true),
    notifyMessages: GM_getValue('notifyMessages', true),
    lastMessageCheck: GM_getValue('lastMessageCheck', 0),
    messageCheckInterval: GM_getValue('messageCheckInterval', 60),
    notifySqlCheck: GM_getValue('notifySqlCheck', true),
    notifyLogout: GM_getValue('notifyLogout', true)
};

  function saveTelegramConfig() {
    GM_setValue('telegramBotToken', telegramConfig.botToken);
    GM_setValue('telegramChatId', telegramConfig.chatId);
    GM_setValue('telegramEnabled', telegramConfig.enabled);
    GM_setValue('notifyCaptcha', telegramConfig.notifyCaptcha);
    GM_setValue('notifyMessages', telegramConfig.notifyMessages);
    GM_setValue('lastMessageCheck', telegramConfig.lastMessageCheck);
    GM_setValue('messageCheckInterval', telegramConfig.messageCheckInterval);
    GM_setValue('notifySqlCheck', telegramConfig.notifySqlCheck);
    GM_setValue('notifyLogout', telegramConfig.notifyLogout);
  }

  let state = {
    autoCrime: GM_getValue('autoCrime', false),
    autoGTA: GM_getValue('autoGTA', false),
    autoJail: GM_getValue('autoJail', false),
    autoBooze: GM_getValue('autoBooze', false),
    autoHealth: GM_getValue('autoHealth', false),
    autoGarage: GM_getValue('autoGarage', false),
    autoCrusher: GM_getValue('autoCrusher', true),
    // crusherOwned: null = unknown (try it), true = owns crusher, false = doesn't own crusher
    crusherOwned: GM_getValue('crusherOwned', null),
    lastCrime: GM_getValue('lastCrime', 0),
    lastGTA: GM_getValue('lastGTA', 0),
    lastJail: GM_getValue('lastJail', 0),
    lastBooze: GM_getValue('lastBooze', 0),
    lastHealth: GM_getValue('lastHealth', 0),
    lastGarage: GM_getValue('lastGarage', 0),
    selectedCrimes: GM_getValue('selectedCrimes', [1,3,5]),
    selectedGTAs: GM_getValue('selectedGTAs', [5]),
    playerName: GM_getValue('playerName', ''),
    inJail: GM_getValue('inJail', false),
    panelCollapsed: {
      crime: GM_getValue('crimeCollapsed', false),
      gta: GM_getValue('gtaCollapsed', false),
      booze: GM_getValue('boozeCollapsed', false)
    },
    panelMinimized: GM_getValue('panelMinimized', false),
    isPerformingAction: false,
    lastJailCheck: GM_getValue('lastJailCheck', 0),
    currentAction: GM_getValue('currentAction', ''),
    needsRefresh: GM_getValue('needsRefresh', false),
    pendingAction: GM_getValue('pendingAction', ''),
    buyingHealth: GM_getValue('buyingHealth', false),
    autoOC: GM_getValue('autoOC', false),
    autoDTM: GM_getValue('autoDTM', false),
    notifyOCDTMReady: GM_getValue('notifyOCDTMReady', true),
    whitelistEnabled: GM_getValue('whitelistEnabled', false),
    whitelistNames: GM_getValue('whitelistNames', []),
    carCategories: GM_getValue('carCategories', {}),
    // OC Team Creation
    createOC: GM_getValue('createOC', false),
    ocTeamTransporter: GM_getValue('ocTeamTransporter', ''),
    ocTeamWeaponMaster: GM_getValue('ocTeamWeaponMaster', ''),
    ocTeamExplosive: GM_getValue('ocTeamExplosive', ''),
    ocScheduledTime: GM_getValue('ocScheduledTime', ''),
    ocType: GM_getValue('ocType', 'Casino')
  };

  let automationPaused = false;

  function saveState() {
    GM_setValue('autoCrime', state.autoCrime);
    GM_setValue('autoGTA', state.autoGTA);
    GM_setValue('autoJail', state.autoJail);
    GM_setValue('autoBooze', state.autoBooze);
    GM_setValue('autoHealth', state.autoHealth);
    GM_setValue('autoGarage', state.autoGarage);
    GM_setValue('autoCrusher', state.autoCrusher);
    GM_setValue('crusherOwned', state.crusherOwned);
    GM_setValue('lastCrime', state.lastCrime);
    GM_setValue('lastGTA', state.lastGTA);
    GM_setValue('lastJail', state.lastJail);
    GM_setValue('lastBooze', state.lastBooze);
    GM_setValue('lastHealth', state.lastHealth);
    GM_setValue('lastGarage', state.lastGarage);
    GM_setValue('selectedCrimes', state.selectedCrimes);
    GM_setValue('selectedGTAs', state.selectedGTAs);
    GM_setValue('playerName', state.playerName);
    GM_setValue('inJail', state.inJail);
    GM_setValue('crimeCollapsed', state.panelCollapsed.crime);
    GM_setValue('gtaCollapsed', state.panelCollapsed.gta);
    GM_setValue('boozeCollapsed', state.panelCollapsed.booze);
    GM_setValue('panelMinimized', state.panelMinimized);
    GM_setValue('lastJailCheck', state.lastJailCheck);
    GM_setValue('currentAction', state.currentAction);
    GM_setValue('needsRefresh', state.needsRefresh);
    GM_setValue('pendingAction', state.pendingAction);
    GM_setValue('buyingHealth', state.buyingHealth);
    GM_setValue('autoOC', state.autoOC);
    GM_setValue('autoDTM', state.autoDTM);
    GM_setValue('notifyOCDTMReady', state.notifyOCDTMReady);
    GM_setValue('whitelistEnabled', state.whitelistEnabled);
    GM_setValue('whitelistNames', state.whitelistNames);
    GM_setValue('carCategories', state.carCategories);
    GM_setValue('createOC', state.createOC);
    GM_setValue('ocTeamTransporter', state.ocTeamTransporter);
    GM_setValue('ocTeamWeaponMaster', state.ocTeamWeaponMaster);
    GM_setValue('ocTeamExplosive', state.ocTeamExplosive);
    GM_setValue('ocScheduledTime', state.ocScheduledTime);
    GM_setValue('ocType', state.ocType);
  }

  // ---------------------------
  // Tab Manager - Prevents multiple tabs from conflicting
  // Single tab enforcement: Only one tab can run automation at a time
  // ---------------------------
  const LS_TAB_MASTER = "tmnMasterTab";
  const LS_TAB_HEARTBEAT = "tmnTabHeartbeat";
  const LS_SCRIPT_CHECK_ACTIVE = "tmnScriptCheckActive";
  const LS_TAB_LOCK = "tmnTabLock"; // Additional lock for atomic operations

  class TabManager {
    constructor() {
      this.tabId = this.generateTabId();
      this.heartbeatInterval = null;
      this.isMasterTab = false;
      this.HEARTBEAT_INTERVAL = 2000; // 2 seconds - more frequent heartbeat
      this.MASTER_TIMEOUT = 6000; // 6 seconds - faster takeover if master dies
      this.initialized = false;
    }

    generateTabId() {
      return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    checkMasterStatus() {
      const currentMaster = localStorage.getItem(LS_TAB_MASTER);
      const lastHeartbeat = parseInt(localStorage.getItem(LS_TAB_HEARTBEAT) || "0", 10);
      const now = Date.now();

      // Check if we are the current master
      if (currentMaster === this.tabId) {
        this.isMasterTab = true;
        // Update heartbeat
        localStorage.setItem(LS_TAB_HEARTBEAT, now.toString());
        return true;
      }

      // If no master or master hasn't sent heartbeat recently, try to become master
      if (!currentMaster || (now - lastHeartbeat) > this.MASTER_TIMEOUT) {
        // Use lock to prevent race condition when multiple tabs try to become master
        const lock = localStorage.getItem(LS_TAB_LOCK);
        if (!lock || (now - parseInt(lock, 10)) > 1000) {
          localStorage.setItem(LS_TAB_LOCK, now.toString());
          // Double-check after setting lock
          setTimeout(() => {
            const stillNoMaster = !localStorage.getItem(LS_TAB_MASTER) ||
              (Date.now() - parseInt(localStorage.getItem(LS_TAB_HEARTBEAT) || "0", 10)) > this.MASTER_TIMEOUT;
            if (stillNoMaster) {
              this.becomeMaster();
            }
          }, 100);
        }
        return this.isMasterTab;
      }

      // Another tab is master
      this.isMasterTab = false;
      return false;
    }

    becomeMaster() {
      this.isMasterTab = true;
      localStorage.setItem(LS_TAB_MASTER, this.tabId);
      localStorage.setItem(LS_TAB_HEARTBEAT, Date.now().toString());
      console.log(`[TMN] Tab ${this.tabId.substr(0, 12)}... became master`);
      this.startHeartbeat();
    }

    startHeartbeat() {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }

      this.heartbeatInterval = setInterval(() => {
        if (this.isMasterTab) {
          const currentMaster = localStorage.getItem(LS_TAB_MASTER);
          // Verify we're still the master before updating heartbeat
          if (currentMaster === this.tabId) {
            localStorage.setItem(LS_TAB_HEARTBEAT, Date.now().toString());
          } else {
            console.log("[TMN] Lost master status, stopping heartbeat");
            this.stopHeartbeat();
            this.isMasterTab = false;
          }
        }
      }, this.HEARTBEAT_INTERVAL);
    }

    stopHeartbeat() {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
    }

    releaseMaster() {
      if (this.isMasterTab) {
        // Only clear if we're still the master
        const currentMaster = localStorage.getItem(LS_TAB_MASTER);
        if (currentMaster === this.tabId) {
          localStorage.removeItem(LS_TAB_MASTER);
          localStorage.removeItem(LS_TAB_HEARTBEAT);
        }
        this.stopHeartbeat();
        this.isMasterTab = false;
        console.log("[TMN] Released master tab status");
      }
    }

    // Force this tab to become master (used when user explicitly wants this tab active)
    forceMaster() {
      localStorage.setItem(LS_TAB_MASTER, this.tabId);
      localStorage.setItem(LS_TAB_HEARTBEAT, Date.now().toString());
      this.isMasterTab = true;
      this.startHeartbeat();
      console.log(`[TMN] Tab ${this.tabId.substr(0, 12)}... forced to become master`);
    }

    hasActiveMaster() {
      const currentMaster = localStorage.getItem(LS_TAB_MASTER);
      const lastHeartbeat = parseInt(localStorage.getItem(LS_TAB_HEARTBEAT) || "0", 10);
      const now = Date.now();

      return currentMaster &&
        currentMaster !== this.tabId &&
        (now - lastHeartbeat) <= this.MASTER_TIMEOUT;
    }

    getMasterTabId() {
      return localStorage.getItem(LS_TAB_MASTER);
    }
  }

  // Create tab manager instance
  const tabManager = new TabManager();

  // ---------------------------
  // Auto-Resume Script Check Configuration
  // ---------------------------
  const autoResumeConfig = {
    enabled: GM_getValue('autoResumeEnabled', true),
    lastScriptCheckTime: 0
  };

  function saveAutoResumeConfig() {
    GM_setValue('autoResumeEnabled', autoResumeConfig.enabled);
  }

  // ---------------------------
  // Stats Collection Configuration
  // ---------------------------
  const statsCollectionConfig = {
    enabled: GM_getValue('statsCollectionEnabled', true),
    interval: GM_getValue('statsCollectionInterval', 60), // 1 minutes default
    lastCollection: GM_getValue('lastStatsCollection', 0),
    cachedStats: GM_getValue('cachedGameStats', null)
  };

  function saveStatsCollectionConfig() {
    GM_setValue('statsCollectionEnabled', statsCollectionConfig.enabled);
    GM_setValue('statsCollectionInterval', statsCollectionConfig.interval);
    GM_setValue('lastStatsCollection', statsCollectionConfig.lastCollection);
    GM_setValue('cachedGameStats', statsCollectionConfig.cachedStats);
  }

  // ---------------------------
  // Enhanced Reset Function - Clears ALL stored values
  // ---------------------------
  function resetStorage() {
    if (confirm('Are you sure you want to reset ALL settings and timers? This cannot be undone.')) {
      // Comprehensive list of ALL possible stored values
      const allKeys = [
        // State values
        'autoCrime', 'autoGTA', 'autoJail', 'autoBooze', 'lastCrime', 'lastGTA', 'lastJail', 'lastBooze',
        'selectedCrimes', 'selectedGTAs', 'playerName', 'inJail', 'crimeCollapsed', 'gtaCollapsed',
        'boozeCollapsed', 'panelMinimized', 'lastJailCheck', 'currentAction', 'needsRefresh', 'pendingAction',
        'autoOC', 'autoDTM',

        // Config values
        'crimeInterval', 'gtaInterval', 'jailbreakInterval', 'jailCheckInterval', 'boozeInterval',
        'boozeBuyAmount', 'boozeSellAmount',

        // Action tracking
        'actionStartTime',



        // Auto-Resume Config
        'autoResumeEnabled',

        // Stats Collection Config
        'statsCollectionEnabled', 'statsCollectionInterval', 'lastStatsCollection', 'cachedGameStats',

        // Health threshold config
        'minHealthThreshold', 'targetHealth',

        // Cached display values
      ];

      // Clear localStorage tab manager keys
      localStorage.removeItem('tmnMasterTab');
      localStorage.removeItem('tmnTabHeartbeat');
      localStorage.removeItem('tmnScriptCheckActive');

      // Clear OC/DTM timer keys
      localStorage.removeItem('tmnDTMTimerStatus');
      localStorage.removeItem('tmnOCTimerStatus');

      // Clear each value individually
      allKeys.forEach(key => GM_setValue(key, undefined));

      // Also try to clear any unexpected values by getting all known values and resetting them
      try {
        const knownValues = GM_getValue('knownValues', []);
        knownValues.forEach(key => GM_setValue(key, undefined));
        GM_setValue('knownValues', []);
      } catch (e) {
        console.log('No additional values to clear');
      }

      alert('ALL settings and data have been reset! Refreshing the page...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }

  // Crime and GTA definitions
  const crimeOptions = [
    { id: 1, name: "Credit card fraud", element: "ctl00_main_btnCrime1" },
    { id: 2, name: "Rob gas station", element: "ctl00_main_btnCrime2" },
    { id: 3, name: "Sell illegal weapons", element: "ctl00_main_btnCrime3" },
    { id: 4, name: "Rob a store", element: "ctl00_main_btnCrime4" },
    { id: 5, name: "Rob a bank", element: "ctl00_main_btnCrime5" }
  ];

  const gtaOptions = [
    { id: 1, name: "Public parking lot", value: "1" },
    { id: 2, name: "Building parking lot", value: "2" },
    { id: 3, name: "Residential place", value: "3" },
    { id: 4, name: "Pick Pocket Keys", value: "4" },
    { id: 5, name: "Car jack from street", value: "5" }
  ];

  // ---------------------------
  // ---------------------------
  // Status Bar Parser (shared utility)
  // ---------------------------
  function parseStatusBar() {
    const stats = {
      city: '', rank: '', rankPercent: 0, network: '', money: 0,
      health: 0, fmj: 0, jhp: 0, credits: 0, updateTime: '', timestamp: Date.now()
    };
    try {
      const cityEl = document.getElementById('ctl00_userInfo_lblcity');
      if (cityEl) stats.city = cityEl.textContent.trim();
      const rankEl = document.getElementById('ctl00_userInfo_lblrank');
      if (rankEl) stats.rank = rankEl.textContent.trim();
      const rankPercEl = document.getElementById('ctl00_userInfo_lblRankbarPerc');
      if (rankPercEl) {
        const percText = rankPercEl.textContent.trim();
        const match = percText.match(/\(([\d]+)[.,]?(\d+)?%\)/);
        if (match) {
          stats.rankPercent = parseFloat(match[1] + '.' + (match[2] || '00'));
        } else {
          const fb = percText.match(/([\d]+[.,][\d]+)%/);
          if (fb) stats.rankPercent = parseFloat(fb[1].replace(',', '.'));
        }
      }
      const moneyEl = document.getElementById('ctl00_userInfo_lblcash');
      if (moneyEl) stats.money = parseInt(moneyEl.textContent.trim().replace(/[$,]/g, '')) || 0;
      const healthEl = document.getElementById('ctl00_userInfo_lblhealth');
      if (healthEl) stats.health = parseInt(healthEl.textContent.trim().replace('%', '')) || 0;
      const networkEl = document.getElementById('ctl00_userInfo_lblnetwork');
      if (networkEl) stats.network = networkEl.textContent.trim();
      const fmjEl = document.getElementById('ctl00_userInfo_lblfmj');
      if (fmjEl) stats.fmj = parseInt(fmjEl.textContent.trim()) || 0;
      const jhpEl = document.getElementById('ctl00_userInfo_lbljhp');
      if (jhpEl) stats.jhp = parseInt(jhpEl.textContent.trim()) || 0;
      const creditsEl = document.getElementById('ctl00_userInfo_lblcredits');
      if (creditsEl) stats.credits = parseInt(creditsEl.textContent.trim()) || 0;
      const updateTimeEl = document.getElementById('ctl00_userInfo_lblUpdateTime');
      if (updateTimeEl) stats.updateTime = updateTimeEl.textContent.trim();
    } catch (e) {
      console.warn('Error parsing status bar:', e);
      return null;
    }
    return stats;
  }

  // ---------------------------
  // Helper Functions
  // ---------------------------
  let shadowRoot = null;

  function updateStatus(msg) {
    if (shadowRoot) {
      const el = shadowRoot.querySelector("#tmn-status");
      const jailIcon = state.inJail ? "🔒" : "✅";

      const pendingInfo = state.pendingAction ? `<br>Pending: ${state.pendingAction}` : '';
      const fullStatus = `Status: ${escapeHtml(msg)}<br>Player: ${escapeHtml(state.playerName)}<br>Jail: ${jailIcon}${pendingInfo}<br>Last Crime: ${formatTime(state.lastCrime)}<br>Last GTA: ${formatTime(state.lastGTA)}<br>Last Booze: ${formatTime(state.lastBooze)}`;

      if (el) el.innerHTML = fullStatus;
    }
    console.log('[TMN Auto]', msg);
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

// ---------------------------
  // Telegram Functions (COMPLETE)
  // ---------------------------

  function sendTelegramMessage(message) {
    console.log('[Telegram] Attempting to send message...');

    if (!telegramConfig.enabled) {
      console.log('[Telegram] Notifications are disabled in settings');
      return;
    }

    if (!telegramConfig.botToken || !telegramConfig.chatId) {
      console.error('[Telegram] Bot Token or Chat ID is missing!');
      return;
    }

    const url = `https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`;

    GM_xmlhttpRequest({
      method: 'POST',
      url: url,
      headers: {
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({
        chat_id: telegramConfig.chatId,
        text: message,
        parse_mode: 'HTML'
      }),
      onload: function(response) {
        if (response.status === 200) {
          console.log('[Telegram] âœ“ Message sent successfully!');
        } else {
          console.error('[Telegram] âœ— Failed to send message:', response.status);
          console.error('[Telegram] Response:', response.responseText);
        }
      },
      onerror: function(error) {
        console.error('[Telegram] âœ— Network error:', error);
      }
    });
  }

  function testTelegramConnection() {
    if (!telegramConfig.botToken || !telegramConfig.chatId) {
      alert('Please configure both Bot Token and Chat ID first!');
      return;
    }

    sendTelegramMessage('🎮 <b>TMN 2010 Automation</b>\n\nTelegram notifications are working!\n\nYou will receive alerts for:\n• Script checks (captcha)\n• New messages\n• SQL script checks\n• Logout/timeout\n• Low health alerts');
    alert('Test message sent! Check console (F12) and your Telegram.');
  }

  // Health alert tracking
  let lastHealthAlertTime = 0;
  const HEALTH_ALERT_INTERVAL = 10000; // 10 seconds between alerts

  function checkForLowHealth() {
    if (!telegramConfig.enabled) return false;

    const health = getHealthPercent();
    const now = Date.now();

    // Check if health is below threshold
    if (health < config.minHealthThreshold) {
      // Only send alert every 10 seconds
      if (now - lastHealthAlertTime >= HEALTH_ALERT_INTERVAL) {
        lastHealthAlertTime = now;

        console.log(`[Telegram] Low health detected: ${health}%`);

        // Send alert IMMEDIATELY (never delay)
        sendTelegramMessage(
          '🏥 <b>LOW HEALTH ALERT!</b>\n\n' +
          `Player: ${state.playerName || 'Unknown'}\n` +
          `Current Health: <b>${health}%</b>\n` +
          `Threshold: ${config.minHealthThreshold}%\n` +
          `Time: ${formatDateUK()}\n\n` +
          (state.autoHealth ?
            '💊 Auto-buy is ON - attempting to restore health' :
            '⚠️ Auto-buy is OFF - scripts may stop!')
        );

        // Then try to fetch and send mail content as a follow-up (fire and forget)
        setTimeout(() => {
          fetchLatestMailContent().then(mailText => {
            if (mailText) {
              sendTelegramMessage(
                `📬 <b>Latest Mail:</b>\n<pre>${escapeHtml(mailText.substring(0, 500))}</pre>`
              );
            }
          }).catch(() => {}); // Silently fail
        }, 5000);

        console.log('[Telegram] Low health alert sent');
        return true;
      }
    } else {
      // Reset alert timer when health is OK
      lastHealthAlertTime = 0;
    }

    return false;
  }

  let captchaNotificationSent = false;

  function checkForCaptcha() {
    if (!telegramConfig.enabled || !telegramConfig.notifyCaptcha) {
      return false;
    }

    if (isOnCaptchaPage()) {
      if (!captchaNotificationSent) {
        console.log('[Telegram] Captcha detected! Sending notification...');

        sendTelegramMessage(
          '⚠️ <b>Script Check Required!</b>\n\n' +
          `Player: ${state.playerName || 'Unknown'}\n` +
          `Time: ${formatDateUK()}\n\n` +
          '🛑 All automation is PAUSED\n' +
          '👉 Please complete the captcha to resume'
        );

        captchaNotificationSent = true;
        console.log('[Telegram] Captcha notification sent');
      }
      return true;
    } else {
      captchaNotificationSent = false;
    }

    return false;
  }

  let lastMessageCount = 0;

  function checkForNewMessages() {
    if (!telegramConfig.enabled && !state.autoOC && !state.autoDTM) return false;

    let hasNewMessage = false;
    let messageCount = 0;

    // Method 1: Check the message span element (MOST RELIABLE)
    const msgSpan = document.querySelector('span[id*="imgMessages"]');
    if (msgSpan) {
      const titleAttr = msgSpan.getAttribute('title');
      const classAttr = msgSpan.getAttribute('class');
      if (titleAttr && titleAttr !== '0') {
        messageCount = parseInt(titleAttr) || 0;
        if (messageCount > 0) hasNewMessage = true;
      }
      if (!hasNewMessage && classAttr) {
        const classMatch = classAttr.match(/message(\d+)/);
        if (classMatch) { messageCount = parseInt(classMatch[1]) || 1; hasNewMessage = true; }
      }
    }

    // Method 2: Check page title for "X new mails"
    if (!hasNewMessage) {
      const titleMatch = document.title.match(/(\d+)\s+new\s+mails?/i);
      if (titleMatch) { hasNewMessage = true; messageCount = parseInt(titleMatch[1]); }
    }

    // Method 3: Check for the new_message_1.gif image
    if (!hasNewMessage) {
      const newMessageImg = document.querySelector('img[src*="new_message_1.gif"]');
      if (newMessageImg) { hasNewMessage = true; messageCount = 1; }
    }

    // When new messages detected, trigger immediate mail check (bypasses the 60s interval)
    // The unifiedMailCheck handles all Telegram notifications — no duplicate sends
    if (hasNewMessage && messageCount > lastMessageCount) {
      console.log(`[TMN][MAIL] New mail indicator detected (${messageCount} unread) — triggering immediate check`);
      lastMessageCount = messageCount;
      // Clear the last check timestamp to force immediate check on next mainLoop tick
      localStorage.setItem('tmnLastMailCheckTs', '0');
      return true;
    } else if (hasNewMessage) {
      lastMessageCount = messageCount;
    } else {
      lastMessageCount = 0;
    }

    return false;
  }

  let sqlCheckNotificationSent = false;

  function checkForSqlScriptCheck() {
    if (!telegramConfig.enabled || !telegramConfig.notifySqlCheck) {
      return false;
    }

    // Method 1: Check for "Important message" div
    const importantMsgDiv = document.querySelector('div.NewGridTitle');
    const hasImportantMessage = importantMsgDiv && importantMsgDiv.textContent.includes('Important message');

    // Method 2: Check page content for SQL script check indicators
    const pageText = document.body.textContent;
    const hasSqlCheck = pageText.includes('SQL Script Check') ||
                        pageText.includes('SQL what your favourite') ||
                        pageText.includes('tell SQL what');

    if ((hasImportantMessage || hasSqlCheck) && !sqlCheckNotificationSent) {
      console.log('[Telegram] SQL Script Check detected! Sending notification...');

      // Try to extract the question
      let question = 'Please answer the admin question';
      const paragraphs = document.querySelectorAll('p, div');
      for (let p of paragraphs) {
        const text = p.textContent;
        if (text.includes('SQL') && text.includes('?')) {
          question = text.trim();
          break;
        }
      }

      sendTelegramMessage(

        '❗ <b>SQL SCRIPT CHECK!</b>\n\n' +
        `Player: ${state.playerName || 'Unknown'}\n` +
        `Time: ${formatDateUK()}\n\n` +
        '🛑 Admin SQL needs a response!\n' +
        `Question: ${question}\n\n` +
        '👉 Please answer the question to continue'
      );

      sqlCheckNotificationSent = true;
      console.log('[Telegram] SQL script check notification sent');
      return true;
    } else if (!hasImportantMessage && !hasSqlCheck) {
      // Reset flag when no longer on SQL check page
      sqlCheckNotificationSent = false;
    }

    return false;
  }

let logoutNotificationSent = false;

  function checkForLogout() {
    if (!telegramConfig.enabled || !telegramConfig.notifyLogout) {
      return false;
    }

    const currentUrl = window.location.href.toLowerCase();

    // ONLY trigger on actual login page, not authenticated pages
    const isLoginPage = currentUrl.includes('login.aspx');

    // Must be on login.aspx to proceed
    if (!isLoginPage) {
      // Reset flag when on authenticated pages
      if (currentUrl.includes('/authenticated/')) {
        logoutNotificationSent = false;
        // Stop tab flash if we've logged back in
        stopFlashTabTitle();
      }
      return false;
    }

    // Now we're definitely on login.aspx - check if it's auto logout
    const isAutoLogout = currentUrl.includes('act=out') || currentUrl.includes('auto=true');

    // Double-check with login form elements
    const hasLoginForm = document.querySelector('input[name="ctl00$main$txtUsername"]') !== null ||
                         document.querySelector('input[type="password"]') !== null ||
                         document.querySelector('input[value="Login"]') !== null;

    if (hasLoginForm && !logoutNotificationSent) {
      console.log('[Telegram] ACTUAL Logout/Login page detected! Sending notification...');
      console.log('[Telegram] URL:', currentUrl);
      console.log('[Telegram] Is auto logout:', isAutoLogout);

      const logoutType = isAutoLogout ? 'AUTO LOGOUT' : 'LOGOUT';
      const reason = isAutoLogout ?
        'You have been automatically logged out (session timeout)' :
        'You have been logged out';

      sendTelegramMessage(
        `🚪 <b>${logoutType} DETECTED!</b>\n\n` +
        `Player: ${state.playerName || 'Unknown'}\n` +
        `Time: ${formatDateUK()}\n\n` +
        reason + '\n\n' +
        '🔑 Please log back in to resume automation'
      );

      // Trigger tab flash and browser notifications
      triggerLogoutAlerts();

      logoutNotificationSent = true;
      console.log('[Telegram] Logout notification sent');
      return true;
    }

    return false;
  }

  // END OF TELEGRAM FUNCTIONS

  // ---------------------------
  // Auto-Resume Script Check Functions
  // ---------------------------
  let scriptCheckMonitorActive = false;
  let scriptCheckSubmitAttempted = false;

  function startScriptCheckMonitor() {
    if (!autoResumeConfig.enabled || scriptCheckMonitorActive) return;

    scriptCheckMonitorActive = true;
    scriptCheckSubmitAttempted = false;
    console.log('[TMN] Starting script check monitor for auto-resume...');

    const monitor = setInterval(() => {
      // Check if we're still on script check page
      if (!isOnCaptchaPage()) {
        console.log('[TMN] Script check page cleared - resuming automation');
        clearInterval(monitor);
        scriptCheckMonitorActive = false;
        localStorage.removeItem(LS_SCRIPT_CHECK_ACTIVE);

        // Resume automation
        automationPaused = false;
        updateStatus('Script check completed - automation resumed');
        return;
      }

      // Check if captcha is completed
      const captchaResponse = document.querySelector('textarea[name="g-recaptcha-response"]');
      const token = captchaResponse?.value?.trim();

      if (token && token.length > 0 && !scriptCheckSubmitAttempted) {
        console.log('[TMN] Captcha completed - auto-submitting...');
        scriptCheckSubmitAttempted = true;

        // Find and click submit button
        const submitBtn = document.querySelector('#ctl00_main_MyScriptTest_btnSubmit') ||
                          document.querySelector('#ctl00_main_btnVerify') ||
                          document.querySelector('input[type="submit"], button[type="submit"]') ||
                          Array.from(document.querySelectorAll('input, button')).find(b =>
                            b.value?.toLowerCase().includes('verify') ||
                            b.value?.toLowerCase().includes('submit') ||
                            b.textContent?.toLowerCase().includes('verify') ||
                            b.textContent?.toLowerCase().includes('submit')
                          );

        if (submitBtn && !submitBtn.disabled) {
          setTimeout(() => {
            submitBtn.click();
            console.log('[TMN] Script check form auto-submitted');
          }, 3000 + Math.random() * 2000);
        }
      }
    }, 1500);

    // Timeout after 10 minutes
    setTimeout(() => {
      if (scriptCheckMonitorActive) {
        console.log('[TMN] Script check monitor timeout');
        clearInterval(monitor);
        scriptCheckMonitorActive = false;
      }
    }, 600000);
  }

  // ---------------------------
  // Stats Collection Functions
  // ---------------------------
  const STATS_URL = '/authenticated/statistics.aspx?p=p';

  function shouldCollectStats() {
    if (!statsCollectionConfig.enabled) return false;
    if (state.inJail || state.isPerformingAction || automationPaused) return false;

    const now = Date.now();
    const timeSinceLastCollection = now - statsCollectionConfig.lastCollection;
    return timeSinceLastCollection >= statsCollectionConfig.interval * 1000;
  }

  function parseStatisticsPage() {
    const stats = {
      timestamp: Date.now(),
      crimes: {},
      gta: {},
      booze: {},
      general: {}
    };

    try {
      // Parse crimes statistics
      const crimeTable = document.querySelector('#ctl00_main_gvCrimes');
      if (crimeTable) {
        const rows = crimeTable.querySelectorAll('tr');
        rows.forEach((row, index) => {
          if (index === 0) return; // Skip header
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            const crimeName = cells[0]?.textContent?.trim();
            const attempts = parseInt(cells[1]?.textContent?.trim()) || 0;
            const success = parseInt(cells[2]?.textContent?.trim()) || 0;
            if (crimeName) {
              stats.crimes[crimeName] = { attempts, success };
            }
          }
        });
      }

      // Parse GTA statistics
      const gtaTable = document.querySelector('#ctl00_main_gvGTA');
      if (gtaTable) {
        const rows = gtaTable.querySelectorAll('tr');
        rows.forEach((row, index) => {
          if (index === 0) return; // Skip header
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            const gtaType = cells[0]?.textContent?.trim();
            const attempts = parseInt(cells[1]?.textContent?.trim()) || 0;
            const success = parseInt(cells[2]?.textContent?.trim()) || 0;
            if (gtaType) {
              stats.gta[gtaType] = { attempts, success };
            }
          }
        });
      }

      // Get general stats from status bar
      const currentStats = parseStatusBar();
      if (currentStats) {
        stats.general = {
          rank: currentStats.rank,
          rankPercent: currentStats.rankPercent,
          money: currentStats.money,
          health: currentStats.health,
          city: currentStats.city,
          fmj: currentStats.fmj,
          jhp: currentStats.jhp,
          credits: currentStats.credits
        };
      }

      console.log('[TMN] Statistics parsed:', stats);
      return stats;
    } catch (e) {
      console.error('[TMN] Error parsing statistics page:', e);
      return null;
    }
  }

  async function collectStatistics() {
    if (!shouldCollectStats()) return false;

    const currentPage = getCurrentPage();

    // If we're on the stats page, parse and save
    if (window.location.pathname.toLowerCase().includes('statistics.aspx') &&
        window.location.search.toLowerCase().includes('p=p')) {
      const stats = parseStatisticsPage();
      if (stats) {
        statsCollectionConfig.cachedStats = stats;
        statsCollectionConfig.lastCollection = Date.now();
        saveStatsCollectionConfig();
        updateStatus('Statistics collected successfully');
        console.log('[TMN] Statistics cached');
        return true;
      }
    }

    return false;
  }


  // ---------------------------
  // DTM & OC Timer System
  // ---------------------------
  const DTM_URL = '/authenticated/organizedcrime.aspx?p=dtm';
  const OC_URL = '/authenticated/organizedcrime.aspx';

  // Fetch DTM timer data from DTM page
  async function fetchDTMTimerData() {
    try {
      const fullURL = `${window.location.origin}${DTM_URL}&_=${Date.now()}`;
      console.log('[TMN] Fetching DTM timer data...');

      const response = await fetch(fullURL, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        credentials: 'same-origin'
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Check for DTM cooldown message
      const msgElement = doc.querySelector('#ctl00_lblMsg');
      if (msgElement) {
        const msgText = msgElement.textContent || "";
        const cooldownMatch = msgText.match(/You cannot do a DTM at this moment, you have to wait (\d+) hours? (\d+) minutes? and (\d+) seconds?/i);

        if (cooldownMatch) {
          const hours = parseInt(cooldownMatch[1], 10) || 0;
          const minutes = parseInt(cooldownMatch[2], 10) || 0;
          const seconds = parseInt(cooldownMatch[3], 10) || 0;
          const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;

          return {
            canDTM: false,
            hours, minutes, seconds, totalSeconds,
            message: msgText.trim(),
            lastUpdate: Date.now()
          };
        }
      }

      // Check if DTM is available
      const dtmStartDiv = doc.querySelector('.NewGridTitle');
      if (dtmStartDiv && dtmStartDiv.textContent.includes('Start a Drugs Transportation Mission')) {
        return {
          canDTM: true,
          hours: 0, minutes: 0, seconds: 0, totalSeconds: 0,
          message: "Available",
          lastUpdate: Date.now()
        };
      }

      return null;
    } catch (err) {
      console.error('[TMN] Error fetching DTM timer:', err);
      return null;
    }
  }

  // Fetch OC timer data from OC page
  async function fetchOCTimerData() {
    try {
      const fullURL = `${window.location.origin}${OC_URL}?_=${Date.now()}`;
      console.log('[TMN] Fetching OC timer data...');

      const response = await fetch(fullURL, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        credentials: 'same-origin'
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Check for OC cooldown message
      const msgElement = doc.querySelector('#ctl00_lblMsg');
      if (msgElement) {
        const msgText = msgElement.textContent || "";
        const cooldownMatch = msgText.match(/You cannot do an Organized Crime at this moment, you have to wait (\d+) hours? (\d+) minutes? and (\d+) seconds?/i);

        if (cooldownMatch) {
          const hours = parseInt(cooldownMatch[1], 10) || 0;
          const minutes = parseInt(cooldownMatch[2], 10) || 0;
          const seconds = parseInt(cooldownMatch[3], 10) || 0;
          const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;

          return {
            canOC: false,
            hours, minutes, seconds, totalSeconds,
            message: msgText.trim(),
            lastUpdate: Date.now()
          };
        }
      }

      // Check if OC is available
      const ocStartDiv = doc.querySelector('.NewGridTitle');
      if (ocStartDiv && ocStartDiv.textContent.includes('Start an Organized Crime')) {
        return {
          canOC: true,
          hours: 0, minutes: 0, seconds: 0, totalSeconds: 0,
          message: "Available",
          lastUpdate: Date.now()
        };
      }

      return null;
    } catch (err) {
      console.error('[TMN] Error fetching OC timer:', err);
      return null;
    }
  }

  // Store timer data with expiry calculation
  function storeDTMTimerData(timerData) {
    if (!timerData) return;
    const dtmTimerStatus = {
      ...timerData,
      fetchTime: Date.now(),
      expiresAt: Date.now() + (timerData.totalSeconds * 1000)
    };
    localStorage.setItem('tmnDTMTimerStatus', JSON.stringify(dtmTimerStatus));
  }

  function storeOCTimerData(timerData) {
    if (!timerData) return;
    const ocTimerStatus = {
      ...timerData,
      fetchTime: Date.now(),
      expiresAt: Date.now() + (timerData.totalSeconds * 1000)
    };
    localStorage.setItem('tmnOCTimerStatus', JSON.stringify(ocTimerStatus));
  }

  // Get current timer status with real-time countdown
  function getDTMTimerStatus() {
    const stored = localStorage.getItem('tmnDTMTimerStatus');
    if (!stored) return null;

    try {
      const timerData = JSON.parse(stored);
      const now = Date.now();
      const remainingMs = Math.max(0, timerData.expiresAt - now);
      const remainingSeconds = Math.floor(remainingMs / 1000);

      if (remainingSeconds <= 0) {
        return { canDTM: true, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, message: "Available" };
      }

      return {
        canDTM: false,
        hours: Math.floor(remainingSeconds / 3600),
        minutes: Math.floor((remainingSeconds % 3600) / 60),
        seconds: remainingSeconds % 60,
        totalSeconds: remainingSeconds
      };
    } catch (e) {
      return null;
    }
  }

  function getOCTimerStatus() {
    const stored = localStorage.getItem('tmnOCTimerStatus');
    if (!stored) return null;

    try {
      const timerData = JSON.parse(stored);
      const now = Date.now();
      const remainingMs = Math.max(0, timerData.expiresAt - now);
      const remainingSeconds = Math.floor(remainingMs / 1000);

      if (remainingSeconds <= 0) {
        return { canOC: true, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, message: "Available" };
      }

      return {
        canOC: false,
        hours: Math.floor(remainingSeconds / 3600),
        minutes: Math.floor((remainingSeconds % 3600) / 60),
        seconds: remainingSeconds % 60,
        totalSeconds: remainingSeconds
      };
    } catch (e) {
      return null;
    }
  }

  // Format timer display with color indicator
  function formatTimerDisplay(timerStatus, readyKey) {
    if (!timerStatus) return { text: "Unknown", color: "gray", ready: false };

    const isReady = timerStatus[readyKey];
    if (isReady || timerStatus.totalSeconds <= 0) {
      return { text: "Available", color: "green", ready: true };
    }

    const { hours, minutes } = timerStatus;
    let text;
    if (hours > 0) {
      text = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else if (minutes > 0) {
      text = `${minutes}m`;
    } else {
      text = "< 1m";
    }

    return { text, color: "red", ready: false };
  }

  // Collect both timers
  async function collectOCDTMTimers() {
    if (state.inJail || automationPaused) return;

    try {
      const [dtmData, ocData] = await Promise.all([
        fetchDTMTimerData(),
        fetchOCTimerData()
      ]);

      if (dtmData) storeDTMTimerData(dtmData);
      if (ocData) storeOCTimerData(ocData);

      console.log('[TMN] OC/DTM timers collected');
      updateTimerDisplay();
    } catch (e) {
      console.error('[TMN] Error collecting OC/DTM timers:', e);
    }
  }

  // Timer refresh interval (every 60 seconds for fetching, every 5 seconds for display)
  let timerDisplayInterval = null;
  let timerFetchInterval = null;

  // Cached display values to prevent flickering - only update DOM when values change
  // These persist the last known values so we don't show "..." on every page load
  const cachedDisplayValues = {
    dtm: GM_getValue('cachedDtmDisplay', ''),
    oc: GM_getValue('cachedOcDisplay', ''),
    travel: GM_getValue('cachedTravelDisplay', ''),
    health: GM_getValue('cachedHealthDisplay', ''),
    protection: GM_getValue('cachedProtectionDisplay', '')
  };

  // Cache element references to avoid repeated DOM queries
  let timerElements = {
    dtm: null,
    oc: null,
    travel: null,
    health: null,
    protection: null
  };

  // Update timer display in UI - only updates DOM if value changed (prevents flicker)
  function updateTimerDisplay() {
    if (!shadowRoot) return;

    // Cache element references on first call
    if (!timerElements.dtm) {
      timerElements.dtm = shadowRoot.querySelector('#tmn-dtm-timer');
      timerElements.oc = shadowRoot.querySelector('#tmn-oc-timer');
      timerElements.travel = shadowRoot.querySelector('#tmn-travel-timer');
      timerElements.health = shadowRoot.querySelector('#tmn-health-monitor');
    }

    const dtmStatus = getDTMTimerStatus();
    const ocStatus = getOCTimerStatus();
    const travelStatus = getTravelTimerStatus();

    const dtmDisplay = formatTimerDisplay(dtmStatus, 'canDTM');
    const ocDisplay = formatTimerDisplay(ocStatus, 'canOC');
    const travelDisplay = formatTravelTimerDisplay(travelStatus);

    // Only update DOM if value changed to prevent flicker
    const newDtmHtml = `<span style="color:${dtmDisplay.color === 'green' ? '#10b981' : dtmDisplay.color === 'red' ? '#ef4444' : '#9ca3af'};">●</span> ${dtmDisplay.text}`;
    if (timerElements.dtm && cachedDisplayValues.dtm !== newDtmHtml) {
      cachedDisplayValues.dtm = newDtmHtml;
      GM_setValue('cachedDtmDisplay', newDtmHtml);
      timerElements.dtm.innerHTML = newDtmHtml;
    }

    const newOcHtml = `<span style="color:${ocDisplay.color === 'green' ? '#10b981' : ocDisplay.color === 'red' ? '#ef4444' : '#9ca3af'};">●</span> ${ocDisplay.text}`;
    if (timerElements.oc && cachedDisplayValues.oc !== newOcHtml) {
      cachedDisplayValues.oc = newOcHtml;
      GM_setValue('cachedOcDisplay', newOcHtml);
      timerElements.oc.innerHTML = newOcHtml;
    }

    const travelColor = travelDisplay.color === 'green' ? '#10b981' : travelDisplay.color === 'amber' ? '#f59e0b' : travelDisplay.color === 'red' ? '#ef4444' : '#9ca3af';
    const newTravelHtml = `<span style="color:${travelColor};">●</span> ${travelDisplay.text}`;
    if (timerElements.travel && cachedDisplayValues.travel !== newTravelHtml) {
      cachedDisplayValues.travel = newTravelHtml;
      GM_setValue('cachedTravelDisplay', newTravelHtml);
      timerElements.travel.innerHTML = newTravelHtml;
    }

    // Also update health display
    updateHealthDisplay();

    // Update protection countdown
    updateProtectionDisplay();

    // Check protection expiry warnings
    try { checkProtectionWarnings(); } catch (e) {}

    // Check if OC/DTM just became ready and send Telegram alert
    try { checkOCDTMReadyAlerts(); } catch (e) {}
  }

  function getHealthColor(healthPercent) {
    if (healthPercent >= 100) return '#10b981';
    if (healthPercent > 60) return '#f59e0b';
    return '#ef4444';
  }

  function updateHealthDisplay() {
    if (!shadowRoot) return;
    if (!timerElements.health) {
      timerElements.health = shadowRoot.querySelector('#tmn-health-monitor');
    }
    const currentStats = parseStatusBar();
    if (timerElements.health && currentStats) {
      const health = currentStats.health || 0;
      const color = getHealthColor(health);
      const newHealthHtml = `<span style="color:${color};">●</span> ${health}%`;
      if (cachedDisplayValues.health !== newHealthHtml) {
        cachedDisplayValues.health = newHealthHtml;
        GM_setValue('cachedHealthDisplay', newHealthHtml);
        timerElements.health.innerHTML = newHealthHtml;
      }
    }
  }

  function startTimerUpdates() {
    // Immediately restore cached values to prevent flash of "..."
    if (shadowRoot) {
      const dtmEl = shadowRoot.querySelector('#tmn-dtm-timer');
      const ocEl = shadowRoot.querySelector('#tmn-oc-timer');
      const travelEl = shadowRoot.querySelector('#tmn-travel-timer');
      const healthEl = shadowRoot.querySelector('#tmn-health-monitor');

      if (dtmEl && cachedDisplayValues.dtm) dtmEl.innerHTML = cachedDisplayValues.dtm;
      if (ocEl && cachedDisplayValues.oc) ocEl.innerHTML = cachedDisplayValues.oc;
      if (travelEl && cachedDisplayValues.travel) travelEl.innerHTML = cachedDisplayValues.travel;
      if (healthEl && cachedDisplayValues.health) healthEl.innerHTML = cachedDisplayValues.health;
      const protEl = shadowRoot.querySelector('#tmn-protection-timer');
      if (protEl && cachedDisplayValues.protection) protEl.innerHTML = cachedDisplayValues.protection;
    }

    // Update display every 5 seconds
    if (!timerDisplayInterval) {
      timerDisplayInterval = setInterval(updateTimerDisplay, 5000);
    }

    // Fetch new data every 60 seconds
    if (!timerFetchInterval) {
      timerFetchInterval = setInterval(() => {
        if (!state.inJail && !automationPaused && !state.isPerformingAction) {
          collectOCDTMTimers();
          fetchTravelTimerData();
        }
      }, 60000);
    }

    // Initial fetch after a short delay
    setTimeout(collectOCDTMTimers, 3000);
    setTimeout(fetchTravelTimerData, 4000);
    setTimeout(fetchProtectionStatus, 5000);

    // Refresh protection status every 2 minutes (doesn't change often)
    setInterval(fetchProtectionStatus, 120000);
  }

  // ---------------------------
  // Travel Timer System (display only — no auto-travel)
  // ---------------------------
  const TRAVEL_URL = '/authenticated/travel.aspx';

  async function fetchTravelTimerData() {
    try {
      const fullURL = `${window.location.origin}${TRAVEL_URL}?_=${Date.now()}`;
      const response = await fetch(fullURL, {
        method: 'GET', headers: { 'Cache-Control': 'no-cache' }, credentials: 'same-origin'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const allText = doc.body.textContent || "";
      const lowerText = allText.toLowerCase();

      // Debug: log first 300 chars of travel page for troubleshooting
      console.log('[TMN][TRAVEL] Page text:', allText.substring(0, 300).replace(/\s+/g, ' '));

      // Pattern 1: "X hours Y minutes Z seconds before you can travel"
      let cooldownMatch = allText.match(/(\d+)\s*hours?\s*(\d+)\s*minutes?\s*(?:and\s*)?(\d+)?\s*seconds?\s*before you can travel/i);

      // Pattern 2: "You must wait X minutes" or "wait X minutes and Y seconds"
      if (!cooldownMatch) {
        const waitMatch = allText.match(/(?:must|have to)\s*wait\s*(?:(\d+)\s*hours?)?\s*(?:(\d+)\s*minutes?)?\s*(?:(?:and\s*)?(\d+)\s*seconds?)?/i);
        if (waitMatch && (waitMatch[1] || waitMatch[2] || waitMatch[3])) {
          cooldownMatch = [null, waitMatch[1] || '0', waitMatch[2] || '0', waitMatch[3] || '0'];
        }
      }

      // Pattern 3: "X minutes and Y seconds" anywhere near "travel"
      if (!cooldownMatch) {
        const timeMatch = allText.match(/(\d+)\s*minutes?\s*(?:and\s*)?(\d+)\s*seconds?/i);
        if (timeMatch && (lowerText.includes('travel') || lowerText.includes('cooldown') || lowerText.includes('wait'))) {
          cooldownMatch = [null, '0', timeMatch[1], timeMatch[2]];
        }
      }

      if (cooldownMatch) {
        const h = parseInt(cooldownMatch[1], 10) || 0;
        const m = parseInt(cooldownMatch[2], 10) || 0;
        const s = parseInt(cooldownMatch[3], 10) || 0;
        const totalSeconds = h * 3600 + m * 60 + s;

        if (totalSeconds > 0) {
          const jetAvailable = lowerText.includes('private jet') &&
                              (lowerText.includes('now available') || lowerText.includes('jet travel is now'));
          storeTravelTimerData({ normalCooldownRemaining: totalSeconds, jetAvailable, canTravelNormal: false, lastUpdate: Date.now() });
          console.log(`[TMN][TRAVEL] Cooldown: ${h}h ${m}m ${s}s`);
          updateTimerDisplay();
          return;
        }
      }

      // Check if can actually travel (page shows destination selection)
      const canTravelNow = lowerText.includes('select a destination') ||
                          lowerText.includes('where would you like') ||
                          doc.querySelector('select[name*="city"]') !== null ||
                          doc.querySelector('input[value*="Travel"]') !== null;

      if (canTravelNow) {
        storeTravelTimerData({ normalCooldownRemaining: 0, jetAvailable: true, canTravelNormal: true, lastUpdate: Date.now() });
        console.log('[TMN][TRAVEL] Can travel now');
      } else {
        // Unknown state — don't update, keep existing timer running down
        console.log('[TMN][TRAVEL] Could not determine travel status — keeping existing timer');
      }
      updateTimerDisplay();
    } catch (err) {
      console.error('[TMN] Error fetching travel timer:', err);
    }
  }

  function storeTravelTimerData(timerData) {
    if (!timerData) return;
    localStorage.setItem('tmnTravelTimerStatus', JSON.stringify({ ...timerData, fetchTime: Date.now() }));
  }

  function getTravelTimerStatus() {
    const stored = localStorage.getItem('tmnTravelTimerStatus');
    if (!stored) return null;
    try {
      const d = JSON.parse(stored);
      const elapsed = Math.floor((Date.now() - d.fetchTime) / 1000);
      const planeCd = Math.max(0, (d.normalCooldownRemaining || 0) - elapsed);
      const jetCd = Math.max(0, planeCd - (25 * 60));
      return { canTravelNormal: planeCd <= 0, canTravelJet: jetCd <= 0, planeCooldownRemaining: planeCd, jetCooldownRemaining: jetCd };
    } catch (e) { return null; }
  }

  function formatTravelTimerDisplay(ts) {
    if (!ts) return { text: "...", color: "gray" };
    if (ts.canTravelNormal) return { text: "Plane", color: "green" };
    if (ts.canTravelJet) { const m = Math.ceil(ts.planeCooldownRemaining / 60); return { text: `Jet (${m}m)`, color: "amber" }; }
    const m = Math.ceil(ts.jetCooldownRemaining / 60);
    return { text: `${m}m`, color: "red" };
  }

  // ---------------------------
  // New Player Protection Timer
  // ---------------------------
  const LS_PROTECTION_END = 'tmnProtectionEndTs';
  const LS_PROTECTION_STATUS = 'tmnProtectionStatus'; // 'active', 'expired', 'left', 'none'

  async function fetchProtectionStatus() {
    try {
      const statsURL = `${window.location.origin}/authenticated/statistics.aspx?p=p&_=${Date.now()}`;
      console.log('[TMN][PROT] Fetching stats page:', statsURL);
      const response = await fetch(statsURL, {
        method: 'GET', headers: { 'Cache-Control': 'no-cache' }, credentials: 'same-origin'
      });
      if (!response.ok) {
        console.log('[TMN][PROT] Stats page fetch failed:', response.status);
        return;
      }
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // Debug: log all span IDs containing "Protection" or "protection"
      const allSpans = doc.querySelectorAll('span[id*="rotection"], span[id*="lblNew"]');
      console.log(`[TMN][PROT] Found ${allSpans.length} protection-related spans`);
      allSpans.forEach(s => console.log(`[TMN][PROT]   id="${s.id}" text="${s.textContent.trim().substring(0, 80)}"`));

      // Also check for the div
      const protDiv = doc.querySelector('.NewGridTitle');
      if (protDiv) console.log(`[TMN][PROT] NewGridTitle: "${protDiv.textContent.trim()}"`);

      // Check for protection end date element
      const protEl = doc.getElementById('ctl00_main_lblNewPlayerProtectionEndDate');
      if (protEl) {
        const text = protEl.textContent.trim();
        console.log(`[TMN][PROT] Protection element found: "${text}"`);

        // Preferred: parse "(HH:MM:SS remaining)" or "(Xd HH:MM:SS remaining)" directly
        // This avoids timezone issues between game server and local browser
        const remainMatch = text.match(/\((?:(\d+)d\s*)?(\d+):(\d{2}):(\d{2})\s*remaining\)/i);
        if (remainMatch) {
          const days = parseInt(remainMatch[1] || '0', 10);
          const hours = parseInt(remainMatch[2], 10);
          const mins = parseInt(remainMatch[3], 10);
          const secs = parseInt(remainMatch[4], 10);
          const remainingMs = ((days * 24 + hours) * 3600 + mins * 60 + secs) * 1000;
          const endTs = Date.now() + remainingMs;
          localStorage.setItem(LS_PROTECTION_END, String(endTs));
          localStorage.setItem(LS_PROTECTION_STATUS, 'active');
          console.log(`[TMN][PROT] Protection remaining: ${days}d ${hours}h ${mins}m ${secs}s`);
          updateProtectionDisplay();
          return;
        }

        // Fallback: parse the end date but treat it as UTC to avoid timezone drift
        const dateMatch = text.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
        if (dateMatch) {
          const [, dd, mm, yyyy, HH, MM, SS] = dateMatch;
          // Use UTC to match game server time
          const endTs = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(HH), Number(MM), Number(SS));
          localStorage.setItem(LS_PROTECTION_END, String(endTs));
          localStorage.setItem(LS_PROTECTION_STATUS, 'active');
          console.log(`[TMN][PROT] Protection ends (UTC): ${new Date(endTs).toUTCString()}`);
          updateProtectionDisplay();
          return;
        } else {
          console.log('[TMN][PROT] Could not parse date from:', text);
        }
      } else {
        console.log('[TMN][PROT] Protection element NOT found by ID');
        // Try alternative: search page text for the date pattern near "protection"
        const pageText = doc.body.textContent || '';
        const protMatch = pageText.match(/protection.*?(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/i);
        if (protMatch) {
          const [, dd, mm, yyyy, HH, MM, SS] = protMatch;
          const endTs = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(HH), Number(MM), Number(SS)).getTime();
          localStorage.setItem(LS_PROTECTION_END, String(endTs));
          localStorage.setItem(LS_PROTECTION_STATUS, 'active');
          console.log(`[TMN][PROT] Found via text search — ends: ${new Date(endTs).toLocaleString()}`);
          updateProtectionDisplay();
          return;
        }
      }

      // Check if protection banner exists but no timer
      const pageText = doc.body.textContent || '';
      if (/new player protection is on/i.test(pageText) || /protection.*remaining/i.test(pageText)) {
        console.log('[TMN][PROT] Protection text found but no parseable date');
        if (!localStorage.getItem(LS_PROTECTION_END)) {
          localStorage.setItem(LS_PROTECTION_STATUS, 'active');
        }
        updateProtectionDisplay();
        return;
      }

      // No protection found on stats page
      const existing = localStorage.getItem(LS_PROTECTION_STATUS);
      if (existing === 'active') {
        // Was active, now gone — either expired or left early
        const endTs = parseInt(localStorage.getItem(LS_PROTECTION_END) || '0', 10);
        if (endTs > 0 && Date.now() < endTs) {
          localStorage.setItem(LS_PROTECTION_STATUS, 'left');
          console.log('[TMN][PROT] Protection left early');
        } else {
          localStorage.setItem(LS_PROTECTION_STATUS, 'expired');
          console.log('[TMN][PROT] Protection expired');
        }
      } else if (!existing) {
        localStorage.setItem(LS_PROTECTION_STATUS, 'none');
      }
    } catch (err) {
      console.error('[TMN] Error fetching protection status:', err);
    }
  }

  function getProtectionDisplay() {
    const status = localStorage.getItem(LS_PROTECTION_STATUS);
    // Don't show anything until we've actually fetched once
    if (!status) return null;
    if (status === 'none') return { text: 'None', color: '#9ca3af' };
    if (status === 'left') return { text: 'Left Early', color: '#ef4444' };
    if (status === 'expired') return { text: 'Expired', color: '#9ca3af' };

    // Active — calculate countdown
    const endTs = parseInt(localStorage.getItem(LS_PROTECTION_END) || '0', 10);
    if (!endTs) return { text: 'Active', color: '#10b981' };

    const remaining = endTs - Date.now();
    if (remaining <= 0) {
      localStorage.setItem(LS_PROTECTION_STATUS, 'expired');
      return { text: 'Expired', color: '#9ca3af' };
    }

    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const mins = Math.floor((remaining % 3600000) / 60000);

    let text;
    if (days > 0) {
      text = `${days}d ${hours}h ${mins}m`;
    } else if (hours > 0) {
      text = `${hours}h ${mins}m`;
    } else {
      text = `${mins}m`;
    }
    return { text, color: '#10b981' };
  }

  function updateProtectionDisplay() {
    if (!shadowRoot) return;
    if (!timerElements.protection) {
      timerElements.protection = shadowRoot.querySelector('#tmn-protection-timer');
    }
    if (!timerElements.protection) return;
    const display = getProtectionDisplay();
    // Don't update if we haven't fetched yet — keep cached or placeholder
    if (!display) return;
    const newHtml = `<span style="color:${display.color};">●</span> ${display.text}`;
    if (cachedDisplayValues.protection !== newHtml) {
      cachedDisplayValues.protection = newHtml;
      GM_setValue('cachedProtectionDisplay', newHtml);
      timerElements.protection.innerHTML = newHtml;
    }
  }

  // ---------------------------
  // OC/DTM Ready Telegram Alerts (edge-triggered)
  // ---------------------------
  function checkOCDTMReadyAlerts() {
    if (!telegramConfig.enabled || !state.notifyOCDTMReady) return;
    if (state.inJail) return;

    const dtmStatus = getDTMTimerStatus();
    if (dtmStatus) {
      const dtmReady = dtmStatus.canDTM === true || (dtmStatus.totalSeconds || 0) <= 0;
      const lastState = localStorage.getItem('tmnDTMReadyAlertState');
      if (dtmReady && lastState !== 'ready') {
        localStorage.setItem('tmnDTMReadyAlertState', 'ready');
        sendTelegramMessage(
          '✅ <b>DTM is now READY!</b>\n\n' +
          `Player: ${state.playerName || 'Unknown'}\n` +
          `Time: ${formatDateUK()}\n` +
          '🚚 Drug Trade Mission is available'
        );
      } else if (!dtmReady && lastState === 'ready') {
        localStorage.setItem('tmnDTMReadyAlertState', 'cooldown');
      }
    }

    const ocStatus = getOCTimerStatus();
    if (ocStatus) {
      const ocReady = ocStatus.canOC === true || (ocStatus.totalSeconds || 0) <= 0;
      const lastState = localStorage.getItem('tmnOCReadyAlertState');
      if (ocReady && lastState !== 'ready') {
        localStorage.setItem('tmnOCReadyAlertState', 'ready');
        sendTelegramMessage(
          '✅ <b>OC is now READY!</b>\n\n' +
          `Player: ${state.playerName || 'Unknown'}\n` +
          `Time: ${formatDateUK()}\n` +
          '🕵️ Organized Crime is available'
        );
        // If Create OC is enabled, kick off the creation flow
        if (state.createOC && getCreateOCState() === 'idle') {
          try { triggerCreateOC(); } catch (e) {
            console.warn('[TMN][CreateOC] triggerCreateOC error:', e);
          }
        }
      } else if (!ocReady && lastState === 'ready') {
        localStorage.setItem('tmnOCReadyAlertState', 'cooldown');
      }
    }
  }

  // ---------------------------
  // Protection Expiry Telegram Warnings
  // ---------------------------
  function checkProtectionWarnings() {
    if (!telegramConfig.enabled) return;
    const status = localStorage.getItem(LS_PROTECTION_STATUS);
    if (status !== 'active') return;

    const endTs = parseInt(localStorage.getItem(LS_PROTECTION_END) || '0', 10);
    if (!endTs) return;

    const remaining = endTs - Date.now();
    if (remaining <= 0) return;

    const hours = remaining / 3600000;

    // 12-hour warning (between 11.5h and 12.5h to avoid re-firing)
    const sent12h = localStorage.getItem('tmnProtWarn12h');
    if (!sent12h && hours <= 12 && hours > 11) {
      localStorage.setItem('tmnProtWarn12h', 'true');
      sendTelegramMessage(
        '⚠️ <b>Protection Expiring in ~12 Hours!</b>\n\n' +
        `Player: ${state.playerName || 'Unknown'}\n` +
        `Time remaining: ${Math.floor(hours)}h ${Math.floor((remaining % 3600000) / 60000)}m\n\n` +
        '🛡️ New player protection will end soon'
      );
    }

    // 6-hour warning (between 5.5h and 6.5h)
    const sent6h = localStorage.getItem('tmnProtWarn6h');
    if (!sent6h && hours <= 6 && hours > 5) {
      localStorage.setItem('tmnProtWarn6h', 'true');
      sendTelegramMessage(
        '🚨 <b>Protection Expiring in ~6 Hours!</b>\n\n' +
        `Player: ${state.playerName || 'Unknown'}\n` +
        `Time remaining: ${Math.floor(hours)}h ${Math.floor((remaining % 3600000) / 60000)}m\n\n` +
        '🛡️ New player protection ending soon — prepare for attacks!'
      );
    }
  }

  // ============================================================
  // AUTO OC / DTM MAIL INVITE SYSTEM
  // ============================================================

  // LocalStorage keys for OC/DTM mail tracking
  const LS_LAST_OC_INVITE_MAIL_ID = "tmnLastOCInviteMailId";
  const LS_LAST_DTM_INVITE_MAIL_ID = "tmnLastDTMInviteMailId";
  const LS_LAST_OC_ACCEPT_TS = "tmnLastOCAcceptTs";
  const LS_LAST_DTM_ACCEPT_TS = "tmnLastDTMAcceptTs";
  const LS_PENDING_DTM_URL = "tmnPendingDTMAcceptURL";
  const LS_PENDING_OC_URL = "tmnPendingOCAcceptURL";

  // Single unified watcher - no more separate OC/DTM/background watchers racing
  const MAIL_CHECK_INTERVAL_MS = 60000; // Check every 60 seconds

  // --- GM_xmlhttpRequest GET helper (returns html + finalUrl for redirect detection) ---
  function gmGet(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        headers: {
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache'
        },
        onload: (res) => {
          const finalUrl = res.finalUrl || url;
          if (res.status >= 200 && res.status < 300) {
            resolve({ html: res.responseText, finalUrl, status: res.status });
          } else {
            reject(new Error(`HTTP ${res.status} for ${finalUrl}`));
          }
        },
        onerror: (err) => reject(err),
      });
    });
  }

  // --- Normalize mailbox link to authenticated URL ---
  function toAuthenticatedMailboxURL(href) {
    const h = (href || "").trim();
    if (/^https?:\/\//i.test(h)) return h;
    if (/^\/authenticated\//i.test(h)) return new URL(h, location.origin).href;
    if (/^\/?mailbox\.aspx/i.test(h)) {
      const rel = h.replace(/^\//, "");
      return `${location.origin}/authenticated/${rel}`;
    }
    return new URL(h, `${location.origin}/authenticated/`).href;
  }

  // --- Normalize any authenticated-relative link ---
  function toAuthenticatedURL(href) {
    const h = (href || "").trim();
    if (!h) return null;
    if (/^https?:\/\//i.test(h)) return h;
    if (/^\/authenticated\//i.test(h)) return new URL(h, location.origin).href;
    if (h.startsWith("/")) return `${location.origin}/authenticated${h}`;
    return `${location.origin}/authenticated/${h.replace(/^\//, "")}`;
  }

  // --- Parse mail ID from href ---
  function parseMailIdFromHref(href) {
    const m = String(href || "").match(/[?&]id=(\d+)/i);
    return m ? m[1] : null;
  }

  // --- Parse TMN date from row text ---
  function parseTMNDateFromText(s) {
    const m = String(s).match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return 0;
    const [, dd, mm, yyyy, HH, MM, SS] = m;
    // Use UTC — TMN server times are in UTC, not local time
    return Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(HH), Number(MM), Number(SS || 0));
  }

  // --- Find newest DTM invitation mail ---

  // --- Open DTM mail and extract accept URL ---
  async function getDTMAcceptURLFromMail(mailHref) {
    const mailURL = toAuthenticatedMailboxURL(mailHref);
    console.log('[TMN][AUTO-DTM] Fetching mail content from:', mailURL);
    const mailRes = await gmGet(mailURL);
    if (!/\/authenticated\/mailbox\.aspx/i.test(mailRes.finalUrl)) {
      console.log('[TMN][AUTO-DTM] Redirected away from mailbox:', mailRes.finalUrl);
      return null;
    }

    const mailDoc = new DOMParser().parseFromString(mailRes.html, "text/html");

    // Log all links in the mail for debugging
    const allLinks = [...mailDoc.querySelectorAll('a')];
    console.log(`[TMN][AUTO-DTM] Mail contains ${allLinks.length} links`);
    allLinks.forEach((a, i) => {
      const href = a.getAttribute("href") || "";
      const txt = (a.textContent || "").trim();
      if (href.includes("organizedcrime") || txt.toLowerCase().includes("accept")) {
        console.log(`[TMN][AUTO-DTM] Relevant link ${i}: text="${txt}" href="${href}"`);
      }
    });

    const acceptA = [...mailDoc.querySelectorAll('a[href*="organizedcrime.aspx"]')].find(a => {
      const txt = (a.textContent || "").trim().toLowerCase();
      // Accept if text is empty, contains "accept", or is just the URL
      if (txt && !txt.includes("accept") && !txt.includes("organizedcrime")) return false;
      const h = (a.getAttribute("href") || "").replace(/&amp;/g, "&");
      try {
        const u = new URL(h, location.origin);
        // New-style: ?act=accept&ocid=... (DTM uses same page)
        const act = (u.searchParams.get("act") || "").toLowerCase();
        const ocid = u.searchParams.get("ocid") || "";
        if (act === "accept" && /^\d+$/.test(ocid)) return true;
        // Old-style: ?p=dtm&accept=1&id=...
        const p = (u.searchParams.get("p") || "").toLowerCase();
        const accept = u.searchParams.get("accept");
        const id = u.searchParams.get("id") || "";
        if (p === "dtm" && accept === "1" && /^\d+$/.test(id)) return true;
        // Fallback: any accept parameter with an id
        if (accept === "1" && /^\d+$/.test(id)) return true;
        return false;
      } catch { return false; }
    });

    if (!acceptA) {
      console.log('[TMN][AUTO-DTM] No accept link found in mail content');
      return null;
    }
    console.log('[TMN][AUTO-DTM] Found accept URL:', acceptA.getAttribute("href"));
    return toAuthenticatedURL(acceptA.getAttribute("href"));
  }

  // --- Find newest OC invitation mail ---

  // --- Open OC mail and extract accept URL ---
  async function getOCAcceptURLFromMail(mailHref) {
    const mailURL = toAuthenticatedMailboxURL(mailHref);
    const mailRes = await gmGet(mailURL);
    if (!/\/authenticated\/mailbox\.aspx/i.test(mailRes.finalUrl)) return null;

    const mailDoc = new DOMParser().parseFromString(mailRes.html, "text/html");

    const acceptA = [...mailDoc.querySelectorAll('a[href*="organizedcrime.aspx"]')].find(a => {
      const txt = (a.textContent || "").trim().toLowerCase();
      // Accept if text is empty, contains "accept", or is just the URL
      if (txt && !txt.includes("accept") && !txt.includes("organizedcrime")) return false;
      const h = (a.getAttribute("href") || "").replace(/&amp;/g, "&");
      try {
        const u = new URL(h, location.origin);
        // New-style: ?act=accept&ocid=...&pos=...
        const act = (u.searchParams.get("act") || "").toLowerCase();
        const ocid = u.searchParams.get("ocid") || "";
        if (act === "accept" && /^\d+$/.test(ocid)) return true;
        // Old-style: ?p=oc&accept=1&id=...
        const p = (u.searchParams.get("p") || "").toLowerCase();
        const accept = u.searchParams.get("accept");
        const id = u.searchParams.get("id") || "";
        if (p === "oc" && accept === "1" && /^\d+$/.test(id)) return true;
        return false;
      } catch { return false; }
    });

    if (!acceptA) return null;
    return toAuthenticatedURL(acceptA.getAttribute("href"));
  }

  // ============================================================
  // UNIFIED MAIL WATCHER - Single system handles OC, DTM, and general messages
  // Runs via gmGet (background HTTP) so works regardless of current page
  // Stores pending invites in localStorage so they survive page navigations
  // ============================================================

  // All tracking is now via localStorage - no in-memory state that gets wiped on page nav

  async function unifiedMailCheck() {
    try {
      if (!tabManager.isMasterTab) return;
      // Need at least OC/DTM enabled or telegram messages enabled
      if (!state.autoOC && !state.autoDTM && !(telegramConfig.enabled && telegramConfig.notifyMessages)) return;

      const inboxURL = `${location.origin}/authenticated/mailbox.aspx?p=m`;
      const inboxRes = await gmGet(inboxURL);
      if (!/\/authenticated\/mailbox\.aspx/i.test(inboxRes.finalUrl)) {
        console.log('[TMN][MAIL] Redirected away from mailbox - may be logged out');
        return;
      }

      const inboxDoc = new DOMParser().parseFromString(inboxRes.html, "text/html");
      const grid = inboxDoc.querySelector("#ctl00_main_gridMail");
      if (!grid) {
        console.log('[TMN][MAIL] No mail grid found');
        return;
      }

      const rows = [...grid.querySelectorAll("tr")].slice(1);
      console.log(`[TMN][MAIL] Scanning ${rows.length} mail rows...`);

      for (const r of rows) {
        const link = [...r.querySelectorAll('a[href*="mailbox.aspx"]')].find(a =>
          /[?&]id=\d+/i.test(a.getAttribute("href") || "")
        );
        if (!link) continue;

        const href = link.getAttribute("href") || "";
        const mailId = parseMailIdFromHref(href);
        if (!mailId) continue;

        const cells = r.querySelectorAll("td");
        const rowText = (r.textContent || "").trim();

        // Extract sender - try multiple methods
        let sender = "Unknown";
        let subject = "No subject";

        // Method 1: Look for profile link in the row (most reliable)
        const profileLink = r.querySelector('a[href*="profile.aspx"], a[href*="Profile.aspx"]');
        if (profileLink) {
          sender = (profileLink.textContent || "").trim();
        }

        // Method 2: Fall back to cells
        if (sender === "Unknown" && cells.length >= 2) {
          // Try each cell — sender could be in cell 0, 1, or 2 depending on layout
          for (let ci = 0; ci < Math.min(cells.length, 3); ci++) {
            const cellText = (cells[ci].textContent || "").trim();
            // Skip cells that look like dates, IDs, or are empty
            if (cellText && !/^\d{2}-\d{2}-\d{4}/.test(cellText) && cellText.length > 1 && cellText.length < 30) {
              // Check if this cell contains a link (likely the sender)
              const cellLink = cells[ci].querySelector('a');
              if (cellLink) {
                sender = (cellLink.textContent || "").trim();
                break;
              }
            }
          }
        }

        // Method 3: Fall back to first cell text
        if (sender === "Unknown" && cells.length >= 1) {
          const firstCell = (cells[0].textContent || "").trim();
          if (firstCell && firstCell !== "Unknown") sender = firstCell;
        }

        // Extract subject from cells
        if (cells.length >= 2) {
          // Subject is usually the cell with the mailbox link
          for (let ci = 0; ci < cells.length; ci++) {
            const cellLink = cells[ci].querySelector('a[href*="mailbox.aspx"]');
            if (cellLink) {
              subject = (cellLink.textContent || cells[ci].textContent || "").trim() || subject;
              break;
            }
          }
        }

        // Check DTM invite - use localStorage to track if already processed
        const isDTMInvite = /(dtm\s*invitation|dtm\s*invite|drug\s*trade)/i.test(rowText);
        if (isDTMInvite) {
          console.log(`[TMN][MAIL] DTM invite detected! mailId=${mailId} autoDTM=${state.autoDTM} sender="${sender}" cells=${cells.length} rowText="${rowText.substring(0, 100)}"`);
        }
        if (isDTMInvite && state.autoDTM) {
          // DEDUP LAYER 1: Cooldown — skip if we already accepted a DTM within last 2 hours
          const lastDTMAcceptTs = parseInt(localStorage.getItem(LS_LAST_DTM_ACCEPT_TS) || '0', 10);
          if (lastDTMAcceptTs > 0 && (Date.now() - lastDTMAcceptTs) < 7200000) {
            console.log(`[TMN][MAIL] DTM BLOCKED by Layer 1 (cooldown) — accepted ${Math.round((Date.now() - lastDTMAcceptTs) / 60000)}min ago`);
            localStorage.setItem(LS_LAST_DTM_INVITE_MAIL_ID, mailId);
            continue;
          }

          // DEDUP LAYER 2: Already processing — skip if we have a pending DTM handle
          if (localStorage.getItem('tmnPendingDTMHandle') === 'true' || localStorage.getItem(LS_PENDING_DTM_URL)) {
            console.log(`[TMN][MAIL] DTM BLOCKED by Layer 2 (already processing) — handle=${localStorage.getItem('tmnPendingDTMHandle')} url=${!!localStorage.getItem(LS_PENDING_DTM_URL)}`);
            localStorage.setItem(LS_LAST_DTM_INVITE_MAIL_ID, mailId);
            continue;
          }

          // DEDUP LAYER 3: Mail ID — skip if we've already seen this exact mail
          const lastSeen = localStorage.getItem(LS_LAST_DTM_INVITE_MAIL_ID);
          if (lastSeen === mailId) {
            console.log(`[TMN][MAIL] DTM BLOCKED by Layer 3 (same mail ID) — ${mailId}`);
            continue;
          }

          // DEDUP LAYER 4: Age check — skip if mail is older than 2 minutes
          const inviteTs = parseTMNDateFromText(rowText);
          const fifteenMinAgo = Date.now() - (15 * 60 * 1000);
          if (inviteTs > 0 && inviteTs < fifteenMinAgo) {
            console.log(`[TMN][MAIL] DTM BLOCKED by Layer 4 (older than 15min) — age: ${Math.round((Date.now() - inviteTs) / 60000)}min`);
            localStorage.setItem(LS_LAST_DTM_INVITE_MAIL_ID, mailId);
            continue;
          }

          // DEDUP LAYER 5: If we can't parse the date, only accept if mail ID is HIGHER than last seen
          if (inviteTs === 0 && lastSeen && parseInt(mailId) <= parseInt(lastSeen)) {
            console.log(`[TMN][MAIL] DTM BLOCKED by Layer 5 (ID ordering) — mailId=${mailId} lastSeen=${lastSeen}`);
            continue;
          }

          // All checks passed — this is a genuinely new DTM invite
          console.log(`[TMN][MAIL] ✅ DTM invite PASSED dedup! id=${mailId} subject="${subject}"`);
          await handleNewDTMInvite(mailId, href);
          continue;
        }

        // Check OC invite
        const isOCInvite = /(organized\s*crime\s*invitation|oc\s*invitation)/i.test(rowText);
        if (isOCInvite && state.autoOC) {
          // DEDUP LAYER 1: Cooldown — skip if we already accepted an OC within last 2 hours
          const lastAcceptTs = parseInt(localStorage.getItem(LS_LAST_OC_ACCEPT_TS) || '0', 10);
          if (lastAcceptTs > 0 && (Date.now() - lastAcceptTs) < 7200000) {
            console.log(`[TMN][MAIL] OC invite skipped — already accepted ${Math.round((Date.now() - lastAcceptTs) / 60000)}min ago`);
            localStorage.setItem(LS_LAST_OC_INVITE_MAIL_ID, mailId);
            continue;
          }

          // DEDUP LAYER 2: Already processing — skip if we have a pending OC handle
          if (localStorage.getItem('tmnPendingOCHandle') === 'true' || localStorage.getItem(LS_PENDING_OC_URL)) {
            console.log('[TMN][MAIL] OC invite skipped — already processing an OC');
            localStorage.setItem(LS_LAST_OC_INVITE_MAIL_ID, mailId);
            continue;
          }

          // DEDUP LAYER 3: Mail ID — skip if we've already seen this exact mail
          const lastSeen = localStorage.getItem(LS_LAST_OC_INVITE_MAIL_ID);
          if (lastSeen === mailId) {
            continue;
          }

          // DEDUP LAYER 4: Age check — skip if mail is older than 2 minutes
          const inviteTs = parseTMNDateFromText(rowText);
          const fifteenMinAgo = Date.now() - (15 * 60 * 1000);
          if (inviteTs > 0 && inviteTs < fifteenMinAgo) {
            console.log(`[TMN][MAIL] OC invite skipped — older than 15min (age: ${Math.round((Date.now() - inviteTs) / 60000)}min)`);
            localStorage.setItem(LS_LAST_OC_INVITE_MAIL_ID, mailId);
            continue;
          }

          // DEDUP LAYER 5: If date unparseable, only accept if mail ID is higher than last seen
          if (inviteTs === 0 && lastSeen && parseInt(mailId) <= parseInt(lastSeen)) {
            console.log(`[TMN][MAIL] OC invite skipped — mail ID ${mailId} <= last seen ${lastSeen} (unparseable date)`);
            continue;
          }

          // All checks passed — this is a genuinely new OC invite
          console.log(`[TMN][MAIL] ✅ OC invite PASSED dedup! id=${mailId} subject="${subject}"`);
          await handleNewOCInvite(mailId, href);
          continue;
        }

        // Regular mail - check against last notified ID stored in GM storage (persists reliably)
        if (telegramConfig.enabled && telegramConfig.notifyMessages) {
          const lastNotifiedId = GM_getValue('lastNotifiedMailId', null);

          // FIRST RUN: If we've never notified before, set the high-water mark
          if (lastNotifiedId === null) {
            let maxId = 0;
            for (const row of rows) {
              const rowLink = [...row.querySelectorAll('a[href*="mailbox.aspx"]')].find(a =>
                /[?&]id=\d+/i.test(a.getAttribute("href") || "")
              );
              if (rowLink) {
                const rid = parseInt(parseMailIdFromHref(rowLink.getAttribute("href") || "")) || 0;
                if (rid > maxId) maxId = rid;
              }
            }
            GM_setValue('lastNotifiedMailId', maxId);
            console.log(`[TMN][MAIL] First run — initialized lastNotifiedMailId to ${maxId}`);
            break;
          }

          const numericMailId = parseInt(mailId);
          if (numericMailId > lastNotifiedId) {
            // Advance high-water mark IMMEDIATELY
            GM_setValue('lastNotifiedMailId', numericMailId);

            // Age check: only notify for recent mails (last 2 minutes)
            const mailTs = parseTMNDateFromText(rowText);
            const fiveMinAgo = Date.now() - (5 * 60 * 1000);
            if (mailTs > 0 && mailTs < fiveMinAgo) {
              console.log(`[TMN][MAIL] Skipping old mail id=${mailId} (age: ${Math.round((Date.now() - mailTs) / 60000)}min)`);
              continue;
            }

            console.log(`[TMN][MAIL] New mail: id=${mailId} from="${sender}" subject="${subject}"`);

            // Fetch content and send as single combined Telegram message
            try {
              const mailContent = await fetchMailContentById(href);
              const contentPreview = mailContent ? `\n\n<pre>${escapeHtml(mailContent.substring(0, 500))}</pre>` : '';
              sendTelegramMessage(
                `📬 <b>New Message!</b>\n\n` +
                `Player: ${state.playerName || 'Unknown'}\n` +
                `From: ${sender}\n` +
                `Subject: ${subject}` +
                contentPreview
              );
            } catch (e) {
              // Fallback: send without content
              sendTelegramMessage(
                `📬 <b>New Message!</b>\n\n` +
                `Player: ${state.playerName || 'Unknown'}\n` +
                `From: ${sender}\n` +
                `Subject: ${subject}`
              );
            }

            continue;
          }
        }
      }

    } catch (e) {
      console.warn("[TMN][MAIL] unifiedMailCheck error:", e);
    }
  }

  // --- Extract inviter name from mail content (for whitelist check) ---
  async function extractInviterFromMail(mailHref) {
    try {
      const mailURL = toAuthenticatedMailboxURL(mailHref);
      const mailRes = await gmGet(mailURL);
      if (!/\/authenticated\/mailbox\.aspx/i.test(mailRes.finalUrl)) return null;
      const mailDoc = new DOMParser().parseFromString(mailRes.html, "text/html");
      const bodyText = (mailDoc.body.textContent || '');

      // Method 1 (BEST): Extract from body text "X has invited you"
      // Player names can contain letters, numbers, spaces, underscores
      const inviteMatch = bodyText.match(/(.+?)\s+has\s+invited\s+you/i);
      if (inviteMatch) {
        // Clean up — the match might include preceding text, take last line/sentence
        let name = inviteMatch[1].trim();
        // If it contains newlines or "DTM invitation", take only the part after the last newline
        const lastNewline = name.lastIndexOf('\n');
        if (lastNewline >= 0) name = name.substring(lastNewline + 1).trim();
        // Remove any leading "DTM invitation" or "OC invitation" text
        name = name.replace(/^.*?(invitation|invite)\s*/i, '').trim();
        if (name) {
          console.log(`[TMN][MAIL] Extracted inviter from body: "${name}"`);
          return name;
        }
      }

      // Method 2: "invited by X"
      const byMatch = bodyText.match(/invited\s+by\s+(.+?)[\s.!,]/i);
      if (byMatch) {
        console.log(`[TMN][MAIL] Extracted inviter (invited by): "${byMatch[1].trim()}"`);
        return byMatch[1].trim();
      }

      // Method 3: From profile link (may be the sender, not inviter, but better than nothing)
      const fromLink = mailDoc.querySelector('#ctl00_main_hlFromMember');
      if (fromLink) {
        const name = (fromLink.textContent || '').trim();
        if (name && name.toLowerCase() !== (state.playerName || '').toLowerCase()) {
          console.log(`[TMN][MAIL] Extracted inviter from From link: "${name}"`);
          return name;
        }
      }

      console.log('[TMN][MAIL] Could not extract inviter name from mail');
      return null;
    } catch (e) {
      console.warn('[TMN][MAIL] extractInviterFromMail error:', e);
      return null;
    }
  }

  // --- Telegram alert dedup: track mailIds we've already alerted on ---
  // Belt-and-braces guard: prevents duplicate Telegram alerts for the same
  // invite mail regardless of any other dedup layer failing. Entries expire
  // after 24h to keep localStorage small.
  const LS_ALERTED_INVITE_MAILS = "tmnAlertedInviteMails";
  const ALERTED_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  function _loadAlertedMails() {
    try {
      const raw = localStorage.getItem(LS_ALERTED_INVITE_MAILS);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return (obj && typeof obj === 'object') ? obj : {};
    } catch { return {}; }
  }

  function _saveAlertedMails(obj) {
    try {
      // Prune expired entries before saving
      const now = Date.now();
      const cleaned = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'number' && (now - v) < ALERTED_TTL_MS) cleaned[k] = v;
      }
      localStorage.setItem(LS_ALERTED_INVITE_MAILS, JSON.stringify(cleaned));
    } catch (e) {
      console.warn('[TMN][MAIL] Failed to save alerted mails:', e);
    }
  }

  function hasAlreadyAlerted(kind, mailId) {
    if (!mailId) return false;
    const key = `${kind}:${mailId}`;
    const obj = _loadAlertedMails();
    const ts = obj[key];
    if (typeof ts !== 'number') return false;
    if ((Date.now() - ts) >= ALERTED_TTL_MS) return false;
    return true;
  }

  function markAsAlerted(kind, mailId) {
    if (!mailId) return;
    const key = `${kind}:${mailId}`;
    const obj = _loadAlertedMails();
    obj[key] = Date.now();
    _saveAlertedMails(obj);
  }

  // --- Handle new DTM invite: always alert, extract URL, store for processing ---
  async function handleNewDTMInvite(mailId, mailHref) {
    try {
      // Mark as seen immediately to prevent duplicate processing
      localStorage.setItem(LS_LAST_DTM_INVITE_MAIL_ID, mailId);

      // BELT-AND-BRACES: skip Telegram alert if we've already alerted on this exact mailId
      if (hasAlreadyAlerted('DTM', mailId)) {
        console.log(`[TMN][MAIL] DTM alert suppressed — already alerted for mailId=${mailId}`);
      } else {
        markAsAlerted('DTM', mailId);
        // Always send Telegram alert regardless of jail/action state
        sendTelegramMessage(
          '📬 <b>New DTM Invitation!</b>\n\n' +
          `Player: ${state.playerName || 'Unknown'}\n` +
          `Time: ${formatDateUK()}\n\n` +
          (state.inJail ? '⛓ Currently in jail — will auto-accept when released' :
           state.isPerformingAction ? '⏳ Busy — will auto-accept shortly' :
           '🚚 Auto-accepting now...')
        );
      }

      // Extract accept URL from the mail
      const acceptURL = await getDTMAcceptURLFromMail(mailHref);

      // WHITELIST CHECK: Extract inviter name from mail content and check
      if (state.whitelistEnabled && state.whitelistNames.length > 0) {
        const inviterName = await extractInviterFromMail(mailHref);
        const isWhitelisted = inviterName && state.whitelistNames.some(n => {
          if (!n) return false;
          return n.toLowerCase().trim() === inviterName.toLowerCase().trim();
        });
        console.log(`[TMN][MAIL] DTM Whitelist check — inviter="${inviterName}" whitelist=[${state.whitelistNames.join(', ')}] match=${isWhitelisted}`);
        if (!isWhitelisted) {
          console.log(`[TMN][MAIL] DTM invite from "${inviterName}" BLOCKED by whitelist`);
          sendTelegramMessage(
            `🚫 <b>DTM Invite Blocked (Whitelist)</b>\n\n` +
            `Player: ${state.playerName || 'Unknown'}\n` +
            `From: ${inviterName || 'Unknown'}\n` +
            `Not on whitelist — invite ignored`
          );
          return;
        }
      }
      if (!acceptURL) {
        console.warn('[TMN][MAIL] Could not extract DTM accept URL from mail');
        sendTelegramMessage('⚠️ <b>DTM invite found but could not extract accept link.</b>\nPlease accept manually.');
        return;
      }

      console.log('[TMN][MAIL] DTM accept URL:', acceptURL);

      // Store the URL in localStorage so it survives page navigations
      localStorage.setItem(LS_PENDING_DTM_URL, acceptURL);

      // DON'T navigate here - mainLoop Priority 2 will pick it up on next tick
      // This avoids race conditions with concurrent mainLoop navigation
      console.log('[TMN][MAIL] DTM accept URL stored in localStorage. MainLoop will process it.');
    } catch (e) {
      console.warn('[TMN][MAIL] handleNewDTMInvite error:', e);
    }
  }

  // --- Handle new OC invite: always alert, extract URL, store for processing ---
  async function handleNewOCInvite(mailId, mailHref) {
    try {
      // Mark as seen immediately
      localStorage.setItem(LS_LAST_OC_INVITE_MAIL_ID, mailId);

      // Extract accept URL first so we can show role in alert
      const acceptURL = await getOCAcceptURLFromMail(mailHref);

      // WHITELIST CHECK: Extract inviter name from mail content and check
      if (state.whitelistEnabled && state.whitelistNames.length > 0) {
        const inviterName = await extractInviterFromMail(mailHref);
        const isWhitelisted = inviterName && state.whitelistNames.some(n => {
          if (!n) return false;
          return n.toLowerCase().trim() === inviterName.toLowerCase().trim();
        });
        console.log(`[TMN][MAIL] OC Whitelist check — inviter="${inviterName}" whitelist=[${state.whitelistNames.join(', ')}] match=${isWhitelisted}`);
        if (!isWhitelisted) {
          console.log(`[TMN][MAIL] OC invite from "${inviterName}" BLOCKED by whitelist`);
          sendTelegramMessage(
            `🚫 <b>OC Invite Blocked (Whitelist)</b>\n\n` +
            `Player: ${state.playerName || 'Unknown'}\n` +
            `From: ${inviterName || 'Unknown'}\n` +
            `Not on whitelist — invite ignored`
          );
          return;
        }
      }

      let roleInfo = '';
      if (acceptURL) {
        try {
          const u = new URL(acceptURL);
          const pos = u.searchParams.get('pos');
          if (pos) roleInfo = `\nRole: ${pos.replace(/([A-Z])/g, ' $1').trim()}`;
        } catch {}
      }

      // Always send Telegram alert
      if (hasAlreadyAlerted('OC', mailId)) {
        console.log(`[TMN][MAIL] OC alert suppressed — already alerted for mailId=${mailId}`);
      } else {
        markAsAlerted('OC', mailId);
        sendTelegramMessage(
          '📬 <b>New OC Invitation!</b>\n\n' +
          `Player: ${state.playerName || 'Unknown'}\n` +
          `Time: ${formatDateUK()}${roleInfo}\n\n` +
          (state.inJail ? '⛓ Currently in jail — will auto-accept when released' :
           state.isPerformingAction ? '⏳ Busy — will auto-accept shortly' :
           '🕵️ Auto-accepting now...')
        );
      }

      if (!acceptURL) {
        console.warn('[TMN][MAIL] Could not extract OC accept URL from mail');
        sendTelegramMessage('⚠️ <b>OC invite found but could not extract accept link.</b>\nPlease accept manually.');
        return;
      }

      console.log('[TMN][MAIL] OC accept URL:', acceptURL);

      // Store in localStorage so it survives page navigations
      localStorage.setItem(LS_PENDING_OC_URL, acceptURL);

      // DON'T navigate here - mainLoop Priority 2 will pick it up on next tick
      console.log('[TMN][MAIL] OC accept URL stored in localStorage. MainLoop will process it.');
    } catch (e) {
      console.warn('[TMN][MAIL] handleNewOCInvite error:', e);
    }
  }


  // ============================================================
  // OC PAGE HANDLER - Weapon/Explosive/Car selection after accepting
  // ============================================================
  function handleOCPageAfterAccept() {
    const pending = localStorage.getItem('tmnPendingOCHandle');
    if (pending !== 'true') return false;

    // Timeout: if pending for more than 2 minutes, clear it (something went wrong)
    const pendingTs = parseInt(localStorage.getItem('tmnPendingOCHandleTs') || '0', 10);
    if (pendingTs > 0 && Date.now() - pendingTs > 120000) {
      console.log('[TMN][AUTO-OC] Pending OC handle timed out after 2 min — clearing');
      localStorage.removeItem('tmnPendingOCHandle');
      localStorage.removeItem('tmnPendingOCHandleTs');
      state.isPerformingAction = false;
      return false;
    }

    const path = window.location.pathname.toLowerCase();
    if (!path.includes('organizedcrime.aspx')) {
      // Not on OC page — re-navigate if we have the URL still
      const retryUrl = localStorage.getItem(LS_PENDING_OC_URL);
      if (retryUrl) {
        console.log('[TMN][AUTO-OC] Not on OC page, re-navigating to accept URL');
        localStorage.removeItem(LS_PENDING_OC_URL);
        try {
          const u = new URL(retryUrl);
          window.location.href = u.pathname + u.search;
        } catch {
          window.location.href = retryUrl.replace(/^https?:\/\/[^/]+/, '');
        }
        return true;
      }
      return false;
    }

    console.log('[TMN][AUTO-OC] On OC page — handling role selection...');
    state.isPerformingAction = true;

    // 1) Check if there's still an Accept link to click
    const acceptLink = Array.from(document.querySelectorAll("a"))
      .find(a => {
        const txt = (a.textContent || "").trim().toLowerCase();
        const href = (a.getAttribute("href") || "").toLowerCase();
        return txt === "accept" && href.includes("organizedcrime.aspx");
      });

    if (acceptLink) {
      console.log('[TMN][AUTO-OC] Clicking Accept link on page');
      setTimeout(() => acceptLink.click(), randomDelay(DELAYS.quick));
      return true;
    }

    // 2) Select item from dropdown if present (weapons/explosives/cars)
    const selectIds = [
      "ctl00_main_explosiveslist",
      "ctl00_main_weaponslist",
      "ctl00_main_carslist",
      "ctl00_main_vehicleslist",
      "ctl00_main_weaponlist",
      "ctl00_main_carlist"
    ];
    for (const sid of selectIds) {
      const sel = document.getElementById(sid);
      if (sel && sel.tagName === "SELECT" && sel.options && sel.options.length > 0) {
        if (sel.selectedIndex < 0) sel.selectedIndex = 0;
        try { sel.dispatchEvent(new Event("change", { bubbles: true })); } catch {}
        console.log(`[TMN][AUTO-OC] Selected item from dropdown: ${sid}`);
      }
    }

    // 3) Click the Choose/Select button
    const buttonIds = [
      "ctl00_main_btnchooseexplosive",
      "ctl00_main_btnChooseWeapon",
      "ctl00_main_btnchooseweapons",
      "ctl00_main_btnchooseweapon",
      "ctl00_main_btnchoosecar",
      "ctl00_main_btnchoosevehicle",
      "ctl00_main_btnchoosevehicles",
      "ctl00_main_btnchoose",
      "ctl00_main_btnselect"
    ];

    for (const id of buttonIds) {
      const btn = document.getElementById(id);
      if (btn && !btn.disabled) {
        console.log(`[TMN][AUTO-OC] Clicking role button: ${id}`);
        setTimeout(() => {
          btn.click();
          localStorage.removeItem('tmnPendingOCHandle');
          state.isPerformingAction = false;
          updateStatus("✅ OC role selected — resuming automation");
          sendTelegramMessage(
            '🕵️ <b>OC Role Selected!</b>\n\n' +
            `Player: ${state.playerName || 'Unknown'}\n` +
            '✅ Automation resumed'
          );
        }, 2000);
        return true;
      }
    }

    // 4) Fallback: any button with choose/select text
    const fallbackBtn = Array.from(document.querySelectorAll("input[type='submit'], button"))
      .find(el => {
        if (el.disabled) return false;
        const v = ((el.value || el.textContent || "") + "").trim().toLowerCase();
        const id = (el.id || "").toLowerCase();
        return v.includes("choose") || v.includes("select") ||
          id.includes("btnchoose") || id.includes("btnselect");
      });

    if (fallbackBtn) {
      console.log(`[TMN][AUTO-OC] Clicking fallback button: ${fallbackBtn.id || fallbackBtn.value}`);
      setTimeout(() => {
        fallbackBtn.click();
        localStorage.removeItem('tmnPendingOCHandle');
        state.isPerformingAction = false;
        updateStatus("✅ OC role selected — resuming automation");
      }, 2000);
      return true;
    }

    // 5) Check if OC is already completed/waiting
    const bodyText = (document.body.textContent || "").toLowerCase();
    if (/you cannot do an organized crime|you have to wait/.test(bodyText)) {
      console.log('[TMN][AUTO-OC] OC appears completed — clearing pending');
      localStorage.removeItem('tmnPendingOCHandle');
      localStorage.removeItem('tmnPendingOCHandleTs');
      localStorage.setItem(LS_LAST_OC_ACCEPT_TS, String(Date.now())); // Cooldown starts on COMPLETION only
      state.isPerformingAction = false;
      updateStatus("✅ OC completed — resuming automation");
      return true;
    }

    // Check for invalid/expired invite
    if (/invalid request|invalid invite|this invitation has expired|invitation.*no longer/i.test(bodyText)) {
      console.log('[TMN][AUTO-OC] Invalid/expired OC invite — clearing all pending state');
      localStorage.removeItem('tmnPendingOCHandle');
      localStorage.removeItem('tmnPendingOCHandleTs');
      localStorage.removeItem(LS_PENDING_OC_URL);
      localStorage.removeItem(LS_LAST_OC_INVITE_MAIL_ID);
      state.isPerformingAction = false;
      updateStatus("❌ OC invite invalid — ready for new invite");
      sendTelegramMessage(
        '❌ <b>OC Invite Invalid</b>\n\n' +
        `Player: ${state.playerName || 'Unknown'}\n` +
        'Invite was invalid/expired — ready for new invite'
      );
      return true;
    }

    // Nothing found yet — retry on next mainLoop cycle
    console.log('[TMN][AUTO-OC] No OC role button found yet — will retry');
    return true;
  }

  // ============================================================
  // DTM PAGE HANDLER - Buy drugs after accepting
  // ============================================================
  function handleDTMPageAfterAccept() {
    const pending = localStorage.getItem('tmnPendingDTMHandle');
    if (pending !== 'true') return false;

    // Timeout: if pending for more than 2 minutes, clear it
    const pendingTs = parseInt(localStorage.getItem('tmnPendingDTMHandleTs') || '0', 10);
    if (pendingTs > 0 && Date.now() - pendingTs > 120000) {
      console.log('[TMN][AUTO-DTM] Pending DTM handle timed out after 2 min — clearing');
      localStorage.removeItem('tmnPendingDTMHandle');
      localStorage.removeItem('tmnPendingDTMHandleTs');
      state.isPerformingAction = false;
      return false;
    }

    const path = window.location.pathname.toLowerCase();
    if (!path.includes('organizedcrime.aspx')) {
      // Not on DTM page — re-navigate if we have the URL still
      const retryUrl = localStorage.getItem(LS_PENDING_DTM_URL);
      if (retryUrl) {
        console.log('[TMN][AUTO-DTM] Not on DTM page, re-navigating to accept URL');
        localStorage.removeItem(LS_PENDING_DTM_URL);
        try {
          const u = new URL(retryUrl);
          window.location.href = u.pathname + u.search;
        } catch {
          window.location.href = retryUrl.replace(/^https?:\/\/[^/]+/, '');
        }
        return true;
      }
      return false;
    }

    console.log('[TMN][AUTO-DTM] On DTM page — handling...');
    console.log(`[TMN][AUTO-DTM] Page text snippet: "${(document.body.textContent || "").substring(0, 200)}"`);
    state.isPerformingAction = true;

    // Wait briefly for page to fully render (ASP.NET forms can load elements async)
    if (!document.getElementById('ctl00_main_btnBuyDrugs') &&
        !document.getElementById('ctl00_main_btnBuyLDrugs') &&
        !Array.from(document.querySelectorAll('input[type="submit"]')).find(b => /buy/i.test(b.value || ''))) {
      // Page might not be fully loaded yet — check if "Buy drugs" text exists but button doesn't
      if (/buy\s*drugs/i.test(document.body.textContent || '')) {
        console.log('[TMN][AUTO-DTM] Buy drugs text found but button not in DOM yet — will retry next tick');
        return true; // Retry on next mainLoop cycle
      }
    }

    // Step 1: Check for Complete DTM button
    const completeBtn =
      document.getElementById('ctl00_main_btnCompleteDTM') ||
      document.querySelector('input[id*="btnComplete"][type="submit"]') ||
      Array.from(document.querySelectorAll('input[type="submit"],button')).find(b =>
        /complete\s*dtm/i.test((b.value || b.textContent || '').trim())
      );

    if (completeBtn && !completeBtn.disabled) {
      console.log('[TMN][AUTO-DTM] Clicking Complete DTM');
      setTimeout(() => {
        completeBtn.click();
        localStorage.removeItem('tmnPendingDTMHandle');
        localStorage.setItem(LS_LAST_DTM_ACCEPT_TS, String(Date.now())); // Cooldown starts on COMPLETION only
        state.isPerformingAction = false;

        // Set cooldown
        const dtmCooldown = { canDTM: false, totalSeconds: 7200, hours: 2, minutes: 0, seconds: 0, message: "DTM completed", lastUpdate: Date.now() };
        storeDTMTimerData(dtmCooldown);

        updateStatus("✅ DTM completed — resuming automation");
        sendTelegramMessage(
          '🚚 <b>DTM Completed!</b>\n\n' +
          `Player: ${state.playerName || 'Unknown'}\n` +
          '✅ 2h cooldown started, automation resumed'
        );
      }, 2000);
      return true;
    }

    // Step 2: Buy drugs page — find max amount and buy
    const pageText = document.body.textContent || "";

    // Try multiple patterns to find the max drug amount
    let maxAmount = 0;
    const maxPatterns = [
      /maximum amount you can carry is (\d+)/i,
      /maximum amount you can buy is (\d+)/i,
      /maximum amount.*?is (\d+)/i,
      /you can carry is (\d+)/i,
      /can buy.*?(\d+)\s*units/i
    ];
    for (const pat of maxPatterns) {
      const m = pageText.match(pat);
      if (m) { maxAmount = parseInt(m[1], 10); break; }
    }

    // Fallback: extract units from member table — look for player name with "(X units)"
    if (!maxAmount && state.playerName) {
      const playerUnitMatch = pageText.match(new RegExp(state.playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\([^)]*?-\\s*(\\d+)\\s*units?\\)', 'i'));
      if (playerUnitMatch) {
        maxAmount = parseInt(playerUnitMatch[1], 10);
        console.log(`[TMN][AUTO-DTM] Got max units from member table: ${maxAmount}`);
      }
    }

    console.log(`[TMN][AUTO-DTM] maxAmount=${maxAmount}, playerName="${state.playerName}"`);

    // Find the buy controls — broaden selectors to catch all possible element IDs
    let drugInput =
      document.getElementById('ctl00_main_tbDrugLAmount') ||
      document.getElementById('ctl00_main_tbDrugAmount') ||
      document.getElementById('ctl00_main_txtDrugAmount') ||
      document.getElementById('ctl00_main_txtAmount') ||
      document.querySelector('input[id*="tbDrug"]') ||
      document.querySelector('input[id*="txtDrug"]') ||
      document.querySelector('input[id*="Drug"][type="text"]') ||
      document.querySelector('input[id*="Amount"][type="text"]') ||
      document.querySelector('input[name*="tbDrug"]') ||
      document.querySelector('input[name*="txtDrug"]');

    let buyButton =
      document.getElementById('ctl00_main_btnBuyLDrugs') ||
      document.getElementById('ctl00_main_btnBuyDrugs') ||
      document.getElementById('ctl00_main_btnBuy') ||
      document.querySelector('input[id*="btnBuy"][type="submit"]') ||
      Array.from(document.querySelectorAll('input[type="submit"],button')).find(b =>
        /buy\s*drugs/i.test((b.value || b.textContent || '').trim())
      );

    // Nuclear fallback: find any text input next to the Buy Drugs button
    if (!drugInput && buyButton) {
      drugInput = buyButton.parentElement?.querySelector('input[type="text"],input:not([type])') ||
                  buyButton.closest('div,td,tr,form')?.querySelector('input[type="text"],input:not([type])');
      if (drugInput) console.log(`[TMN][AUTO-DTM] Found input via Buy button proximity: id="${drugInput.id}"`);
    }

    // Nuclear fallback 2: if no buy button found by ID, search harder
    if (!buyButton) {
      buyButton = Array.from(document.querySelectorAll('input[type="submit"]')).find(b =>
        /buy/i.test(b.value || '')
      );
      if (buyButton) console.log(`[TMN][AUTO-DTM] Found Buy button via text search: id="${buyButton.id}" value="${buyButton.value}"`);
    }

    // Nuclear fallback 3: no specific selectors worked, grab the ONLY text input on page
    if (!drugInput && maxAmount > 0) {
      const allTextInputs = document.querySelectorAll('input[type="text"],input:not([type="submit"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"])');
      const candidates = Array.from(allTextInputs).filter(i => !i.id.includes('search') && !i.id.includes('chat'));
      if (candidates.length === 1) {
        drugInput = candidates[0];
        console.log(`[TMN][AUTO-DTM] Found sole text input as fallback: id="${drugInput.id}"`);
      }
    }

    // Debug logging
    if (!drugInput || !buyButton) {
      const allInputs = Array.from(document.querySelectorAll('input'));
      console.log(`[TMN][AUTO-DTM] DEBUG — drugInput=${!!drugInput}, buyButton=${!!buyButton}, maxAmount=${maxAmount}`);
      console.log(`[TMN][AUTO-DTM] All inputs on page:`);
      allInputs.forEach(i => console.log(`  id="${i.id}" type="${i.type}" name="${i.name}" value="${i.value}"`));
    }

    if (maxAmount > 0 && drugInput && buyButton && !buyButton.disabled) {
      drugInput.value = String(maxAmount);
      console.log(`[TMN][AUTO-DTM] Buying ${maxAmount} drugs`);
      setTimeout(() => {
        buyButton.click();

        // Set cooldown (buying drugs completes the DTM in some setups)
        const now = Date.now();
        const dtmCooldown = {
          canDTM: false, totalSeconds: 7200, hours: 2, minutes: 0, seconds: 0,
          message: "DTM completed", lastUpdate: now,
          expiresAt: now + (7200 * 1000)
        };
        storeDTMTimerData(dtmCooldown);

        localStorage.removeItem('tmnPendingDTMHandle');
        localStorage.removeItem('tmnPendingDTMHandleTs');
        localStorage.setItem(LS_LAST_DTM_ACCEPT_TS, String(Date.now())); // Cooldown starts on COMPLETION only
        state.isPerformingAction = false;
        updateStatus("✅ DTM drugs bought — resuming automation");
        sendTelegramMessage(
          '🚚 <b>DTM Drugs Bought!</b>\n\n' +
          `Player: ${state.playerName || 'Unknown'}\n` +
          `Amount: ${maxAmount}\n` +
          '✅ 2h cooldown started, automation resumed'
        );
      }, randomDelay(DELAYS.quick));
      return true;
    }

    // If we found input + button but no amount, try buying with the input already populated
    if (drugInput && buyButton && !buyButton.disabled && drugInput.value && parseInt(drugInput.value) > 0) {
      const prefilledAmount = drugInput.value;
      console.log(`[TMN][AUTO-DTM] Input already has value: ${prefilledAmount}, clicking Buy`);
      setTimeout(() => {
        buyButton.click();
        const now = Date.now();
        storeDTMTimerData({
          canDTM: false, totalSeconds: 7200, hours: 2, minutes: 0, seconds: 0,
          message: "DTM completed", lastUpdate: now, expiresAt: now + (7200 * 1000)
        });
        localStorage.removeItem('tmnPendingDTMHandle');
        localStorage.removeItem('tmnPendingDTMHandleTs');
        state.isPerformingAction = false;
        updateStatus("✅ DTM drugs bought — resuming automation");
      }, randomDelay(DELAYS.quick));
      return true;
    }

    // Log what we found for debugging
    if (buyButton) {
      console.log(`[TMN][AUTO-DTM] Buy button found but maxAmount=${maxAmount}, drugInput=${!!drugInput}`);
    }

    // Check if DTM is already on cooldown
    const bodyText = (document.body.textContent || "").toLowerCase();
    if (/you cannot do a dtm|you have to wait/.test(bodyText)) {
      console.log('[TMN][AUTO-DTM] DTM on cooldown — clearing pending');
      localStorage.removeItem('tmnPendingDTMHandle');
      localStorage.removeItem('tmnPendingDTMHandleTs');
      state.isPerformingAction = false;
      updateStatus("DTM on cooldown — resuming automation");
      return true;
    }

    // Check for invalid/expired invite
    if (/invalid request|invalid invite|this invitation has expired|invitation.*no longer/i.test(bodyText)) {
      console.log('[TMN][AUTO-DTM] Invalid/expired DTM invite — clearing all pending state');
      localStorage.removeItem('tmnPendingDTMHandle');
      localStorage.removeItem('tmnPendingDTMHandleTs');
      localStorage.removeItem(LS_PENDING_DTM_URL);
      localStorage.removeItem(LS_LAST_DTM_INVITE_MAIL_ID);
      state.isPerformingAction = false;
      updateStatus("❌ DTM invite invalid — ready for new invite");
      sendTelegramMessage(
        '❌ <b>DTM Invite Invalid</b>\n\n' +
        `Player: ${state.playerName || 'Unknown'}\n` +
        'Invite was invalid/expired — ready for new invite'
      );
      return true;
    }

    // Nothing found yet — retry
    console.log('[TMN][AUTO-DTM] DTM page not ready yet — will retry');
    return true;
  }

  // Legacy stubs — mainLoop handles all mail checks now
  function stopUnifiedMailWatcher() {}
  function startAutoOCMailWatcher() {}
  function stopAutoOCMailWatcher() {}
  function startAutoDTMMailWatcher() {}
  function stopAutoDTMMailWatcher() {}

  // ============================================================
  // FETCH LATEST MAIL CONTENT (for Telegram alerts)
  // ============================================================
  async function fetchMailContentById(mailHref) {
    try {
      const mailURL = toAuthenticatedMailboxURL(mailHref);
      const mailRes = await gmGet(mailURL);
      if (!/\/authenticated\/mailbox\.aspx/i.test(mailRes.finalUrl)) return null;

      const mailDoc = new DOMParser().parseFromString(mailRes.html, "text/html");

      // Try multiple selectors for mail content
      let contentDiv = null;

      // Method 1: Read panel with GridRow structure
      const readPanel = mailDoc.querySelector("#ctl00_main_pnlMailRead");
      if (readPanel) {
        contentDiv =
          readPanel.querySelector(".GridRow div[style*='padding']") ||
          readPanel.querySelector(".GridRow > .GridHeader + div") ||
          readPanel.querySelector(".GridRow");
      }

      // Method 2: Direct content elements
      if (!contentDiv) {
        contentDiv =
          mailDoc.querySelector("#ctl00_main_lblBody") ||
          mailDoc.querySelector("#ctl00_main_lblMessage");
      }

      // Method 3: Any div with padding:5px inside the main content
      if (!contentDiv) {
        contentDiv = mailDoc.querySelector('div[style*="padding: 5px"]') ||
                     mailDoc.querySelector('div[style*="padding:5px"]');
      }

      if (!contentDiv) return null;

      let html = contentDiv.innerHTML || "";
      // Remove the subject bold line if present (we already show it in the header)
      html = html.replace(/<b>\[?[Nn]o [Ss]ubject\]?<\/b>\s*<br\s*\/?>/gi, '');
      html = html.replace(/<br\s*\/?>/gi, "\n");
      // Remove img tags but keep alt text
      html = html.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, '$1');
      html = html.replace(/<img[^>]*>/gi, '');
      const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
      const text = (parsed.body.textContent || "")
        .replace(/\r/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      return text || null;
    } catch (e) {
      console.warn("[TMN] fetchMailContentById error:", e);
      return null;
    }
  }

  // Legacy wrapper for backwards compatibility
  async function fetchLatestMailContent() {
    try {
      const inboxURL = `${location.origin}/authenticated/mailbox.aspx?p=m`;
      const inboxRes = await gmGet(inboxURL);
      if (!/\/authenticated\/mailbox\.aspx/i.test(inboxRes.finalUrl)) return null;
      const inboxDoc = new DOMParser().parseFromString(inboxRes.html, "text/html");
      const grid = inboxDoc.querySelector("#ctl00_main_gridMail");
      if (!grid) return null;
      const rows = [...grid.querySelectorAll("tr")].slice(1);
      if (!rows.length) return null;
      const link = [...rows[0].querySelectorAll('a[href*="mailbox.aspx"]')].find(a =>
        /[?&]id=\d+/i.test(a.getAttribute("href") || "")
      );
      if (!link) return null;
      return await fetchMailContentById(link.getAttribute("href"));
    } catch (e) { return null; }
  }

  // Next function should be formatTime()
  function formatTime(timestamp) {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s ago`;
  }

  function getCurrentPage() {
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();

    if (path.includes('crimes.aspx')) {
      if (search.includes('p=g')) return 'gta';
      if (search.includes('p=b')) return 'booze';
      return 'crimes';
    }
    if (path.includes('jail.aspx')) return 'jail';
    if (path.includes('players.aspx')) return 'players';
    if (path.includes('resetscriptcounter.aspx')) return 'captcha';
    if (path.includes('playerproperty.aspx') && search.includes('p=g')) return 'garage';
    if (path.includes('credits.aspx')) return 'credits';
    if (path.includes('travel.aspx')) return 'travel';
    if (path.includes('store.aspx') && search.includes('p=b')) return 'store';
    if (path.includes('mailbox.aspx')) return 'mailbox';
    return 'other';
  }

  function isOnCaptchaPage() {
    return getCurrentPage() === 'captcha' ||
      document.querySelector('.g-recaptcha') !== null ||
      document.querySelector('#ctl00_main_pnlVerify') !== null ||
      document.title.includes('Script Check') ||
      document.body.textContent.includes('Verify your actions') ||
      document.body.textContent.includes('complete the script test');
  }

  function getPlayerName() {
    if (getCurrentPage() !== 'players') {
      updateStatus("Getting player name...");
      window.location.href = '/authenticated/players.aspx?' + Date.now();
      return;
    }

    const TARGET_RGB = 'rgb(170, 0, 0)';
    const playerLinks = document.querySelectorAll('a[href*="profile.aspx"]');
    for (let link of playerLinks) {
      const computedColor = window.getComputedStyle(link).color;
      const inlineColor = link.style.color.toUpperCase();

      if (computedColor === TARGET_RGB ||
        inlineColor === '#AA0000' ||
        inlineColor === 'RED') {
        state.playerName = link.textContent.trim();
        saveState();
        updateStatus(`Player identified: ${state.playerName}`);
        return;
      }
    }

    const allElements = document.querySelectorAll('*');
    for (let element of allElements) {
      if (window.getComputedStyle(element).color === TARGET_RGB &&
        element.textContent.trim().length > 0 &&
        element.textContent.trim().length < 50) {

        state.playerName = element.textContent.trim();
        saveState();
        updateStatus(`Player identified: ${state.playerName}`);
        return;
      }
    }

    updateStatus("Could not identify player name");
  }

  // COMPLETELY REWRITTEN JAIL DETECTION
  function processJailPage() {
    if (getCurrentPage() !== 'jail') return;

    let inJail = false;

    // Method 1: Check if player name appears in jail table ROWS (not headers)
    // Uses profile links to avoid false matches on column headers like "Inmate"
    if (state.playerName) {
      const jailTable = document.querySelector('#ctl00_main_gvJail');
      if (jailTable) {
        const rows = [...jailTable.querySelectorAll('tr')].slice(1); // Skip header row
        for (const row of rows) {
          const profileLink = row.querySelector('a[href*="profile.aspx"]');
          if (profileLink && profileLink.textContent.trim().toLowerCase() === state.playerName.toLowerCase()) {
            inJail = true;
            console.log('Jail detection: Player found in jail table via profile link');
            break;
          }
        }
      }
    }

    // Method 2: Check for "You are in jail" text
    if (!inJail) {
      const pageText = document.body.textContent.toLowerCase();
      if (pageText.includes('you are in jail') || pageText.includes('you have been jailed')) {
        inJail = true;
        console.log('Jail detection: "You are in jail" text found');
      }
    }

    // Method 3: Check for release timer or bail options
    if (!inJail) {
      const pageText = document.body.textContent.toLowerCase();
      if (pageText.includes('time remaining') || pageText.includes('bail amount') || pageText.includes('post bail')) {
        inJail = true;
        console.log('Jail detection: Release timer or bail options found');
      }
    }

    // Method 4: Check if we can see jailbreak options but no break out options for ourselves
    if (!inJail) {
      const breakLinks = document.querySelectorAll('a[id*="btnBreak"]');
      const hasClickableBreaks = Array.from(breakLinks).some(link => {
        return !link.hasAttribute('disabled') && link.href && link.href.includes('javascript:');
      });

      // If there are breakable players but we're not seeing our own breakout option, we're probably jailed
      if (breakLinks.length > 0 && !hasClickableBreaks) {
        inJail = true;
        console.log('Jail detection: Break options exist but none for player');
      }
    }

    // Handle state transition
    const wasInJail = state.inJail;
    state.inJail = inJail;

    if (!wasInJail && inJail) {
      // Player just got jailed
      console.log('Player just got jailed!');
      if (state.currentAction && !state.pendingAction) {
        state.pendingAction = state.currentAction;
        updateStatus(`JAILED! Action interrupted: ${state.currentAction}. Will resume after release.`);
      }
      // CRITICAL: Reset action state immediately when jailed
      state.isPerformingAction = false;
      state.currentAction = '';
      state.needsRefresh = true;
      GM_setValue('actionStartTime', 0);
    } else if (wasInJail && !inJail) {
      // Player just got released
      console.log('Player just got released!');
      updateStatus(`Released from jail!${state.pendingAction ? ` Resuming: ${state.pendingAction}` : ''}`);
      state.needsRefresh = true;

      // Process any pending OC/DTM invites now that we're free (after short delay)
      const hasPendingDTM = localStorage.getItem(LS_PENDING_DTM_URL);
      const hasPendingOC = localStorage.getItem(LS_PENDING_OC_URL);
      if (hasPendingDTM || hasPendingOC) {
        console.log('[TMN] Released from jail — pending invite will be processed by mainLoop');
      }
    }

    saveState();

    if (state.inJail) {
      updateStatus(`${state.playerName} is IN JAIL - waiting for release${state.pendingAction ? ` (will resume ${state.pendingAction})` : ''}`);
    } else {
      updateStatus(`${state.playerName} is free - ready for actions`);
    }

    return inJail;
  }

  // Enhanced function to check jail state on ANY page
  function checkJailStateOnAnyPage() {
    const currentPage = getCurrentPage();

    // If we're on the jail page, use the full detection
    if (currentPage === 'jail') {
      return processJailPage();
    }

    // On other pages, look for jail indicators
    const pageText = document.body.textContent.toLowerCase();
    if (pageText.includes('you are in jail') || pageText.includes('you have been jailed')) {
      const wasInJail = state.inJail;
      state.inJail = true;

      if (!wasInJail) {
        console.log('Jail detected on non-jail page!');
        if (state.currentAction && !state.pendingAction) {
          state.pendingAction = state.currentAction;
        }
        state.isPerformingAction = false;
        state.currentAction = '';
        state.needsRefresh = true;
        GM_setValue('actionStartTime', 0);
        saveState();
        updateStatus(`JAILED on ${currentPage} page! Navigation interrupted.`);

        // Navigate to jail page to confirm
        setTimeout(() => {
          window.location.href = '/authenticated/jail.aspx?' + Date.now();
        }, 1000);
      }
      return true;
    }

    return state.inJail;
  }

  // ---------------------------
  // Safety Functions
  // ---------------------------
  function checkForNavigationInterruption() {
    if (state.isPerformingAction) {
      const actionStartTime = GM_getValue('actionStartTime', 0);
      const now = Date.now();

      if (now - actionStartTime > 15000) {
        updateStatus(`Resetting stuck action: ${state.currentAction}`);
        state.isPerformingAction = false;
        state.currentAction = '';
        state.needsRefresh = true;
        saveState();
        GM_setValue('actionStartTime', 0);
        return true;
      }
    }
    return false;
  }

  function safeNavigate(url) {
    // CRITICAL: Always check jail state before navigation
    if (state.inJail && !url.includes('jail.aspx')) {
      updateStatus("BLOCKED: Cannot navigate - player is in jail");
      return true;
    }

    if (state.isPerformingAction) {
      updateStatus("Completing current action before navigation...");
      setTimeout(() => {
        state.isPerformingAction = false;
        state.currentAction = '';
        state.needsRefresh = false;
        GM_setValue('actionStartTime', 0);
        saveState();
        window.location.href = url;
      }, randomDelay(DELAYS.normal));
      return true;
    } else {
      // Human-like delay before navigation
      const delay = randomDelay(DELAYS.quick);
      setTimeout(() => {
        window.location.href = url;
      }, delay);
      return false;
    }
  }

  function completePendingAction(actionType) {
    if (state.pendingAction === actionType) {
      state.pendingAction = '';
      saveState();
    }
  }

  // ---------------------------
  // Automation Control Functions
  // ---------------------------
  function pauseAutomation() {
    automationPaused = true;
    updateStatus("Automation PAUSED - Settings modal open");
  }

  function resumeAutomation() {
    automationPaused = false;
    updateStatus("Automation RESUMED");
  }

  // ---------------------------
  // Main Action Functions (WITH JAIL CHECKS)
  // ---------------------------
  function doCrime() {
    // CRITICAL: Check jail state at the start of EVERY action
    if (state.inJail) {
      updateStatus("BLOCKED: Cannot commit crime while in jail");
      state.isPerformingAction = false;
      state.currentAction = '';
      return;
    }

    if (!state.autoCrime || state.isPerformingAction || automationPaused) return;

    const now = Date.now();
    if (now - state.lastCrime < config.crimeInterval * 1000) {
      const remaining = Math.ceil((config.crimeInterval * 1000 - (now - state.lastCrime)) / 1000);
      updateStatus(`Crime cooldown: ${remaining}s remaining`);
      return;
    }

    if (state.needsRefresh || getCurrentPage() !== 'crimes') {
      state.needsRefresh = false;
      saveState();
      updateStatus("Loading crimes page...");
      safeNavigate('/authenticated/crimes.aspx?' + Date.now());
      return;
    }

    state.isPerformingAction = true;
    state.currentAction = 'crime';
    GM_setValue('actionStartTime', now);
    updateStatus("Attempting crime...");

    let availableCrimes = [];

    if (state.selectedCrimes.length > 0) {
      availableCrimes = state.selectedCrimes.map(crimeId => {
        const crime = crimeOptions.find(c => c.id === crimeId);
        if (crime) {
          const btn = document.getElementById(crime.element);
          if (btn && !btn.disabled) {
            return btn;
          }
        }
        return null;
      }).filter(btn => btn !== null);
    } else {
      for (let i = 1; i <= 5; i++) {
        const btn = document.getElementById(`ctl00_main_btnCrime${i}`);
        if (btn && !btn.disabled) {
          availableCrimes.push(btn);
        }
      }
    }

    if (availableCrimes.length === 0) {
      updateStatus("No available crime buttons found");
      state.isPerformingAction = false;
      state.currentAction = '';
      GM_setValue('actionStartTime', 0);
      return;
    }

    const randomBtn = availableCrimes[Math.floor(Math.random() * availableCrimes.length)];
    randomBtn.click();

    state.lastCrime = now;
    state.needsRefresh = true;
    completePendingAction('crime');
    saveState();
    updateStatus("Crime attempted - will refresh page...");

    setTimeout(() => {
      state.isPerformingAction = false;
      state.currentAction = '';
      GM_setValue('actionStartTime', 0);
    }, randomDelay(DELAYS.normal));
  }

  function doGTA() {
    // CRITICAL: Check jail state at the start of EVERY action
    if (state.inJail) {
      updateStatus("BLOCKED: Cannot do GTA while in jail");
      state.isPerformingAction = false;
      state.currentAction = '';
      return;
    }

    if (!state.autoGTA || state.isPerformingAction || automationPaused) return;

    const now = Date.now();
    if (now - state.lastGTA < config.gtaInterval * 1000) {
      const remaining = Math.ceil((config.gtaInterval * 1000 - (now - state.lastGTA)) / 1000);
      updateStatus(`GTA cooldown: ${remaining}s remaining`);
      return;
    }

    const currentPage = getCurrentPage();
    if (state.needsRefresh || currentPage !== 'gta') {
      state.needsRefresh = false;
      saveState();
      if (currentPage === 'gta') {
        updateStatus("Already on GTA page, proceeding...");
      } else {
        updateStatus("Loading GTA page...");
        safeNavigate('/authenticated/crimes.aspx?p=g&' + Date.now());
        return;
      }
    }

    state.isPerformingAction = true;
    state.currentAction = 'gta';
    GM_setValue('actionStartTime', now);
    updateStatus("Attempting GTA...");

    let availableGTAs = [];
    const radioButtons = document.querySelectorAll('input[name="ctl00$main$carslist"]');

    if (state.selectedGTAs.length > 0) {
      availableGTAs = state.selectedGTAs.map(gtaId => {
        const gta = gtaOptions.find(g => g.id === gtaId);
        if (gta) {
          return Array.from(radioButtons).find(radio => radio.value === gta.value);
        }
        return null;
      }).filter(Boolean);
    } else {
      availableGTAs = Array.from(radioButtons);
    }

    if (availableGTAs.length === 0) {
      updateStatus("No GTA options found - resetting action state");
      state.isPerformingAction = false;
      state.currentAction = '';
      state.needsRefresh = true;
      GM_setValue('actionStartTime', 0);
      saveState();
      return;
    }

    const randomRadio = availableGTAs[Math.floor(Math.random() * availableGTAs.length)];
    randomRadio.checked = true;

    // Human-like delay between selecting car and clicking steal
    setTimeout(() => {
      const stealBtn = document.getElementById('ctl00_main_btnStealACar');
      if (!stealBtn) {
        updateStatus("Steal car button not found - resetting action state");
        state.isPerformingAction = false;
        state.currentAction = '';
        state.needsRefresh = true;
        GM_setValue('actionStartTime', 0);
        saveState();
        return;
      }

      stealBtn.click();

      state.lastGTA = now;
      state.needsRefresh = true;
      completePendingAction('gta');
      saveState();
      updateStatus("GTA attempted - will refresh page...");

      setTimeout(() => {
        state.isPerformingAction = false;
        state.currentAction = '';
        GM_setValue('actionStartTime', 0);
      }, randomDelay(DELAYS.normal));
    }, randomDelay(DELAYS.quick));
  }

  function doBooze() {
    // CRITICAL: Check jail state at the start of EVERY action
    if (state.inJail) {
      updateStatus("BLOCKED: Cannot do booze run while in jail");
      state.isPerformingAction = false;
      state.currentAction = '';
      return;
    }

    if (!state.autoBooze || state.isPerformingAction || automationPaused) return;

    const now = Date.now();
    if (now - state.lastBooze < config.boozeInterval * 1000) {
      const remaining = Math.ceil((config.boozeInterval * 1000 - (now - state.lastBooze)) / 1000);
      updateStatus(`Booze cooldown: ${remaining}s remaining`);
      return;
    }

    if (state.needsRefresh || getCurrentPage() !== 'booze') {
      state.needsRefresh = false;
      saveState();
      updateStatus("Loading booze page...");
      safeNavigate('/authenticated/crimes.aspx?p=b&' + Date.now());
      return;
    }

    state.isPerformingAction = true;
    state.currentAction = 'booze';
    GM_setValue('actionStartTime', now);
    updateStatus("Attempting booze transaction...");

    // First try to sell existing inventory
    const inventoryRows = Array.from(document.querySelectorAll('table tr')).filter(row => {
      const col3 = row.querySelector('td:nth-child(3)');
      if (!col3) return false;
      const inventory = col3.textContent.trim();
      return inventory && inventory !== '0' && !isNaN(inventory);
    });

    if (inventoryRows.length > 0) {
      // Has inventory - sell it using boozeSellAmount
      const row = inventoryRows[0];
      const sellInput = row.querySelector('input[id*="tbAmtSell"]');
      const sellBtn = row.querySelector('input[id*="btnSell"]');
      if (sellInput && sellBtn && !sellBtn.disabled) {
        const currentInventory = parseInt(row.querySelector('td:nth-child(3)').textContent.trim());
        const sellAmount = Math.min(config.boozeSellAmount, currentInventory);
        sellInput.value = sellAmount;
        updateStatus(`Selling ${sellAmount} booze units...`);
        sellBtn.click();

        state.lastBooze = now;
        state.needsRefresh = true;
        completePendingAction('booze');
        saveState();

        setTimeout(() => {
          state.isPerformingAction = false;
          state.currentAction = '';
          GM_setValue('actionStartTime', 0);
        }, randomDelay(DELAYS.normal));
        return;
      }
    }

    // No inventory - try to buy using boozeBuyAmount
    const buyOptions = [];
    for (let i = 2; i <= 6; i++) {
      const input = document.getElementById(`ctl00_main_gvBooze_ctl0${i}_tbAmtBuy`);
      const btn = document.getElementById(`ctl00_main_gvBooze_ctl0${i}_btnBuy`);
      if (input && btn && !btn.disabled) {
        buyOptions.push({ input, btn, index: i });
      }
    }

    if (buyOptions.length > 0) {
      const choice = buyOptions[Math.floor(Math.random() * buyOptions.length)];
      choice.input.value = config.boozeBuyAmount;
      updateStatus(`Buying ${config.boozeBuyAmount} booze units...`);
      choice.btn.click();

      state.lastBooze = now;
      state.needsRefresh = true;
      completePendingAction('booze');
      saveState();

      setTimeout(() => {
        state.isPerformingAction = false;
        state.currentAction = '';
        GM_setValue('actionStartTime', 0);
      }, randomDelay(DELAYS.normal));
    } else {
      updateStatus("No booze options available");
      state.isPerformingAction = false;
      state.currentAction = '';
      GM_setValue('actionStartTime', 0);
    }
  }

  function doJailbreak() {
    if (!state.autoJail || state.isPerformingAction || state.inJail || automationPaused) return;

    const now = Date.now();
    if (now - state.lastJail < config.jailbreakInterval * 1000) return;

    if (getCurrentPage() !== 'jail') {
      updateStatus("Navigating to jail page...");
      safeNavigate('/authenticated/jail.aspx?' + Date.now());
      return;
    }

    const breakLinks = document.querySelectorAll('a[id*="btnBreak"]');
    const availableLinks = Array.from(breakLinks).filter(link => {
      return !link.hasAttribute('disabled') && link.href && link.href.includes('javascript:');
    });

    if (availableLinks.length > 0) {
      state.isPerformingAction = true;
      state.currentAction = 'jailbreak';
      GM_setValue('actionStartTime', now);
      const randomLink = availableLinks[Math.floor(Math.random() * availableLinks.length)];
      randomLink.click();
      updateStatus(`Jailbreak attempted (${availableLinks.length} available)`);

      state.lastJail = now;
      saveState();

      setTimeout(() => {
        state.isPerformingAction = false;
        state.currentAction = '';
        GM_setValue('actionStartTime', 0);
        safeNavigate('/authenticated/jail.aspx?' + Date.now());
      }, randomDelay(DELAYS.quick));
    } else {
      state.lastJail = now;
      saveState();
      updateStatus("No players available to break out");
    }
  }

  // ---------------------------
  // Health Functions
  // ---------------------------
  function getHealthPercent() {
    const healthSpan = document.querySelector('#ctl00_userInfo_lblhealth');
    if (!healthSpan) return 100;
    const healthText = healthSpan.textContent.trim();
    const healthValue = parseInt(healthText.replace('%', ''), 10);
    return isNaN(healthValue) ? 100 : healthValue;
  }

  function getCredits() {
    const creditsSpan = document.querySelector('#ctl00_userInfo_lblcredits');
    if (!creditsSpan) return 0;
    const creditsText = creditsSpan.textContent.trim();
    return parseInt(creditsText.replace(/[,$]/g, ''), 10) || 0;
  }

  function checkAndBuyHealth() {
    if (!state.autoHealth || state.isPerformingAction || automationPaused) return;

    const health = getHealthPercent();
    const credits = getCredits();

    // If health is 100% or close, nothing to do
    if (health >= 100) {
      state.buyingHealth = false;
      saveState();
      return;
    }

    // Calculate how much health we need and how many credits that costs
    // Each 10% health costs 10 credits
    const healthNeeded = 100 - health;
    const purchasesNeeded = Math.ceil(healthNeeded / 10);
    const creditsNeeded = purchasesNeeded * 10;

    // Check if we have enough credits
    if (credits < 10) {
      console.log('[TMN] Not enough credits for health - need at least 10');
      state.autoHealth = false; // Disable auto-health if no credits
      saveState();
      updateStatus("Auto-health disabled - no credits");
      return;
    }

    // If not on credits page, navigate there
    if (!/\/authenticated\/credits\.aspx$/i.test(location.pathname)) {
      state.buyingHealth = true;
      saveState();
      updateStatus(`Health low (${health}%) - navigating to buy health`);
      console.log(`[TMN] Health: ${health}%, navigating to credits page`);
      setTimeout(() => location.href = '/authenticated/credits.aspx', 1500);
      return;
    }

    // On credits page - buy health
    if (state.buyingHealth) {
      const buyBtn = document.querySelector('#ctl00_main_btnBuyHealth');
      if (buyBtn) {
        state.isPerformingAction = true;
        state.currentAction = 'health';
        console.log(`[TMN] Buying health - current: ${health}%`);
        updateStatus(`Buying health (${health}% -> ${Math.min(100, health + 10)}%)`);
        buyBtn.click();

        // After purchase, reload to continue buying if needed
        setTimeout(() => {
          state.isPerformingAction = false;
          state.currentAction = '';
          state.lastHealth = Date.now();
          // Check if we need more health
          if (health + 10 >= 100) {
            state.buyingHealth = false;
            console.log('[TMN] Health purchase complete');
          }
          saveState();
          location.reload();
        }, 1500);
      } else {
        state.buyingHealth = false;
        saveState();
        console.log('[TMN] Buy health button not found');
      }
    }
  }

  // ---------------------------
  // Garage Functions
  // ---------------------------
  // Known car catalog with default categories.
  // Categories: 'OC' = keep & repair (used for OC), 'Crush' = send to crusher, 'Sell' = sell normally
  // Cars flagged as locked:true are fixed OC cars and cannot be recategorised by the user.
  // Any car NOT in this list falls through to 'Sell' behaviour.
  const KNOWN_CARS = [
    // OC / VIP cars (LOCKED — cannot be overridden)
    { name: 'Bentley Arnage',        defaultCategory: 'OC',    locked: true },
    { name: 'Audi RS6 Avant',        defaultCategory: 'OC',    locked: true },
    // Manual-only (LOCKED — never auto-processed; user handles via game UI)
    { name: 'Bugatti Chiron SS',     defaultCategory: 'Manual', locked: true, manual: true },
    // Crusher cars
    { name: 'Bentley Continental',   defaultCategory: 'Crush' },
    { name: 'Lamborghini Aventador', defaultCategory: 'Crush' },
    { name: 'Lamborghini Huracan',   defaultCategory: 'Crush' },
    { name: 'Lamborghini Gallardo',  defaultCategory: 'Crush' },
    { name: 'Ferrari Purosangue',    defaultCategory: 'Crush' },
    { name: 'Mercedes-Benz G-Wagon', defaultCategory: 'Crush' },
    { name: 'Tesla Cybertruck',      defaultCategory: 'Crush' },
    // High-value cars — listed so users can recategorise, default to Sell
    { name: 'Dodge Challenger Hellcat', defaultCategory: 'Sell' },
    { name: 'Porsche 911 Turbo',     defaultCategory: 'Sell' },
    { name: 'Audi A8',               defaultCategory: 'Sell' },
    { name: 'Audi R8',               defaultCategory: 'Sell' },
    { name: 'Mercedes-Benz SLK 55',  defaultCategory: 'Sell' },
    { name: 'BMW X5M',               defaultCategory: 'Sell' },
    { name: 'Chevrolet Corvette',    defaultCategory: 'Sell' },
    { name: 'Porsche Cayenne',       defaultCategory: 'Sell' }
  ];

  // Look up a car's effective category, honouring user overrides in state.carCategories.
  // Matching is case-insensitive and tolerant of '-' / '.' / ' ' differences.
  function _normalizeCarName(s) {
    return String(s || '').toLowerCase().replace(/[-.\s]+/g, '');
  }
  function getCarCategory(carName) {
    const normName = _normalizeCarName(carName);
    if (!normName) return null;
    // Find the canonical entry first — locked cars always return their default
    const known = KNOWN_CARS.find(c => _normalizeCarName(c.name) === normName);
    if (known && known.locked) return known.defaultCategory;
    // Check user overrides
    const overrides = state.carCategories || {};
    for (const [key, cat] of Object.entries(overrides)) {
      if (_normalizeCarName(key) === normName) return cat;
    }
    // Fall back to defaults
    if (known) return known.defaultCategory;
    return null; // Unknown car — falls through to default behaviour (sell)
  }

  // VIP cars - keep these, repair them, don't sell
  function isVIPCar(carName) {
    return getCarCategory(carName) === 'OC';
  }

  // Crusher cars - send these to the crusher instead of selling
  function isCrusherCar(carName) {
    return getCarCategory(carName) === 'Crush';
  }

  // Manual-only cars - never auto-processed by Auto Garage at all
  function isManualOnlyCar(carName) {
    const normName = _normalizeCarName(carName);
    if (!normName) return false;
    const known = KNOWN_CARS.find(c => _normalizeCarName(c.name) === normName);
    return !!(known && known.manual);
  }

  // ---------------------------
  // Gifted-car cooldown (post-error recovery)
  // ---------------------------
  // The crusher rejects cars sent to you by other players ("you can only crush
  // cars that you stole yourself"). The garage page exposes NO reliable per-car
  // identifier — checkbox ids are row-position-based and shift when rows change,
  // and the only data columns (name/type/value/damage/location) can't distinguish
  // two cars of the same model. So instead of blacklisting individual cars, we
  // cooldown the model NAME for a while: any car matching that name is skipped
  // by the crusher and falls through to Step 1b's sell path. Once the cooldown
  // expires, crushing that model resumes — by then the gifted one has been sold
  // and any new one is almost certainly stolen. Per-player scoped.
  const LS_GIFTED_MODELS_PREFIX = 'tmnGiftedModels_';
  const LS_PENDING_CRUSH_NAME = 'tmnPendingCrushName';
  const LS_CRUSHER_FULL_UNTIL = 'tmnCrusherFullUntil';
  const LS_CRUSHER_LOOP_COUNT = 'tmnCrusherLoopCount';
  const CRUSHER_ERROR_REGEX = /you can only crush cars that you stole yourself/i;
  const CRUSHER_FULL_REGEX = /crusher queue full|daily capacity reached/i;
  const CRUSHER_FULL_PAUSE_MS = 60 * 60 * 1000;   // 1 hour
  const GIFTED_MODEL_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
  const CRUSHER_LOOP_SAFETY_LIMIT = 3; // After N failed crush attempts in a row, assume no crusher and auto-disable

  function _giftedKey() {
    return LS_GIFTED_MODELS_PREFIX + (state.playerName || 'unknown');
  }

  function getGiftedModelCooldowns() {
    try {
      const raw = localStorage.getItem(_giftedKey());
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return (obj && typeof obj === 'object') ? obj : {};
    } catch { return {}; }
  }

  function _saveGiftedModelCooldowns(obj) {
    try {
      // Prune expired entries before saving
      const now = Date.now();
      const cleaned = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'number' && v > now) cleaned[k] = v;
      }
      localStorage.setItem(_giftedKey(), JSON.stringify(cleaned));
    } catch (e) {
      console.warn('[TMN] Failed to save gifted model cooldowns:', e);
    }
  }

  function markGiftedModel(carName) {
    if (!carName) return;
    const obj = getGiftedModelCooldowns();
    obj[carName] = Date.now() + GIFTED_MODEL_COOLDOWN_MS;
    _saveGiftedModelCooldowns(obj);
  }

  function isModelOnGiftedCooldown(carName) {
    if (!carName) return false;
    const obj = getGiftedModelCooldowns();
    const until = obj[carName];
    if (typeof until !== 'number') return false;
    return until > Date.now();
  }

  // Permanently disable crusher functionality for this player until they manually
  // re-enable it via the "Reset crusher status" button in settings. Called when:
  //  - the crusher button is absent from the garage page, or
  //  - the crusher loop safety limit is hit (N failed attempts in a row)
  function disableCrusherOwnership(reason) {
    state.crusherOwned = false;
    state.autoCrusher = false;
    saveState();
    localStorage.removeItem(LS_PENDING_CRUSH_NAME);
    localStorage.removeItem(LS_CRUSHER_LOOP_COUNT);
    // Reflect in the UI if it's open
    try {
      const host = document.getElementById('tmn-automation-host');
      if (host && host.shadowRoot) {
        const cb = host.shadowRoot.querySelector('#tmn-auto-crusher');
        if (cb) {
          cb.checked = false;
          cb.disabled = true;
        }
      }
    } catch (e) {}
    console.log(`[TMN] Auto Crusher disabled — ${reason}`);
    updateStatus('Auto Crusher disabled — no crusher');
    sendTelegramMessage(
      '⚙️ <b>Auto Crusher Disabled</b>\n\n' +
      `Player: ${state.playerName || 'Unknown'}\n` +
      `Reason: ${reason}\n` +
      'Use "Reset crusher status" in settings if you get a crusher.'
    );
  }
  function doGarage() {
    if (!state.autoGarage || state.isPerformingAction || state.inJail || automationPaused) return;

    const now = Date.now();
    if (now - state.lastGarage < config.garageInterval * 1000) return;

    // Navigate to garage if not there
    if (getCurrentPage() !== 'garage') {
      updateStatus("Navigating to garage...");
      safeNavigate('/authenticated/playerproperty.aspx?p=g&' + Date.now());
      return;
    }

    // On garage page - process cars
    const table = document.getElementById('ctl00_main_gvCars');
    if (!table) {
      updateStatus("No garage table found");
      state.lastGarage = now;
      state.isPerformingAction = false;
      state.currentAction = '';
      GM_setValue('actionStartTime', 0);
      saveState();
      return;
    }

    // Get all car rows (skip header row)
    const rows = Array.from(table.querySelectorAll('tr')).slice(1);
    const carRows = rows.filter(row => row.querySelector('input[type="checkbox"]'));

    if (carRows.length === 0) {
      updateStatus("No cars in garage");
      state.lastGarage = now;
      state.isPerformingAction = false;
      state.currentAction = '';
      GM_setValue('actionStartTime', 0);
      saveState();
      return;
    }

    // BLOCKING-ERROR GATE: if the page is showing a TMN error that isn't one of our
    // known crusher errors (gifted-car rejection or queue-full), something unrelated
    // is preventing actions — jail, hospital, no-action-allowed, etc. Abort the whole
    // garage cycle so we don't tick checkboxes, click buttons, or accidentally trip
    // error-recovery logic. The next cycle will re-check after the blocker clears.
    {
      const errEl = document.getElementById('ctl00_lblMsg');
      const errTxt = (errEl && errEl.classList.contains('TMNErrorFont'))
        ? (errEl.textContent || '').trim()
        : '';
      const isKnownCrusherError = errTxt && (CRUSHER_ERROR_REGEX.test(errTxt) || CRUSHER_FULL_REGEX.test(errTxt));
      if (errTxt && !isKnownCrusherError) {
        console.log(`[TMN] Garage: blocking error on page, aborting cycle: "${errTxt.substring(0, 160)}"`);
        updateStatus(`Garage blocked: ${errTxt.substring(0, 60)}`);
        // Clear any stale pending crush so we don't misinterpret it next time
        localStorage.removeItem(LS_PENDING_CRUSH_NAME);
        state.lastGarage = now;
        state.isPerformingAction = false;
        state.currentAction = '';
        GM_setValue('actionStartTime', 0);
        saveState();
        return;
      }
    }

    state.isPerformingAction = true;
    state.currentAction = 'garage';
    GM_setValue('actionStartTime', now);

    // Step 1a: Send crusher cars to crusher
    // Gated on: Auto Crusher toggle on, crusherOwned not explicitly false
    if (state.autoCrusher && state.crusherOwned !== false) {
      // Detect crusher ownership: the button is ALWAYS present on the garage page,
      // but is rendered with the `disabled` attribute when the player doesn't own a crusher.
      // We must check both: element exists AND it's not disabled.
      const crusherBtnCheck = document.getElementById('ctl00_main_btnSendtoCrusher');
      const crusherBtnUsable = crusherBtnCheck &&
                               !crusherBtnCheck.disabled &&
                               !crusherBtnCheck.hasAttribute('disabled');
      if (!crusherBtnUsable) {
        // Button absent OR disabled → definitely no crusher. Permanently disable.
        const reason = !crusherBtnCheck
          ? 'crusher button missing from garage page'
          : 'crusher button present but disabled (no crusher owned)';
        disableCrusherOwnership(reason);
      } else {
        // Button is enabled → we own a crusher. Lock this in permanently.
        // Once confirmed, ownership is never revoked (you can't lose a crusher in TMN),
        // which means the loop-safety counter and unknown-error logic become inert.
        if (state.crusherOwned !== true) {
          state.crusherOwned = true;
          saveState();
          localStorage.removeItem(LS_CRUSHER_LOOP_COUNT);
          console.log('[TMN] Crusher ownership confirmed — locked in permanently');
        }
        // POST-ERROR RECOVERY: read the message element from the previous attempt.
        // Three distinct error conditions to handle:
        //   1. "you can only crush cars that you stole yourself" → cooldown this model name
        //   2. "crusher queue full" / "daily capacity reached" → pause crusher attempts for 1 hour
        //   3. Any OTHER error with a pending crush name → bump the loop safety counter.
        //      If we hit the limit, assume we don't actually own a crusher and auto-disable.
        try {
          const errorMsg = document.getElementById('ctl00_lblMsg');
          const msgText = errorMsg ? (errorMsg.textContent || '').trim() : '';
          const pendingName = localStorage.getItem(LS_PENDING_CRUSH_NAME);

          if (msgText && CRUSHER_FULL_REGEX.test(msgText)) {
            // Crusher full — pause for 1 hour, reset loop counter
            const pauseUntil = Date.now() + CRUSHER_FULL_PAUSE_MS;
            localStorage.setItem(LS_CRUSHER_FULL_UNTIL, String(pauseUntil));
            localStorage.removeItem(LS_CRUSHER_LOOP_COUNT);
            // If we got a "full" error, we definitely own a crusher — confirm it
            if (state.crusherOwned !== true) {
              state.crusherOwned = true;
              saveState();
            }
            console.log(`[TMN] Crusher full / daily limit reached — pausing crusher for 1 hour (until ${new Date(pauseUntil).toLocaleTimeString()})`);
            updateStatus('Crusher full — paused for 1 hour');
            sendTelegramMessage(
              '⏸ <b>Crusher Paused</b>\n\n' +
              `Player: ${state.playerName || 'Unknown'}\n` +
              'Reason: crusher queue full or daily limit reached\n' +
              'Resuming in 1 hour'
            );
            localStorage.removeItem(LS_PENDING_CRUSH_NAME);
          } else if (pendingName) {
            if (msgText && CRUSHER_ERROR_REGEX.test(msgText)) {
              // Gifted-car rejection — confirms we DO own a crusher
              if (state.crusherOwned !== true) {
                state.crusherOwned = true;
                saveState();
              }
              localStorage.removeItem(LS_CRUSHER_LOOP_COUNT);
              markGiftedModel(pendingName);
              const minsCooldown = Math.round(GIFTED_MODEL_COOLDOWN_MS / 60000);
              console.log(`[TMN] Crusher rejected "${pendingName}" as gifted — cooling down model for ${minsCooldown} min`);
              updateStatus(`"${pendingName}" gifted — cooldown ${minsCooldown} min`);
              sendTelegramMessage(
                '🚫 <b>Crusher Rejection</b>\n\n' +
                `Player: ${state.playerName || 'Unknown'}\n` +
                `Model: ${pendingName}\n` +
                `This car was gifted, not stolen. Skipping this model for ${minsCooldown} min (will be sold instead).`
              );
            } else if (msgText) {
              // Some text is present that isn't a known crusher error.
              // Only count it toward the safety limit if BOTH:
              //   (a) the element has the TMNErrorFont class (how TMN marks real errors), AND
              //   (b) the text mentions "crusher" (so unrelated errors from other parts
              //       of the page — hospital, jail, travel, etc. — don't trip the counter)
              // This is conservative on purpose: false positives here lead to falsely
              // disabling Auto Crusher on accounts that genuinely own one.
              const isErrorClass = errorMsg && errorMsg.classList.contains('TMNErrorFont');
              const mentionsCrusher = /crusher/i.test(msgText);
              const isActualCrusherError = isErrorClass && mentionsCrusher;
              // ONCE OWNERSHIP IS CONFIRMED, never disable. The loop counter only exists
              // to catch a missed no-crusher state on first run; if we've already
              // confirmed the player owns one, unknown errors are just transient (multi-car
              // submissions, weird page state, etc.) and should be ignored.
              const ownershipConfirmed = state.crusherOwned === true;
              if (isActualCrusherError && !ownershipConfirmed) {
                const currentCount = parseInt(localStorage.getItem(LS_CRUSHER_LOOP_COUNT) || '0', 10) + 1;
                localStorage.setItem(LS_CRUSHER_LOOP_COUNT, String(currentCount));
                console.log(`[TMN] Crusher attempt returned unknown crusher error (${currentCount}/${CRUSHER_LOOP_SAFETY_LIMIT}): "${msgText.substring(0, 200)}"`);
                if (currentCount >= CRUSHER_LOOP_SAFETY_LIMIT) {
                  disableCrusherOwnership(`${CRUSHER_LOOP_SAFETY_LIMIT} consecutive failed crush attempts — assuming no crusher`);
                  localStorage.removeItem(LS_PENDING_CRUSH_NAME);
                  return;
                }
              } else if (isActualCrusherError && ownershipConfirmed) {
                // Logged for diagnostics but no action — ownership is locked in
                console.log(`[TMN] Crusher error after confirmed ownership (ignored): "${msgText.substring(0, 200)}"`);
                localStorage.removeItem(LS_CRUSHER_LOOP_COUNT);
              } else {
                // Non-crusher error or non-error text → treat as success for our purposes
                console.log(`[TMN] Crusher: ignoring non-crusher message after attempt (treating as success): "${msgText.substring(0, 120)}" [errorClass=${isErrorClass}, mentionsCrusher=${mentionsCrusher}]`);
                localStorage.removeItem(LS_CRUSHER_LOOP_COUNT);
                if (state.crusherOwned !== true) {
                  state.crusherOwned = true;
                  saveState();
                }
              }
            } else {
              // No error text → assume success, reset loop counter, confirm ownership
              localStorage.removeItem(LS_CRUSHER_LOOP_COUNT);
              if (state.crusherOwned !== true) {
                state.crusherOwned = true;
                saveState();
              }
            }
            localStorage.removeItem(LS_PENDING_CRUSH_NAME);
          }
        } catch (e) {
          console.warn('[TMN] Crusher error-recovery check failed:', e);
          localStorage.removeItem(LS_PENDING_CRUSH_NAME);
        }

        // Check the active crusher-full pause window
        const fullUntil = parseInt(localStorage.getItem(LS_CRUSHER_FULL_UNTIL) || '0', 10);
        const crusherPaused = fullUntil > Date.now();
        if (crusherPaused) {
          const minsLeft = Math.ceil((fullUntil - Date.now()) / 60000);
          console.log(`[TMN] Crusher paused — ${minsLeft} min remaining, skipping crusher selection`);
        } else if (fullUntil > 0) {
          localStorage.removeItem(LS_CRUSHER_FULL_UNTIL);
        }

        if (!crusherPaused) {
          // ONE-AT-A-TIME: find the first eligible damaged crusher car whose model
          // isn't on a gifted cooldown, and send only that one.
          let chosenRow = null;
          let chosenName = '';
          for (const row of carRows) {
            const nameCell = row.children[1];
            const carName = nameCell ? nameCell.textContent.trim() : '';
            const damageCell = row.children[4];
            const damage = damageCell ? parseInt(damageCell.textContent.trim().replace('%', ''), 10) : 0;
            const checkbox = row.querySelector('input[type="checkbox"]');
            // Skip: missing checkbox, manual-only cars, non-crusher cars, OC cars,
            // undamaged cars, models currently on a gifted cooldown
            if (!checkbox) continue;
            if (isManualOnlyCar(carName)) continue;
            if (!isCrusherCar(carName)) continue;
            if (isVIPCar(carName)) continue;
            if (damage <= 0) continue;
            if (isModelOnGiftedCooldown(carName)) continue;
            chosenRow = row;
            chosenName = carName;
            break;
          }

          if (chosenRow) {
            // Uncheck EVERYTHING in the entire car table first — not just rows we know
            // about, but the Check All header checkbox and any stray checkboxes too.
            // UnderCoverLover reported seeing 3 boxes ticked when the script intended 1,
            // so we belt-and-braces this.
            const allTableCheckboxes = table.querySelectorAll('input[type="checkbox"]');
            allTableCheckboxes.forEach(cb => { cb.checked = false; });

            const cb = chosenRow.querySelector('input[type="checkbox"]');
            if (cb) cb.checked = true;

            // Verify we have EXACTLY one ticked checkbox before clicking. If the count
            // is wrong, abort and log loudly — this prevents a multi-car submission
            // which would trigger TMN's "you can only crush cars that you stole yourself"
            // error if any of the unintended cars happened to be gifted.
            const tickedCount = Array.from(table.querySelectorAll('input[type="checkbox"]'))
              .filter(c => c.checked).length;
            if (tickedCount !== 1) {
              console.warn(`[TMN] ⚠️ Crusher safety abort — expected exactly 1 ticked checkbox, found ${tickedCount}. Skipping this crush cycle.`);
              updateStatus(`Crusher: aborted (${tickedCount} boxes ticked, expected 1)`);
              // Don't stash a pending name, don't click, just bail out to Step 1b
              localStorage.removeItem(LS_PENDING_CRUSH_NAME);
            } else {
              // Stash the model name so the next garage visit can detect failure
              try {
                localStorage.setItem(LS_PENDING_CRUSH_NAME, chosenName);
              } catch (e) {
                console.warn('[TMN] Failed to stash pending crush name:', e);
              }
              updateStatus(`Sending ${chosenName} to crusher...`);
              console.log(`[TMN] Sending 1 car to crusher: ${chosenName}`);
              crusherBtnCheck.click();
              setTimeout(() => {
                state.isPerformingAction = false;
                state.currentAction = '';
                state.lastGarage = Date.now();
                state.needsRefresh = true;
                GM_setValue('actionStartTime', 0);
                saveState();
                window.location.href = '/authenticated/crimes.aspx?' + Date.now();
              }, randomDelay(DELAYS.normal));
              return;
            }
          }
        }
      }
    }

    // Step 1b: Sell remaining cars.
    // What gets sold:
    //  - Anything that isn't an OC car AND isn't a manual-only car (e.g. Bugatti Chiron SS)
    //  - Crush-category cars are sold ONLY if Auto Crusher is off, OR the model is on
    //    a gifted cooldown (meaning a previous crush attempt failed),
    //    OR they have 0% damage (the crusher won't accept undamaged cars)
    // Step 1b: Sell remaining cars.
    // Behaviour depends on whether we've confirmed no crusher:
    //  - crusherOwned !== false (own one OR status unknown): keep all listed cars
    //    (OC, Chiron, crusher cars) — only sell unlisted cars like random Nissans.
    //    This builds up crusher-bound stock while the crusher is available or being earned.
    //  - crusherOwned === false (confirmed no crusher): sell crusher cars too, since
    //    there's no point keeping them. OC cars and Chiron still kept.
    //  - Damaged crusher cars that hit the gifted cooldown are always sold regardless.
    const crusherConfirmedNone = state.crusherOwned === false;
    let carsToSell = 0;
    carRows.forEach(row => {
      const nameCell = row.children[1];
      const carName = nameCell ? nameCell.textContent.trim() : '';
      const damageCell = row.children[4];
      const damage = damageCell ? parseInt(damageCell.textContent.trim().replace('%', ''), 10) : 0;
      const checkbox = row.querySelector('input[type="checkbox"]');
      if (!checkbox) return;
      if (isVIPCar(carName)) return;        // OC cars: always keep
      if (isManualOnlyCar(carName)) return; // Bugatti Chiron SS: always keep (manual)
      if (isCrusherCar(carName)) {
        // Gifted cooldown → always sell (we can't crush it right now anyway)
        if (isModelOnGiftedCooldown(carName)) {
          checkbox.checked = true;
          carsToSell++;
          return;
        }
        // No crusher confirmed → sell it, no point hoarding
        if (crusherConfirmedNone) {
          checkbox.checked = true;
          carsToSell++;
          return;
        }
        // Otherwise keep crusher cars (damaged ones are handled by Step 1a;
        // undamaged ones are stockpiled for when they eventually take damage)
        return;
      }
      // Unlisted car — sell it
      checkbox.checked = true;
      carsToSell++;
    });
    if (carsToSell > 0) {
      const sellBtn = document.getElementById('ctl00_main_btnSellSelected');
      if (sellBtn) {
        updateStatus(`Selling ${carsToSell} non-VIP cars...`);
        console.log(`[TMN] Selling ${carsToSell} non-VIP cars`);
        sellBtn.click();
        setTimeout(() => {
          state.isPerformingAction = false;
          state.currentAction = '';
          state.lastGarage = Date.now();
          state.needsRefresh = true;
          GM_setValue('actionStartTime', 0);
          saveState();
          window.location.href = '/authenticated/crimes.aspx?' + Date.now();
        }, randomDelay(DELAYS.normal));
        return;
      }
    }

    // Step 2: Repair damaged VIP cars (one at a time)
    for (const row of carRows) {
      const nameCell = row.children[1];
      const carName = nameCell ? nameCell.textContent.trim() : '';
      const damageCell = row.children[4];
      const damage = damageCell ? parseInt(damageCell.textContent.trim().replace('%', ''), 10) : 0;
      const checkbox = row.querySelector('input[type="checkbox"]');

      if (checkbox && isVIPCar(carName) && damage > 0) {
        // Uncheck EVERY checkbox in the table (including Check All header) first
        const allTableCheckboxes = table.querySelectorAll('input[type="checkbox"]');
        allTableCheckboxes.forEach(cb => { cb.checked = false; });

        checkbox.checked = true;

        // Verify exactly one ticked before clicking — same defence as Step 1a
        const tickedCount = Array.from(table.querySelectorAll('input[type="checkbox"]'))
          .filter(c => c.checked).length;
        if (tickedCount !== 1) {
          console.warn(`[TMN] ⚠️ Repair safety abort — expected 1 ticked checkbox, found ${tickedCount}. Skipping repair this cycle.`);
          updateStatus(`Repair: aborted (${tickedCount} boxes ticked, expected 1)`);
          continue;
        }

        const repairBtn = document.getElementById('ctl00_main_btnRepair');
        if (repairBtn) {
          updateStatus(`Repairing VIP car: ${carName} (${damage}% damage)`);
          console.log(`[TMN] Repairing VIP car: ${carName}`);
          repairBtn.click();

          // Reset state and continue automation
          setTimeout(() => {
            state.isPerformingAction = false;
            state.currentAction = '';
            state.needsRefresh = true;
            GM_setValue('actionStartTime', 0);
            saveState();
            // Navigate back to crimes page to continue automation
            window.location.href = '/authenticated/crimes.aspx?' + Date.now();
          }, randomDelay(DELAYS.normal));
          return;
        }
      }
    }

    // Nothing to do - reset state and continue
    updateStatus("Garage: No actions needed");
    state.isPerformingAction = false;
    state.currentAction = '';
    state.lastGarage = now;
    GM_setValue('actionStartTime', 0);
    saveState();
  }

  // ---------------------------
  // Hot City System
  // ---------------------------
  // The "hot city" is the city with the OC bonus, rotating daily at CET midnight.
  // Scraped from the statistics page, cached in localStorage until next midnight.
  const LS_HOT_CITY = 'tmnOCDTMHotCity';
  const LS_HOT_CITY_UNTIL = 'tmnOCDTMHotCityUntil';
  const LS_HOT_CITY_PENDING = 'tmnHotCityPending';

  function getMidnightCETTimestamp() {
    try {
      const cetNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
      const msUntilMidnight = (24 * 3600 * 1000)
        - (cetNow.getHours() * 3600 + cetNow.getMinutes() * 60 + cetNow.getSeconds()) * 1000
        - cetNow.getMilliseconds();
      return Date.now() + msUntilMidnight;
    } catch {
      return Date.now() + 24 * 3600 * 1000;
    }
  }

  function scrapeHotCityFromDOM(doc) {
    if (!doc) return null;
    try {
      // The statistics page uses mat-inline-symbol spans with #990000 color for each city.
      // The HOT city is identified by the icon text "Swords" (Material icon name) in the
      // #990000 span. The city name is in the next sibling span element.
      // Structure: <span class="mat-inline-symbol" style="...#990000...">Swords</span>
      //            <span>Toronto</span>
      //            followed by text containing ": Hot city, There is less..."
      //
      // Alternative approach: look for any text node containing "Hot city" and work
      // backwards to find the city name. This is more resilient to layout changes.

      // Approach 1: Find "Swords" icon span → next sibling is the city name
      for (const span of doc.querySelectorAll('span.mat-inline-symbol')) {
        const style = span.getAttribute('style') || '';
        if (!/990000/.test(style)) continue;
        const iconText = span.textContent.trim();
        if (iconText === 'Swords') {
          const next = span.nextElementSibling;
          if (next) {
            const city = next.textContent.trim();
            if (city && city.length < 30) {
              console.log(`[TMN][HotCity] Found hot city via Swords icon: "${city}"`);
              return city;
            }
          }
        }
      }

      // Approach 2: Fallback — search for "Hot city" text in any element
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false);
      while (walker.nextNode()) {
        const text = walker.currentNode.textContent;
        if (/hot\s*city/i.test(text)) {
          // Walk up to find a city name — usually in a nearby span
          const parent = walker.currentNode.parentElement;
          if (parent) {
            const prev = parent.previousElementSibling;
            if (prev) {
              const city = prev.textContent.trim();
              if (city && city.length < 30 && !/Swords|local_police/i.test(city)) {
                console.log(`[TMN][HotCity] Found hot city via "Hot city" text: "${city}"`);
                return city;
              }
            }
          }
        }
      }

      console.log('[TMN][HotCity] Could not identify hot city from DOM');
    } catch (e) {
      console.warn('[TMN][HotCity] scrapeHotCityFromDOM error:', e);
    }
    return null;
  }

  function saveHotCity(city) {
    localStorage.setItem(LS_HOT_CITY, city);
    localStorage.setItem(LS_HOT_CITY_UNTIL, String(getMidnightCETTimestamp()));
    console.log(`[TMN][HotCity] Hot city set: "${city}" — cache valid until CET midnight`);
  }

  function getHotCity() {
    const until = parseInt(localStorage.getItem(LS_HOT_CITY_UNTIL) || '0', 10);
    if (until > 0 && Date.now() > until) {
      localStorage.removeItem(LS_HOT_CITY);
      localStorage.removeItem(LS_HOT_CITY_UNTIL);
      return null;
    }
    return localStorage.getItem(LS_HOT_CITY) || null;
  }

  function isInHotCity() {
    const hotCity = getHotCity();
    if (!hotCity) return false; // No cached city → don't allow (need to scrape first)
    try {
      const el = document.getElementById('ctl00_userInfo_lblcity');
      const currentCity = (el ? el.textContent : '').trim();
      return currentCity.toLowerCase().includes(hotCity.toLowerCase()) ||
             hotCity.toLowerCase().includes(currentCity.toLowerCase());
    } catch { return false; }
  }

  function getCurrentCity() {
    try {
      const el = document.getElementById('ctl00_userInfo_lblcity');
      return (el ? el.textContent : '').trim();
    } catch { return ''; }
  }

  // Run on startup: if on the stats page, scrape hot city
  function initHotCity() {
    if (/\/authenticated\/statistics\.aspx/i.test(location.pathname) &&
        !/p=/i.test(location.search)) {
      setTimeout(() => {
        const city = scrapeHotCityFromDOM(document);
        if (city) {
          saveHotCity(city);
          if (localStorage.getItem(LS_HOT_CITY_PENDING) === '1') {
            localStorage.removeItem(LS_HOT_CITY_PENDING);
            console.log('[TMN][HotCity] Hot city captured — returning to crimes page');
            window.location.href = '/authenticated/crimes.aspx?' + Date.now();
          }
        } else {
          console.log('[TMN][HotCity] On stats page but no hot city found');
          localStorage.removeItem(LS_HOT_CITY_PENDING);
        }
      }, 2000);
    }
  }

  function fetchHotCity() {
    if (getHotCity()) return; // Already cached and valid
    console.log('[TMN][HotCity] Navigating to stats page to detect hot city');
    localStorage.setItem(LS_HOT_CITY_PENDING, '1');
    window.location.href = '/authenticated/statistics.aspx?' + Date.now();
  }

  // ---------------------------
  // OC Team Creation (Leader Mode)
  // ---------------------------
  // State machine: idle → setup (steps 0-4) → polling (waiting for commit)
  // Steps: 0=Start OC, 1=Invite Transporter, 2=Invite Weapon Master,
  //        3=Invite Explosive Expert, 4=Buy Laptop, 5=Polling for Commit
  const LS_CREATE_OC_STATE = 'tmnCreateOCState';        // idle | setup | polling
  const LS_CREATE_OC_STEP = 'tmnCreateOCStep';          // 0-5
  const LS_CREATE_OC_NEXT_CHECK = 'tmnCreateOCNextCheckAt'; // ms timestamp
  const LS_CREATE_OC_RETRY_AFTER = 'tmnCreateOCRetryAfter'; // ms timestamp
  const LS_CREATE_OC_POLLING_SINCE = 'tmnCreateOCPollingSince'; // ms timestamp

  function getCreateOCState() {
    return localStorage.getItem(LS_CREATE_OC_STATE) || 'idle';
  }

  function getCreateOCStep() {
    return parseInt(localStorage.getItem(LS_CREATE_OC_STEP) || '0', 10);
  }

  function resetCreateOC() {
    localStorage.setItem(LS_CREATE_OC_STATE, 'idle');
    localStorage.setItem(LS_CREATE_OC_STEP, '0');
    localStorage.removeItem(LS_CREATE_OC_NEXT_CHECK);
    localStorage.removeItem(LS_CREATE_OC_POLLING_SINCE);
  }

  // Parse a scheduled time from an HTML datetime-local input.
  // Format: "YYYY-MM-DDTHH:MM" (native browser format).
  // Returns 0 if empty/invalid (meaning no schedule — trigger on cooldown only).
  function parseScheduledTime(str) {
    if (!str || !str.trim()) return 0;
    const d = new Date(str.trim());
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function isOCScheduleReady() {
    const scheduledMs = parseScheduledTime(state.ocScheduledTime);
    if (scheduledMs === 0) return true; // No schedule set — always ready (trigger on cooldown)
    return Date.now() >= scheduledMs;
  }

  // Called when OC timer shows ready and Create OC is enabled
  function triggerCreateOC() {
    if (!state.createOC) return;

    // Check scheduled time — both schedule AND cooldown must be ready
    if (!isOCScheduleReady()) {
      const scheduledMs = parseScheduledTime(state.ocScheduledTime);
      const minsLeft = Math.ceil((scheduledMs - Date.now()) / 60000);
      console.log(`[TMN][CreateOC] OC cooldown ready but scheduled time not reached — ${minsLeft} min remaining`);
      return;
    }

    // Check retry cooldown
    const retryAfter = parseInt(localStorage.getItem(LS_CREATE_OC_RETRY_AFTER) || '0', 10);
    if (retryAfter && Date.now() < retryAfter) {
      console.log(`[TMN][CreateOC] Retry suppressed — ${Math.ceil((retryAfter - Date.now()) / 1000)}s remaining`);
      return;
    }

    // Ensure we know the hot city
    if (!getHotCity()) {
      console.log('[TMN][CreateOC] Hot city not cached — fetching before proceeding');
      fetchHotCity();
      return;
    }

    // Ensure we're in the hot city
    if (!isInHotCity()) {
      const hotCity = getHotCity() || '?';
      const currentCity = getCurrentCity();
      console.log(`[TMN][CreateOC] Not in hot city — current="${currentCity}" hot="${hotCity}" — skipping`);
      sendTelegramMessage(
        '⚠️ <b>OC Not Started</b>\n\n' +
        `Player: ${state.playerName || 'Unknown'}\n` +
        `Reason: Not in hot city (current: ${currentCity}, hot: ${hotCity})`
      );
      return;
    }

    // Check team is configured
    const t = state.ocTeamTransporter.trim();
    const w = state.ocTeamWeaponMaster.trim();
    const e = state.ocTeamExplosive.trim();
    if (!t || !w || !e) {
      console.log(`[TMN][CreateOC] Team not fully configured — T="${t}" W="${w}" E="${e}"`);
      sendTelegramMessage(
        '⚠️ <b>OC Ready But Team Not Set</b>\n\n' +
        `Player: ${state.playerName || 'Unknown'}\n` +
        'Set team members in Settings → OC Team before creating'
      );
      return;
    }

    console.log('[TMN][CreateOC] OC is ready — initiating setup');
    sendTelegramMessage(
      '🏢 <b>OC Team Setup Starting</b>\n\n' +
      `Leader: ${state.playerName || 'Unknown'}\n` +
      `City: ${getCurrentCity()}\n` +
      `Team: ${t} (T), ${w} (W), ${e} (E)`
    );
    localStorage.setItem(LS_CREATE_OC_STATE, 'setup');
    localStorage.setItem(LS_CREATE_OC_STEP, '0');
    localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now()));

    // Navigate to OC page if not already there
    const onOCPage = /\/authenticated\/organizedcrime\.aspx/i.test(location.pathname) &&
                     !/p=dtm/i.test(location.search);
    if (onOCPage) {
      setTimeout(() => handleCreateOCPage(), 600);
    } else {
      window.location.href = OC_URL + '?' + Date.now();
    }
  }

  // Main OC creation handler — closely based on the proven working flow from
  // the reference script. Uses form.submit() with hidden inputs for ASP.NET
  // postback reliability instead of .click() which can be intercepted by confirm dialogs.
  async function handleCreateOCPage() {
    if (!state.createOC) return false;

    const onOCPage = /\/authenticated\/organizedcrime\.aspx/i.test(location.pathname) &&
                     !/p=dtm/i.test(location.search);
    if (!onOCPage) return false;

    const ocState = getCreateOCState();
    if (ocState === 'idle') return false;

    // Check if it's time to run
    const nextCheck = parseInt(localStorage.getItem(LS_CREATE_OC_NEXT_CHECK) || '0', 10);
    if (nextCheck > Date.now()) return false;

    const step = getCreateOCStep();
    const transporter = state.ocTeamTransporter.trim();
    const weaponMaster = state.ocTeamWeaponMaster.trim();
    const explosiveExpert = state.ocTeamExplosive.trim();
    const username = state.playerName || 'Unknown';

    // Helper: submit a button via form.submit() with a hidden input (reliable ASP.NET postback)
    function formSubmitButton(btn) {
      try {
        const form = btn.form || document.forms[0];
        if (form) {
          const prev = form.querySelector('input[data-tmn-submit]');
          if (prev) prev.remove();
          const hidden = document.createElement('input');
          hidden.type = 'hidden';
          hidden.name = btn.name;
          hidden.value = btn.value || '';
          hidden.setAttribute('data-tmn-submit', '1');
          form.appendChild(hidden);
          form.submit();
          return true;
        }
      } catch (e) {
        console.warn('[TMN][CreateOC] form.submit() failed, falling back to .click():', e);
      }
      btn.click();
      return true;
    }

    try {
      // POLLING STATE: Check if commit button is ready
      if (ocState === 'polling') {
        const commitBtn = document.getElementById('ctl00_main_btnCommitOC');
        if (commitBtn && !commitBtn.disabled) {
          console.log('[TMN][CreateOC] Polling: Commit button ready — submitting!');
          await humanDelay(randomDelay(DELAYS.normal));
          formSubmitButton(commitBtn);
          sendTelegramMessage(
            '✅ <b>OC Committed!</b>\n\n' +
            `Leader: ${username}\n` +
            'Cooldown started'
          );
          resetCreateOC();
          return true;
        }
        // Not ready yet — check back in 60s
        console.log('[TMN][CreateOC] Polling: Commit not ready — rechecking in 60s');
        localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 60000));
        // Navigate away so normal automation can continue
        window.location.href = '/authenticated/crimes.aspx?' + Date.now();
        return true;
      }

      // STEP 0: Click start button based on user's OC type preference
      if (step === 0) {
        const casinoBtn = document.getElementById('ctl00_main_btnStartOCRobCasino');
        const armouryBtn = document.getElementById('ctl00_main_btnStartOCRobArmoury');
        const bankBtn = document.getElementById('ctl00_main_btnStartOCRobBank');

        // Build preference order based on user's selection
        let preferred;
        const pref = (state.ocType || 'Casino').toLowerCase();
        if (pref === 'casino') {
          preferred = [casinoBtn, armouryBtn, bankBtn];
        } else if (pref === 'armoury') {
          preferred = [armouryBtn, casinoBtn, bankBtn];
        } else {
          preferred = [bankBtn, casinoBtn, armouryBtn];
        }

        const startBtn = preferred.find(btn => btn && !btn.disabled) || null;
        if (!startBtn) {
          console.log('[TMN][CreateOC] No enabled start button found — retrying in 5s');
          localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 5000));
          return false;
        }
        const typeName = startBtn.id.includes('Casino') ? 'Casino'
                       : startBtn.id.includes('Armoury') ? 'Armoury' : 'Bank';
        console.log(`[TMN][CreateOC] Step 0: Starting OC — ${typeName}`);
        await humanDelay(randomDelay(DELAYS.normal));
        sendTelegramMessage(
          `🏢 <b>OC Step 1/5</b>\n\nLeader: ${username}\n` +
          `Started OC (${typeName})`
        );
        localStorage.setItem(LS_CREATE_OC_STATE, 'setup');
        localStorage.setItem(LS_CREATE_OC_STEP, '1');
        localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 10000));
        formSubmitButton(startBtn);
        return true;
      }

      // STEP 1: Invite Transporter
      if (step === 1) {
        if (!transporter) { console.log('[TMN][CreateOC] Transporter not set'); resetCreateOC(); return false; }
        const nameInput = document.getElementById('ctl00_main_txtinvitename');
        const roleSelect = document.getElementById('ctl00_main_roleslist');
        const inviteBtn = document.getElementById('ctl00_main_btninvite');
        if (!nameInput || !roleSelect || !inviteBtn) {
          console.log('[TMN][CreateOC] Step 1: Invite form not found — retrying in 5s');
          localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 5000));
          return true;
        }
        console.log('[TMN][CreateOC] Step 1: Clearing field');
        nameInput.value = '';
        await humanDelay(randomDelay(DELAYS.normal));
        console.log('[TMN][CreateOC] Step 1: Enter ' + transporter);
        nameInput.value = transporter;
        await humanDelay(randomDelay(DELAYS.normal));
        console.log('[TMN][CreateOC] Step 1: Select Transporter');
        roleSelect.value = 'Transporter';
        await humanDelay(randomDelay(DELAYS.normal));
        console.log('[TMN][CreateOC] Step 1: Click invite');
        sendTelegramMessage(
          `🏢 <b>OC Step 2/5</b>\n\nLeader: ${username}\n` +
          `Invited ${transporter} as Transporter`
        );
        // Advance step BEFORE click — postback reloads page immediately
        localStorage.setItem(LS_CREATE_OC_STEP, '2');
        localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 10000));
        inviteBtn.click();
        return true;
      }

      // STEP 2: Invite Weapon Master
      if (step === 2) {
        if (!weaponMaster) { console.log('[TMN][CreateOC] Weapon Master not set'); resetCreateOC(); return false; }
        const nameInput = document.getElementById('ctl00_main_txtinvitename');
        const roleSelect = document.getElementById('ctl00_main_roleslist');
        const inviteBtn = document.getElementById('ctl00_main_btninvite');
        if (!nameInput || !roleSelect || !inviteBtn) {
          console.log('[TMN][CreateOC] Step 2: Invite form not found — retrying in 5s');
          localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 5000));
          return true;
        }
        console.log('[TMN][CreateOC] Step 2: Clearing field');
        nameInput.value = '';
        await humanDelay(randomDelay(DELAYS.normal));
        console.log('[TMN][CreateOC] Step 2: Enter ' + weaponMaster);
        nameInput.value = weaponMaster;
        await humanDelay(randomDelay(DELAYS.normal));
        console.log('[TMN][CreateOC] Step 2: Select WeaponMaster');
        roleSelect.value = 'WeaponMaster';
        await humanDelay(randomDelay(DELAYS.normal));
        console.log('[TMN][CreateOC] Step 2: Click invite');
        sendTelegramMessage(
          `🏢 <b>OC Step 3/5</b>\n\nLeader: ${username}\n` +
          `Invited ${weaponMaster} as Weapon Master`
        );
        localStorage.setItem(LS_CREATE_OC_STEP, '3');
        localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 10000));
        inviteBtn.click();
        return true;
      }

      // STEP 3: Invite Explosive Expert
      if (step === 3) {
        if (!explosiveExpert) { console.log('[TMN][CreateOC] Explosive Expert not set'); resetCreateOC(); return false; }
        const nameInput = document.getElementById('ctl00_main_txtinvitename');
        const roleSelect = document.getElementById('ctl00_main_roleslist');
        const inviteBtn = document.getElementById('ctl00_main_btninvite');
        if (!nameInput || !roleSelect || !inviteBtn) {
          console.log('[TMN][CreateOC] Step 3: Invite form not found — retrying in 5s');
          localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 5000));
          return true;
        }
        console.log('[TMN][CreateOC] Step 3: Clearing field');
        nameInput.value = '';
        await humanDelay(randomDelay(DELAYS.normal));
        console.log('[TMN][CreateOC] Step 3: Enter ' + explosiveExpert);
        nameInput.value = explosiveExpert;
        await humanDelay(randomDelay(DELAYS.normal));
        console.log('[TMN][CreateOC] Step 3: Select ExplosiveExpert');
        roleSelect.value = 'ExplosiveExpert';
        await humanDelay(randomDelay(DELAYS.normal));
        console.log('[TMN][CreateOC] Step 3: Click invite');
        sendTelegramMessage(
          `🏢 <b>OC Step 4/5</b>\n\nLeader: ${username}\n` +
          `Invited ${explosiveExpert} as Explosive Expert`
        );
        localStorage.setItem(LS_CREATE_OC_STEP, '4');
        localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 60000));
        inviteBtn.click();
        return true;
      }

      // STEP 4: Buy Laptop (security device)
      if (step === 4) {
        console.log('[TMN][CreateOC] Step 4: Verifying team is still intact...');
        const commanderEl = document.querySelector('#ctl00_main_lblcommanderstatus');
        const transporterEl = document.querySelector('#ctl00_main_lbltransporterstatus');
        const explosiveEl = document.querySelector('#ctl00_main_lblexplosiveexpertstatus');

        const commanderStatus = commanderEl ? commanderEl.textContent.trim().toLowerCase() : '';
        const transporterStatus = transporterEl ? transporterEl.textContent.trim().toLowerCase() : '';
        const explosiveStatus = explosiveEl ? explosiveEl.textContent.trim().toLowerCase() : '';

        console.log(`[TMN][CreateOC] Step 4: Team status — Commander: ${commanderStatus}, Transporter: ${transporterStatus}, Explosive: ${explosiveStatus}`);

        if (commanderStatus.includes('open') || transporterStatus.includes('open') || explosiveStatus.includes('open')) {
          console.log('[TMN][CreateOC] Step 4: Team incomplete — cancelling');
          sendTelegramMessage(
            '⚠️ <b>OC Cancelled</b>\n\n' +
            `Leader: ${username}\n` +
            'Team incomplete — someone left or declined'
          );
          resetCreateOC();
          return false;
        }

        const secSelect = document.getElementById('ctl00_main_securitydeviceslist');
        const buyBtn = document.getElementById('ctl00_main_btnBuySecurity');

        if (!secSelect || !buyBtn) {
          console.log('[TMN][CreateOC] Step 4: Buy form not found — retrying in 5s');
          localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 5000));
          return true;
        }

        console.log('[TMN][CreateOC] Step 4: Select Laptop');
        secSelect.value = '6';
        await humanDelay(randomDelay(DELAYS.normal));

        console.log('[TMN][CreateOC] Step 4: Click Buy');
        sendTelegramMessage(
          `🏢 <b>OC Step 5/5</b>\n\nLeader: ${username}\n` +
          'Bought laptop — waiting for team to commit'
        );
        localStorage.setItem(LS_CREATE_OC_STEP, '5');
        localStorage.setItem(LS_CREATE_OC_STATE, 'polling');
        localStorage.setItem(LS_CREATE_OC_POLLING_SINCE, String(Date.now()));
        localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 60000));
        buyBtn.click();
        return true;
      }

    } catch (e) {
      console.error('[TMN][CreateOC] Error:', e);
      resetCreateOC();
      return false;
    }
    return false;
  }

  // Helper for humanDelay used in OC creation
  function humanDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, typeof ms === 'number' ? ms : 1000));
  }

  // ---------------------------
  // UI: create Shadow DOM + dark themed Bootstrap-based UI (scoped)
  // ---------------------------
  function createScopedUI() {
    if (document.getElementById('tmn-automation-host')) return;

    const host = document.createElement('div');
    host.id = 'tmn-automation-host';
    document.body.appendChild(host);

    shadowRoot = host.attachShadow({ mode: 'open' });

    const linkBootstrap = document.createElement('link');
    linkBootstrap.rel = 'stylesheet';
    linkBootstrap.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
    linkBootstrap.onload = () => {
      // Show UI only after Bootstrap CSS is loaded (prevents FOUC)
      host.classList.add('tmn-ready');
    };
    shadowRoot.appendChild(linkBootstrap);

    const linkIcons = document.createElement('link');
    linkIcons.rel = 'stylesheet';
    linkIcons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css';
    shadowRoot.appendChild(linkIcons);

    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .card { font-family: Arial, Helvetica, sans-serif; width: 20rem; }
      .card, .modal-content { background-color: #111827 !important; color: #e5e7eb !important; border: 1px solid #2d3748; }
      .card-header { background: linear-gradient(180deg, #0b1220, #0f1724); border-bottom: 1px solid #1f2937; }
      .btn-outline-secondary { color: #cbd5e1; border-color: #334155; background: transparent; }
      .btn-outline-secondary:hover { background: rgba(255,255,255,0.03); }
      .form-check-input { background-color: #0b1220; border: 1px solid #475569; }
      .form-control { background-color: #0b1220; color: #e5e7eb; border-color: #334155; }
      .form-check-label { color: #e2e8f0; }
      .tmn-compact-input { width: 5.5rem; display: inline-block; margin-left: 8px; }
      .card-footer { background: transparent; border-top: 1px solid #1f2937; color: #9ca3af; min-height: 130px; height: 130px; overflow: hidden; }
      .card-body { min-height: 200px; }
      .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 2147483646; }
      .modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 2147483647; display: none; }
      .modal.show { display: block; }
      .modal-dialog { max-width: 36rem; }
      .form-check.form-switch .form-check-input:checked {
        background-color: #10b981; border-color: #10b981;
      }
      :host(*) { all: unset; }
      .bi-gear::before { content: "⚙" !important; }
      .bi-x::before { content: "×" !important; }
      /* Prevent layout shift on timer updates */
      #tmn-health-monitor, #tmn-travel-timer, #tmn-oc-timer, #tmn-dtm-timer {
        min-width: 70px;
        display: inline-block;
      }
    `;
    shadowRoot.appendChild(style);

    const wrapper = document.createElement('div');
    wrapper.id = 'tmn-wrapper';
    wrapper.innerHTML = `
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center" id="tmn-drag-handle" style="cursor: grab;">
          <strong>TMN TDS Auto v17.04</strong>
          <div>
            <button id="tmn-lock-btn" class="btn btn-sm btn-outline-secondary me-1" title="Lock/Unlock position">ð</button>
            <button id="tmn-settings-btn" class="btn btn-sm btn-outline-secondary me-1" title="Settings">
              <i class="bi bi-gear"></i>
            </button>
            <button id="tmn-minimize-btn" class="btn btn-sm btn-outline-secondary" title="Minimize">-</button>
          </div>
        </div>

        <div class="card-body" id="tmn-panel-body">
          <div class="mb-2" style="display:grid; grid-template-columns: 1fr 1fr; gap: 4px 8px;">
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-crime">
                <label class="form-check-label" for="tmn-auto-crime">Auto Crime</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-all">
                <label class="form-check-label" for="tmn-auto-all" id="tmn-auto-all-label" style="font-weight: 600;">ALL ON</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-gta">
                <label class="form-check-label" for="tmn-auto-gta">Auto GTA</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-health">
                <label class="form-check-label" for="tmn-auto-health">Auto Health</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-booze">
                <label class="form-check-label" for="tmn-auto-booze">Auto Booze</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-dtm">
                <label class="form-check-label" for="tmn-auto-dtm">🚚 Auto DTM</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-jail">
                <label class="form-check-label" for="tmn-auto-jail">Auto Jail</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-oc">
                <label class="form-check-label" for="tmn-auto-oc">🕵️ Auto OC</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-create-oc">
                <label class="form-check-label" for="tmn-create-oc" id="tmn-create-oc-label" style="cursor:pointer; text-decoration:underline; color:#60a5fa;">🏢 Create OC</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-garage">
                <label class="form-check-label" for="tmn-auto-garage">Auto Garage</label>
              </div>
              <div class="form-check form-switch" style="grid-column: 2;">
                <input class="form-check-input" type="checkbox" id="tmn-notify-ocdtm-ready">
                <label class="form-check-label" for="tmn-notify-ocdtm-ready">🔔 OC/DTM Alerts</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-crusher">
                <label class="form-check-label" for="tmn-auto-crusher">Auto Crusher</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-whitelist-enabled">
                <label class="form-check-label" for="tmn-whitelist-enabled" id="tmn-whitelist-label" style="cursor:pointer; text-decoration:underline; color:#60a5fa;">Whitelist</label>
              </div>
          </div>
          <div id="tmn-player-badge" style="font-size:0.85rem;color:#9ca3af;">Player: ${state.playerName || 'Unknown'}</div>

          <!-- Status Grid: Health/Travel, OC/DTM, Protection -->
          <div class="mt-2 pt-2" style="border-top: 1px solid #1f2937; font-size: 0.85rem;">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <div class="d-flex align-items-center" style="width: 50%;">
                <span style="color:#9ca3af; width: 55px;">Health:</span>
                <span id="tmn-health-monitor" style="font-weight: 500;">${cachedDisplayValues.health || '<span style="color:#9ca3af;">●</span> --'}</span>
              </div>
              <div class="d-flex align-items-center" style="width: 50%;">
                <span style="color:#9ca3af; width: 55px;">Travel:</span>
                <span id="tmn-travel-timer" style="font-weight: 500;">${cachedDisplayValues.travel || '<span style="color:#9ca3af;">●</span> --'}</span>
              </div>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-2">
              <div class="d-flex align-items-center" style="width: 50%;">
                <span style="color:#9ca3af; width: 55px;">OC:</span>
                <span id="tmn-oc-timer" style="font-weight: 500;">${cachedDisplayValues.oc || '<span style="color:#9ca3af;">●</span> --'}</span>
              </div>
              <div class="d-flex align-items-center" style="width: 50%;">
                <span style="color:#9ca3af; width: 55px;">DTM:</span>
                <span id="tmn-dtm-timer" style="font-weight: 500;">${cachedDisplayValues.dtm || '<span style="color:#9ca3af;">●</span> --'}</span>
              </div>
            </div>
            <div class="d-flex align-items-center">
              <span style="color:#9ca3af; width: 55px;">Prot:</span>
              <span id="tmn-protection-timer" style="font-weight: 500;">${cachedDisplayValues.protection || '<span style="color:#9ca3af;">●</span> --'}</span>
            </div>
          </div>
        </div>

        <div class="card-footer small text-muted" id="tmn-status" style="min-height: 130px; height: 130px; overflow: hidden;">Status: Ready<br>&nbsp;<br>&nbsp;<br>&nbsp;<br>&nbsp;<br>&nbsp;</div>
      </div>

      <div id="tmn-settings-modal" class="modal" role="dialog" aria-hidden="true">
        <div class="modal-dialog modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Automation Settings</h5>
              <button id="tmn-modal-close" type="button" class="btn btn-sm btn-outline-secondary" title="Close"><i class="bi bi-x"></i></button>
            </div>
            <div class="modal-body">
              <h6 style="color:#cbd5e1;">Login Settings</h6>
              <div class="mb-3">
              <label class="form-label small">Username:</label>
              <input type="text" id="tmn-login-username" class="form-control form-control-sm mb-2"
              placeholder="Your TMN username" value="${LOGIN_CONFIG.USERNAME}">

              <label class="form-label small">Password:</label>
              <input type="text" id="tmn-login-password" class="form-control form-control-sm mb-2"
              placeholder="Your TMN password" value="${LOGIN_CONFIG.PASSWORD}">

  <div class="form-check form-switch">
    <input class="form-check-input" type="checkbox" id="tmn-auto-submit-enabled">
    <label class="form-check-label" for="tmn-auto-submit-enabled">Auto-submit after captcha</label>
  </div>
</div>

<hr style="border-color:#1f2937">
              <h6 style="color:#cbd5e1;">Crime Options</h6>
              <div id="tmn-crime-options"></div>
              <div class="mb-3 mt-2">
                <label class="form-label">Interval (sec):
                  <input type="number" id="tmn-crime-interval" class="form-control form-control-sm tmn-compact-input" value="${config.crimeInterval}" min="1" max="999">
                </label>
              </div>

              <hr style="border-color:#1f2937">

              <h6 style="color:#cbd5e1;">GTA Options</h6>
              <div id="tmn-gta-options"></div>
              <div class="mb-3 mt-2">
                <label class="form-label">Interval (sec):
                  <input type="number" id="tmn-gta-interval" class="form-control form-control-sm tmn-compact-input" value="${config.gtaInterval}" min="1" max="999">
                </label>
              </div>

              <hr style="border-color:#1f2937">

              <h6 style="color:#cbd5e1;">Booze Options</h6>
              <div class="mb-3">
                <label class="form-label">Interval (sec):
                  <input type="number" id="tmn-booze-interval" class="form-control form-control-sm tmn-compact-input" value="${config.boozeInterval}" min="1" max="999">
                </label>
              </div>
              <div class="mb-3">
                <label class="form-label">Buy Amount:
                  <input type="number" id="tmn-booze-buy-amount" class="form-control form-control-sm tmn-compact-input" value="${config.boozeBuyAmount}" min="1" max="300">
                </label>
              </div>
              <div class="mb-3">
                <label class="form-label">Sell Amount:
                  <input type="number" id="tmn-booze-sell-amount" class="form-control form-control-sm tmn-compact-input" value="${config.boozeSellAmount}" min="1" max="300">
                </label>
              </div>

              <hr style="border-color:#1f2937">

              <h6 style="color:#cbd5e1;">Jailbreak Options</h6>
              <div class="mb-3">
                <label class="form-label">Interval (sec):
                  <input type="number" id="tmn-jail-interval" class="form-control form-control-sm tmn-compact-input" value="${config.jailbreakInterval}" min="1" max="999">
                </label>
              </div>

              <hr style="border-color:#1f2937">

              <h6 style="color:#cbd5e1;">Health Options</h6>
              <div class="mb-3">
                <small class="text-muted d-block mb-2">Automatically buy health when below threshold (uses credits)</small>
                <div class="d-flex justify-content-between mb-2">
                  <div style="width: 48%;">
                    <label class="form-label small">Min Health Threshold (%):</label>
                    <input type="number" id="tmn-min-health" class="form-control form-control-sm" value="${config.minHealthThreshold}" min="1" max="99">
                    <small class="text-muted">Stop scripts & alert when below</small>
                  </div>
                  <div style="width: 48%;">
                    <label class="form-label small">Target Health (%):</label>
                    <input type="number" id="tmn-target-health" class="form-control form-control-sm" value="${config.targetHealth}" min="10" max="100">
                    <small class="text-muted">Buy health until reaching this</small>
                  </div>
                </div>
                <div class="d-flex align-items-center mb-2 p-2" style="background: rgba(0,0,0,0.2); border-radius: 4px;">
                  <span style="color:#9ca3af;">Current Health:</span>
                  <span id="tmn-settings-current-health" class="ms-2" style="font-weight: 500;"><span style="color:#10b981;">●</span> 100%</span>
                </div>
                <div class="mb-2 p-2" style="background: rgba(255,193,7,0.1); border: 1px solid rgba(255,193,7,0.3); border-radius: 4px;">
                  <small style="color: #ffc107;">⚠ When health drops below threshold:</small>
                  <ul class="mb-0 ps-3" style="font-size: 0.75rem; color: #9ca3af;">
                    <li>Telegram alert every 10 seconds (with health %)</li>
                    <li>If auto-buy disabled: ALL scripts will stop</li>
                    <li>If auto-buy enabled: Will use credits to restore health</li>
                  </ul>
                </div>
                <button id="tmn-test-health-alert" class="btn btn-sm btn-outline-warning">Test Health Alert</button>
              </div>

              <hr style="border-color:#1f2937">

              <h6 style="color:#cbd5e1;">Garage Options</h6>
              <div class="mb-3">
                <small class="text-muted d-block mb-2">Auto garage: OC cars kept & repaired, crusher cars sent to crusher, all others sold</small>
                <label class="form-label">Interval (min):
                  <input type="number" id="tmn-garage-interval" class="form-control form-control-sm tmn-compact-input" value="${Math.round(config.garageInterval / 60)}" min="1" max="120">
                </label>

                <div class="mt-3">
                  <small class="text-muted d-block mb-2">Per-car category overrides — choose what happens to each car when Auto Garage runs:</small>
                  <div style="background: rgba(0,0,0,0.2); border-radius: 4px; padding: 8px;">
                    <div style="display: grid; grid-template-columns: 1fr auto auto auto; gap: 6px 12px; align-items: center; font-size: 0.8rem;">
                      <div style="color:#9ca3af; font-weight: 600;">Car</div>
                      <div style="color:#10b981; font-weight: 600; text-align: center;" title="Keep & repair (use for OC)">OC</div>
                      <div style="color:#f59e0b; font-weight: 600; text-align: center;" title="Send to crusher">Crush</div>
                      <div style="color:#ef4444; font-weight: 600; text-align: center;" title="Sell immediately">Sell</div>
                      ${KNOWN_CARS.map(car => {
                        const safeId = car.name.replace(/[^A-Za-z0-9]/g, '');
                        if (car.manual) {
                          // Manual-only cars get a single full-width "Manual only" label spanning all 3 radio columns
                          return `
                            <div style="color:#9ca3af; font-style: italic;" title="Never auto-processed — handle manually in-game">${car.name} 🔧</div>
                            <div style="grid-column: 2 / span 3; text-align: center; color:#6b7280; font-style: italic; font-size: 0.75rem;">Manual only</div>
                          `;
                        }
                        const cat = car.locked ? car.defaultCategory : ((state.carCategories && state.carCategories[car.name]) || car.defaultCategory);
                        const disabled = car.locked ? 'disabled' : '';
                        const lockIcon = car.locked ? ' 🔒' : '';
                        const nameStyle = car.locked ? 'color:#9ca3af; font-style: italic;' : 'color:#cbd5e1;';
                        const lockTitle = car.locked ? ' title="Locked — main OC car"' : '';
                        return `
                          <div style="${nameStyle}"${lockTitle}>${car.name}${lockIcon}</div>
                          <div style="text-align: center;"><input type="radio" name="tmn-carcat-${safeId}" data-car="${car.name}" value="OC" ${cat === 'OC' ? 'checked' : ''} ${disabled}></div>
                          <div style="text-align: center;"><input type="radio" name="tmn-carcat-${safeId}" data-car="${car.name}" value="Crush" ${cat === 'Crush' ? 'checked' : ''} ${disabled}></div>
                          <div style="text-align: center;"><input type="radio" name="tmn-carcat-${safeId}" data-car="${car.name}" value="Sell" ${cat === 'Sell' ? 'checked' : ''} ${disabled}></div>
                        `;
                      }).join('')}
                    </div>
                    <button type="button" id="tmn-carcat-reset" class="btn btn-sm btn-outline-secondary mt-2" style="font-size: 0.75rem;">Reset to defaults</button>
                  </div>
                </div>

                <div class="mt-3">
                  <small class="text-muted d-block mb-2">Crusher ownership: <span id="tmn-crusher-status" style="font-weight: 600;">${state.crusherOwned === false ? '<span style="color:#ef4444;">Not owned</span>' : state.crusherOwned === true ? '<span style="color:#10b981;">Owned</span>' : '<span style="color:#9ca3af;">Unknown</span>'}</span></small>
                  <button type="button" id="tmn-crusher-reset" class="btn btn-sm btn-outline-warning" style="font-size: 0.75rem;">Reset crusher status</button>
                  <small class="text-muted d-block mt-1">Use this after buying a crusher so Auto Crusher can be re-enabled.</small>
                </div>
              </div>

              <hr style="border-color:#1f2937">
              <h6 style="color:#cbd5e1;">Telegram Notifications</h6>
              <div class="mb-3">
                <div class="form-check form-switch mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-telegram-enabled">
                  <label class="form-check-label" for="tmn-telegram-enabled">Enable Telegram</label>
                </div>

                <label class="form-label small">Bot Token:</label>
                <input type="text" id="tmn-telegram-token" class="form-control form-control-sm mb-2"
                       placeholder="Get from @BotFather">

                <label class="form-label small">Chat ID:</label>
                <input type="text" id="tmn-telegram-chat" class="form-control form-control-sm mb-2"
                       placeholder="Get from @userinfobot">

                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-notify-captcha">
                  <label class="form-check-label" for="tmn-notify-captcha">Notify on Script Check</label>
                </div>

                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-notify-messages">
                  <label class="form-check-label" for="tmn-notify-messages">Notify on New Messages</label>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-notify-sql">
                  <label class="form-check-label" for="tmn-notify-sql">Notify on SQL Script Check</label>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-notify-logout">
                  <label class="form-check-label" for="tmn-notify-logout">Notify on Logout/Timeout</label>
                </div>

                <button id="tmn-test-telegram" class="btn btn-sm btn-outline-success">Test Connection</button>
              </div>

              <hr style="border-color:#1f2937">
              <div class="mb-3">
                <button id="tmn-view-stats" class="btn btn-sm btn-outline-info">View Detailed Stats</button>
              </div>

              <hr style="border-color:#1f2937">
              <h6 style="color:#cbd5e1;">Logout/Session Alerts</h6>
              <div class="mb-3">
                <small class="text-muted d-block mb-2">Alert methods when logged out (works even in background tabs)</small>
                <div class="form-check form-switch mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-logout-tab-flash">
                  <label class="form-check-label" for="tmn-logout-tab-flash">Tab Title Flash</label>
                </div>
                <small class="text-muted d-block mb-2">Flashes "🔴 LOGIN NEEDED" in browser tab title</small>
                <div class="form-check form-switch mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-logout-browser-notify">
                  <label class="form-check-label" for="tmn-logout-browser-notify">Browser Notification</label>
                </div>
                <small class="text-muted d-block mb-2">Desktop notification popup (requires permission)</small>
                <button id="tmn-test-logout-alert" class="btn btn-sm btn-outline-info">Test Logout Alert</button>
              </div>

              <hr style="border-color:#1f2937">
              <h6 style="color:#cbd5e1;">Advanced Features</h6>
              <div class="mb-3">
                <div class="form-check form-switch mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-auto-resume-enabled">
                  <label class="form-check-label" for="tmn-auto-resume-enabled">Auto-Resume after Script Check</label>
                </div>
                <small class="text-muted d-block mb-2">Automatically submit captcha and resume automation after script check</small>

                <div class="form-check form-switch mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-stats-collection-enabled">
                  <label class="form-check-label" for="tmn-stats-collection-enabled">Stats Collection</label>
                </div>
                <small class="text-muted d-block mb-2">Periodically collect game statistics from the stats page</small>

                <label class="form-label">Stats Collection Interval (sec):
                  <input type="number" id="tmn-stats-interval" class="form-control form-control-sm tmn-compact-input" value="${statsCollectionConfig.interval}" min="10" max="7200">
                </label>
              </div>

              <hr style="border-color:#1f2937">
              <h6 style="color:#cbd5e1;">Health & Timers</h6>
              <div class="mb-3">
                <small class="text-muted d-block mb-2">Health monitor and activity timers</small>
                <div class="d-flex align-items-center mb-2">
                  <span style="color:#9ca3af; width: 60px;">Health:</span>
                  <span id="tmn-settings-health" style="font-weight: 500;">Loading...</span>
                </div>
                <div class="d-flex align-items-center mb-2">
                  <span style="color:#9ca3af; width: 60px;">OC:</span>
                  <span id="tmn-settings-oc-timer" style="font-weight: 500;">Loading...</span>
                </div>
                <div class="d-flex align-items-center mb-2">
                  <span style="color:#9ca3af; width: 60px;">DTM:</span>
                  <span id="tmn-settings-dtm-timer" style="font-weight: 500;">Loading...</span>
                </div>
                <div class="d-flex align-items-center mb-2">
                  <span style="color:#9ca3af; width: 60px;">Travel:</span>
                  <span id="tmn-settings-travel-timer" style="font-weight: 500;">Loading...</span>
                </div>
                <button id="tmn-refresh-timers" class="btn btn-sm btn-outline-info">Refresh Timers</button>
              </div>

              <hr style="border-color:#1f2937">
              <h6 style="color:#cbd5e1;">Tab Management</h6>
              <div class="mb-3">
                <small class="text-muted d-block mb-2">Tab Manager prevents multiple tabs from running automation simultaneously</small>
                <div id="tmn-tab-status" class="small text-info">Status: Checking...</div>
              </div>

              <hr style="border-color:#1f2937">

              <div class="d-grid">
                <button id="tmn-clear-player" class="btn btn-sm btn-outline-danger me-2">Clear Player Data</button>
                <button id="tmn-reset-btn" class="btn btn-danger">Reset All Settings & Data</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="tmn-modal-backdrop" class="modal-backdrop" style="display:none;"></div>

      <div id="tmn-whitelist-modal" class="modal" role="dialog" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content" style="width: 280px;">
            <div class="modal-header" style="padding: 8px 12px;">
              <h6 class="modal-title" style="margin:0;">OC/DTM Whitelist</h6>
              <button id="tmn-whitelist-close" type="button" class="btn btn-sm btn-outline-secondary" title="Close"><i class="bi bi-x"></i></button>
            </div>
            <div class="modal-body" style="padding: 10px 12px;">
              <small class="text-muted d-block mb-2">Only accept OC/DTM invites from these players. Leave empty to accept from anyone.</small>
              <div id="tmn-whitelist-entries"></div>
              <button id="tmn-whitelist-add" class="btn btn-sm btn-outline-success mt-2" style="width:100%;">+ Add Player</button>
              <button id="tmn-clear-cooldowns" class="btn btn-sm btn-outline-warning mt-2" style="width:100%;">Clear OC/DTM Cooldowns</button>
            </div>
          </div>
        </div>
      </div>

      <div id="tmn-oc-leader-modal" class="modal" role="dialog" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content" style="width: 320px;">
            <div class="modal-header" style="padding: 8px 12px;">
              <h6 class="modal-title" style="margin:0;">🏢 OC Team (Leader)</h6>
              <button id="tmn-oc-leader-close" type="button" class="btn btn-sm btn-outline-secondary" title="Close"><i class="bi bi-x"></i></button>
            </div>
            <div class="modal-body" style="padding: 10px 12px;">
              <small class="text-muted d-block mb-2">Team members for auto OC creation. You are the Leader.</small>

              <div style="margin-bottom: 8px;">
                <label style="color:#9ca3af; font-size: 0.85rem;">OC Type:</label>
                <select id="tmn-oc-type" style="background:#0b1220; color:#e5e7eb; border:1px solid #334155; border-radius:4px; padding:3px 6px; font-size:0.85rem; margin-left: 6px;">
                  <option value="Casino" ${state.ocType === 'Casino' ? 'selected' : ''}>Casino (best XP)</option>
                  <option value="Armoury" ${state.ocType === 'Armoury' ? 'selected' : ''}>Armoury (best bullets)</option>
                  <option value="Bank" ${state.ocType === 'Bank' ? 'selected' : ''}>Bank</option>
                </select>
              </div>

              <div style="display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; align-items: center; font-size: 0.85rem;">
                <label style="color:#9ca3af;">Transporter:</label>
                <input type="text" id="tmn-oc-team-transporter" style="background:#0b1220; color:#e5e7eb; border:1px solid #334155; border-radius:4px; padding:3px 6px; font-size:0.85rem;" value="${state.ocTeamTransporter}" placeholder="Username">
                <label style="color:#9ca3af;">Weapon Master:</label>
                <input type="text" id="tmn-oc-team-weapon" style="background:#0b1220; color:#e5e7eb; border:1px solid #334155; border-radius:4px; padding:3px 6px; font-size:0.85rem;" value="${state.ocTeamWeaponMaster}" placeholder="Username">
                <label style="color:#9ca3af;">Explosive Expert:</label>
                <input type="text" id="tmn-oc-team-explosive" style="background:#0b1220; color:#e5e7eb; border:1px solid #334155; border-radius:4px; padding:3px 6px; font-size:0.85rem;" value="${state.ocTeamExplosive}" placeholder="Username">
              </div>

              <div class="mt-3" style="border-top: 1px solid #1f2937; padding-top: 8px;">
                <small class="text-muted d-block mb-1">Schedule OC creation:</small>
                <input type="datetime-local" id="tmn-oc-schedule-time" style="background:#0b1220; color:#e5e7eb; border:1px solid #334155; border-radius:4px; padding:3px 6px; font-size:0.85rem; width:100%; color-scheme: dark;" value="${state.ocScheduledTime || ''}">
                <small class="text-muted d-block mt-1">OC will trigger when this time arrives AND cooldown is expired. Leave blank to trigger on cooldown only.</small>
              </div>

              <div class="mt-3" style="border-top: 1px solid #1f2937; padding-top: 8px; font-size: 0.8rem;">
                <div class="mb-1">
                  <span style="color:#9ca3af;">Hot City:</span>
                  <span id="tmn-hot-city-display" style="color:#f59e0b; font-weight: 600;">${getHotCity() || 'Unknown'}</span>
                  <button type="button" id="tmn-refresh-hot-city" class="btn btn-sm btn-outline-secondary ms-2" style="font-size: 0.65rem; padding: 1px 6px;">Refresh</button>
                </div>
                <div class="mb-1">
                  <span style="color:#9ca3af;">OC State:</span>
                  <span id="tmn-oc-create-status" style="color:#cbd5e1;">${getCreateOCState()} (step ${getCreateOCStep()})</span>
                </div>
                <button type="button" id="tmn-reset-create-oc" class="btn btn-sm btn-outline-danger mt-1" style="font-size: 0.7rem; width:100%;">Reset OC Creation</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    shadowRoot.appendChild(wrapper);

    // Fill crime & gta option lists
    const crimeContainer = shadowRoot.querySelector('#tmn-crime-options');
    crimeContainer.innerHTML = crimeOptions.map(c => `
      <div class="form-check">
        <input class="form-check-input crime-option" type="checkbox" id="crime-${c.id}" value="${c.id}">
        <label class="form-check-label" for="crime-${c.id}">${c.name}</label>
      </div>
    `).join('');

    const gtaContainer = shadowRoot.querySelector('#tmn-gta-options');
    gtaContainer.innerHTML = gtaOptions.map(g => `
      <div class="form-check">
        <input class="form-check-input gta-option" type="checkbox" id="gta-${g.id}" value="${g.id}">
        <label class="form-check-label" for="gta-${g.id}">${g.name}</label>
      </div>
    `).join('');

    // Initialize states in UI
    shadowRoot.querySelector("#tmn-auto-crime").checked = state.autoCrime;
    shadowRoot.querySelector("#tmn-auto-gta").checked = state.autoGTA;
    shadowRoot.querySelector("#tmn-auto-booze").checked = state.autoBooze;
    shadowRoot.querySelector("#tmn-auto-jail").checked = state.autoJail;
    shadowRoot.querySelector("#tmn-auto-health").checked = state.autoHealth;
    shadowRoot.querySelector("#tmn-auto-garage").checked = state.autoGarage;
    shadowRoot.querySelector("#tmn-auto-crusher").checked = state.autoCrusher;
    // Grey out the Auto Crusher toggle if we've confirmed there's no crusher.
    // The user must use "Reset crusher status" in settings (e.g. after buying one).
    if (state.crusherOwned === false) {
      const crusherCb = shadowRoot.querySelector("#tmn-auto-crusher");
      crusherCb.checked = false;
      crusherCb.disabled = true;
      const crusherLabel = shadowRoot.querySelector('label[for="tmn-auto-crusher"]');
      if (crusherLabel) {
        crusherLabel.style.color = '#6b7280';
        crusherLabel.title = 'Crusher not owned — use "Reset crusher status" in settings if you buy one';
      }
    }
    shadowRoot.querySelector("#tmn-auto-oc").checked = state.autoOC;
    shadowRoot.querySelector("#tmn-create-oc").checked = state.createOC;
    shadowRoot.querySelector("#tmn-auto-dtm").checked = state.autoDTM;
    shadowRoot.querySelector("#tmn-notify-ocdtm-ready").checked = state.notifyOCDTMReady;

    // Initialize ALL ON/OFF toggle
    const allToggle = shadowRoot.querySelector("#tmn-auto-all");
    const allLabel = shadowRoot.querySelector("#tmn-auto-all-label");
    allToggle.checked = state.autoCrime && state.autoGTA && state.autoBooze && state.autoJail && state.autoHealth && state.autoGarage;
    allLabel.textContent = allToggle.checked ? 'ALL ON' : 'ALL OFF';
    allLabel.style.color = allToggle.checked ? '#10b981' : '#ef4444';

    shadowRoot.querySelectorAll('.crime-option').forEach(cb => {
      cb.checked = state.selectedCrimes.includes(parseInt(cb.value));
    });
    shadowRoot.querySelectorAll('.gta-option').forEach(cb => {
      cb.checked = state.selectedGTAs.includes(parseInt(cb.value));
    });

    // Hook up event listeners
    shadowRoot.querySelector("#tmn-auto-crime").addEventListener('change', e => {
      state.autoCrime = e.target.checked;
      saveState();
      updateStatus('Auto Crime ' + (state.autoCrime ? 'Enabled' : 'Disabled'));
      updateAllToggleState();

      if (state.autoCrime || state.autoGTA || state.autoBooze || state.autoJail) {
      }
    });
    shadowRoot.querySelector("#tmn-auto-gta").addEventListener('change', e => {
      state.autoGTA = e.target.checked;
      saveState();
      updateStatus('Auto GTA ' + (state.autoGTA ? 'Enabled' : 'Disabled'));
      updateAllToggleState();

      if (state.autoCrime || state.autoGTA || state.autoBooze || state.autoJail) {
      }
    });
    shadowRoot.querySelector("#tmn-auto-booze").addEventListener('change', e => {
      state.autoBooze = e.target.checked;
      saveState();
      updateStatus('Auto Booze ' + (state.autoBooze ? 'Enabled' : 'Disabled'));
      updateAllToggleState();

      if (state.autoCrime || state.autoGTA || state.autoBooze || state.autoJail) {
      }
    });
    shadowRoot.querySelector("#tmn-auto-jail").addEventListener('change', e => {
      state.autoJail = e.target.checked;
      saveState();
      updateStatus('Auto Jail ' + (state.autoJail ? 'Enabled' : 'Disabled'));
      updateAllToggleState();

      if (state.autoCrime || state.autoGTA || state.autoBooze || state.autoJail) {
      }
    });
    shadowRoot.querySelector("#tmn-auto-health").addEventListener('change', e => {
      state.autoHealth = e.target.checked;
      saveState();
      updateStatus('Auto Health ' + (state.autoHealth ? 'Enabled' : 'Disabled'));
    });
    shadowRoot.querySelector("#tmn-auto-garage").addEventListener('change', e => {
      state.autoGarage = e.target.checked;
      saveState();
      updateStatus('Auto Garage ' + (state.autoGarage ? 'Enabled' : 'Disabled'));
    });
    shadowRoot.querySelector("#tmn-auto-crusher").addEventListener('change', e => {
      // Defence in depth: reject re-enable if we've confirmed no crusher
      if (e.target.checked && state.crusherOwned === false) {
        e.target.checked = false;
        updateStatus('Crusher not owned — use "Reset crusher status" first');
        return;
      }
      state.autoCrusher = e.target.checked;
      saveState();
      updateStatus('Auto Crusher ' + (state.autoCrusher ? 'Enabled' : 'Disabled'));
    });

    // Per-car category radio buttons
    shadowRoot.querySelectorAll('input[type="radio"][name^="tmn-carcat-"]').forEach(radio => {
      radio.addEventListener('change', e => {
        if (!e.target.checked) return;
        const carName = e.target.getAttribute('data-car');
        const category = e.target.value;
        if (!carName || !category) return;
        // Reject any change to a locked car
        const known = KNOWN_CARS.find(c => c.name === carName);
        if (known && known.locked) {
          e.target.checked = false;
          // Re-check the locked default
          const defRadio = shadowRoot.querySelector(`input[type="radio"][name="${e.target.name}"][value="${known.defaultCategory}"]`);
          if (defRadio) defRadio.checked = true;
          return;
        }
        if (!state.carCategories) state.carCategories = {};
        state.carCategories[carName] = category;
        saveState();
        updateStatus(`${carName} → ${category}`);
      });
    });

    // Reset car categories to defaults
    const carResetBtn = shadowRoot.querySelector('#tmn-carcat-reset');
    if (carResetBtn) {
      carResetBtn.addEventListener('click', () => {
        state.carCategories = {};
        saveState();
        // Re-check the default radio for each known car (skips locked — they already show default)
        KNOWN_CARS.forEach(car => {
          const safeId = car.name.replace(/[^A-Za-z0-9]/g, '');
          const radios = shadowRoot.querySelectorAll(`input[type="radio"][name="tmn-carcat-${safeId}"]`);
          radios.forEach(r => { r.checked = (r.value === car.defaultCategory); });
        });
        updateStatus('Car categories reset to defaults');
      });
    }

    // Reset crusher ownership status — clears the "no crusher" lockout so the script
    // will re-detect on the next garage cycle. Use after buying a crusher.
    const crusherResetBtn = shadowRoot.querySelector('#tmn-crusher-reset');
    if (crusherResetBtn) {
      crusherResetBtn.addEventListener('click', () => {
        state.crusherOwned = null;
        saveState();
        localStorage.removeItem(LS_CRUSHER_LOOP_COUNT);
        // Re-enable the Auto Crusher checkbox
        const cb = shadowRoot.querySelector('#tmn-auto-crusher');
        if (cb) {
          cb.disabled = false;
          const lbl = shadowRoot.querySelector('label[for="tmn-auto-crusher"]');
          if (lbl) {
            lbl.style.color = '';
            lbl.title = '';
          }
        }
        // Update the status display
        const statusEl = shadowRoot.querySelector('#tmn-crusher-status');
        if (statusEl) statusEl.innerHTML = '<span style="color:#9ca3af;">Unknown</span>';
        updateStatus('Crusher status reset — will re-detect on next garage visit');
      });
    }
    shadowRoot.querySelector("#tmn-auto-oc").addEventListener('change', e => {
      state.autoOC = e.target.checked;
      saveState();
      updateStatus('🕵️ Auto OC ' + (state.autoOC ? 'Enabled' : 'Disabled'));
      if (state.autoOC) {
        startAutoOCMailWatcher();
      } else {
        stopAutoOCMailWatcher();
      }
    });
    shadowRoot.querySelector("#tmn-auto-dtm").addEventListener('change', e => {
      state.autoDTM = e.target.checked;
      saveState();
      updateStatus('🚚 Auto DTM ' + (state.autoDTM ? 'Enabled' : 'Disabled'));
      if (state.autoDTM) {
        startAutoDTMMailWatcher();
      } else {
        stopAutoDTMMailWatcher();
      }
    });

    // Create OC toggle
    shadowRoot.querySelector("#tmn-create-oc").addEventListener('change', e => {
      state.createOC = e.target.checked;
      saveState();
      updateStatus('🏢 Create OC ' + (state.createOC ? 'Enabled' : 'Disabled'));
      if (state.createOC && !getHotCity()) {
        fetchHotCity();
      }
    });

    // Open OC Leader modal when clicking the label text
    shadowRoot.querySelector("#tmn-create-oc-label").addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ocModal = shadowRoot.querySelector('#tmn-oc-leader-modal');
      const ocBackdrop = shadowRoot.querySelector('#tmn-modal-backdrop');
      ocModal.classList.add('show');
      ocModal.setAttribute('aria-hidden', 'false');
      ocBackdrop.style.display = 'block';
    });

    shadowRoot.querySelector("#tmn-oc-leader-close").addEventListener('click', () => {
      const ocModal = shadowRoot.querySelector('#tmn-oc-leader-modal');
      const ocBackdrop = shadowRoot.querySelector('#tmn-modal-backdrop');
      ocModal.classList.remove('show');
      ocModal.setAttribute('aria-hidden', 'true');
      ocBackdrop.style.display = 'none';
    });

    // OC Type selector
    const ocTypeSelect = shadowRoot.querySelector('#tmn-oc-type');
    if (ocTypeSelect) {
      ocTypeSelect.addEventListener('change', () => {
        state.ocType = ocTypeSelect.value;
        saveState();
        updateStatus(`OC type: ${state.ocType}`);
      });
    }

    // OC Team name inputs — save on blur
    const teamTransInput = shadowRoot.querySelector('#tmn-oc-team-transporter');
    const teamWeaponInput = shadowRoot.querySelector('#tmn-oc-team-weapon');
    const teamExplosiveInput = shadowRoot.querySelector('#tmn-oc-team-explosive');
    if (teamTransInput) {
      teamTransInput.addEventListener('blur', () => {
        state.ocTeamTransporter = teamTransInput.value.trim();
        saveState();
      });
    }
    if (teamWeaponInput) {
      teamWeaponInput.addEventListener('blur', () => {
        state.ocTeamWeaponMaster = teamWeaponInput.value.trim();
        saveState();
      });
    }
    if (teamExplosiveInput) {
      teamExplosiveInput.addEventListener('blur', () => {
        state.ocTeamExplosive = teamExplosiveInput.value.trim();
        saveState();
      });
    }

    // OC Schedule time input — save on change
    const schedInput = shadowRoot.querySelector('#tmn-oc-schedule-time');
    if (schedInput) {
      schedInput.addEventListener('change', () => {
        state.ocScheduledTime = schedInput.value;
        saveState();
        if (schedInput.value) {
          const d = new Date(schedInput.value);
          updateStatus(`OC scheduled: ${formatDateUK(d)}`);
        } else {
          updateStatus('OC schedule cleared — will trigger on cooldown');
        }
      });
    }

    // Refresh Hot City button
    const refreshHotCityBtn = shadowRoot.querySelector('#tmn-refresh-hot-city');
    if (refreshHotCityBtn) {
      refreshHotCityBtn.addEventListener('click', () => {
        localStorage.removeItem(LS_HOT_CITY);
        localStorage.removeItem(LS_HOT_CITY_UNTIL);
        updateStatus('Refreshing hot city...');
        fetchHotCity();
      });
    }

    // Reset Create OC button
    const resetCreateOCBtn = shadowRoot.querySelector('#tmn-reset-create-oc');
    if (resetCreateOCBtn) {
      resetCreateOCBtn.addEventListener('click', () => {
        resetCreateOC();
        const statusEl = shadowRoot.querySelector('#tmn-oc-create-status');
        if (statusEl) statusEl.textContent = 'idle (step 0)';
        updateStatus('OC creation state reset');
      });
    }

    shadowRoot.querySelector("#tmn-notify-ocdtm-ready").addEventListener('change', e => {
      state.notifyOCDTMReady = e.target.checked;
      saveState();
      updateStatus('🔔 OC/DTM Ready Alerts ' + (state.notifyOCDTMReady ? 'Enabled' : 'Disabled'));
      // Reset alert states so they can fire again
      if (e.target.checked) {
        localStorage.removeItem('tmnDTMReadyAlertState');
        localStorage.removeItem('tmnOCReadyAlertState');
      }
    });

    // Whitelist toggle and modal
    shadowRoot.querySelector("#tmn-whitelist-enabled").checked = state.whitelistEnabled;
    shadowRoot.querySelector("#tmn-whitelist-enabled").addEventListener('change', e => {
      state.whitelistEnabled = e.target.checked;
      saveState();
      updateStatus('Whitelist ' + (state.whitelistEnabled ? 'Enabled' : 'Disabled'));
    });

    // Open whitelist modal when clicking the label text
    shadowRoot.querySelector("#tmn-whitelist-label").addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const wlModal = shadowRoot.querySelector('#tmn-whitelist-modal');
      const wlBackdrop = shadowRoot.querySelector('#tmn-modal-backdrop');
      wlModal.classList.add('show');
      wlModal.setAttribute('aria-hidden', 'false');
      wlBackdrop.style.display = 'block';
      renderWhitelistEntries();
    });

    shadowRoot.querySelector("#tmn-whitelist-close").addEventListener('click', () => {
      const wlModal = shadowRoot.querySelector('#tmn-whitelist-modal');
      const wlBackdrop = shadowRoot.querySelector('#tmn-modal-backdrop');
      wlModal.classList.remove('show');
      wlModal.setAttribute('aria-hidden', 'true');
      wlBackdrop.style.display = 'none';
    });

    shadowRoot.querySelector("#tmn-whitelist-add").addEventListener('click', () => {
      if (state.whitelistNames.length >= 10) {
        updateStatus('Whitelist full (max 10 players)');
        return;
      }
      state.whitelistNames.push('');
      saveState();
      renderWhitelistEntries();
    });

    shadowRoot.querySelector("#tmn-clear-cooldowns").addEventListener('click', () => {
      localStorage.removeItem(LS_LAST_DTM_ACCEPT_TS);
      localStorage.removeItem(LS_LAST_OC_ACCEPT_TS);
      localStorage.removeItem(LS_LAST_DTM_INVITE_MAIL_ID);
      localStorage.removeItem(LS_LAST_OC_INVITE_MAIL_ID);
      localStorage.removeItem('tmnPendingDTMHandle');
      localStorage.removeItem('tmnPendingDTMHandleTs');
      localStorage.removeItem('tmnPendingOCHandle');
      localStorage.removeItem('tmnPendingOCHandleTs');
      localStorage.removeItem(LS_PENDING_DTM_URL);
      localStorage.removeItem(LS_PENDING_OC_URL);
      updateStatus('OC/DTM cooldowns and pending invites cleared');
    });

    function renderWhitelistEntries() {
      const container = shadowRoot.querySelector('#tmn-whitelist-entries');
      container.innerHTML = '';
      state.whitelistNames.forEach((name, i) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; gap:4px; margin-bottom:4px; align-items:center;';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = name;
        input.placeholder = `Player ${i + 1}`;
        input.style.cssText = 'flex:1; background:#0b1220; color:#e5e7eb; border:1px solid #334155; border-radius:4px; padding:3px 6px; font-size:0.85rem;';
        input.addEventListener('change', () => {
          state.whitelistNames[i] = input.value.trim();
          saveState();
        });
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '✕';
        removeBtn.style.cssText = 'background:transparent; color:#ef4444; border:1px solid #ef4444; border-radius:4px; padding:2px 6px; cursor:pointer; font-size:0.8rem;';
        removeBtn.addEventListener('click', () => {
          state.whitelistNames.splice(i, 1);
          saveState();
          renderWhitelistEntries();
        });
        row.appendChild(input);
        row.appendChild(removeBtn);
        container.appendChild(row);
      });
      if (state.whitelistNames.length === 0) {
        container.innerHTML = '<small style="color:#9ca3af;">No players added. All invites accepted.</small>';
      }
    }

    // ALL ON/OFF toggle functionality
    shadowRoot.querySelector("#tmn-auto-all").addEventListener('change', e => {
      const allEnabled = e.target.checked;

      state.autoCrime = allEnabled;
      state.autoGTA = allEnabled;
      state.autoBooze = allEnabled;
      state.autoJail = allEnabled;
      state.autoHealth = allEnabled;
      state.autoGarage = allEnabled;
      state.autoOC = allEnabled;
      state.autoDTM = allEnabled;

      shadowRoot.querySelector("#tmn-auto-crime").checked = allEnabled;
      shadowRoot.querySelector("#tmn-auto-gta").checked = allEnabled;
      shadowRoot.querySelector("#tmn-auto-booze").checked = allEnabled;
      shadowRoot.querySelector("#tmn-auto-jail").checked = allEnabled;
      shadowRoot.querySelector("#tmn-auto-health").checked = allEnabled;
      shadowRoot.querySelector("#tmn-auto-garage").checked = allEnabled;
      shadowRoot.querySelector("#tmn-auto-oc").checked = allEnabled;
      shadowRoot.querySelector("#tmn-auto-dtm").checked = allEnabled;

      const allLabel = shadowRoot.querySelector("#tmn-auto-all-label");
      allLabel.textContent = allEnabled ? 'ALL ON' : 'ALL OFF';
      allLabel.style.color = allEnabled ? '#10b981' : '#ef4444';

      saveState();
      updateStatus('All automation ' + (allEnabled ? 'Enabled' : 'Disabled'));

      // Start/stop OC/DTM watchers
      if (allEnabled) {
        startAutoOCMailWatcher();
        startAutoDTMMailWatcher();
      } else {
        stopAutoOCMailWatcher();
        stopAutoDTMMailWatcher();
      }

      if (allEnabled) {
      }
    });

    function updateAllToggleState() {
      const allToggle = shadowRoot.querySelector("#tmn-auto-all");
      const allLabel = shadowRoot.querySelector("#tmn-auto-all-label");
      const allEnabled = state.autoCrime && state.autoGTA && state.autoBooze && state.autoJail && state.autoHealth && state.autoGarage && state.autoOC && state.autoDTM;

      allToggle.checked = allEnabled;
      allLabel.textContent = allEnabled ? 'ALL ON' : 'ALL OFF';
      allLabel.style.color = allEnabled ? '#10b981' : '#ef4444';
    }

    shadowRoot.querySelectorAll('.crime-option').forEach(cb => {
      cb.addEventListener('change', e => {
        const id = parseInt(e.target.value);
        if (e.target.checked) {
          if (!state.selectedCrimes.includes(id)) state.selectedCrimes.push(id);
        } else {
          state.selectedCrimes = state.selectedCrimes.filter(x => x !== id);
        }
        saveState();
      });
    });

    shadowRoot.querySelectorAll('.gta-option').forEach(cb => {
      cb.addEventListener('change', e => {
        const id = parseInt(e.target.value);
        if (e.target.checked) {
          if (!state.selectedGTAs.includes(id)) state.selectedGTAs.push(id);
        } else {
          state.selectedGTAs = state.selectedGTAs.filter(x => x !== id);
        }
        saveState();
      });
    });

    // Interval inputs
    shadowRoot.querySelector('#tmn-crime-interval').addEventListener('change', e => {
      config.crimeInterval = Math.max(1, Math.min(999, parseInt(e.target.value)));
      GM_setValue("crimeInterval", config.crimeInterval);
      e.target.value = config.crimeInterval;
    });
    shadowRoot.querySelector('#tmn-gta-interval').addEventListener('change', e => {
      config.gtaInterval = Math.max(1, Math.min(999, parseInt(e.target.value)));
      GM_setValue("gtaInterval", config.gtaInterval);
      e.target.value = config.gtaInterval;
    });
    shadowRoot.querySelector('#tmn-booze-interval').addEventListener('change', e => {
      config.boozeInterval = Math.max(1, Math.min(999, parseInt(e.target.value)));
      GM_setValue("boozeInterval", config.boozeInterval);
      e.target.value = config.boozeInterval;
    });
    shadowRoot.querySelector('#tmn-booze-buy-amount').addEventListener('change', e => {
      config.boozeBuyAmount = Math.max(1, Math.min(300, parseInt(e.target.value)));
      GM_setValue("boozeBuyAmount", config.boozeBuyAmount);
      e.target.value = config.boozeBuyAmount;
    });
    shadowRoot.querySelector('#tmn-booze-sell-amount').addEventListener('change', e => {
      config.boozeSellAmount = Math.max(1, Math.min(300, parseInt(e.target.value)));
      GM_setValue("boozeSellAmount", config.boozeSellAmount);
      e.target.value = config.boozeSellAmount;
    });
    shadowRoot.querySelector('#tmn-jail-interval').addEventListener('change', e => {
      config.jailbreakInterval = Math.max(1, Math.min(999, parseInt(e.target.value)));
      GM_setValue("jailbreakInterval", config.jailbreakInterval);
      e.target.value = config.jailbreakInterval;
    });

    // Garage interval setting
    shadowRoot.querySelector('#tmn-garage-interval').addEventListener('change', e => {
      const minutes = Math.max(1, Math.min(120, parseInt(e.target.value)));
      config.garageInterval = minutes * 60; // Convert minutes to seconds for internal use
      GM_setValue("garageInterval", config.garageInterval);
      e.target.value = minutes;
    });

    // Health threshold settings
    shadowRoot.querySelector('#tmn-min-health').addEventListener('change', e => {
      config.minHealthThreshold = Math.max(1, Math.min(99, parseInt(e.target.value)));
      GM_setValue("minHealthThreshold", config.minHealthThreshold);
      e.target.value = config.minHealthThreshold;
    });
    shadowRoot.querySelector('#tmn-target-health').addEventListener('change', e => {
      config.targetHealth = Math.max(10, Math.min(100, parseInt(e.target.value)));
      GM_setValue("targetHealth", config.targetHealth);
      e.target.value = config.targetHealth;
    });
    shadowRoot.querySelector('#tmn-test-health-alert').addEventListener('click', () => {
      if (telegramConfig.enabled && telegramConfig.botToken && telegramConfig.chatId) {
        sendTelegramMessage(
          '🧪 <b>TEST Health Alert</b>\n\n' +
          `Player: ${state.playerName || 'Unknown'}\n` +
          `Current Health: ${getHealthPercent()}%\n` +
          `Threshold: ${config.minHealthThreshold}%\n` +
          `Time: ${formatDateUK()}\n\n` +
          'This is a test alert. If you receive this, health alerts are working!'
        );
        updateStatus('Test health alert sent to Telegram');
      } else {
        alert('Please configure Telegram notifications first (Bot Token and Chat ID required)');
      }
    });

    // Update current health display in settings periodically
    setInterval(() => {
      const healthEl = shadowRoot.querySelector('#tmn-settings-current-health');
      if (healthEl) {
        const health = getHealthPercent();
        const color = health >= 100 ? '#10b981' : health > config.minHealthThreshold ? '#f59e0b' : '#ef4444';
        healthEl.innerHTML = `<span style="color:${color};">●</span> ${health}%`;
      }
    }, 5000);

    shadowRoot.querySelector('#tmn-view-stats').addEventListener('click', () => {
      showDetailedStats();
    });

    // Reset ALL
    shadowRoot.querySelector('#tmn-reset-btn').addEventListener('click', resetStorage);

    // Clear player data (for new character)
    shadowRoot.querySelector('#tmn-clear-player').addEventListener('click', () => {
      if (confirm('Clear player name and cached data? Use this after starting a new character.')) {
        state.playerName = '';
        GM_setValue('playerName', '');
        localStorage.removeItem('tmnLastOCInviteMailId');
        localStorage.removeItem('tmnLastDTMInviteMailId');
        localStorage.removeItem('tmnLastOCAcceptTs');
        localStorage.removeItem('tmnLastDTMAcceptTs');
        localStorage.removeItem('tmnLastNotifiedMailId'); // legacy cleanup
        GM_setValue('lastNotifiedMailId', null);
        localStorage.removeItem('tmnPendingOCHandle');
        localStorage.removeItem('tmnPendingDTMHandle');
        localStorage.removeItem('tmnPendingOCAcceptURL');
        localStorage.removeItem('tmnPendingDTMAcceptURL');
        localStorage.removeItem('tmnProtectionEndTs');
        localStorage.removeItem('tmnProtectionStatus');
        localStorage.removeItem('tmnProtWarn12h');
        localStorage.removeItem('tmnProtWarn6h');
        updateStatus('Player data cleared — reload to detect new player');
        if (shadowRoot.updatePlayerBadge) shadowRoot.updatePlayerBadge();
      }
    });

    // Drag/Lock UI position
    const lockBtn = shadowRoot.querySelector('#tmn-lock-btn');
    const dragHandle = shadowRoot.querySelector('#tmn-drag-handle');
    let uiLocked = GM_getValue('uiLocked', true);
    let uiPosX = GM_getValue('uiPosX', null);
    let uiPosY = GM_getValue('uiPosY', null);

    // Restore saved position
    if (uiPosX !== null && uiPosY !== null) {
      host.style.right = 'auto';
      host.style.left = uiPosX + 'px';
      host.style.top = uiPosY + 'px';
    }

    function updateLockState() {
      lockBtn.textContent = uiLocked ? '🔒' : '🔓';
      dragHandle.style.cursor = uiLocked ? 'default' : 'grab';
    }
    updateLockState();

    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      uiLocked = !uiLocked;
      GM_setValue('uiLocked', uiLocked);
      updateLockState();
    });

    let isDragging = false, dragStartX, dragStartY, hostStartX, hostStartY;

    dragHandle.addEventListener('mousedown', (e) => {
      if (uiLocked || e.target.closest('button')) return;
      isDragging = true;
      dragHandle.style.cursor = 'grabbing';
      const rect = host.getBoundingClientRect();
      hostStartX = rect.left;
      hostStartY = rect.top;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      host.style.right = 'auto';
      host.style.left = (hostStartX + dx) + 'px';
      host.style.top = (hostStartY + dy) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      dragHandle.style.cursor = uiLocked ? 'default' : 'grab';
      const rect = host.getBoundingClientRect();
      uiPosX = rect.left;
      uiPosY = rect.top;
      GM_setValue('uiPosX', uiPosX);
      GM_setValue('uiPosY', uiPosY);
    });
    // Telegram Settings Event Listeners
    shadowRoot.querySelector("#tmn-telegram-enabled").checked = telegramConfig.enabled;
    shadowRoot.querySelector("#tmn-telegram-token").value = telegramConfig.botToken;
    shadowRoot.querySelector("#tmn-telegram-chat").value = telegramConfig.chatId;
    shadowRoot.querySelector("#tmn-notify-captcha").checked = telegramConfig.notifyCaptcha;
    shadowRoot.querySelector("#tmn-notify-messages").checked = telegramConfig.notifyMessages;

    shadowRoot.querySelector("#tmn-telegram-enabled").addEventListener('change', e => {
      telegramConfig.enabled = e.target.checked;
      saveTelegramConfig();
      updateStatus('Telegram notifications ' + (telegramConfig.enabled ? 'enabled' : 'disabled'));
    });

    shadowRoot.querySelector("#tmn-telegram-token").addEventListener('input', e => {
      telegramConfig.botToken = e.target.value.trim();
      saveTelegramConfig();
    });

    shadowRoot.querySelector("#tmn-telegram-chat").addEventListener('input', e => {
      telegramConfig.chatId = e.target.value.trim();
      saveTelegramConfig();
    });

    shadowRoot.querySelector("#tmn-notify-captcha").addEventListener('change', e => {
      telegramConfig.notifyCaptcha = e.target.checked;
      saveTelegramConfig();
    });

    shadowRoot.querySelector("#tmn-notify-messages").addEventListener('change', e => {
      telegramConfig.notifyMessages = e.target.checked;
      saveTelegramConfig();
    });
    shadowRoot.querySelector("#tmn-notify-sql").checked = telegramConfig.notifySqlCheck;

    shadowRoot.querySelector("#tmn-notify-sql").addEventListener('change', e => {
      telegramConfig.notifySqlCheck = e.target.checked;
      saveTelegramConfig();
    });

    shadowRoot.querySelector("#tmn-notify-logout").checked = telegramConfig.notifyLogout;

    shadowRoot.querySelector("#tmn-notify-logout").addEventListener('change', e => {
      telegramConfig.notifyLogout = e.target.checked;
      saveTelegramConfig();
   });


    shadowRoot.querySelector("#tmn-test-telegram").addEventListener('click', testTelegramConnection);

    // Login Settings Event Listeners
    shadowRoot.querySelector("#tmn-login-username").addEventListener('input', e => {
      LOGIN_CONFIG.USERNAME = e.target.value.trim();
      GM_setValue('loginUsername', LOGIN_CONFIG.USERNAME);
    });

    shadowRoot.querySelector("#tmn-login-password").addEventListener('input', e => {
  LOGIN_CONFIG.PASSWORD = e.target.value.trim();
  GM_setValue('loginPassword', LOGIN_CONFIG.PASSWORD);
    });

    shadowRoot.querySelector("#tmn-auto-submit-enabled").checked = LOGIN_CONFIG.AUTO_SUBMIT_ENABLED;
    shadowRoot.querySelector("#tmn-auto-submit-enabled").addEventListener('change', e => {
  LOGIN_CONFIG.AUTO_SUBMIT_ENABLED = e.target.checked;
  GM_setValue('autoSubmitEnabled', LOGIN_CONFIG.AUTO_SUBMIT_ENABLED);
});

    // Advanced Features Event Listeners
    shadowRoot.querySelector("#tmn-auto-resume-enabled").checked = autoResumeConfig.enabled;
    shadowRoot.querySelector("#tmn-auto-resume-enabled").addEventListener('change', e => {
      autoResumeConfig.enabled = e.target.checked;
      saveAutoResumeConfig();
      updateStatus('Auto-resume ' + (autoResumeConfig.enabled ? 'enabled' : 'disabled'));
    });

    shadowRoot.querySelector("#tmn-stats-collection-enabled").checked = statsCollectionConfig.enabled;
    shadowRoot.querySelector("#tmn-stats-collection-enabled").addEventListener('change', e => {
      statsCollectionConfig.enabled = e.target.checked;
      saveStatsCollectionConfig();
      updateStatus('Stats collection ' + (statsCollectionConfig.enabled ? 'enabled' : 'disabled'));
    });

    shadowRoot.querySelector("#tmn-stats-interval").addEventListener('change', e => {
      statsCollectionConfig.interval = Math.max(10, Math.min(7200, parseInt(e.target.value)));
      saveStatsCollectionConfig();
      e.target.value = statsCollectionConfig.interval;
    });

    // Logout Alert Settings
    shadowRoot.querySelector("#tmn-logout-tab-flash").checked = logoutAlertConfig.tabFlash;
    shadowRoot.querySelector("#tmn-logout-tab-flash").addEventListener('change', e => {
      logoutAlertConfig.tabFlash = e.target.checked;
      saveLogoutAlertConfig();
      updateStatus('Tab flash ' + (logoutAlertConfig.tabFlash ? 'enabled' : 'disabled'));
    });

    shadowRoot.querySelector("#tmn-logout-browser-notify").checked = logoutAlertConfig.browserNotify;
    shadowRoot.querySelector("#tmn-logout-browser-notify").addEventListener('change', e => {
      logoutAlertConfig.browserNotify = e.target.checked;
      saveLogoutAlertConfig();
      // Request notification permission when enabled
      if (logoutAlertConfig.browserNotify && Notification.permission === 'default') {
        Notification.requestPermission().then(perm => {
          updateStatus('Browser notifications: ' + perm);
        });
      } else {
        updateStatus('Browser notify ' + (logoutAlertConfig.browserNotify ? 'enabled' : 'disabled'));
      }
    });

    shadowRoot.querySelector("#tmn-test-logout-alert").addEventListener('click', () => {
      updateStatus('Testing logout alerts...');
      triggerLogoutAlerts();
      // Stop tab flash after 5 seconds for the test
      setTimeout(() => {
        stopFlashTabTitle();
        updateStatus('Logout alert test complete');
      }, 5000);
    });

    // Timer Refresh Button
    shadowRoot.querySelector('#tmn-refresh-timers').addEventListener('click', async () => {
      const btn = shadowRoot.querySelector('#tmn-refresh-timers');
      btn.textContent = 'Refreshing...';
      btn.disabled = true;

      await collectOCDTMTimers();
      await fetchTravelTimerData();

      updateSettingsTimerDisplay();

      btn.textContent = 'Refresh Timers';
      btn.disabled = false;
      updateStatus('Timers refreshed');
    });

    // Function to update settings modal timer displays
    function updateSettingsTimerDisplay() {
      const dtmStatus = getDTMTimerStatus();
      const ocStatus = getOCTimerStatus();
      const travelStatus = getTravelTimerStatus();
      const currentStats = parseStatusBar();

      const dtmDisplay = formatTimerDisplay(dtmStatus, 'canDTM');
      const ocDisplay = formatTimerDisplay(ocStatus, 'canOC');
      const travelDisplay = formatTravelTimerDisplay(travelStatus);

      const settingsDtmEl = shadowRoot.querySelector('#tmn-settings-dtm-timer');
      const settingsOcEl = shadowRoot.querySelector('#tmn-settings-oc-timer');
      const settingsTravelEl = shadowRoot.querySelector('#tmn-settings-travel-timer');
      const settingsHealthEl = shadowRoot.querySelector('#tmn-settings-health');

      if (settingsDtmEl) {
        settingsDtmEl.innerHTML = `<span style="color:${dtmDisplay.color === 'green' ? '#10b981' : dtmDisplay.color === 'red' ? '#ef4444' : '#9ca3af'};">●</span> ${dtmDisplay.text}`;
      }
      if (settingsOcEl) {
        settingsOcEl.innerHTML = `<span style="color:${ocDisplay.color === 'green' ? '#10b981' : ocDisplay.color === 'red' ? '#ef4444' : '#9ca3af'};">●</span> ${ocDisplay.text}`;
      }
      if (settingsTravelEl) {
        const travelColor = travelDisplay.color === 'green' ? '#10b981' : travelDisplay.color === 'amber' ? '#f59e0b' : travelDisplay.color === 'red' ? '#ef4444' : '#9ca3af';
        settingsTravelEl.innerHTML = `<span style="color:${travelColor};">●</span> ${travelDisplay.text}`;
      }
      if (settingsHealthEl && currentStats) {
        const health = currentStats.health || 0;
        const healthColor = getHealthColor(health);
        settingsHealthEl.innerHTML = `<span style="color:${healthColor};">●</span> ${health}%`;
      }

    }

    // Update settings timer display periodically
    setInterval(updateSettingsTimerDisplay, 1000);

    // Update tab status display
    const tabStatusEl = shadowRoot.querySelector('#tmn-tab-status');
    if (tabStatusEl) {
      const updateTabStatus = () => {
        if (tabManager.isMasterTab) {
          tabStatusEl.textContent = 'Status: Master Tab (automation active)';
          tabStatusEl.className = 'small text-success';
        } else if (tabManager.hasActiveMaster()) {
          tabStatusEl.textContent = 'Status: Secondary Tab (waiting)';
          tabStatusEl.className = 'small text-warning';
        } else {
          tabStatusEl.textContent = 'Status: No active master tab';
          tabStatusEl.className = 'small text-info';
        }
      };
      updateTabStatus();
      setInterval(updateTabStatus, 5000);
    }

// Minimizer
    // Minimizer
    const minimizeBtn = shadowRoot.querySelector('#tmn-minimize-btn');
    const body = shadowRoot.querySelector('#tmn-panel-body');
    const footer = shadowRoot.querySelector('#tmn-status');

    // Apply saved minimized state on page load
    if (state.panelMinimized) {
      body.style.display = 'none';
      footer.style.display = 'none';
      minimizeBtn.textContent = '+';
    } else {
      body.style.display = 'block';
      footer.style.display = 'block';
      minimizeBtn.textContent = "-";
    }

    minimizeBtn.addEventListener('click', () => {
      state.panelMinimized = !state.panelMinimized;
      if (state.panelMinimized) {
        body.style.display = 'none';
        footer.style.display = 'none';
        minimizeBtn.textContent = '+';
      } else {
        body.style.display = 'block';
        footer.style.display = 'block';
        minimizeBtn.textContent = "-";
      }
      saveState();
    });

    // Settings modal controls
    const settingsBtn = shadowRoot.querySelector('#tmn-settings-btn');
    const modal = shadowRoot.querySelector('#tmn-settings-modal');
    const backdrop = shadowRoot.querySelector('#tmn-modal-backdrop');
    const modalClose = shadowRoot.querySelector('#tmn-modal-close');

    function showModal() {
      pauseAutomation();
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
      backdrop.style.display = 'block';
    }
    function hideModal() {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
      // Also close any popup modals (whitelist, OC leader) that share the backdrop
      const wlModal = shadowRoot.querySelector('#tmn-whitelist-modal');
      if (wlModal) { wlModal.classList.remove('show'); wlModal.setAttribute('aria-hidden', 'true'); }
      const ocLeaderModal = shadowRoot.querySelector('#tmn-oc-leader-modal');
      if (ocLeaderModal) { ocLeaderModal.classList.remove('show'); ocLeaderModal.setAttribute('aria-hidden', 'true'); }
      backdrop.style.display = 'none';
      saveState();
      updatePlayerBadge();
      resumeAutomation();
    }

    settingsBtn.addEventListener('click', showModal);
    modalClose.addEventListener('click', hideModal);
    backdrop.addEventListener('click', hideModal);

    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        if (modal.classList.contains('show')) hideModal();
      }
    });

    function updatePlayerBadge() {
      const pb = shadowRoot.querySelector('#tmn-player-badge');
      if (pb) pb.innerHTML = `Player: ${state.playerName || 'Unknown'}`;
    }

    shadowRoot.updatePlayerBadge = updatePlayerBadge;
  }

  // ---------------------------
  // Detailed Stats Display
  // ---------------------------
  function showDetailedStats() {
    const currentStats = parseStatusBar();
    let statsHTML = `Current Status\n`;
    statsHTML += `Rank: ${currentStats ? currentStats.rank : 'N/A'} (${currentStats ? currentStats.rankPercent.toFixed(2) : '0.00'}%)\n`;
    statsHTML += `Money: $${currentStats ? currentStats.money.toLocaleString() : '0'}\n`;
    statsHTML += `Location: ${currentStats ? currentStats.city : 'N/A'}\n`;
    statsHTML += `Health: ${currentStats ? currentStats.health : '0'}%\n`;
    statsHTML += `FMJ: ${currentStats ? currentStats.fmj : '0'} | JHP: ${currentStats ? currentStats.jhp : '0'}\n`;
    statsHTML += `Credits: ${currentStats ? currentStats.credits : '0'}`;
    alert(statsHTML);
  }

  // ---------------------------
  // Main Loop (WITH JAIL CHECKS ON EVERY PAGE)
  // ---------------------------
async function mainLoop() {
    // Tab Manager: STRICT single-tab enforcement
    // Always re-check master status to handle tab switches
    const wasMaster = tabManager.isMasterTab;
    tabManager.checkMasterStatus();

    if (!tabManager.isMasterTab) {
      // Not the master tab - do NOT run any automation
      if (wasMaster) {
        console.log('[TMN] Lost master status - stopping automation in this tab');
      }
      updateStatus("⏸ Secondary tab - automation runs in first tab only");
      setTimeout(mainLoop, 3000); // Check less frequently as secondary
      return;
    }

    if (automationPaused) {
      setTimeout(mainLoop, 1800 + Math.floor(Math.random() * 1400));
      return;
    }

    // Check for Telegram notifications
    checkForCaptcha();
    checkForNewMessages();
    checkForSqlScriptCheck();
    checkForLogout();
    checkForLowHealth();

    // Check for stuck actions before anything else
    checkForNavigationInterruption();

    // Handle script check page with auto-resume
    if (isOnCaptchaPage()) {
      if (autoResumeConfig.enabled) {
        updateStatus("Script Check detected - Auto-resume monitoring...");
        localStorage.setItem(LS_SCRIPT_CHECK_ACTIVE, "true");
        startScriptCheckMonitor();
      } else {
        updateStatus("Script Check detected - All automation PAUSED");
      }
      setTimeout(mainLoop, 1800 + Math.floor(Math.random() * 1400));
      return;
    } else {
      // Clear script check flag if we're no longer on the page
      if (localStorage.getItem(LS_SCRIPT_CHECK_ACTIVE) === "true") {
        localStorage.removeItem(LS_SCRIPT_CHECK_ACTIVE);
        scriptCheckMonitorActive = false;
        console.log('[TMN] Script check cleared - resuming normal operation');
      }
    }

    // Check if stats collection is needed (low priority - runs between other actions)
    if (shouldCollectStats() && !state.isPerformingAction) {
      collectStatistics();
    }

    if (!state.playerName) {
      getPlayerName();
      setTimeout(mainLoop, 3000);
      return;
    }

    // CRITICAL: Check jail state on EVERY page, not just jail page
    checkJailStateOnAnyPage();

    // ===== PRIORITY 1: Handle pending OC/DTM page actions (we're already on the page) =====
    if (handleOCPageAfterAccept()) {
      setTimeout(mainLoop, 3000);
      return;
    }
    if (handleDTMPageAfterAccept()) {
      setTimeout(mainLoop, 3000);
      return;
    }

    // ===== PRIORITY 1.5: OC Team Creation flow (leader mode) =====
    // If Create OC is active and we're in setup/polling state, handle the OC page.
    // If idle but OC is ready and schedule hasn't triggered yet, keep polling until it does.
    if (state.createOC && !state.inJail) {
      const ocCreateState = getCreateOCState();

      // IDLE: OC ready but waiting for scheduled time — poll every loop iteration
      if (ocCreateState === 'idle') {
        try {
          const ocStatus = getOCTimerStatus();
          const ocReady = ocStatus && (ocStatus.canOC === true || (ocStatus.totalSeconds || 0) <= 0);
          if (ocReady && isOCScheduleReady()) {
            console.log('[TMN][CreateOC] Schedule + cooldown both ready — triggering');
            triggerCreateOC();
          }
        } catch (e) {
          console.warn('[TMN][CreateOC] idle poll error:', e);
        }
      }

      // SETUP/POLLING: actively creating an OC
      if (ocCreateState !== 'idle') {
        const onOCPage = /\/authenticated\/organizedcrime\.aspx/i.test(location.pathname) &&
                         !/p=dtm/i.test(location.search);
        if (onOCPage) {
          try {
            const handled = await handleCreateOCPage();
            if (handled) {
              setTimeout(mainLoop, 3000);
              return;
            }
          } catch (e) {
            console.warn('[TMN][CreateOC] mainLoop handler error:', e);
          }
        } else {
          // Not on OC page but in setup/polling — check if it's time to navigate back
          const nextCheck = parseInt(localStorage.getItem(LS_CREATE_OC_NEXT_CHECK) || '0', 10);
          if (nextCheck > 0 && Date.now() >= nextCheck && !state.isPerformingAction) {
            console.log('[TMN][CreateOC] Time to check OC page — navigating');
            window.location.href = OC_URL + '?' + Date.now();
            setTimeout(mainLoop, 5000);
            return;
          }
        }
      }
    }

    // ===== PRIORITY 2: Process pending invite accept URLs (navigate to accept page) =====
    if (!state.inJail && !state.isPerformingAction) {
      const pendingDTMUrl = localStorage.getItem(LS_PENDING_DTM_URL);
      if (pendingDTMUrl && state.autoDTM) {
        console.log('[TMN] Processing pending DTM accept URL:', pendingDTMUrl);
        localStorage.removeItem(LS_PENDING_DTM_URL);
        localStorage.setItem('tmnPendingDTMHandle', 'true');
        localStorage.setItem('tmnPendingDTMHandleTs', String(Date.now()));
        sendTelegramMessage(
          '🚚 <b>DTM Invite Accepted!</b>\n\n' +
          `Player: ${state.playerName || 'Unknown'}\n` +
          `Time: ${formatDateUK()}\n\n` +
          '✅ Navigating to DTM page...'
        );
        state.isPerformingAction = true;
        saveState();
        updateStatus("🚚 Accepting DTM invite...");
        // Use URL path+search to avoid origin mismatch (www vs non-www)
        try {
          const dtmUrl = new URL(pendingDTMUrl);
          window.location.href = dtmUrl.pathname + dtmUrl.search;
        } catch {
          window.location.href = pendingDTMUrl.replace(/^https?:\/\/[^/]+/, '');
        }
        return;
      }

      const pendingOCUrl = localStorage.getItem(LS_PENDING_OC_URL);
      if (pendingOCUrl && state.autoOC) {
        // Don't navigate to OC page while in jail — wait for release
        if (state.inJail) {
          console.log('[TMN] Pending OC URL but in jail — waiting for release');
          // Don't remove the URL, keep it for when we're free
        } else {
          console.log('[TMN] Processing pending OC accept URL:', pendingOCUrl);
          localStorage.removeItem(LS_PENDING_OC_URL);
          localStorage.setItem('tmnPendingOCHandle', 'true');
          localStorage.setItem('tmnPendingOCHandleTs', String(Date.now()));
          let roleInfo = '';
          try {
            const u = new URL(pendingOCUrl);
            const pos = u.searchParams.get('pos');
            if (pos) roleInfo = `\nRole: ${pos.replace(/([A-Z])/g, ' $1').trim()}`;
          } catch {}
          sendTelegramMessage(
            '🕵️ <b>OC Invite Accepted!</b>\n\n' +
            `Player: ${state.playerName || 'Unknown'}\n` +
            `Time: ${formatDateUK()}${roleInfo}\n\n` +
            '✅ Navigating to OC page...'
          );
          state.isPerformingAction = true;
          saveState();
          updateStatus("🕵️ Accepting OC invite...");
          // Use URL path+search to avoid origin mismatch (www vs non-www)
          try {
            const ocUrl = new URL(pendingOCUrl);
            window.location.href = ocUrl.pathname + ocUrl.search;
          } catch {
            window.location.href = pendingOCUrl.replace(/^https?:\/\/[^/]+/, '');
          }
          return;
        }
      }
    }

    // ===== PRIORITY 3: Check mail for new invites =====
    // Runs every 60s normally, or IMMEDIATELY when on the mailbox page
    if ((state.autoOC || state.autoDTM || (telegramConfig.enabled && telegramConfig.notifyMessages))
        && tabManager.isMasterTab) {
      const lastMailCheck = parseInt(localStorage.getItem('tmnLastMailCheckTs') || '0', 10);
      const mailCheckNow = Date.now();
      const onMailboxPage = getCurrentPage() === 'mailbox';
      // Check immediately if on mailbox page, otherwise respect the interval
      if (onMailboxPage || (mailCheckNow - lastMailCheck > MAIL_CHECK_INTERVAL_MS)) {
        localStorage.setItem('tmnLastMailCheckTs', String(mailCheckNow));
        try {
          await unifiedMailCheck();
        } catch (e) {
          console.warn('[TMN][MAIL] check error:', e);
        }
        // If mail check stored a pending URL, pick it up immediately
        if (localStorage.getItem(LS_PENDING_DTM_URL) || localStorage.getItem(LS_PENDING_OC_URL)) {
          setTimeout(mainLoop, 500);
          return;
        }
      }
    }

    // Check OC/DTM ready alerts (edge-triggered)
    try { checkOCDTMReadyAlerts(); } catch (e) {}

    // Check health and buy if needed (high priority - runs before other actions)
    if (state.autoHealth && !state.isPerformingAction) {
      checkAndBuyHealth();
      // If we're buying health, wait for it to complete
      if (state.buyingHealth) {
        setTimeout(mainLoop, 1800 + Math.floor(Math.random() * 1400));
        return;
      }
    }

    if (!state.isPerformingAction) {
      const currentPage = getCurrentPage();
      const now = Date.now();

      if (!state.autoCrime && !state.autoGTA && !state.autoBooze && !state.autoJail && !state.autoGarage && !state.autoHealth && !state.autoOC && !state.autoDTM) {
        if (now % 30000 < 2000) {
          updateStatus("Idle - no automation enabled");
        }
        setTimeout(mainLoop, 5000);
        return;
      }

      // Handle jail state properly
      if (state.inJail) {
        // When jailed, only check for release periodically
        if (now - state.lastJailCheck > config.jailCheckInterval * 1000) {
          state.lastJailCheck = now;
          saveState();
          updateStatus("In jail - checking for release...");
          safeNavigate('/authenticated/jail.aspx?' + Date.now());
        } else {
          const hasPendingDTM = localStorage.getItem(LS_PENDING_DTM_URL);
          const hasPendingOC = localStorage.getItem(LS_PENDING_OC_URL);
          const pendingInvite = hasPendingDTM ? ' (pending DTM invite)' : hasPendingOC ? ' (pending OC invite)' : '';
          updateStatus(`IN JAIL - waiting for release${state.pendingAction ? ` (will resume ${state.pendingAction})` : ''}${pendingInvite}`);
        }
      } else {
        // Player is free - proceed with actions
        const shouldDoCrime = state.autoCrime && (now - state.lastCrime >= config.crimeInterval * 1000);
        const shouldDoGTA = state.autoGTA && (now - state.lastGTA >= config.gtaInterval * 1000);
        const shouldDoBooze = state.autoBooze && (now - state.lastBooze >= config.boozeInterval * 1000);
        const shouldDoJailbreak = state.autoJail && (now - state.lastJail >= config.jailbreakInterval * 1000);
        const shouldDoGarage = state.autoGarage && (now - state.lastGarage >= config.garageInterval * 1000);

        // Check if we have a pending action from being jailed
        if (state.pendingAction) {
          updateStatus(`Resuming pending action: ${state.pendingAction}`);
          if (state.pendingAction === 'crime' && shouldDoCrime) {
            if (currentPage === 'crimes') {
              doCrime();
            } else {
              updateStatus("Navigating to crimes page to resume pending action...");
              safeNavigate('/authenticated/crimes.aspx?' + Date.now());
            }
            return;
          } else if (state.pendingAction === 'gta' && shouldDoGTA) {
            if (currentPage === 'gta') {
              doGTA();
            } else {
              updateStatus("Navigating to GTA page to resume pending action...");
              safeNavigate('/authenticated/crimes.aspx?p=g&' + Date.now());
            }
            return;
          } else if (state.pendingAction === 'booze' && shouldDoBooze) {
            if (currentPage === 'booze') {
              doBooze();
            } else {
              updateStatus("Navigating to booze page to resume pending action...");
              safeNavigate('/authenticated/crimes.aspx?p=b&' + Date.now());
            }
            return;
          } else {
            // Pending action no longer relevant
            state.pendingAction = '';
            saveState();
          }
        }

        // Garage runs on a separate longer interval, doesn't block other actions
        // Only navigate to garage if nothing else is due
        const garageOverdue = state.autoGarage && (now - state.lastGarage >= config.garageInterval * 1000);
        if (garageOverdue && currentPage === 'garage') {
          doGarage();
          // Don't return - let mainLoop continue to schedule next iteration
        }

        // Priority handling for overlapping timers
        if (shouldDoCrime && shouldDoGTA) {
          const crimeReadyTime = state.lastCrime + config.crimeInterval * 1000;
          const gtaReadyTime = state.lastGTA + config.gtaInterval * 1000;

          if (crimeReadyTime <= gtaReadyTime) {
            if (currentPage === 'crimes') {
              doCrime();
            } else {
              updateStatus("Navigating to crimes page (priority)...");
              safeNavigate('/authenticated/crimes.aspx?' + Date.now());
            }
          } else {
            if (currentPage === 'gta') {
              doGTA();
            } else {
              updateStatus("Navigating to GTA page (priority)...");
              safeNavigate('/authenticated/crimes.aspx?p=g&' + Date.now());
            }
          }
        } else if (shouldDoCrime) {
          if (currentPage === 'crimes') {
            doCrime();
          } else {
            updateStatus("Navigating to crimes page...");
            safeNavigate('/authenticated/crimes.aspx?' + Date.now());
          }
        } else if (shouldDoGTA) {
          if (currentPage === 'gta') {
            doGTA();
          } else {
            updateStatus("Navigating to GTA page...");
            safeNavigate('/authenticated/crimes.aspx?p=g&' + Date.now());
          }
        } else if (shouldDoBooze) {
          if (currentPage === 'booze') {
            doBooze();
          } else {
            updateStatus("Navigating to booze page...");
            safeNavigate('/authenticated/crimes.aspx?p=b&' + Date.now());
          }
        } else if (shouldDoJailbreak) {
          if (currentPage === 'jail') {
            doJailbreak();
          } else if (state.autoJail) {
            updateStatus("Navigating to jail page to break others out...");
            safeNavigate('/authenticated/jail.aspx?' + Date.now());
          }
        } else if (shouldDoGarage) {
          // Garage runs at lowest priority - only when nothing else is due
          if (currentPage === 'garage') {
            doGarage();
          } else {
            updateStatus("Navigating to garage (scheduled)...");
            safeNavigate('/authenticated/playerproperty.aspx?p=g&' + Date.now());
          }
        } else {
          const crimeRemaining = Math.max(0, Math.ceil((config.crimeInterval * 1000 - (now - state.lastCrime)) / 1000));
          const gtaRemaining = Math.max(0, Math.ceil((config.gtaInterval * 1000 - (now - state.lastGTA)) / 1000));
          const boozeRemaining = Math.max(0, Math.ceil((config.boozeInterval * 1000 - (now - state.lastBooze)) / 1000));
          const jailRemaining = Math.max(0, Math.ceil((config.jailbreakInterval * 1000 - (now - state.lastJail)) / 1000));
          const garageRemainingSec = Math.max(0, Math.ceil((config.garageInterval * 1000 - (now - state.lastGarage)) / 1000));
          const garageRemainingMin = Math.ceil(garageRemainingSec / 60);

          if (crimeRemaining > 0 || gtaRemaining > 0 || boozeRemaining > 0 || jailRemaining > 0 || garageRemainingSec > 0) {
            const pendingInfo = state.pendingAction ? `, Pending: ${state.pendingAction}` : '';
            updateStatus(`Crime ${crimeRemaining}s, GTA ${gtaRemaining}s, Booze ${boozeRemaining}s, Jail ${jailRemaining}s, Garage ${garageRemainingMin}m${pendingInfo}`);
          }
        }
      }
    }

    setTimeout(mainLoop, 1800 + Math.floor(Math.random() * 1400));
  }

  // ---------------------------
  // Initialize
  // ---------------------------
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    // Initialize Tab Manager - check if we should be the master tab
    const isMaster = tabManager.checkMasterStatus();
    if (!isMaster && tabManager.hasActiveMaster()) {
      console.log('[TMN] Another tab is already running automation');
    }

    createScopedUI();

    // Start DTM/OC timer updates
    startTimerUpdates();

    // Initialize hot city detection (scrapes stats page if we're on it)
    try { initHotCity(); } catch (e) { console.warn('[TMN][HotCity] init error:', e); }

    // NOTE: Mail checking is now integrated into mainLoop (Priority 3) with localStorage-based cooldown.
    // No separate timer needed — survives page navigations unlike the old setInterval/setTimeout approach.

    // Show appropriate status based on tab status
    if (tabManager.isMasterTab) {
      updateStatus("TMN TDS Auto v17.04 loaded - Master tab (single tab mode)");
    } else {
      updateStatus("⏸ Secondary tab - close this tab or it will remain inactive");
    }

    // Check jail state immediately on startup
    checkJailStateOnAnyPage();

    // Handle page unload - release master status
    window.addEventListener('beforeunload', () => {
      tabManager.releaseMaster();
      stopUnifiedMailWatcher();
    });

    // Cross-tab synchronization for running state
    window.addEventListener('storage', (e) => {
      if (e.key === LS_TAB_MASTER) {
        // Master tab changed - recheck our status
        tabManager.checkMasterStatus();
      }
    });

    setTimeout(() => {
      state.lastJailCheck = 0;
      mainLoop();
    }, 1500);
  }

  init();

})();
