// ==UserScript==
// @name         TMN TDS Auto v17.46
// @namespace    http://tampermonkey.net/
// @version      17.46
// @description  v17.46 — Auto-login fix: don't require a captcha token when no captcha is rendered on the login page
// @author       You
// @match        *://www.tmn2010.net/login.aspx*
// @match        *://www.tmn2010.net/authenticated/*
// @match        *://www.tmn2010.net/Login.aspx*
// @match        *://www.tmn2010.net/Authenticated/*
// @match        *://www.tmn2010.net/Default.aspx*
// @match        *://www.tmn2010.net/default.aspx*
// @match        *://www.tmn2010.net/Authenticated/Default.aspx*
// @match        *https://www.tmn2010.net/authenticated/
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      api.telegram.org
// @updateURL    https://raw.githubusercontent.com/scoobyghub/v17/refs/heads/main/Helper.meta.js
// @downloadURL  https://raw.githubusercontent.com/scoobyghub/v17/refs/heads/main/Helper.user.js
// ==/UserScript==
