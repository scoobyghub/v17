// ==UserScript==
// @name         TMN TDS Auto v17.59
// @namespace    http://tampermonkey.net/
// @version      17.59
// @description  v17.59 — Fix: pendingAction resume could get permanently stuck on jailbreak, completely blocking crime/GTA/booze from ever running again
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

/*
TMN TDS Auto v17.59 — changelog

Investigated a report that after v17.58's jail-interval change, the script
"carries on jailbreaking and does not run the main crime/gta/booze loop
when before the loop was priority."

FIX IN v17.59:
- Real bug, and a significant one: the pendingAction resume mechanism
  (added in v17.51 for crime/GTA/booze, extended to jailbreak in v17.57)
  never checked whether a HIGHER-priority action was also currently due -
  each branch only asked "does this match the pending action, and is ITS
  OWN cooldown up," completely independent of the others. That was
  survivable for GTA/booze in practice only because their cooldowns
  (245s/120s) are so much longer than mainLoop's ~1.8-3.2s tick that the
  fallthrough-clear (the final `else { pendingAction = '' }`) almost always
  got a chance to fire soon after one resume attempt, unsticking things
  before it became visible. Jailbreak's cooldown is 4s - comparable to the
  tick interval itself - so once state.pendingAction became 'jailbreak'
  (which happens far more easily now than before, simply because jailbreak
  fires so much more often than crime/GTA/booze), shouldDoJailbreak
  essentially never went false long enough for that fallthrough-clear to
  ever run. pendingAction got stuck on 'jailbreak' PERMANENTLY, and this
  block - which never even looks at crime/GTA/booze once locked onto
  resuming jailbreak - silently consumed every single tick from then on,
  completely bypassing the real priority-selection logic further down
  where crime/GTA/booze normally get their turn. Exactly the reported
  symptom.
- Fixed by making the resume branches defer to the same priority order the
  selection logic below already uses (gta requires !shouldDoCrime, booze
  requires !shouldDoCrime && !shouldDoGTA, jailbreak requires none of the
  three above it to be due). The instant something higher-priority becomes
  due, none of the specific branches match anymore, pendingAction gets
  cleared via the final else, and control falls straight through to normal
  priority selection in the very same tick - permanently unstuck, not just
  delayed a few seconds.

--- v17.58 changelog below ---

TMN TDS Auto v17.58 — changelog

Follow-up correction based on direct feedback on v17.57's jail changes.

FIX IN v17.58:
- Removed the needsRefresh-triggered forced reload added in v17.57.
  Jailbreak sets that flag after every successful click and, on the next
  entry, was forcing an extra navigation to jail.aspx on top of whatever
  reload the click's own postback already did. With a 120s+ cooldown that
  extra round-trip was negligible; with jail's actually-intended ~4s
  cadence (see below) it would double navigation overhead on every single
  cycle, working directly against the point of checking quickly. Jail now
  only navigates when it's not actually on the jail page at all - no flag,
  no double reload.
- jailbreakInterval's default is back down to 4s (was bumped to 120s in
  v17.57 on the mistaken assumption it should match crime/GTA/booze's
  multi-minute cooldowns). Per feedback, jail's short cadence is
  intentional: bailing other players out isn't gated by an energy/nerve-
  style server-side cost the way crime/GTA/booze are, so checking
  frequently is correct, not a bug. Installs that picked up the brief
  120s default get migrated down to 4s automatically; anyone still on the
  original pre-v17.57 value of 3s (or any other custom value) is left
  alone.

--- v17.57 changelog below ---

TMN TDS Auto v17.57 — changelog

Investigated a report that Auto Jail "doesn't seem to be working very well."

FIX IN v17.57:
- jailbreakInterval (the cooldown between jailbreak attempts) defaulted to
  3 seconds - compare crimeInterval's 125, gtaInterval's 245, and
  boozeInterval's 120. Three orders of magnitude shorter than every other
  action's cooldown, and shorter than mainLoop's own ~1.8-3.2s tick
  interval. Since jailbreak sits at the lowest priority in mainLoop's
  action-selection chain (only runs when crime/GTA/booze are all not due),
  this near-zero cooldown meant it was effectively unthrottled: it fired
  on almost every idle tick, constantly bouncing to the jail page even
  when there was nothing to bail out, instead of settling into a cadence
  like the other three. Default bumped to 120s (matching booze). Existing
  installs that already saved the old 3s default get migrated to 120s
  automatically the first time this version loads (anyone who deliberately
  set a different custom value, including coincidentally 3, is unaffected
  either way, since the migration only triggers on an exact match against
  the specific old buggy default).
- doJailbreak() explicitly forced a re-navigation to jail.aspx via
  safeNavigate() a fixed 1.1-1.9s after clicking a break link, regardless
  of whether the click's own postback had actually finished. If the server
  hadn't responded yet, that forced navigation could cancel the in-flight
  postback outright - the attempt would get logged as "attempted" client-
  side while the actual bail-out may never have completed server-side.
  doCrime() doesn't fight its own postback this way - it just sets
  needsRefresh and lets the click's natural reload happen, with the flag
  as a fallback in case it didn't. doJailbreak() now follows the same
  pattern (also gained the needsRefresh-checking reload gate on entry that
  doCrime() already had).
- Jailbreak was entirely missing from the pendingAction resume-after-jail-
  release mechanism that crime/GTA/booze already had (added in v17.51).
  Getting jailed mid-attempt did correctly set state.pendingAction =
  'jailbreak' (via the same generic handler that does this for whatever
  action was running), but with no matching branch in the resume block, it
  silently fell through to "no longer relevant" and got discarded instead
  of resumed - unlike the other three. Added the matching branch.

--- v17.56 changelog below ---

TMN TDS Auto v17.56 — changelog

FIX IN v17.56:
- Added an 8px gap between the Auto Login switch and its label so the text
  has the same comfortable spacing as the other switches.
- Kept the vertical alignment with the Prot timer unchanged.
- No Auto Login functionality or timing changed.

FIX IN v17.56:
- Corrected the Auto Login vertical position in the Prot row.
- Auto Login now uses an explicit flex-centred row with Bootstrap's default
  switch top/bottom margins neutralised, so the switch is vertically level
  with the Prot timer content rather than sitting slightly high.
- No login behaviour, timing, settings synchronisation, or other UI rows changed.

FIX IN v17.56:
- Moved Auto Login into the normal two-column toggle layout directly beneath
  the DTM timer row, using the exact same form-switch spacing and styling as
  the other Auto toggles. Removed the custom alignment overrides from v17.53.
- Auto Login remains in the right-hand column beneath DTM, while Prot remains
  in the left-hand column, so the timer and switch rows line up consistently.
- No Auto Login functionality, setting, synchronisation, or login timing was changed.

FIX IN v17.56:
- Main-panel Auto Login is now vertically and horizontally aligned with the
  Prot timer row. The switch container uses the same centered flex alignment
  as the timer cell, removes Bootstrap's default switch padding/float offsets,
  and keeps the label/switch group centered as one unit. No Auto Login logic
  or setting behavior was changed.

NEW IN v17.56:
- Added an "Auto Login" switch to the main panel, right under the DTM
  timer row, styled the same as the other Auto toggles (Auto Garage, Auto
  Booze, etc). It's the same underlying setting as "Auto-submit after
  captcha" in Settings (LOGIN_CONFIG.AUTO_SUBMIT_ENABLED) - not a new
  feature, just a second, more convenient place to flip it without opening
  Settings. Since the Settings modal is always present in the DOM (just
  hidden/shown via a class, not created/destroyed), both switches are live
  at the same time - toggling either one now updates the other so they
  never show conflicting states.

--- v17.51 changelog below ---

TMN TDS Auto v17.51 — changelog

Full audit pass for hangs/errors/performance, requested after the v17.50
retry-race fix. Two real issues found and fixed; everything else checked
(mainLoop's ~15 reschedule points, all setInterval/setTimeout recursive
chains, tab-master enforcement, watchdog timestamps) came back clean.

FIX IN v17.51:
- Real hang bug in mainLoop's "resume pending action" block (crime/GTA/
  booze). Every other early `return` in this ~700-line function is
  preceded by either a setTimeout(mainLoop, ...) reschedule or an actual
  page navigation (which reloads the page and restarts the whole script
  via init()). This one block was the sole exception: when the pending
  action's target page was already the active page, it ran the action and
  returned with neither - permanently killing the recursive mainLoop chain
  until a manual page reload, with no error or warning anywhere. Only
  reachable via a specific combination (released from jail while already
  sitting on the matching page with a pending action queued), which is
  likely why it went unnoticed until now. All three branches (crime/gta/
  booze) now reschedule before returning, matching every other path.
- Added a top-level try/catch around the entirety of mainLoop(). Nothing
  previously wrapped the whole function - if literally anything inside it
  ever threw an uncaught error (an unexpected DOM shape from a site
  change, a null reference, anything not already individually try/caught
  somewhere inside), the exception would propagate out of the
  setTimeout-based callback uncaught, and since nothing downstream of the
  throw would run, none of mainLoop's own reschedule calls would fire
  either - the entire loop would die silently and permanently. This is a
  standing-risk class of bug (not tied to one specific line), and the new
  catch-all guards against any instance of it, present or future: log the
  error, then always reschedule, exactly like every normal path already
  does. The catch block itself has a nested try around its own logging so
  that even a failure in the recovery path can't skip the reschedule.

--- v17.50 changelog below ---

TMN TDS Auto v17.50 — changelog

FIX IN v17.50:
- Crime/GTA/booze all had a "no buttons/options found on page" retry path
  (up to 3 attempts) meant to force a full page reload so the next attempt
  sees fresh DOM. The reload was gated behind state.needsRefresh, but the
  retry code set that flag inside a setTimeout(..., 2000) instead of
  immediately - and mainLoop reschedules itself every ~1.8-3.2s on its own.
  That's a race: the next mainLoop tick could easily fire before the
  delayed flag was ever set, meaning the page never actually got told to
  reload - it just burned through the retry counter finding nothing, tick
  after tick, until it gave up. Now the flag is set synchronously the
  moment a retry is scheduled, so the very next tick reliably sees it and
  reloads - no more race.
- Crime's and booze's "retries exhausted, giving up" branches never set
  needsRefresh at all (GTA's did) - so once either of those gave up, they
  stayed permanently stuck reporting "no buttons/options found" forever,
  with no path back to a working state short of a manual page reload. Both
  now set needsRefresh = true on give-up too, matching GTA's behavior.

--- v17.49 changelog below ---

TMN TDS Auto v17.49 — changelog

FIX IN v17.49:
- Fixed a real stuck-forever bug in transportCarsToHotCity() (added v17.46).
  When a travel-back was queued and the player wasn't already in the hot
  city, that function would try to resolve the hot city name by reading the
  live .hot-marked span on travel.aspx (the getHotCity() cache is often
  empty when a travel-back first queues). If that live read ever failed to
  find a marker - page not fully loaded, a brief gap between hot-city
  rotations, whatever the cause - the function just `return`ed with zero
  state change. The caller in mainLoop set travelBackHandledThisTick = true
  regardless of what the function actually did, so every single tick kept
  landing back on this same dead end: parked on the Airport page, claiming
  every tick, permanently blocking crime/GTA/booze/jailbreak/garage/bunker/
  scrapyard - every other action - with no way out. This matches reports of
  the script "getting stuck checking the airport and nothing else cycling."
  Fixes:
    - That dead end now gives up on car transport specifically (sets
      carsTransportedForThisTravelBack = true) instead of looping forever.
      doTransportBackToHotCity() runs right after on the same cycle and has
      its own independent, already-correct handling for a genuine
      "no hot city found" case.
    - Added a 90-second watchdog around the car-transport step itself
      (carTransportStartedAt), mirroring the one that already existed for
      the jet-travel step, as defense-in-depth against any other
      not-yet-found stuck path in this newer code.
    - The watchdog timestamp is now reset to 0 everywhere
      carsTransportedForThisTravelBack gets reset to false for a fresh
      travel-back cycle (all four DTM triggers, the hot city safety net, and
      toggling Auto Travel off mid-flight) - otherwise a stale timestamp
      left over from a previous cycle could make a brand new cycle
      immediately think it's "been stuck for 90s" on its very first attempt.

--- v17.48 changelog below ---

TMN TDS Auto v17.48 — changelog

NEW IN v17.48:
- Auto Garage and Auto Travel After DTM now default to true (were false)
  for any install with no saved value yet. The car-transport-before-
  travel-back feature added in v17.47 depends on both of these being on -
  without them, the whole flow silently never fires (no error, cars just
  get left behind and the script flies back anyway). Only affects fresh
  installs/cleared storage; an existing false stays false until toggled in
  the settings panel.
- Debug hook: exposes the live in-memory state object as tmnDebugState in
  the page console (via unsafeWindow, falling back to window). Since
  GM_getValue/GM_setValue storage isn't readable from the ordinary page
  console and Tampermonkey's own Storage/Values tab isn't present in every
  version's UI, this gives a always-available way to check what the script
  currently thinks its own state is (autoGarage, pendingTravelBack, etc.)
  without either of those. It's a live reference to the same object
  mainLoop reads/writes, so re-running `tmnDebugState` in the console shows
  current values, not a one-time snapshot. Read-only inspection only -
  don't set values through it, use the settings panel so changes get
  persisted via saveState()/GM_setValue like normal.

--- v17.47 changelog below ---

TMN TDS Auto v17.47 — changelog

NEW IN v17.47:
- Transport garage cars to hot city before flying back. Previously, when a
  travel-back was queued (any of the four DTM triggers, or the v17.45 hot
  city safety net) and you weren't already sitting in the hot city, the
  script would jet straight back and any cars sitting in the garage got
  left behind wherever you were. Now, right before the jet-travel step,
  mainLoop checks isInHotCity(): if false, it routes to the garage page
  first, ticks every car's checkbox, sets the "Transport selected cars to:"
  dropdown (ddlCities) to the hot city, and clicks Transport - only once
  that's done (or confirmed unnecessary: already in hot city, garage empty,
  or Auto Garage toggle is off) does it proceed to the existing jet-travel
  flow. New state: pendingCarTransport (routing flag) and
  carsTransportedForThisTravelBack (one-shot latch, reset to false at every
  site that queues a travel-back, since transporting cars doesn't move the
  player - isInHotCity() alone can't tell "still needs transporting" apart
  from "already handled, waiting on the jet").
  City-name → dropdown-value mapping (ddlCities option values) is hardcoded
  from the six cities currently in the select: Paris=1, Las Vegas=2,
  Sydney=4, London=5, New York=6, Toronto=7. Value "3" hasn't been observed
  - if the hot city ever resolves to a name not in this map, transport is
  skipped with a warning rather than guessing, and the script still flies
  back on schedule.
  Unlike the crusher (which sends exactly one car at a time to dodge a
  "not your car" rejection on gifted cars), this selects and transports ALL
  garage cars in one submission - there's no known equivalent restriction
  on Transport. Revisit doGarage/crusher's per-car pattern here if that
  turns out wrong.

FIX IN v17.47 (same day):
- transportCarsToHotCity() originally read the target city name from
  getHotCity()'s localStorage cache, which is only populated when the
  stats page has been scraped recently and can easily be empty right when
  a travel-back is queued - produced a "no known city-id mapping for hot
  city 'null'" warning and skipped transport entirely. Now, if the cache
  is empty, it detours through travel.aspx first, reads the hot city LIVE
  off the same .hot-marked span doTravelBackToHotCity() already trusts,
  refreshes the cache via saveHotCity(), then continues on to the garage
  once the name is known.

--- v17.46 changelog below ---

TMN TDS Auto v17.46 — changelog

FIX IN v17.46:
- Auto-login stopped auto-submitting after logout: attemptLogin() and
  checkLoginPage() both unconditionally required a non-empty reCAPTCHA
  token before proceeding. When TMN doesn't render a captcha element on
  the login page (getCaptchaToken() finds nothing, returns ""), that
  requirement could never be satisfied, so the auto-submit gate never
  opened - credentials got filled but the button was never clicked, no
  error, no retry, just silently stuck on "Solve captcha to continue..."
  forever. isCaptchaCompleted() already had a no-captcha fallback path
  (button enabled + fields filled = completed) but the token requirement
  downstream of it didn't share that logic. Both functions now check
  whether a captcha element actually exists on the page
  (document.querySelector(TOKEN_SEL)) and only require/compare a token
  when one does; if no captcha is present, a filled+enabled form is
  enough to submit.

--- v17.45 changelog below ---

TMN TDS Auto v17.45 — changelog

NEW IN v17.45:
- Hot City safety net for Auto Travel. Independent of the four existing
  DTM-completion triggers (Complete DTM button, buy-max-drugs, buy-
  prefilled-drugs, DTM completion mail): every
  config.hotCitySafetyCheckInterval (default 30 min, configurable in
  Settings under the new "Auto Travel safety net" option), re-verifies
  you're actually sitting in the hot city and travels back immediately
  (private jet) if not - a backstop for any case where none of the four
  triggers fired (e.g. traveled away manually, or a trigger was missed for
  some other reason).
  Implementation deliberately reuses the exact same pendingTravelBack /
  travelBackQueuedAt / doTravelBackToHotCity machinery as the DTM triggers,
  rather than duplicating the hot-city-comparison or travel-click logic:
  checkHotCitySafetyNet() only ever sets travelBackQueuedAt to a value
  that's already past the existing 22-minute wait, so mainLoop's existing
  gate is satisfied on the very next tick and goes straight to
  navigate-and-check - "immediately" in practice. If you're already in the
  hot city, doTravelBackToHotCity() clears pendingTravelBack right back off
  silently, no travel attempted, no wasted jet cooldown. Won't stomp an
  already-queued/in-progress DTM-triggered travel-back - just waits its
  turn if one's already in flight.
  TRAVEL_BACK_DELAY_MS was hoisted from a mainLoop-local const to module
  scope so both the DTM-trigger gate and this new function share the same
  value instead of risking drift between two copies.

--- v17.44 changelog below ---

TMN TDS Auto v17.44 — changelog

CHANGE IN v17.44:
- Auto Extend Bunker: threshold changed from 24 hours to 48 hours or less
  remaining before the 14-day extension purchase gets queued
  (BUNKER_EXT_THRESHOLD_MS, both the page-label and mail-timestamp detection
  paths use the same constant). Just gives more lead time to actually reach
  the Credits page and complete the purchase before expiry. Settings-page
  tooltip updated to match ("48 hours or less"). No other behavior changed -
  same 75-credit cost, same independence from the deposit toggle, same
  detection paths.

--- v17.43 changelog below ---

TMN TDS Auto v17.43 — changelog

NEW IN v17.43:
- New Telegram alert: Bank Withdrawal. TMN shows a confirmation label after
  a bank withdrawal - "Money from your bank account has been given back to
  you with 5% interest, a total of $36,750,000" - rendered into the same
  generic #ctl00_lblMsg/.TMNErrorFont label the script already reads
  elsewhere for page messages (it's TMN's general message slot, not
  actually always an error). checkForBankWithdrawal() looks for that label
  on every mainLoop tick (same cadence as the existing captcha/low-health/
  logout checks - no extra timer, no page-specific gating needed since the
  label only appears on the page that shows it), pulls out the interest %
  and dollar amount with a regex, and sends a Telegram message once per
  distinct message text. Dedup is via a localStorage-cached copy of the
  last-notified label text (survives reloads/navigation) rather than a
  fixed cooldown, since the dollar amount is different every time and
  there's no natural id to key off - comparing full text is exact and
  cheap. New toggle telegramConfig.notifyBankWithdrawal (default on,
  persisted via GM_setValue like the other notify* flags) plus a matching
  checkbox in the Telegram settings panel.

--- v17.42 changelog below ---

TMN TDS Auto v17.42 — changelog

NEW IN v17.42:
- Auto Extend Bunker now has a second, independent way to notice the bunker
  is about to blow up, triggered from ordinary mailbox activity instead of
  only a playerproperty.aspx page visit. First attempt (mid-development)
  tried matching mail BODY content for the "bunker will blow up" sentence,
  but the actual confirmed mail turned out to have no bunker-related text
  at all - subject "hello", sender "Scream" - so there's nothing to filter
  or match on in the mail itself.
  Final approach: state.bunkerExpiresAt caches the expiry timestamp the
  moment it's read off the page label (doBunkerSubmit already visits that
  page on the usual interval) - now cached unconditionally, not just when
  already due. Then, during the existing unifiedMailCheck() inbox scan,
  each mail row's OWN timestamp (via the existing parseTMNDateFromText
  helper, same one the DTM/OC dedup layers already use - no mail-opening
  needed) is compared against that cached expiry. If any mail's timestamp
  lands within 24h of the cached expiry, state.bunkerExtendPending is set
  directly - the same flag checkAndExtendBunker() already consumes, so the
  Credits-page navigation and Buy click downstream are unchanged.
  Needs the bunker page to have been visited at least once first (to know
  bunkerExpiresAt), but after that, ordinary mail traffic alone is enough
  to notice the 24h window - no further page visit needed. bunkerExpiresAt
  is cleared back to 0 whenever a purchase succeeds or the toggle is
  switched off, so a stale cached expiry can never re-trigger by mistake.
- Fixed a second bug in the same area, same root cause as v17.38: the outer
  mainLoop gate at "PRIORITY 3: Check mail for new invites" (which decides
  whether unifiedMailCheck() runs AT ALL) only checked autoOC/autoDTM/
  autoTravelAfterDTM/Telegram - state.autoBunkerExtend was missing, even
  though unifiedMailCheck()'s own internal gate already included it. So for
  a setup with ONLY Auto Extend Bunker on (no OC/DTM/Travel, no relevant
  Telegram alerts), the mailbox was never scanned at all - the mail-based
  trigger above would have been silently dead code without this fix,
  exactly like the Auto-Travel-only leader case v17.38 fixed for the DTM
  completion mail. Both gates now agree.
- Fixed a timezone bug in parseBunkerExpireDate(): it built the timestamp
  with `new Date(year, month-1, day, ...)`, which interprets the numbers
  in the BROWSER's local timezone. parseTMNDateFromText (used for mail row
  timestamps) already notes TMN server times are UTC and uses Date.UTC()
  for exactly that reason. Comparing a UTC-based mail timestamp against a
  locally-interpreted expiry silently skewed the "hours left" math by the
  browser's UTC offset (e.g. UK BST = UTC+1 in summer). Switched to
  Date.UTC() so both sides of every comparison are apples-to-apples.
- The existing page-label check in doBunkerSubmit() (v17.31/v17.36/v17.40)
  is unchanged in structure and still runs as before - this is purely
  additive. Either path (page visit or mail) can set bunkerExtendPending;
  checkAndExtendBunker() doesn't care which one did it.

--- v17.40 changelog below ---

TMN TDS Auto v17.40 — changelog

FIX IN v17.40:
- Auto Extend Bunker never triggered a navigation to the Credits page, even
  with well under 24h left on the bunker. Root cause: parseBunkerExpireDate()
  matched the expiry label's text against an ANCHORED regex (^...$), which
  requires the entire trimmed label to be nothing but the date/time. The
  real label on playerproperty.aspx is a full sentence with the date
  embedded partway through - "Your bunker will blow up on 5-8-2026
  00:03:09 unless you extend it from the Credits page before that." -
  confirmed from an actual live label. Against a full sentence like that
  the anchored regex never matched, so parseBunkerExpireDate() always
  returned null, bunkerExtendPending was never set to true, and nothing
  downstream (the Credits-page navigation, the Buy click) ever had a
  reason to run. This failed completely silently - the only trace was a
  console.log('Could not parse expiry date text: ...'), nothing visible
  in the on-screen status.
  Fix: dropped the ^ / $ anchors so the same D-M-YYYY HH:MM:SS pattern is
  now pulled out of wherever it sits in the sentence, instead of requiring
  an exact full-string match. Everything downstream (BUNKER_EXT_THRESHOLD_MS
  gate, credits check, Credits-page navigation, Buy click,
  scheduleMailDeletion-style bookkeeping) was already working correctly and
  is unchanged.

--- v17.39 changelog below ---

TMN TDS Auto v17.39 — changelog

NEW IN v17.39:
- DTM completion mail is now auto-deleted 40 minutes after it's confirmed,
  reusing the same generic mail-deletion queue already built for accepted
  OC/DTM invite mails (scheduleMailDeletion/checkAndProcessMailDeletions -
  localStorage-backed {mailId: dueTs} map, ticks the row and clicks Delete
  on the next mailbox visit once due). This runs unconditionally once the
  completion mail is confirmed - it does NOT require
  state.autoTravelAfterDTM to be on, only that the mailbox scan itself is
  running (i.e. at least one of Auto DTM/Auto OC/Auto Travel/the relevant
  Telegram alerts is enabled - if none of those are on, nothing scans mail
  at all, so there's nothing to delete either).
  New constant DTM_COMPLETE_MAIL_DELETE_DELAY_MS (40 min), separate from the
  5-minute MAIL_DELETE_DELAY_MS used for invite mails.
  Point of this: the completion mail's row text can loosely re-match the
  same first-pass filter on a later mailbox scan; leaving it sitting in the
  inbox indefinitely was unnecessary clutter and a latent risk of confusing
  a future scan, so it now gets cleaned up like invite mails already were.

--- v17.38 changelog below ---

TMN TDS Auto v17.38 — changelog

FIX IN v17.38:
- Auto Travel to Hot City after DTM: leaders weren't getting sent back after
  the 22-minute wait. Root cause was the mainLoop gate at "PRIORITY 3: Check
  mail for new invites" (guards whether unifiedMailCheck() runs at all) -
  it only checked state.autoOC, state.autoDTM, or certain Telegram settings.
  unifiedMailCheck()'s own internal gate already includes
  state.autoTravelAfterDTM (added in v17.34, and the v17.34 changelog even
  says the outer gate was widened to match) but that never actually happened
  in the outer gate's code until now.
  Why this hit leaders specifically: the "Complete DTM" button auto-click
  (handleDTMPageAfterAccept) only runs when localStorage's
  tmnPendingDTMHandle flag is 'true', which is only set after auto-accepting
  a DTM invite mail - something only the invited partner does, never the
  leader who creates the DTM. So for a leader, the DTM-completion mail
  notification (4th trigger, v17.34) is the ONLY path that can queue
  pendingTravelBack. If that leader runs with just Auto Travel on (no Auto
  DTM, no Auto OC, no matching Telegram alerts), the outer gate blocked
  unifiedMailCheck() from running at all, so the completion mail was never
  scanned and travel-back never queued - even though everything downstream
  (the 22-min timer, the private jet click) was working fine.
  Fix: added state.autoTravelAfterDTM to the outer gate alongside autoOC/
  autoDTM/Telegram, so the mailbox scan (and therefore the DTM-completion-
  mail trigger) now runs for an Auto-Travel-only leader same as it always
  has for a partner running Auto DTM.

--- v17.37 changelog below ---

TMN TDS Auto v17.37 — changelog

NEW IN v17.37:
- UI only: swapped the display order of Auto Booze and Auto Health in the main
  toggle grid. Auto Health now sits where Auto Booze used to be (right after
  Auto GTA); Auto Booze moved down to where Auto Health used to be (right
  after Auto Jail). Same checkboxes, same IDs, same event listeners, same
  state keys - purely a reorder in the HTML, no behavior change.

--- v17.36 changelog below ---

TMN TDS Auto v17.36 — changelog

NEW IN v17.36:
- Ported Auto Extend Bunker from the v17.31 branch (that branch was off v17.28
  and never had Auto Travel/the toggle-grid reorder, so it had drifted apart
  from this line). Everything else in this file is unchanged from v17.35 -
  this is purely an addition, not a merge of v17.31's other differences.
  Confirmed from the actual page markup: the Artillery Bunker panel
  (playerproperty.aspx) shows an expiry label (ctl00_main_lblArtBunkExpireDate,
  format "D-M-YYYY HH:MM:SS") saying when the bunker blows up, and the Credits
  page has a "Buy" button (ctl00_main_btnArtilleryBunkerExt) that spends 75
  credits for a 14-day extension. New toggle - "Auto Extend Bunker (uses
  credits)" - lives in the Settings modal under Bunker Options, deliberately
  NOT in the main toggle grid and NOT wired into "ALL ON" (same treatment as
  Auto Travel), since it's the kind of thing that should be a conscious opt-in
  given it spends credits automatically.
  Behavior: the expiry label is read as a side effect of the existing bunker
  page visit (same check interval as bullet deposits, no extra navigation
  needed to notice it's due) and the extension is only ever queued once <=24
  hours remain - this 24h gate is hard-coded (BUNKER_EXT_THRESHOLD_MS), not
  configurable. Once queued, it reuses the exact navigate-to-Credits-page +
  click-and-reload pattern already used by Auto Health (the only other
  feature spending credits from this page): if credits are short, it just
  waits and rechecks each tick without navigating anywhere; once there are
  enough, it navigates to the Credits page and clicks Buy, then confirms via
  a Telegram message and reload. Works independently of the bullet-deposit
  toggle (autoBunker) - an extension-only setup with deposits turned off will
  still visit the bunker page on schedule for the expiry check without ever
  touching the deposit form.

--- v17.35 changelog below ---

TMN TDS Auto v17.35 — changelog

CHANGE IN v17.35:
- Main panel UI: the switches grid mixed plain on/off toggles with the 3
  toggles whose labels are also clickable blue links that open a modal
  (Create OC, Whitelist, Online Watch Alerts), scattered in the middle of
  the list. Purely cosmetic reorder - moved all 3 blue-link toggles down
  to the bottom of the grid (after a thin divider), grouped together, so
  the "just a switch" rows and the "switch + click label for options"
  rows are visually separated. No IDs, event listeners, or behavior
  changed - same elements, same state keys, just reordered in the DOM.

--- v17.34 changelog below ---

TMN TDS Auto v17.34 — changelog

CHANGE IN v17.34:
- Auto Travel to Hot City after DTM: added the 4th trigger - a DTM
  completion mail notification - confirmed against a real mail:
    "<b>Drugs Transportation Mission</b><br /><br />
     Congratulations, <partner> and you successfully completed a Drugs
     Transportation Mission in <City> - <Country>. Both participants earned
     $X from this mission! Additionally, you managed to find and smuggle N
     <FMJ/JHP> bullets."
  Detection reuses the existing unifiedMailCheck() mailbox scan (the same
  background poll that already looks for OC/DTM invite mail): each row gets
  a cheap first-pass filter on its text ("drugs transportation mission",
  and not already matched as an invite), then the mail is actually opened
  via gmGet and its body is checked for the more specific "successfully
  completed a Drugs Transportation Mission" phrase before it's trusted as a
  genuine completion signal - the row text alone wasn't confirmed to be
  specific enough to rule out an invite mail using similar wording. Dedup is
  by mail ID (tmnLastDTMCompleteMailId), same pattern as the invite watcher.
  The mail scan's top-level gate was widened so it still runs when only
  Auto Travel is enabled (previously required autoOC/autoDTM/certain
  Telegram settings) - otherwise this trigger would never get a chance to
  see the mailbox at all in an Auto-Travel-only setup.
  All four triggers now queue the same state.pendingTravelBack /
  travelBackQueuedAt: Complete DTM button, buy-max-drugs, buy-prefilled-
  drugs, and this mail notification.

--- v17.33 changelog below ---

TMN TDS Auto v17.33 — changelog

CHANGE IN v17.33:
- Auto Travel to Hot City after DTM: there were three places in the code
  that mark a DTM as completed (Complete DTM button, buy-max-drugs, buy-
  prefilled-drugs), but only the Complete DTM button queued a travel-back.
  The other two now queue it as well (same state.pendingTravelBack /
  travelBackQueuedAt, with an explicit saveState() added since those two
  paths don't otherwise save state before the reload the button click
  triggers).
- NOT yet done: a fourth trigger from a DTM-completion mail notification.
  There's no existing detection for this - startAutoDTMMailWatcher() /
  stopAutoDTMMailWatcher() are empty stub functions, and the only mail
  handling that exists today is for DTM *invite* mail (opening it and
  extracting the accept link), which is a different mail than a completion
  notice. Building this needs an actual sample of that mail (subject line
  and/or body text) rather than a guess - see the request for that.

--- v17.32 changelog below ---

TMN TDS Auto v17.32 — changelog

CHANGE IN v17.32:
- Auto Travel to Hot City after DTM: reworked the trigger and travel mode.
    - Trigger: was gated on the real travel cooldown via
      getTravelTimerStatus() (45-min normal-travel cooldown); now waits a
      fixed 22 minutes from state.travelBackQueuedAt, stamped the moment a
      DTM completes. Simpler than the cooldown-polling approach it replaces,
      and matches the ~20-min real cooldown for private jet with a small
      buffer.
    - Travel mode: was the "Travel (normal)" button
      (ctl00_main_btnTravelNormal); now the "Travel (Private jet*)" button
      (ctl00_main_btnTravelPrivate), confirmed from the live travel.aspx
      markup.
  Same hot-city detection, "skip if already there," and 90s stuck-watchdog
  pause pattern as before - only the timing and the button clicked changed.
  Toggle label/tooltip updated to match ("waits 22 minutes... private jet").
  Note: only the "Complete DTM" button click currently queues this
  travel-back - the two "buy max/prefilled drugs" DTM-completion paths don't
  set state.pendingTravelBack. That's pre-existing from v17.29 and wasn't
  part of this change, but worth knowing if travel-back seems to not fire
  after some DTMs.

--- v17.30 changelog below ---

TMN TDS Auto v17.30 — changelog

UI IN v17.30:
- Shortened the "🛫 Auto Travel to Hot City after DTM" toggle label to
  "🛫 Auto Travel" - the full description is still available as a tooltip on
  hover. The long label was noticeably wider than every other toggle in the
  2-column grid, throwing off the row it shared with "Auto Jail".
- Reordered the toggle grid into logically-grouped, length-matched pairs so
  every row lines up cleanly instead of pairing whatever happened to be
  declared next to each other:
    Auto Crime / ALL ON
    Auto GTA / Auto Booze
    Auto Health / Auto Jail
    🚚 Auto DTM / 🛫 Auto Travel   (grouped together - travel-after-DTM)
    🕵️ Auto OC / 🏢 Create OC
    Auto Garage / 🔫 Auto Bunker
    ⚙️ Auto Scrapyard / Auto Crusher
    🔔 OC/DTM Alerts / Whitelist
    🟢 Online Watch Alerts (full width, unchanged)
  No functionality, IDs, or toggle behavior changed - this is layout only.

--- v17.29 changelog below ---

TMN TDS Auto v17.29 — changelog

NEW IN v17.29:
- Auto Travel to Hot City after DTM. New "🛫 Auto Travel to Hot City after DTM"
  toggle. When a DTM completes, queues a travel-back (state.pendingTravelBack)
  instead of using a fixed timer - it waits for the REAL travel cooldown via
  the existing getTravelTimerStatus() tracker (backed by the background
  travel-timer poller that already runs every 60s) before doing anything. Once
  normal travel is actually available, navigates to travel.aspx and travels to
  whichever city the site itself has marked hot (wrapped in <span class="hot">
  right on the page), using the "Travel (normal)" button specifically - never
  the private jet button. Skips cleanly if already in the hot city, or if no
  hot city is marked on the page. Uses the same "in progress" pause pattern as
  Bunker/Scrapyard (state.travelBackInProgress, 90s stuck-watchdog) so it
  doesn't race navigations with them, and deliberately does NOT claim the
  mainLoop tick while still on cooldown, so crime/GTA/etc keep running
  normally in the meantime. Reuses scheduleOCDTMAction() for the countdown
  display and sends a Telegram notification once travel is initiated. Not
  included in the "Enable All" master toggle since it's a DTM sub-behavior,
  not a standalone recurring automation.

  Note: the real in-game cooldowns are 45 minutes for normal travel and 20
  minutes for private jet (confirmed from the travel.aspx page text) - not the
  22 minutes originally guessed - which is exactly why this checks the live
  status instead of trusting a fixed number.

--- v17.28 changelog below ---

NEW IN v17.28:
- Auto Scrapyard. New "⚙️ Auto Scrapyard" toggle + configurable check interval
  (default 60 min, config.scrapyardCheckInterval). When due, navigates to
  store.aspx?p=s, reads the current scrap balance (ctl00_main_lblScrapBalance)
  and, while there's enough scrap for at least one 1000-FMJ buy (5 scrap per
  the store.aspx?p=s page's own pricing), clicks the Buy link
  (ctl00_main_lbBuy1kFMJScrap). Mirrors the Artillery Bunker's burst pattern:
  lastScrapyardCheck is only reset once a check finds scrap too low for
  another buy, so multiple buys happen back-to-back on successive ticks
  instead of waiting a full interval between each one, then the loop falls
  back to the configured interval (hourly by default) once scrap is drained.
  Uses the same scrapyardCheckInProgress pause pattern as the bunker (and is
  deliberately only evaluated when the bunker didn't already claim the tick)
  so at most one "resource top-up" feature is ever navigating/submitting at a
  time - this is what stops competing navigations from racing each other, per
  the root-cause fix already made for the bunker in v17.27. Included in the
  "Enable All" master toggle.

--- v17.27 changelog below ---

TMN TDS Auto v17.27 — changelog

FIX IN v17.27:
- Artillery Bunker: two problems, one root cause. The bunker interval setting
  seemed to be ignored and the check usually just didn't run (v17.26 symptom
  report), and a first attempt at fixing that (making the bunker check fully
  independent of the crime/GTA/booze/jailbreak priority chain) caused a new
  problem: the automation would just bounce back and forth between pages with
  no action ever completing. Root cause of THAT: safeNavigate() doesn't
  navigate immediately, it schedules the actual page load 1-3s later. The
  independent bunker check and the crime/GTA priority chain could each
  schedule a navigation to a *different* page within that window, so two
  competing navigations ended up racing each other - whichever fired second
  would yank the page away from the first before it ever finished loading,
  over and over.
  Fix: Artillery Bunker now uses a proper pause. The moment a check starts
  (bunkerCheckInProgress, GM-backed so it survives the page reload mid-check),
  crime/GTA/booze/jailbreak/garage are skipped entirely for every tick until
  the check reaches a real end state - submitted with nothing left to
  deposit, no bullets on hand, no bunker panel, missing form controls, or a
  blocking page error. A partial deposit (FMJ done, JHP still to go)
  deliberately leaves the pause on so the next tick finishes the job instead
  of handing the turn to auto-jailbreak (whose 3s interval was the original
  culprit) before JHP gets submitted. Only ONE navigation is ever in flight at
  a time now, which is what stops the back-and-forth. A 90-second watchdog
  clears the pause automatically if something ever gets stuck, so automation
  can't freeze permanently. Crime/GTA/booze/jailbreak/garage priority and
  timing are otherwise unchanged.

--- v17.25 changelog below ---

TMN TDS Auto v17.25 — changelog

FIX IN v17.25:
- Artillery Bunker: JHP was never actually being deposited, and the bunker check
  appeared to "stop" after FMJ. Root cause: the bullet-type dropdown
  (ddlArtBunkBulletType) was selected by a guessed numeric value ('1' for FMJ,
  '2' for JHP) that was never verified against the real page. Setting
  select.value to a value that doesn't match any <option> is a silent no-op, so
  once FMJ was deposited the dropdown just stayed on FMJ - the next cycle then
  tried to submit the JHP amount while still pointed at FMJ (which now has 0 on
  hand), which the game almost certainly rejected. That rejection then tripped
  the script's own blocking-error gate, which shelves the bunker check for a
  full 15 minutes - so from the outside it looked like the loop "stopped after
  FMJ" instead of moving on to JHP.
  Fix: select the dropdown option by matching its visible label text
  ("fmj"/"jhp") instead of a hardcoded value, and dispatch a change event so
  the page picks up the selection. Falls back to the old guessed value (with a
  console warning) only if no option's text matches, so a future mismatch is
  visible instead of silently failing again.

--- v17.24 changelog below ---

TMN TDS Auto v17.24 — changelog

NEW IN v17.24:
- Artillery Bunker auto-deposit. New "🔫 Auto Bunker" toggle + configurable check
  interval (default 15 min, config.bunkerCheckInterval). When due, navigates to
  playerproperty.aspx (base URL, no p= param - this is where the Money/Credits/Bullets/
  Artillery Bunker panel lives), reads on-hand FMJ/JHP straight from the header stats
  bar (ctl00_userInfo_lblfmj / lbljhp - already scraped elsewhere in this script), and
  deposits whichever is available via the real form controls
  (ctl00_main_tbArtBunkAddBullets / ddlArtBunkBulletType / btnArtBunkDeposit). The
  deposit form only takes one bullet type per submit, so if both FMJ and JHP are on
  hand it deposits FMJ first and drains JHP on the very next tick rather than waiting a
  full interval - the 15-minute timer only resets once a check finds nothing left to
  deposit. Reuses the existing scheduleOCDTMAction() countdown helper before clicking
  Deposit, and sends a Telegram notification on success. Runs at the same "own interval,
  lowest priority, doesn't block other automation" tier as Garage, and is included in
  the "Enable All" master toggle.

--- v17.23 changelog below ---

NEW IN v17.23:
- Restored the v17.20 UI behavior of showing the countdown between OC/DTM invite
  action clicks on the panel's status line (e.g. "Completing DTM in 14s..."), not just
  in the console log. Re-added the scheduleOCDTMAction(label, fn) helper (removed in
  v17.22's refactor) and switched all six OC/DTM invite action sites back to it:
  clicking the OC Accept link, clicking the OC role/weapon/car selection button, the
  fallback choose/select button, clicking Complete DTM, buying DTM drugs (max amount),
  and buying DTM drugs when the amount field was already prefilled. The 3-20s
  randomized delay itself (DELAYS.ocDtmAction) is unchanged; only the missing UI
  countdown was added back. As a side fix, the prefilled-drugs buy click was on the
  1.1-1.9s "quick" delay tier instead of the 3-20s OC/DTM tier - it now uses
  scheduleOCDTMAction like the other five, matching v17.20.

--- v17.22 changelog below ---

TMN TDS Auto v17.22 — changelog

NEW IN v17.22:
- OC/DTM action clicks now use a randomized 3-20s delay (DELAYS.ocDtmAction) instead of
  a fixed 2000ms setTimeout or the 1.1-1.9s "quick" tier. Applies to: clicking the OC
  Accept link, clicking the OC role/weapon/car selection button (incl. the fallback
  choose/select button), clicking Complete DTM, and clicking Buy Drugs. Mail-invite
  detection/queueing itself is unchanged - only the on-page action clicks got the wider
  delay, since mainLoop's own tick interval already varies before a pending invite is
  picked up and navigated to.
- Code review pass: confirmed no duplicate function declarations, no colliding
  localStorage key constants, and the v17.22 mail-auto-delete feature (Priority 3.5) is
  correctly gated behind `!state.inJail && !state.isPerformingAction` so it can't
  interrupt an in-progress OC/DTM action. No other bugs found in this pass; this was a
  targeted review rather than a full line-by-line audit of the whole file.

--- v17.22 changelog below ---

NEW IN v17.22:
- Auto-delete accepted OC/DTM invite mails. When an invite's accept URL is stored, the
  mail ID is queued with a due timestamp 5 minutes out (MAIL_DELETE_DELAY_MS). Once due,
  mainLoop Priority 3.5 opens the mailbox, ticks that single row and clicks Delete
  (ctl00_main_btnDelMessage). Queue lives in localStorage so it survives page navigations.
  One deletion per mailbox visit (delete causes a postback). Entries are dropped if the
  mail is already gone, or abandoned 30 minutes past due if the controls never appear.
  Only fires for invites that were actually accepted — whitelist-blocked invites and
  invites where the accept link couldn't be extracted return before queueing.

--- v17.22 merge changelog below ---
Base: v17.22 (trusted). Only the items below were taken from v17.22.

Fixes carried over from v17.22:
- Request timeouts on background GET (gmGet) and Telegram POST so a hung request can't stall the main loop.
- actionStartTime + currentAction writes in the OC-accept, DTM-accept, health-buy and pending-invite handlers so stuck-action recovery has a valid timestamp.
- Split the overloaded humanDelay() helper: humanDelay(range) for action timing, sleepMs(ms) for OC-creation millisecond waits (a duplicate humanDelay() previously clobbered the range version).
- In-flight lock around unifiedMailCheck() to stop overlapping mailbox scans.
- Authenticated captcha submit guard so the same captcha token isn't submitted repeatedly.
- Early logout/timeout Telegram alert on login.aspx (incl. act=out / timeout / session), with a timestamp-based de-dupe instead of a sticky boolean.

Features added:
- Online Watch Alerts: watch up to 10 players and alert (browser notification, tab flash, sound, Telegram) when a watched name appears online.
- Two staff-mail Telegram alerts: 5x on an inbox "Script test" title, and 5x on SQL/Stipe staff inbox messages. Mail gate widened so these scan even when general "New Messages" alerts are off.

Garage:
- Damage is now read via a robust row-scanner (getGarageRowInfo) instead of fixed column positions, BUT the crusher still only sends cars with damage > 0 and skips any car whose damage can't be parsed (crushing an undamaged car flags script usage).
- v17.22's automatic crusher self-re-enable block was deliberately NOT carried over.

No changes intended to bypass site detection or restrictions; reliability/load cleanup only.
*/


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

  // Small browser-notification permission helpers (used by Online Watch)
  function supportsBrowserNotifications() {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  function requestBrowserNotificationPermission() {
    if (!supportsBrowserNotifications()) return Promise.resolve('unsupported');
    try {
      if (Notification.permission === 'default') {
        return Notification.requestPermission().catch(() => 'denied');
      }
      return Promise.resolve(Notification.permission);
    } catch (e) {
      console.warn('[TMN] Browser notification permission request failed:', e);
      return Promise.resolve('denied');
    }
  }

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

  // ---------------------------
  // Early Logout/Timeout Telegram Alert (carried from v17.22)
  // Runs on login.aspx because the script exits early there, before the main
  // Telegram block exists. Uses a short timestamp cooldown + URL-aware key so
  // act=out is caught reliably without spamming on login-page refreshes.
  // ---------------------------
  const LS_LOGOUT_TELEGRAM_SENT = 'tmnLogoutTelegramSent';
  const LS_LOGOUT_TELEGRAM_LAST_TS = 'tmnLogoutTelegramLastTs';
  const LS_LOGOUT_TELEGRAM_LAST_KEY = 'tmnLogoutTelegramLastKey';
  const LOGOUT_TELEGRAM_COOLDOWN_MS = 2 * 60 * 1000;

  function getLogoutAlertKey(urlLower) {
    if (urlLower.includes('act=out')) return 'act-out';
    if (urlLower.includes('timeout')) return 'timeout';
    if (urlLower.includes('session')) return 'session';
    if (urlLower.includes('auto=true')) return 'auto';
    return 'login-page';
  }

  function clearLogoutTelegramDedupState() {
    try {
      localStorage.removeItem(LS_LOGOUT_TELEGRAM_SENT);
      localStorage.removeItem(LS_LOGOUT_TELEGRAM_LAST_TS);
      localStorage.removeItem(LS_LOGOUT_TELEGRAM_LAST_KEY);
    } catch {}
  }

  function wasLogoutTelegramRecentlySent(alertKey) {
    try {
      const legacySent = localStorage.getItem(LS_LOGOUT_TELEGRAM_SENT) === 'true';
      const lastTs = parseInt(localStorage.getItem(LS_LOGOUT_TELEGRAM_LAST_TS) || '0', 10);
      const lastKey = localStorage.getItem(LS_LOGOUT_TELEGRAM_LAST_KEY) || '';
      const fresh = lastTs && (Date.now() - lastTs) < LOGOUT_TELEGRAM_COOLDOWN_MS;

      // Convert the old stuck boolean into timestamp behaviour instead of letting
      // it permanently block future logout/timeout Telegram alerts.
      if (legacySent && !lastTs) {
        localStorage.removeItem(LS_LOGOUT_TELEGRAM_SENT);
        return false;
      }

      return Boolean(fresh && lastKey === alertKey);
    } catch {
      return false;
    }
  }

  function markLogoutTelegramSent(alertKey) {
    try {
      localStorage.setItem(LS_LOGOUT_TELEGRAM_LAST_TS, String(Date.now()));
      localStorage.setItem(LS_LOGOUT_TELEGRAM_LAST_KEY, alertKey);
      localStorage.removeItem(LS_LOGOUT_TELEGRAM_SENT);
    } catch {}
  }

  function sendEarlyLogoutTelegramIfNeeded(source = 'login-page') {
    try {
      const telegramEnabled = GM_getValue('telegramEnabled', false);
      const notifyLogout = GM_getValue('notifyLogout', true);
      const botToken = GM_getValue('telegramBotToken', '');
      const chatId = GM_getValue('telegramChatId', '');
      if (!telegramEnabled || !notifyLogout || !botToken || !chatId) {
        console.log('[Telegram] Logout alert skipped: Telegram disabled, logout notify disabled, or missing bot/chat settings');
        return false;
      }

      const currentUrl = window.location.href.toLowerCase();
      const isLoginUrl = currentUrl.includes('login.aspx');
      const alertKey = getLogoutAlertKey(currentUrl);

      // The act=out URL itself is enough proof. Do not wait for login form DOM,
      // because the script exits early on the login page and the form may not be
      // available at the first check.
      const isExplicitLogoutUrl = alertKey !== 'login-page';
      const hasLoginForm = Boolean(
        document.querySelector('input[name="ctl00$main$txtUsername"], #ctl00_main_txtUsername') ||
        document.querySelector('input[type="password"], #ctl00_main_txtPassword') ||
        document.querySelector('input[value="Login"], input[type="submit"], button[type="submit"]')
      );
      if (!isLoginUrl && !hasLoginForm) return false;
      if (!isExplicitLogoutUrl && !hasLoginForm && document.readyState === 'loading') return false;
      if (wasLogoutTelegramRecentlySent(alertKey)) return false;

      const isAutoLogout = isExplicitLogoutUrl;
      const logoutType = isAutoLogout ? 'AUTO LOGOUT / TIMEOUT' : 'LOGOUT / LOGIN PAGE';
      const reason = isAutoLogout
        ? 'You have been automatically logged out or timed out.'
        : 'The script has landed on the login page and automation cannot continue until login is restored.';

      const message =
        `🚪 <b>${logoutType} DETECTED!</b>\n\n` +
        `Player: ${GM_getValue('playerName', '') || 'Unknown'}\n` +
        `Time: ${formatDateUK()}\n\n` +
        `${reason}\n\n` +
        `URL: ${escapeHtml(window.location.href)}\n` +
        `Source: ${source}\n` +
        '🔑 Please log back in to resume automation';

      markLogoutTelegramSent(alertKey);
      GM_xmlhttpRequest({
        method: 'POST',
        url: `https://api.telegram.org/bot${botToken}/sendMessage`,
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
        onload: function(response) {
          if (response.status === 200) {
            console.log('[Telegram] Early logout/timeout alert sent successfully');
          } else {
            console.error('[Telegram] Early logout/timeout alert failed:', response.status, response.responseText);
            clearLogoutTelegramDedupState();
          }
        },
        onerror: function(error) {
          console.error('[Telegram] Early logout/timeout alert network error:', error);
          clearLogoutTelegramDedupState();
        },
        ontimeout: function() {
          console.error('[Telegram] Early logout/timeout alert timed out');
          clearLogoutTelegramDedupState();
        }
      });
      return true;
    } catch (e) {
      console.warn('[TMN] Early logout Telegram check failed:', e);
      return false;
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
    // Telegram alert must run here because the script exits before the normal Telegram block on login.aspx.
    sendEarlyLogoutTelegramIfNeeded('login-page-start');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => sendEarlyLogoutTelegramIfNeeded('login-page-dom-ready'), { once: true });
    } else {
      setTimeout(() => sendEarlyLogoutTelegramIfNeeded('login-page-ready'), 800);
    }

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
      loginOverlay.textContent = `TMN TDS AutoLogin v17.59\n${message}`;
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
      const captchaPresent = Boolean(document.querySelector(TOKEN_SEL));
      const currentToken = getCaptchaToken();
      // Only require a token when there's actually a captcha element on the
      // page. TMN doesn't always render one (e.g. no-captcha login flow),
      // and in that case waiting on a token that will never appear stalls
      // auto-login forever.
      if (!loginBtn || loginBtn.disabled || (captchaPresent && !currentToken)) {
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
      // A captcha element only needs a fresh, unused token when the site
      // actually renders one. If there's no captcha on the page at all,
      // don't block forever waiting for a token that will never exist.
      const captchaPresent = Boolean(document.querySelector(TOKEN_SEL));
      const tokenReady = !captchaPresent || (currentToken && currentToken !== lastTokenUsed);
      if (loginBtn && !loginBtn.disabled && captchaCompleted && tokenReady) {
        if (!submitTimer) {
          updateLoginOverlay("✅ Captcha completed - auto-submitting...");
          scheduleAutoSubmit(LOGIN_CONFIG.AUTO_SUBMIT_DELAY + Math.floor(Math.random() * 2000));
        }
      } else {
        if (submitTimer && (!captchaCompleted || !tokenReady || (loginBtn && loginBtn.disabled))) {
          clearTimers();
          if (!captchaCompleted) {
            updateLoginOverlay("⏳ Waiting for captcha completion...");
          } else if (!tokenReady) {
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
    localStorage.removeItem(LS_LOGOUT_TELEGRAM_SENT);
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
  let authenticatedCaptchaSubmitScheduled = false;

  function handleAuthenticatedCaptcha() {
    const captchaFrame = document.querySelector('iframe[src*="recaptcha"]');
    const captchaResponse = document.querySelector('textarea[name="g-recaptcha-response"]');

    if (captchaFrame || captchaResponse) {
      const token = captchaResponse?.value?.trim();

      if (token && token.length > 0) {
        // Captcha completed - find and click submit. Guard prevents duplicate clicks
        // while the same captcha token remains visible during slow page loads.
        if (authenticatedCaptchaSubmitScheduled) return;
        const submitBtn = document.querySelector('input[type="submit"], button[type="submit"]') ||
                         document.getElementById('ctl00_main_btnVerify') ||
                         Array.from(document.querySelectorAll('input, button')).find(b =>
                           b.value?.toLowerCase().includes('verify') ||
                           b.textContent?.toLowerCase().includes('verify')
                         );

        if (submitBtn && !submitBtn.disabled) {
          authenticatedCaptchaSubmitScheduled = true;
          console.log('[TMN] Captcha completed - submitting once...');
          setTimeout(() => {
            try { submitBtn.click(); }
            catch (e) {
              authenticatedCaptchaSubmitScheduled = false;
              console.warn('[TMN] Captcha submit click failed:', e);
            }
          }, 1000);
        }
      } else {
        authenticatedCaptchaSubmitScheduled = false;
      }
    } else {
      authenticatedCaptchaSubmitScheduled = false;
    }
  }

  setInterval(handleAuthenticatedCaptcha, 1000);
}

  // Config + State
  // ---------------------------
  const config = {
    crimeInterval: GM_getValue('crimeInterval', 125),
    gtaInterval: GM_getValue('gtaInterval', 245),
    // v17.58 - was 3s in earlier versions, briefly "fixed" to 120s in
    // v17.57 on the (wrong) assumption it should match crime/GTA/booze's
    // multi-minute cooldowns. Corrected per direct feedback: jail's short
    // cadence is intentional, not a bug - bailing other players out isn't
    // gated by an energy/nerve-style server-side cost the way crime/GTA/
    // booze are, so checking frequently is the actual desired behavior.
    // Settled on 4s (up slightly from the original 3s default).
    jailbreakInterval: GM_getValue('jailbreakInterval', 4),
    jailCheckInterval: GM_getValue('jailCheckInterval', 5),
    boozeInterval: GM_getValue('boozeInterval', 120),
    boozeBuyAmount: GM_getValue('boozeBuyAmount', 5),
    boozeSellAmount: GM_getValue('boozeSellAmount', 1),
    healthCheckInterval: GM_getValue('healthCheckInterval', 30),
    garageInterval: GM_getValue('garageInterval', 300),
    // v17.45 - Hot city safety net: how often to independently re-verify
    // we're actually in the hot city, regardless of whether any of the
    // four DTM-completion triggers fired.
    hotCitySafetyCheckInterval: GM_getValue('hotCitySafetyCheckInterval', 1800), // 30 minutes
    // v17.24 - Artillery Bunker: how often to check for on-hand FMJ/JHP to deposit
    bunkerCheckInterval: GM_getValue('bunkerCheckInterval', 900), // 15 minutes
    // v17.28 - Scrapyard: how often to re-check scrap balance for FMJ buys
    // once the burst-buy loop (see doScrapyardSubmit) has drained it below
    // the cost of one buy
    scrapyardCheckInterval: GM_getValue('scrapyardCheckInterval', 3600), // 1 hour
    minHealthThreshold: GM_getValue('minHealthThreshold', 90),
    targetHealth: GM_getValue('targetHealth', 100)
  };

  // v17.58 - Migration for installs that picked up the brief v17.57 bump to
  // 120s. That was based on a mistaken assumption (see comment above) and
  // is being reverted; anyone sitting on that now-also-wrong 120s value
  // gets moved to the real default of 4s. Installs still on the original
  // 3s (from before v17.57 ever ran) or any other custom value are left
  // alone - only the specific v17.57 value gets corrected.
  if (config.jailbreakInterval === 120) {
    console.log('[TMN] Migrating jailbreakInterval from the brief v17.57 default (120s) to 4s');
    config.jailbreakInterval = 4;
    GM_setValue('jailbreakInterval', 4);
  }

  // ---------------------------
  // Human-like Delays (anti-detection)
  // ---------------------------
  const DELAYS = {
    quick: [1100, 1900],
    normal: [1200, 3000],
    slow: [2500, 6000],
    error: [5000, 15000],
    // v17.22 - OC/DTM action clicks (accept role, buy drugs, complete DTM)
    // wait a randomized 3-20s instead of a fixed delay before clicking.
    ocDtmAction: [3000, 20000]
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

  // Range-based human delay (used for action timing).
  // Note: the millisecond-based waiter for OC creation is now a separate
  // helper, sleepMs(), so it no longer clobbers this range version.
  function humanDelay(range = DELAYS.normal) {
    return new Promise(resolve => setTimeout(resolve, randomDelay(range)));
  }

  // v17.23 - Restored from v17.20: schedule an OC/DTM invite action (accept
  // link, role selection, DTM complete/buy) after a randomized 3-20s delay,
  // and show the countdown on the panel status line so it's visible on the UI
  // while the action is pending (not just logged to console).
  function scheduleOCDTMAction(label, fn) {
    const delay = randomDelay(DELAYS.ocDtmAction);
    console.log(`[TMN][OC/DTM DELAY] ${label} in ${Math.round(delay / 1000)}s`);
    updateStatus(`${label} in ${Math.round(delay / 1000)}s...`);
    setTimeout(fn, delay);
    return delay;
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
    notifyInboxScriptTest: GM_getValue('notifyInboxScriptTest', true),
    notifyStaffMailCheck: GM_getValue('notifyStaffMailCheck', true),
    lastMessageCheck: GM_getValue('lastMessageCheck', 0),
    messageCheckInterval: GM_getValue('messageCheckInterval', 60),
    notifySqlCheck: GM_getValue('notifySqlCheck', true),
    notifyLogout: GM_getValue('notifyLogout', true),
    notifyBankWithdrawal: GM_getValue('notifyBankWithdrawal', true)
};

  function saveTelegramConfig() {
    GM_setValue('telegramBotToken', telegramConfig.botToken);
    GM_setValue('telegramChatId', telegramConfig.chatId);
    GM_setValue('telegramEnabled', telegramConfig.enabled);
    GM_setValue('notifyCaptcha', telegramConfig.notifyCaptcha);
    GM_setValue('notifyMessages', telegramConfig.notifyMessages);
    GM_setValue('notifyInboxScriptTest', telegramConfig.notifyInboxScriptTest);
    GM_setValue('notifyStaffMailCheck', telegramConfig.notifyStaffMailCheck);
    GM_setValue('lastMessageCheck', telegramConfig.lastMessageCheck);
    GM_setValue('messageCheckInterval', telegramConfig.messageCheckInterval);
    GM_setValue('notifySqlCheck', telegramConfig.notifySqlCheck);
    GM_setValue('notifyLogout', telegramConfig.notifyLogout);
    GM_setValue('notifyBankWithdrawal', telegramConfig.notifyBankWithdrawal);
  }

  // ---------------------------
  // Online Player Watch Alert Configuration
  // Integrated from TMN2010 Online Watcher v1.0.0
  // ---------------------------
  const ONLINE_WATCH_MAX_NAMES = 10;
  const ONLINE_WATCH_DEFAULT_SCAN_SECONDS = 60;
  const ONLINE_WATCH_MIN_SCAN_SECONDS = 20;
  const ONLINE_WATCH_ALERT_COOLDOWN_MS = 5 * 60 * 1000;
  const ONLINE_WATCH_FETCH_TIMEOUT_MS = 15000;
  const ONLINE_WATCH_PAGE_CANDIDATES = [
    '/authenticated/players.aspx',
    '/Authenticated/players.aspx'
  ];

  const onlineWatchConfig = {
    enabled: GM_getValue('onlineWatchEnabled', false),
    scanSeconds: GM_getValue('onlineWatchScanSeconds', ONLINE_WATCH_DEFAULT_SCAN_SECONDS),
    browserNotify: GM_getValue('onlineWatchBrowserNotify', true),
    tabFlash: GM_getValue('onlineWatchTabFlash', true),
    soundAlert: GM_getValue('onlineWatchSoundAlert', true),
    telegramNotify: GM_getValue('onlineWatchTelegramNotify', true),
    watchList: GM_getValue('onlineWatchList', []),
    lastOnline: GM_getValue('onlineWatchLastOnline', {}),
    lastAlert: GM_getValue('onlineWatchLastAlert', {}),
    lastScanAt: GM_getValue('onlineWatchLastScanAt', 0),
    lastScanOk: GM_getValue('onlineWatchLastScanOk', false),
    lastScanMessage: GM_getValue('onlineWatchLastScanMessage', 'Not scanned yet')
  };

  // Defensive upgrade for older/bad saved data
  if (!Array.isArray(onlineWatchConfig.watchList)) onlineWatchConfig.watchList = [];
  onlineWatchConfig.watchList = onlineWatchConfig.watchList.slice(0, ONLINE_WATCH_MAX_NAMES);
  if (!onlineWatchConfig.lastOnline || typeof onlineWatchConfig.lastOnline !== 'object') onlineWatchConfig.lastOnline = {};
  if (!onlineWatchConfig.lastAlert || typeof onlineWatchConfig.lastAlert !== 'object') onlineWatchConfig.lastAlert = {};
  onlineWatchConfig.scanSeconds = Math.max(
    ONLINE_WATCH_MIN_SCAN_SECONDS,
    Math.min(3600, Number(onlineWatchConfig.scanSeconds || ONLINE_WATCH_DEFAULT_SCAN_SECONDS))
  );

  let onlineWatchTimer = null;
  let onlineWatchInProgress = false;
  let onlineWatchTitleFlashTimer = null;

  function saveOnlineWatchConfig() {
    GM_setValue('onlineWatchEnabled', onlineWatchConfig.enabled);
    GM_setValue('onlineWatchScanSeconds', onlineWatchConfig.scanSeconds);
    GM_setValue('onlineWatchBrowserNotify', onlineWatchConfig.browserNotify);
    GM_setValue('onlineWatchTabFlash', onlineWatchConfig.tabFlash);
    GM_setValue('onlineWatchSoundAlert', onlineWatchConfig.soundAlert);
    GM_setValue('onlineWatchTelegramNotify', onlineWatchConfig.telegramNotify);
    GM_setValue('onlineWatchList', onlineWatchConfig.watchList.slice(0, ONLINE_WATCH_MAX_NAMES));
    GM_setValue('onlineWatchLastOnline', onlineWatchConfig.lastOnline);
    GM_setValue('onlineWatchLastAlert', onlineWatchConfig.lastAlert);
    GM_setValue('onlineWatchLastScanAt', onlineWatchConfig.lastScanAt);
    GM_setValue('onlineWatchLastScanOk', onlineWatchConfig.lastScanOk);
    GM_setValue('onlineWatchLastScanMessage', onlineWatchConfig.lastScanMessage);
  }

  let state = {
    autoCrime: GM_getValue('autoCrime', false),
    autoGTA: GM_getValue('autoGTA', false),
    autoJail: GM_getValue('autoJail', false),
    autoBooze: GM_getValue('autoBooze', false),
    autoHealth: GM_getValue('autoHealth', false),
    // v17.48 - defaults to true (was false) so a fresh install has Auto
    // Garage on out of the box - needed for the car-transport-before-
    // travel-back step to run at all. Only affects installs with no saved
    // value yet; an existing false stays false until toggled in the UI.
    autoGarage: GM_getValue('autoGarage', true),
    // v17.24 - Artillery Bunker auto-deposit
    autoBunker: GM_getValue('autoBunker', false),
    autoCrusher: GM_getValue('autoCrusher', true),
    // crusherOwned: null = unknown (try it), true = owns crusher, false = doesn't own crusher
    crusherOwned: GM_getValue('crusherOwned', null),
    lastCrime: GM_getValue('lastCrime', 0),
    lastGTA: GM_getValue('lastGTA', 0),
    lastJail: GM_getValue('lastJail', 0),
    lastBooze: GM_getValue('lastBooze', 0),
    lastHealth: GM_getValue('lastHealth', 0),
    lastGarage: GM_getValue('lastGarage', 0),
    lastBunkerCheck: GM_getValue('lastBunkerCheck', 0),
    // v17.27 - true while a bunker check (navigate + submit) is actively in
    // progress; other actions are paused until this clears back to false.
    bunkerCheckInProgress: GM_getValue('bunkerCheckInProgress', false),
    // v17.31 - Auto Extend Bunker (credits): separate opt-in from bullet
    // deposits since this spends 75 credits. bunkerExtendPending is set once
    // a bunker-page visit finds <=48h left on the expiry label, and stays
    // set (driving navigation to the Credits page + the buy click) until
    // the purchase actually succeeds - mirrors the existing buyingHealth
    // pattern, the only other feature that already spends credits from this
    // same Credits page.
    autoBunkerExtend: GM_getValue('autoBunkerExtend', false),
    bunkerExtendPending: GM_getValue('bunkerExtendPending', false),
    // v17.42 - cached bunker expiry timestamp (ms), last read off the
    // playerproperty.aspx label. Kept around so the mail-scan trigger
    // (unifiedMailCheck) can compare a fresh mail's own timestamp against
    // it WITHOUT needing another bunker-page visit or opening any mail
    // body - see the v17.42 changelog for why this replaced the earlier
    // open-every-mail-body approach.
    bunkerExpiresAt: GM_getValue('bunkerExpiresAt', 0),
    // v17.28 - Scrapyard auto-buy FMJ (uses spare scrap from the crusher)
    autoScrapyard: GM_getValue('autoScrapyard', false),
    lastScrapyardCheck: GM_getValue('lastScrapyardCheck', 0),
    // true while a scrapyard check (navigate + buy) is actively in progress;
    // same pause pattern as the bunker so navigations never race each other.
    scrapyardCheckInProgress: GM_getValue('scrapyardCheckInProgress', false),
    // v17.29 - travel back to the current hot city (normal travel) after a DTM
    // completes. pendingTravelBack is set true on DTM completion and only
    // cleared once a genuine end state is reached (traveled, already there,
    // no hot city found, or missing controls) - it is NOT time-based; it
    // waits on the real travel cooldown via getTravelTimerStatus().
    // v17.48 - defaults to true (was false), same reasoning as autoGarage
    // above: this is the master switch for the whole travel-back flow
    // (including the new car-transport step ahead of it), so a fresh
    // install should have it on by default. Only affects installs with no
    // saved value yet.
    autoTravelAfterDTM: GM_getValue('autoTravelAfterDTM', true),
    pendingTravelBack: GM_getValue('pendingTravelBack', false),
    // v17.32 - timestamp (ms) of when the DTM completed that queued this
    // travel-back. Replaces the old real-cooldown check (getTravelTimerStatus)
    // with a fixed 22-minute wait, since travel now uses the private jet
    // (20-min real cooldown) rather than normal travel (45-min).
    travelBackQueuedAt: GM_getValue('travelBackQueuedAt', 0),
    // v17.45 - Hot city safety net: independent periodic re-check (see
    // checkHotCitySafetyNet), separate from the four DTM-completion
    // triggers above.
    lastHotCitySafetyCheck: GM_getValue('lastHotCitySafetyCheck', 0),
    travelBackInProgress: GM_getValue('travelBackInProgress', false),
    // v17.46 - Pre-travel-back car transport. Before flying back to the hot
    // city, if we're not already sitting in it, garage cars need to be sent
    // there too (Transport-selected-cars-to dropdown on the garage page) or
    // they get left behind. pendingCarTransport gates mainLoop into the
    // garage-transport step instead of the jet-travel step; carsTransported
    // ForThisTravelBack is a one-shot latch so we don't try to transport
    // again every tick once cars are already gone (transporting cars doesn't
    // move the player, so isInHotCity() alone can't tell "already handled"
    // apart from "still needs handling"). Reset to false everywhere
    // pendingTravelBack is freshly set to true.
    pendingCarTransport: GM_getValue('pendingCarTransport', false),
    carsTransportedForThisTravelBack: GM_getValue('carsTransportedForThisTravelBack', false),
    lastCarTransport: GM_getValue('lastCarTransport', 0),
    selectedCrimes: GM_getValue('selectedCrimes', [1]),
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
    ocType: GM_getValue('ocType', 'Casino'),
    ocRepeatMode: GM_getValue('ocRepeatMode', 'once'),
    ocRepeatsLeft: GM_getValue('ocRepeatsLeft', 0)
  };

  // Debug hook (v17.48) - exposes the live state object to the page console
  // so it can be inspected as `tmnDebugState` without needing Tampermonkey's
  // Storage tab (not present in every TM version/UI). Read-only inspection
  // only; do not edit values through this - use the script's own UI toggles.
  try { unsafeWindow.tmnDebugState = state; } catch (e) { try { window.tmnDebugState = state; } catch (e2) {} }

  let automationPaused = false;

  function saveState() {
    GM_setValue('autoCrime', state.autoCrime);
    GM_setValue('autoGTA', state.autoGTA);
    GM_setValue('autoJail', state.autoJail);
    GM_setValue('autoBooze', state.autoBooze);
    GM_setValue('autoHealth', state.autoHealth);
    GM_setValue('autoGarage', state.autoGarage);
    GM_setValue('autoBunker', state.autoBunker);
    GM_setValue('autoCrusher', state.autoCrusher);
    GM_setValue('crusherOwned', state.crusherOwned);
    GM_setValue('lastCrime', state.lastCrime);
    GM_setValue('lastGTA', state.lastGTA);
    GM_setValue('lastJail', state.lastJail);
    GM_setValue('lastBooze', state.lastBooze);
    GM_setValue('lastHealth', state.lastHealth);
    GM_setValue('lastGarage', state.lastGarage);
    GM_setValue('lastBunkerCheck', state.lastBunkerCheck);
    GM_setValue('bunkerCheckInProgress', state.bunkerCheckInProgress);
    GM_setValue('autoBunkerExtend', state.autoBunkerExtend);
    GM_setValue('bunkerExtendPending', state.bunkerExtendPending);
    GM_setValue('bunkerExpiresAt', state.bunkerExpiresAt);
    GM_setValue('autoScrapyard', state.autoScrapyard);
    GM_setValue('lastScrapyardCheck', state.lastScrapyardCheck);
    GM_setValue('scrapyardCheckInProgress', state.scrapyardCheckInProgress);
    GM_setValue('autoTravelAfterDTM', state.autoTravelAfterDTM);
    GM_setValue('pendingTravelBack', state.pendingTravelBack);
    GM_setValue('travelBackQueuedAt', state.travelBackQueuedAt);
    GM_setValue('lastHotCitySafetyCheck', state.lastHotCitySafetyCheck);
    GM_setValue('travelBackInProgress', state.travelBackInProgress);
    GM_setValue('pendingCarTransport', state.pendingCarTransport);
    GM_setValue('carsTransportedForThisTravelBack', state.carsTransportedForThisTravelBack);
    GM_setValue('lastCarTransport', state.lastCarTransport);
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
    GM_setValue('ocRepeatMode', state.ocRepeatMode);
    GM_setValue('ocRepeatsLeft', state.ocRepeatsLeft);
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

      // If no master or master hasn't sent heartbeat recently, become master immediately.
      // The old code used a 100ms setTimeout which created a race condition: checkMasterStatus
      // returned false (not yet master) before becomeMaster fired, causing mainLoop to show
      // "Secondary tab" even with only one tab open. Now we become master synchronously.
      if (!currentMaster || (now - lastHeartbeat) > this.MASTER_TIMEOUT) {
        const lock = localStorage.getItem(LS_TAB_LOCK);
        if (!lock || (now - parseInt(lock, 10)) > 1000) {
          localStorage.setItem(LS_TAB_LOCK, now.toString());
          this.becomeMaster();
          return true;
        }
        // Another tab holds the lock — wait for next check
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
        'lastStaffScriptMailId', 'lastScriptTestMailId', 'lastNotifiedMailId', 'notifyStaffMailCheck', 'notifyInboxScriptTest',
        'autoBunker', 'lastBunkerCheck', 'bunkerCheckInProgress',
        'autoBunkerExtend', 'bunkerExtendPending', 'bunkerExpiresAt',
        'autoScrapyard', 'lastScrapyardCheck', 'scrapyardCheckInProgress',
        'autoTravelAfterDTM', 'pendingTravelBack', 'travelBackInProgress', 'travelBackQueuedAt', 'lastHotCitySafetyCheck',
        'pendingCarTransport', 'carsTransportedForThisTravelBack', 'lastCarTransport', 'carTransportStartedAt',

        // Config values
        'crimeInterval', 'gtaInterval', 'jailbreakInterval', 'jailCheckInterval', 'boozeInterval',
        'boozeBuyAmount', 'boozeSellAmount', 'bunkerCheckInterval', 'scrapyardCheckInterval',

        // Action tracking
        'actionStartTime',
        'bunkerCheckStartedAt',
        'scrapyardCheckStartedAt',

        // Auto-Resume Config
        'autoResumeEnabled',

        // Online Watch Alert config
        'onlineWatchEnabled', 'onlineWatchScanSeconds', 'onlineWatchBrowserNotify', 'onlineWatchTabFlash',
        'onlineWatchSoundAlert', 'onlineWatchTelegramNotify', 'onlineWatchList', 'onlineWatchLastOnline',
        'onlineWatchLastAlert', 'onlineWatchLastScanAt', 'onlineWatchLastScanOk', 'onlineWatchLastScanMessage',

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

  const TELEGRAM_SEND_TIMEOUT_MS = 15000;

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
      timeout: TELEGRAM_SEND_TIMEOUT_MS,
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
          console.log('[Telegram] Message sent successfully!');
        } else {
          console.error('[Telegram] Failed to send message:', response.status);
          console.error('[Telegram] Response:', response.responseText);
        }
      },
      onerror: function(error) {
        console.error('[Telegram] Network error:', error);
      },
      ontimeout: function() {
        console.error('[Telegram] Send timed out');
      }
    });
  }

  // Repeat a Telegram message N times with a small gap — used for high-urgency
  // staff/script-test inbox alerts so they aren't easy to miss.
  function sendRepeatedTelegramMessage(message, count = 5, delayMs = 1500, label = 'Repeated alert') {
    const repeats = Math.max(1, Math.min(10, parseInt(count, 10) || 5));
    for (let i = 0; i < repeats; i++) {
      setTimeout(() => {
        console.log(`[Telegram] ${label} ${i + 1}/${repeats}`);
        sendTelegramMessage(message);
      }, i * delayMs);
    }
  }

  function sendScriptTestInboxAlert(mailId, sender, subject) {
    const msg =
      '❗ <b>STAFF SCRIPT CHECK!</b>\n\n' +
      `Player: ${state.playerName || 'Unknown'}\n` +
      `Time: ${formatDateUK()}\n\n` +
      '🛑 Inbox message needs a response!\n' +
      `From: ${escapeHtml(sender || 'Unknown')}\n` +
      `Title: <b>${escapeHtml(subject || 'Script test')}</b>\n` +
      `Mail ID: ${escapeHtml(mailId || 'Unknown')}\n\n` +
      '👉 Please open your TMN inbox and respond/check the message.';

    sendRepeatedTelegramMessage(msg, 5, 1500, 'Script test inbox alert');
  }

  function isSqlOrStipeSender(sender) {
    return /^(sql|stipe)$/i.test(String(sender || '').trim());
  }

  function hasSqlOrStipeStaffSignal(sender, subject, rowText, bodyText = '') {
    const combined = `${sender || ''} ${subject || ''} ${rowText || ''} ${bodyText || ''}`;
    return /\b(SQL|Stipe)\b/i.test(combined) &&
           /(script\s*check|staff|admin|answer|question|reply|respond|favourite|favorite|important\s*message|mail|message)/i.test(combined);
  }

  function sendStaffMailCheckAlert(mailId, sender, subject, bodyText = '') {
    const bodyPreview = bodyText ? `\n\n<pre>${escapeHtml(bodyText.substring(0, 500))}</pre>` : '';
    const msg =
      '❗ <b>STAFF SCRIPT CHECK!</b>\n\n' +
      `Player: ${state.playerName || 'Unknown'}\n` +
      `Time: ${formatDateUK()}\n\n` +
      '🛑 SQL/Stipe inbox message needs a response!\n' +
      `From: <b>${escapeHtml(sender || 'Unknown')}</b>\n` +
      `Title: <b>${escapeHtml(subject || 'No subject')}</b>\n` +
      `Mail ID: ${escapeHtml(mailId || 'Unknown')}` +
      bodyPreview +
      '\n\n👉 Please open your TMN inbox and respond/check the message.';

    sendRepeatedTelegramMessage(msg, 5, 1500, 'SQL/Stipe staff mail alert');
  }

  function testTelegramConnection() {
    if (!telegramConfig.botToken || !telegramConfig.chatId) {
      alert('Please configure both Bot Token and Chat ID first!');
      return;
    }

    sendTelegramMessage('🎮 <b>TMN 2010 Automation</b>\n\nTelegram notifications are working!\n\nYou will receive alerts for:\n• Script checks (captcha)\n• New messages\n• Staff script checks (SQL / Stipe page checks)\n• SQL/Stipe inbox staff-check alerts (5x)\n• Inbox Script test alerts (5x)\n• Logout/timeout\n• Low health alerts');
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

  // ---------------------------
  // Bank Withdrawal Telegram Alert
  // ---------------------------
  // TMN renders a confirmation into the generic #ctl00_lblMsg/.TMNErrorFont
  // message label after a bank withdrawal, e.g.:
  //   "Money from your bank account has been given back to you with 5%
  //    interest, a total of $36,750,000"
  // Dedup key is the last-notified label text itself (localStorage-backed,
  // survives reload/navigation) since the amount differs every time and
  // there's no id to key off - an exact text match is enough to know we've
  // already alerted on this particular withdrawal.
  const LS_BANK_WITHDRAWAL_LAST_TEXT = 'tmnBankWithdrawalLastText';
  const BANK_WITHDRAWAL_RE = /Money from your bank account has been given back to you with\s*([\d.]+)%\s*interest,\s*a total of\s*\$?\s*([\d,]+)/i;

  function checkForBankWithdrawal() {
    if (!telegramConfig.enabled || !telegramConfig.notifyBankWithdrawal) return false;

    const msgEl = document.getElementById('ctl00_lblMsg');
    if (!msgEl || !msgEl.classList.contains('TMNErrorFont')) return false;

    const text = (msgEl.textContent || '').trim();
    if (!text) return false;

    const match = text.match(BANK_WITHDRAWAL_RE);
    if (!match) return false;

    let lastSent = '';
    try {
      lastSent = localStorage.getItem(LS_BANK_WITHDRAWAL_LAST_TEXT) || '';
    } catch (e) { /* ignore storage errors */ }

    if (lastSent === text) return false; // already alerted on this exact withdrawal

    try {
      localStorage.setItem(LS_BANK_WITHDRAWAL_LAST_TEXT, text);
    } catch (e) { /* ignore storage errors */ }

    const interestPct = match[1];
    const amount = match[2];

    console.log('[Telegram] Bank withdrawal detected:', text);

    sendTelegramMessage(
      '🏦 <b>Bank Withdrawal Detected!</b>\n\n' +
      `Player: ${state.playerName || 'Unknown'}\n` +
      `Amount: <b>$${amount}</b>\n` +
      `Interest: ${interestPct}%\n` +
      `Time: ${formatDateUK()}`
    );

    console.log('[Telegram] Bank withdrawal notification sent');
    return true;
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

    // Method 2: Check page content for SQL/Stipe script check indicators
    const pageText = document.body.textContent;
    const hasSqlCheck = pageText.includes('SQL Script Check') ||
                        pageText.includes('SQL what your favourite') ||
                        pageText.includes('tell SQL what') ||
                        pageText.includes('Stipe Script Check') ||
                        pageText.includes('Stipe what your favourite') ||
                        pageText.includes('tell Stipe what');

    if ((hasImportantMessage || hasSqlCheck) && !sqlCheckNotificationSent) {
      console.log('[Telegram] Staff Script Check detected! Sending notification...');

      // Try to extract the question
      let question = 'Please answer the admin question';
      const paragraphs = document.querySelectorAll('p, div');
      for (let p of paragraphs) {
        const text = p.textContent;
        if ((text.includes('SQL') || text.includes('Stipe')) && text.includes('?')) {
          question = text.trim();
          break;
        }
      }

      sendTelegramMessage(

        '❗ <b>STAFF SCRIPT CHECK!</b>\n\n' +
        `Player: ${state.playerName || 'Unknown'}\n` +
        `Time: ${formatDateUK()}\n\n` +
        '🛑 Staff needs a response!\n' +
        `Question: ${escapeHtml(question)}\n\n` +
        '👉 Please answer the question to continue'
      );

      sqlCheckNotificationSent = true;
      console.log('[Telegram] Staff script check notification sent');
      return true;
    } else if (!hasImportantMessage && !hasSqlCheck) {
      // Reset flag when no longer on staff check page
      sqlCheckNotificationSent = false;
      // Resume automation if we paused for a staff check
      if (automationPaused) {
        automationPaused = false;
        console.log('[TMN] Staff check cleared — resuming automation');
        updateStatus('Staff check cleared — automation resumed');
      }
    }

    return false;
  }

let logoutNotificationSent = false;

  function checkForLogout() {
    if (!telegramConfig.enabled || !telegramConfig.notifyLogout) {
      return false;
    }

    const currentUrl = window.location.href.toLowerCase();
    const isLoginPageNow = currentUrl.includes('login.aspx');

    if (!isLoginPageNow) {
      if (currentUrl.includes('/authenticated/')) {
        logoutNotificationSent = false;
        clearLogoutTelegramDedupState();
        stopFlashTabTitle();
      }
      return false;
    }

    const isAutoLogout = currentUrl.includes('act=out') ||
                         currentUrl.includes('auto=true') ||
                         currentUrl.includes('timeout') ||
                         currentUrl.includes('session');

    const hasLoginForm = document.querySelector('input[name="ctl00$main$txtUsername"], #ctl00_main_txtUsername') !== null ||
                         document.querySelector('input[type="password"], #ctl00_main_txtPassword') !== null ||
                         document.querySelector('input[value="Login"], input[type="submit"], button[type="submit"]') !== null;

    const alertKey = getLogoutAlertKey(currentUrl);
    const alreadySent = logoutNotificationSent || wasLogoutTelegramRecentlySent(alertKey);
    if ((hasLoginForm || isLoginPageNow) && !alreadySent) {
      console.log('[Telegram] Logout/Login page detected! Sending notification...');
      console.log('[Telegram] URL:', currentUrl);
      console.log('[Telegram] Is auto logout:', isAutoLogout);

      const logoutType = isAutoLogout ? 'AUTO LOGOUT / TIMEOUT' : 'LOGOUT / LOGIN PAGE';
      const reason = isAutoLogout ?
        'You have been automatically logged out or timed out' :
        'You have been sent to the login page';

      markLogoutTelegramSent(alertKey);
      sendTelegramMessage(
        `🚪 <b>${logoutType} DETECTED!</b>\n\n` +
        `Player: ${state.playerName || 'Unknown'}\n` +
        `Time: ${formatDateUK()}\n\n` +
        reason + '\n\n' +
        '🔑 Please log back in to resume automation'
      );

      triggerLogoutAlerts();
      logoutNotificationSent = true;
      console.log('[Telegram] Logout notification sent');
      return true;
    }

    return false;
  }

  // END OF TELEGRAM FUNCTIONS


  // ---------------------------
  // Online Watch Alert Functions
  // ---------------------------
  function normalizeWatchName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function getOnlineWatchAuthBasePath() {
    const match = window.location.pathname.match(/^\/(authenticated)/i);
    return match ? `/${match[1]}` : '/authenticated';
  }

  function getOnlineWatchUrl(path = 'players.aspx') {
    const suffix = String(path).replace(/^\/?(authenticated\/)?/i, '');
    return `${window.location.origin}${getOnlineWatchAuthBasePath()}/${suffix}`;
  }

  function isLikelyLoginDocument(doc) {
    try {
      const text = (doc.body?.textContent || '').toLowerCase();
      return Boolean(
        doc.querySelector('input[type="password"], input[name*="password" i], input[id*="password" i]') ||
        (text.includes('login') && text.includes('password'))
      );
    } catch {
      return false;
    }
  }

  function fetchOnlineWatchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ONLINE_WATCH_FETCH_TIMEOUT_MS);
    return fetch(url, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'X-TMN-Online-Watch': '1' }
    }).finally(() => clearTimeout(timer));
  }

  async function fetchOnlineWatchPage() {
    let lastError = null;

    for (const path of ONLINE_WATCH_PAGE_CANDIDATES) {
      const url = window.location.origin + path;
      try {
        const response = await fetchOnlineWatchWithTimeout(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        if (isLikelyLoginDocument(doc)) throw new Error('Looks logged out. Log in to TMN2010, then scan again.');
        return { doc, url };
      } catch (err) {
        lastError = err;
      }
    }

    try {
      const fallbackUrl = getOnlineWatchUrl('players.aspx');
      const response = await fetchOnlineWatchWithTimeout(fallbackUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      if (isLikelyLoginDocument(doc)) throw new Error('Looks logged out. Log in to TMN2010, then scan again.');
      return { doc, url: fallbackUrl };
    } catch (err) {
      lastError = err;
    }

    throw lastError || new Error('Could not fetch online players page.');
  }

  function parseOnlineWatchPlayers(doc) {
    const map = new Map();
    const links = Array.from(doc.querySelectorAll('a[href*="profile.aspx" i]'));

    for (const link of links) {
      const name = (link.textContent || '').trim().replace(/\s+/g, ' ');
      const href = link.getAttribute('href') || '';
      if (!name || name.length > 40) continue;
      if (/^(profile|view|user|players|online|home|logout)$/i.test(name)) continue;

      const idMatch = href.match(/[?&]id=(\d+)/i);
      map.set(normalizeWatchName(name), {
        name,
        href: new URL(href, window.location.origin).href,
        id: idMatch ? idMatch[1] : ''
      });
    }

    return map;
  }

  function getCurrentOnlineWatchPlayers() {
    try {
      if (!/players\.aspx/i.test(window.location.pathname)) return null;
      return parseOnlineWatchPlayers(document);
    } catch {
      return null;
    }
  }

  function showOnlineWatchBrowserNotification(title, body, url) {
    if (!onlineWatchConfig.browserNotify || !('Notification' in window)) return;

    const showNotification = () => {
      try {
        const notification = new Notification(title, {
          body,
          requireInteraction: true,
          icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
        });
        notification.onclick = () => {
          window.focus();
          if (url) window.open(url, '_blank', 'noopener');
          notification.close();
        };
      } catch (err) {
        console.warn('[TMN][WATCH] Browser notification failed:', err);
      }
    };

    if (Notification.permission === 'granted') {
      showNotification();
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') showNotification();
      }).catch(() => {});
    }
  }

  function playOnlineWatchSound() {
    if (!onlineWatchConfig.soundAlert) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.08;

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      setTimeout(() => { osc.frequency.value = 660; }, 130);
      setTimeout(() => {
        try { osc.stop(); } catch {}
        try { ctx.close(); } catch {}
      }, 280);
    } catch {}
  }

  function flashOnlineWatchTitle(name) {
    if (!onlineWatchConfig.tabFlash) return;
    if (onlineWatchTitleFlashTimer) clearInterval(onlineWatchTitleFlashTimer);

    let count = 0;
    onlineWatchTitleFlashTimer = setInterval(() => {
      document.title = (count % 2 === 0) ? `🟢 ${name} ONLINE` : originalTitle;
      count++;
      if (count > 12) {
        clearInterval(onlineWatchTitleFlashTimer);
        onlineWatchTitleFlashTimer = null;
        document.title = originalTitle;
      }
    }, 1000);
  }

  function shouldOnlineWatchAlert(key, isOnline) {
    const wasOnline = Boolean(onlineWatchConfig.lastOnline[key]);
    const lastAlert = Number(onlineWatchConfig.lastAlert[key] || 0);
    const cooldownOk = Date.now() - lastAlert > ONLINE_WATCH_ALERT_COOLDOWN_MS;
    return isOnline && (!wasOnline || cooldownOk);
  }

  function triggerOnlineWatchAlert(player) {
    const key = normalizeWatchName(player.name);
    onlineWatchConfig.lastAlert[key] = Date.now();
    saveOnlineWatchConfig();

    const message =
      '🟢 <b>TMN2010 WATCH ALERT</b>\n\n' +
      `${escapeHtml(player.name)} is <b>ONLINE</b>\n` +
      `Player: ${escapeHtml(state.playerName || 'Unknown')}\n` +
      `Time: ${formatDateUK()}` +
      (player.href ? `\n${escapeHtml(player.href)}` : '');

    showOnlineWatchBrowserNotification('TMN2010: player online', `${player.name} is online now`, player.href);
    playOnlineWatchSound();
    flashOnlineWatchTitle(player.name);

    if (onlineWatchConfig.telegramNotify) {
      sendTelegramMessage(message);
    }

    updateStatus(`🟢 Watch alert: ${player.name} online`);
    console.log('[TMN][WATCH]', `${player.name} online`, player.href || '');
  }

  async function runOnlineWatchScan(reason = 'timer') {
    if (!onlineWatchConfig.enabled) return;
    if (!tabManager.isMasterTab) return; // prevents duplicate alerts in multiple tabs
    if (onlineWatchInProgress) return;
    if (!onlineWatchConfig.watchList.length) {
      onlineWatchConfig.lastScanAt = Date.now();
      onlineWatchConfig.lastScanOk = true;
      onlineWatchConfig.lastScanMessage = 'Enabled, but no names in watch list';
      saveOnlineWatchConfig();
      renderOnlineWatchUI();
      return;
    }

    onlineWatchInProgress = true;
    renderOnlineWatchStatus('Scanning...', '#f59e0b');

    try {
      let onlineMap = getCurrentOnlineWatchPlayers();
      let source = 'current page';

      if (!onlineMap) {
        const fetched = await fetchOnlineWatchPage();
        onlineMap = parseOnlineWatchPlayers(fetched.doc);
        source = fetched.url;
      }

      for (const rawName of onlineWatchConfig.watchList) {
        const key = normalizeWatchName(rawName);
        const hit = onlineMap.get(key);
        const isOnline = Boolean(hit);

        if (isOnline && shouldOnlineWatchAlert(key, true)) {
          triggerOnlineWatchAlert(hit);
        }

        onlineWatchConfig.lastOnline[key] = isOnline;
      }

      onlineWatchConfig.lastScanAt = Date.now();
      onlineWatchConfig.lastScanOk = true;
      onlineWatchConfig.lastScanMessage = `OK: ${onlineMap.size} online parsed from ${source}`;
      saveOnlineWatchConfig();
      renderOnlineWatchUI();
      console.log(`[TMN][WATCH] Scan complete (${reason}). ${onlineWatchConfig.lastScanMessage}`);
    } catch (err) {
      onlineWatchConfig.lastScanAt = Date.now();
      onlineWatchConfig.lastScanOk = false;
      onlineWatchConfig.lastScanMessage = err?.name === 'AbortError' ? 'Scan timed out' : (err?.message || String(err));
      saveOnlineWatchConfig();
      renderOnlineWatchUI();
      console.warn('[TMN][WATCH] Scan failed:', err);
    } finally {
      onlineWatchInProgress = false;
    }
  }

  function startOnlineWatchScheduler() {
    stopOnlineWatchScheduler();
    if (!onlineWatchConfig.enabled) {
      renderOnlineWatchUI();
      return;
    }

    const scanMs = Math.max(ONLINE_WATCH_MIN_SCAN_SECONDS, Number(onlineWatchConfig.scanSeconds || ONLINE_WATCH_DEFAULT_SCAN_SECONDS)) * 1000;
    onlineWatchTimer = setInterval(() => runOnlineWatchScan('timer'), scanMs);
    setTimeout(() => runOnlineWatchScan('startup'), 2500);
    renderOnlineWatchUI();
  }

  function stopOnlineWatchScheduler() {
    if (onlineWatchTimer) clearInterval(onlineWatchTimer);
    onlineWatchTimer = null;
  }

  function addOnlineWatchPlayer(name) {
    const clean = String(name || '').trim().replace(/\s+/g, ' ');
    if (!clean) return alert('Enter a player name first.');

    if (onlineWatchConfig.watchList.some(existing => normalizeWatchName(existing) === normalizeWatchName(clean))) {
      return alert(`${clean} is already in the watch list.`);
    }

    if (onlineWatchConfig.watchList.length >= ONLINE_WATCH_MAX_NAMES) {
      return alert(`Watch list limit is ${ONLINE_WATCH_MAX_NAMES} players.`);
    }

    onlineWatchConfig.watchList.push(clean);
    onlineWatchConfig.lastOnline[normalizeWatchName(clean)] = false;
    saveOnlineWatchConfig();
    renderOnlineWatchUI();
  }

  function removeOnlineWatchPlayer(name) {
    const key = normalizeWatchName(name);
    onlineWatchConfig.watchList = onlineWatchConfig.watchList.filter(existing => normalizeWatchName(existing) !== key);
    delete onlineWatchConfig.lastOnline[key];
    delete onlineWatchConfig.lastAlert[key];
    saveOnlineWatchConfig();
    renderOnlineWatchUI();
  }

  function formatOnlineWatchLastScan() {
    if (!onlineWatchConfig.lastScanAt) return 'Never scanned';
    return `${formatDateUK(new Date(onlineWatchConfig.lastScanAt))} — ${onlineWatchConfig.lastScanMessage || ''}`;
  }

  function renderOnlineWatchStatus(text, color) {
    if (!shadowRoot) return;
    const statusEl = shadowRoot.querySelector('#tmn-online-watch-status');
    if (statusEl) {
      statusEl.innerHTML = `<span style="color:${color};">●</span> ${escapeHtml(text)}`;
    }
  }

  function renderOnlineWatchUI() {
    if (!shadowRoot) return;

    const mainToggle = shadowRoot.querySelector('#tmn-online-watch-enabled');
    if (mainToggle) mainToggle.checked = onlineWatchConfig.enabled;

    const modalToggle = shadowRoot.querySelector('#tmn-online-watch-modal-enabled');
    if (modalToggle) modalToggle.checked = onlineWatchConfig.enabled;

    const listEl = shadowRoot.querySelector('#tmn-online-watch-list');
    if (listEl) {
      if (!onlineWatchConfig.watchList.length) {
        listEl.innerHTML = '<div class="small text-muted">No watched players added yet.</div>';
      } else {
        listEl.innerHTML = onlineWatchConfig.watchList.map(name => {
          const key = normalizeWatchName(name);
          const isOnline = Boolean(onlineWatchConfig.lastOnline[key]);
          const dotColor = isOnline ? '#22c55e' : '#ca8a04';
          const statusText = isOnline ? 'Online' : 'Offline/unknown';
          return `
            <div class="tmn-watch-row" data-watch-name="${escapeHtml(name)}">
              <span style="color:${dotColor}; font-size: 1rem;">●</span>
              <span>${escapeHtml(name)} <small class="text-muted">(${statusText})</small></span>
              <button type="button" class="btn btn-sm btn-outline-danger tmn-watch-remove" data-watch-name="${escapeHtml(name)}" style="padding:1px 6px;">×</button>
            </div>
          `;
        }).join('');
      }

      listEl.querySelectorAll('.tmn-watch-remove').forEach(btn => {
        btn.addEventListener('click', () => removeOnlineWatchPlayer(btn.getAttribute('data-watch-name')));
      });
    }

    const statusText = onlineWatchConfig.lastScanOk ? formatOnlineWatchLastScan() : (onlineWatchConfig.lastScanMessage || 'Not scanned yet');
    renderOnlineWatchStatus(statusText, onlineWatchConfig.lastScanOk ? '#10b981' : '#ef4444');

    const secondsInput = shadowRoot.querySelector('#tmn-online-watch-seconds');
    if (secondsInput) secondsInput.value = onlineWatchConfig.scanSeconds;

    const browserCb = shadowRoot.querySelector('#tmn-online-watch-browser');
    if (browserCb) browserCb.checked = onlineWatchConfig.browserNotify;

    const tabCb = shadowRoot.querySelector('#tmn-online-watch-tabflash');
    if (tabCb) tabCb.checked = onlineWatchConfig.tabFlash;

    const soundCb = shadowRoot.querySelector('#tmn-online-watch-sound');
    if (soundCb) soundCb.checked = onlineWatchConfig.soundAlert;

    const telegramCb = shadowRoot.querySelector('#tmn-online-watch-telegram');
    if (telegramCb) telegramCb.checked = onlineWatchConfig.telegramNotify;
  }

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
  const LS_LAST_OC_INVITE_MAIL_ID  = "tmnLastOCInviteMailId";
  const LS_LAST_DTM_INVITE_MAIL_ID = "tmnLastDTMInviteMailId";
  const LS_LAST_DTM_COMPLETE_MAIL_ID = "tmnLastDTMCompleteMailId"; // v17.34
  const DTM_COMPLETE_MAIL_DELETE_DELAY_MS = 40 * 60 * 1000; // v17.39 - delete confirmed completion mail 40 min after detection
  const LS_LAST_OC_ACCEPT_TS       = "tmnLastOCAcceptTs";
  const LS_LAST_DTM_ACCEPT_TS      = "tmnLastDTMAcceptTs";
  const LS_PENDING_DTM_URL         = "tmnPendingDTMAcceptURL";
  const LS_PENDING_OC_URL          = "tmnPendingOCAcceptURL";

  // Single unified watcher - no more separate OC/DTM/background watchers racing
  const MAIL_CHECK_INTERVAL_MS     = 60000;            // Check every 60 seconds
  const GM_GET_TIMEOUT_MS          = 20000;            // Prevent hung background requests from stalling automation
  const INVITE_STALE_MS            = 15 * 60 * 1000;   // Ignore OC/DTM invites older than 15 minutes
  const SCRIPT_TEST_MAIL_STALE_MS  = 5 * 60 * 1000;    // Ignore stale Script test inbox alerts

  // --- GM_xmlhttpRequest GET helper (returns html + finalUrl for redirect detection) ---
  function gmGet(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        timeout: GM_GET_TIMEOUT_MS,
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
        ontimeout: () => reject(new Error(`Timeout after ${GM_GET_TIMEOUT_MS}ms for ${url}`)),
      });
    });
  }

  // --- Small time helper used by the staff-mail/script-test alert age checks ---
  function isOlderThanMs(timestamp, maxAgeMs) {
    return timestamp > 0 && timestamp < (Date.now() - maxAgeMs);
  }

  // --- Inbox "Script test" title detector ---
  function isScriptTestInboxMessage(subject, rowText) {
    const title = String(subject || '').trim();
    const full = String(rowText || '');
    return /^script\s*test$/i.test(title) || /\bscript\s*test\b/i.test(full);
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

  // --- Open a mail and check if it's a DTM completion notice (v17.34) ---
  // Confirmed body text (from a real completion mail): "Congratulations,
  // <partner> and you successfully completed a Drugs Transportation
  // Mission in <City> - <Country>. Both participants earned $X from this
  // mission! Additionally, you managed to find and smuggle N <FMJ/JHP>
  // bullets." The mail's bold header is "Drugs Transportation Mission" -
  // same wording an invite mail might use, so this checks the more specific
  // "successfully completed a Drugs Transportation Mission" phrase rather
  // than just the header text, to avoid confusing it with an invite.
  async function checkMailForDTMCompletion(mailHref) {
    const mailURL = toAuthenticatedMailboxURL(mailHref);
    const mailRes = await gmGet(mailURL);
    if (!/\/authenticated\/mailbox\.aspx/i.test(mailRes.finalUrl)) return false;
    return /successfully completed a drugs transportation mission/i.test(mailRes.html || '');
  }

  // ============================================================
  // UNIFIED MAIL WATCHER - Single system handles OC, DTM, and general messages
  // Runs via gmGet (background HTTP) so works regardless of current page
  // Stores pending invites in localStorage so they survive page navigations
  // ============================================================

  // All tracking is now via localStorage - no in-memory state that gets wiped on page nav.
  // In-flight lock prevents overlapping mailbox scans (v17.22 reliability fix).
  let unifiedMailCheckInProgress = false;

  async function unifiedMailCheck() {
    if (unifiedMailCheckInProgress) {
      console.log('[TMN][MAIL] Previous mail check still in progress — skipping overlap');
      return;
    }
    unifiedMailCheckInProgress = true;
    try {
      if (!tabManager.isMasterTab) return;
      // Need at least OC/DTM enabled, Auto Travel (watches for DTM
      // completion mail - v17.34), Auto Extend Bunker (watches for the
      // bunker expiry warning mail - v17.41), or a Telegram inbox/mail
      // alert enabled
      if (!state.autoOC && !state.autoDTM && !state.autoTravelAfterDTM && !state.autoBunkerExtend &&
          !(telegramConfig.enabled && (telegramConfig.notifyMessages || telegramConfig.notifyInboxScriptTest || telegramConfig.notifyStaffMailCheck))) return;

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

        // v17.34 - Check DTM completion mail (4th trigger for the travel-
        // back queue, alongside Complete DTM button + the two buy-drugs
        // paths). Cheap first-pass filter on the row text ("drugs
        // transportation mission", excluding anything that already matched
        // as an invite above), then open the mail to confirm the more
        // specific "successfully completed..." phrase before treating it as
        // a real completion signal - row text alone isn't guaranteed to be
        // specific enough to tell an invite and a completion notice apart.
        // v17.39 - detection/confirmation no longer requires
        // autoTravelAfterDTM - only the pendingTravelBack queuing below
        // does. Once confirmed, the mail is queued for auto-deletion 40 min
        // later (reusing the same scheduleMailDeletion/
        // checkAndProcessMailDeletions machinery as accepted invite mails),
        // unconditionally, so it stops sitting in the inbox where a later
        // scan could re-trip the loose row-text filter and interfere with
        // the auto-travel system.
        const looksLikeDTMComplete = !isDTMInvite && /drugs\s*transportation\s*mission/i.test(rowText);
        if (looksLikeDTMComplete) {
          const lastSeenComplete = localStorage.getItem(LS_LAST_DTM_COMPLETE_MAIL_ID);
          if (lastSeenComplete !== mailId) {
            localStorage.setItem(LS_LAST_DTM_COMPLETE_MAIL_ID, mailId);
            try {
              const confirmed = await checkMailForDTMCompletion(href);
              if (confirmed) {
                console.log(`[TMN][TRAVEL-BACK] DTM completion mail confirmed (id=${mailId})`);
                if (state.autoTravelAfterDTM) {
                  state.pendingTravelBack = true;
                  state.travelBackQueuedAt = Date.now();
                  state.carsTransportedForThisTravelBack = false;
                  GM_setValue('carTransportStartedAt', 0); // v17.49 - fresh cycle, clear any stale watchdog timestamp
                  saveState();
                  console.log('[TMN][TRAVEL-BACK] Will travel back via private jet in 22 minutes');
                }
                scheduleMailDeletion(mailId, DTM_COMPLETE_MAIL_DELETE_DELAY_MS);
                console.log(`[TMN][MAIL] DTM completion mail ${mailId} queued for deletion in 40 min`);
              } else {
                console.log(`[TMN][TRAVEL-BACK] Mail id=${mailId} matched the loose filter but not the confirmed completion phrase - skipped`);
              }
            } catch (e) {
              console.warn('[TMN][TRAVEL-BACK] Error checking mail for DTM completion:', e);
            }
          }
        }

        // v17.41/v17.42 - Auto Extend Bunker: trigger the extension from
        // mail activity without ever opening a mail body or relying on a
        // bunker-page visit. v17.41 tried matching mail content directly,
        // but the confirmed real mail (subject "hello", sender "Scream")
        // has nothing bunker-related in it at all - it's just an ordinary
        // mail. So instead: use each mail row's OWN timestamp (already
        // parseable from the row text via parseTMNDateFromText, same
        // helper the DTM/OC dedup layers use) as a fresh "now" reference,
        // and compare it against state.bunkerExpiresAt - the expiry
        // timestamp cached from the last bunker-page label read (see
        // doBunkerSubmit). Any mail arriving within 48h of that cached
        // expiry queues the extension. This needs the bunker page to have
        // been read at least once to know bunkerExpiresAt in the first
        // place, but after that, ordinary mailbox activity alone is enough
        // to notice the 48h window and trigger - no further page visit or
        // mail-opening required.
        if (state.autoBunkerExtend && !state.bunkerExtendPending && state.bunkerExpiresAt > 0) {
          const mailTs = parseTMNDateFromText(rowText);
          if (mailTs > 0) {
            const msRemaining = state.bunkerExpiresAt - mailTs;
            if (msRemaining <= BUNKER_EXT_THRESHOLD_MS) {
              const hoursLeft = (msRemaining / (1000 * 60 * 60)).toFixed(1);
              console.log(`[TMN][BUNKER-EXT] ${hoursLeft}h left, per mail id=${mailId} timestamp (<=48h) - queuing extension`);
              state.bunkerExtendPending = true;
              saveState();
            }
          }
        }

        if (isDTMInvite && !state.autoDTM) {
          // Auto DTM is off — mark as seen so we don't re-detect it every scan cycle
          localStorage.setItem(LS_LAST_DTM_INVITE_MAIL_ID, mailId);
          continue;
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

          // DEDUP LAYER 4: Age check — skip if mail is older than 15 minutes
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
        if (isOCInvite && !state.autoOC) {
          // Auto OC is off — mark as seen so we don't re-detect it every scan cycle
          localStorage.setItem(LS_LAST_OC_INVITE_MAIL_ID, mailId);
          continue;
        }
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

          // DEDUP LAYER 4: Age check — skip if mail is older than 15 minutes
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

        // Inbox "Script test" alert — mirrors staff script check urgency and repeats 5 times.
        // Uses its own high-water mark so it works even if general "New Messages" alerts are off.
        if (telegramConfig.enabled && telegramConfig.notifyInboxScriptTest && isScriptTestInboxMessage(subject, rowText)) {
          const lastScriptTestMailId = GM_getValue('lastScriptTestMailId', 0);
          const numericMailId = parseInt(mailId, 10) || 0;
          if (numericMailId > Number(lastScriptTestMailId || 0)) {
            GM_setValue('lastScriptTestMailId', numericMailId);

            const scriptTestTs = parseTMNDateFromText(rowText);
            if (isOlderThanMs(scriptTestTs, SCRIPT_TEST_MAIL_STALE_MS)) {
              console.log(`[TMN][MAIL] Script test alert skipped — older than 5min id=${mailId}`);
              continue;
            }

            console.log(`[TMN][MAIL] Script test inbox title detected — alerting 5x id=${mailId}`);
            sendScriptTestInboxAlert(mailId, sender, subject);
            continue;
          }
        }

        // SQL/Stipe staff mail alert — catches staff checks delivered as normal inbox messages.
        // Separate high-water mark prevents repeats and works even when general new-message alerts are off.
        if (telegramConfig.enabled && telegramConfig.notifyStaffMailCheck) {
          const lastStaffMailId = GM_getValue('lastStaffScriptMailId', null);
          const numericMailId = parseInt(mailId, 10) || 0;

          // First run: baseline the mailbox so old SQL/Stipe messages do not spam Telegram after update/install.
          if (lastStaffMailId === null) {
            let maxId = 0;
            for (const row of rows) {
              const rowLink = [...row.querySelectorAll('a[href*="mailbox.aspx"]')].find(a =>
                /[?&]id=\d+/i.test(a.getAttribute("href") || "")
              );
              if (rowLink) {
                const rid = parseInt(parseMailIdFromHref(rowLink.getAttribute("href") || ""), 10) || 0;
                if (rid > maxId) maxId = rid;
              }
            }
            GM_setValue('lastStaffScriptMailId', maxId);
            console.log(`[TMN][MAIL] First run — initialized lastStaffScriptMailId to ${maxId}`);
          } else if (numericMailId > Number(lastStaffMailId || 0)) {
            const mailTs = parseTMNDateFromText(rowText);
            if (isOlderThanMs(mailTs, INVITE_STALE_MS)) {
              GM_setValue('lastStaffScriptMailId', numericMailId);
              console.log(`[TMN][MAIL] SQL/Stipe staff mail skipped — 15min+ old id=${mailId}`);
            } else if (isSqlOrStipeSender(sender) || hasSqlOrStipeStaffSignal(sender, subject, rowText)) {
              GM_setValue('lastStaffScriptMailId', numericMailId);
              let mailContent = '';
              try { mailContent = await fetchMailContentById(href) || ''; } catch (e) { mailContent = ''; }

              if (isSqlOrStipeSender(sender) || hasSqlOrStipeStaffSignal(sender, subject, rowText, mailContent)) {
                console.log(`[TMN][MAIL] SQL/Stipe staff mail detected — alerting 5x id=${mailId}`);
                sendStaffMailCheckAlert(mailId, sender, subject, mailContent);
                continue;
              }
            }
          }
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

            // Age check: only notify for recent mails (last 5 minutes)
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
                `From: ${escapeHtml(sender)}\n` +
                `Subject: ${escapeHtml(subject)}` +
                contentPreview
              );
            } catch (e) {
              // Fallback: send without content
              sendTelegramMessage(
                `📬 <b>New Message!</b>\n\n` +
                `Player: ${state.playerName || 'Unknown'}\n` +
                `From: ${escapeHtml(sender)}\n` +
                `Subject: ${escapeHtml(subject)}`
              );
            }

            continue;
          }
        }
      }

    } catch (e) {
      console.warn("[TMN][MAIL] unifiedMailCheck error:", e);
    } finally {
      unifiedMailCheckInProgress = false;
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
  const ALERTED_TTL_MS          = 24 * 60 * 60 * 1000; // 24 hours

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

      // Queue this invite mail for deletion 5 minutes from now
      scheduleMailDeletion(mailId);

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

      // Queue this invite mail for deletion 5 minutes from now
      scheduleMailDeletion(mailId);

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
    state.currentAction = 'oc';
    GM_setValue('actionStartTime', Date.now());

    // 1) Check if there's still an Accept link to click
    const acceptLink = Array.from(document.querySelectorAll("a"))
      .find(a => {
        const txt = (a.textContent || "").trim().toLowerCase();
        const href = (a.getAttribute("href") || "").toLowerCase();
        return txt === "accept" && href.includes("organizedcrime.aspx");
      });

    if (acceptLink) {
      console.log('[TMN][AUTO-OC] Clicking Accept link on page');
      scheduleOCDTMAction('Clicking OC accept link', () => acceptLink.click());
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
        scheduleOCDTMAction('Selecting OC role item', () => {
          btn.click();
          localStorage.removeItem('tmnPendingOCHandle');
          state.isPerformingAction = false;
          updateStatus("✅ OC role selected — resuming automation");
          sendTelegramMessage(
            '🕵️ <b>OC Role Selected!</b>\n\n' +
            `Player: ${state.playerName || 'Unknown'}\n` +
            '✅ Automation resumed'
          );
        });
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
      scheduleOCDTMAction('Selecting OC fallback role item', () => {
        fallbackBtn.click();
        localStorage.removeItem('tmnPendingOCHandle');
        state.isPerformingAction = false;
        updateStatus("✅ OC role selected — resuming automation");
      });
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
    state.currentAction = 'dtm';
    GM_setValue('actionStartTime', Date.now());

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
      scheduleOCDTMAction('Completing DTM', () => {
        completeBtn.click();
        localStorage.removeItem('tmnPendingDTMHandle');
        localStorage.setItem(LS_LAST_DTM_ACCEPT_TS, String(Date.now())); // Cooldown starts on COMPLETION only
        state.isPerformingAction = false;

        // Set cooldown
        const dtmCooldown = { canDTM: false, totalSeconds: 7200, hours: 2, minutes: 0, seconds: 0, message: "DTM completed", lastUpdate: Date.now() };
        storeDTMTimerData(dtmCooldown);

        // v17.32 - queue a travel back to the current hot city via private
        // jet, after a fixed 22-minute wait (was: real travel cooldown +
        // normal travel button). See doTravelBackToHotCity().
        if (state.autoTravelAfterDTM) {
          state.pendingTravelBack = true;
          state.travelBackQueuedAt = Date.now();
          state.carsTransportedForThisTravelBack = false;
          GM_setValue('carTransportStartedAt', 0); // v17.49 - fresh cycle, clear any stale watchdog timestamp
          saveState();
          console.log('[TMN][TRAVEL-BACK] DTM completed - will travel back via private jet in 22 minutes');
        }

        updateStatus("✅ DTM completed — resuming automation");
        sendTelegramMessage(
          '🚚 <b>DTM Completed!</b>\n\n' +
          `Player: ${state.playerName || 'Unknown'}\n` +
          '✅ 2h cooldown started, automation resumed'
        );
      });
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
      scheduleOCDTMAction(`Buying ${maxAmount} DTM drugs`, () => {
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

        // v17.33 - this DTM-completion path (buy max drugs) previously
        // didn't queue a travel-back, unlike the Complete DTM button path.
        // saveState() here (unlike surrounding lines) because buyButton's
        // click triggers a reload shortly after - without flushing to GM
        // storage now, pendingTravelBack would be lost before the next
        // mainLoop tick ever sees it.
        if (state.autoTravelAfterDTM) {
          state.pendingTravelBack = true;
          state.travelBackQueuedAt = Date.now();
          state.carsTransportedForThisTravelBack = false;
          GM_setValue('carTransportStartedAt', 0); // v17.49 - fresh cycle, clear any stale watchdog timestamp
          saveState();
          console.log('[TMN][TRAVEL-BACK] DTM completed (buy max drugs) - will travel back via private jet in 22 minutes');
        }

        updateStatus("✅ DTM drugs bought — resuming automation");
        sendTelegramMessage(
          '🚚 <b>DTM Drugs Bought!</b>\n\n' +
          `Player: ${state.playerName || 'Unknown'}\n` +
          `Amount: ${maxAmount}\n` +
          '✅ 2h cooldown started, automation resumed'
        );
      });
      return true;
    }

    // If we found input + button but no amount, try buying with the input already populated
    if (drugInput && buyButton && !buyButton.disabled && drugInput.value && parseInt(drugInput.value) > 0) {
      const prefilledAmount = drugInput.value;
      console.log(`[TMN][AUTO-DTM] Input already has value: ${prefilledAmount}, clicking Buy`);
      scheduleOCDTMAction(`Buying prefilled DTM drugs (${prefilledAmount})`, () => {
        buyButton.click();
        const now = Date.now();
        storeDTMTimerData({
          canDTM: false, totalSeconds: 7200, hours: 2, minutes: 0, seconds: 0,
          message: "DTM completed", lastUpdate: now, expiresAt: now + (7200 * 1000)
        });
        localStorage.removeItem('tmnPendingDTMHandle');
        localStorage.removeItem('tmnPendingDTMHandleTs');
        state.isPerformingAction = false;

        // v17.33 - this DTM-completion path (buy prefilled drugs) previously
        // didn't queue a travel-back either. saveState() here since
        // buyButton's click triggers a reload shortly after.
        if (state.autoTravelAfterDTM) {
          state.pendingTravelBack = true;
          state.travelBackQueuedAt = Date.now();
          state.carsTransportedForThisTravelBack = false;
          GM_setValue('carTransportStartedAt', 0); // v17.49 - fresh cycle, clear any stale watchdog timestamp
          saveState();
          console.log('[TMN][TRAVEL-BACK] DTM completed (buy prefilled drugs) - will travel back via private jet in 22 minutes');
        }

        updateStatus("✅ DTM drugs bought — resuming automation");
      });
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

  // ============================================================
  // AUTO-DELETE ACCEPTED OC/DTM INVITE MAILS (5 min after accept)
  // ============================================================
  // When an OC/DTM invite is actually accepted, its mail ID is queued here with a
  // due timestamp. Once due, the next mainLoop tick opens the mailbox, ticks that
  // one row and clicks Delete. Queue lives in localStorage so it survives page navs.
  const LS_PENDING_MAIL_DELETIONS = 'tmnPendingMailDeletions'; // { mailId: dueTs }
  const MAIL_DELETE_DELAY_MS  = 5 * 60 * 1000;   // delete 5 minutes after accepting
  const MAIL_DELETE_GIVEUP_MS = 30 * 60 * 1000;  // drop entry if still unresolved 30min past due

  function getPendingMailDeletions() {
    try {
      const raw = localStorage.getItem(LS_PENDING_MAIL_DELETIONS);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return (obj && typeof obj === 'object') ? obj : {};
    } catch { return {}; }
  }

  function savePendingMailDeletions(obj) {
    try {
      localStorage.setItem(LS_PENDING_MAIL_DELETIONS, JSON.stringify(obj || {}));
    } catch (e) {
      console.warn('[TMN][MAIL] Failed to save pending deletions:', e);
    }
  }

  function scheduleMailDeletion(mailId, delayMs = MAIL_DELETE_DELAY_MS) {
    if (!mailId) return;
    const obj = getPendingMailDeletions();
    obj[String(mailId)] = Date.now() + delayMs;
    savePendingMailDeletions(obj);
    console.log(`[TMN][MAIL] Queued mail ${mailId} for deletion in ${Math.round(delayMs / 60000)} min`);
  }

  // Tick exactly one row and click Delete. Returns:
  //   'clicked'    — delete submitted (page will post back)
  //   'not-found'  — row isn't in the grid any more (already deleted) -> drop entry
  //   'no-control' — grid present but no usable checkbox/delete button -> retry later
  function deleteMailMessageById(mailId) {
    const grid = document.getElementById('ctl00_main_gridMail');
    if (!grid) return 'no-control';

    const rows = Array.from(grid.querySelectorAll('tr')).slice(1);
    let targetRow = null;
    for (const row of rows) {
      const link = [...row.querySelectorAll('a[href*="mailbox.aspx"]')].find(a =>
        /[?&]id=\d+/i.test(a.getAttribute('href') || '')
      );
      if (link && parseMailIdFromHref(link.getAttribute('href')) === String(mailId)) {
        targetRow = row;
        break;
      }
    }
    if (!targetRow) return 'not-found';

    const checkbox = targetRow.querySelector('input[type="checkbox"]');
    if (!checkbox) return 'no-control';

    // Tick the row FIRST — the Delete button may only render once a row is selected.
    grid.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    checkbox.checked = true;
    try { checkbox.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    try { checkbox.dispatchEvent(new Event('click',  { bubbles: true })); } catch (e) {}

    const ticked = Array.from(grid.querySelectorAll('input[type="checkbox"]')).filter(c => c.checked).length;
    if (ticked !== 1) {
      console.warn(`[TMN][MAIL] Delete safety abort — expected 1 ticked box, found ${ticked}`);
      return 'no-control';
    }

    const deleteBtn =
      document.getElementById('ctl00_main_btnDelMessage') ||
      document.querySelector('input[name="ctl00$main$btnDelMessage"]') ||
      document.querySelector('input[id*="btnDelMessage"], input[id*="btnDelete"]') ||
      Array.from(document.querySelectorAll('input[type="submit"], button')).find(b =>
        /^delete$/i.test(((b.value || b.textContent || '')).trim())
      );

    if (!deleteBtn || deleteBtn.disabled) {
      console.log(`[TMN][MAIL] Row ${mailId} ticked but Delete button not available yet — will retry`);
      checkbox.checked = false;
      return 'no-control';
    }

    console.log(`[TMN][MAIL] Deleting invite mail ${mailId}`);
    deleteBtn.click();
    return 'clicked';
  }

  // Returns true if it navigated or submitted something (caller should yield).
  function checkAndProcessMailDeletions() {
    if (!tabManager.isMasterTab) return false;

    const pending = getPendingMailDeletions();
    const ids = Object.keys(pending);
    if (!ids.length) return false;

    const now = Date.now();
    let changed = false;
    const due = [];

    for (const id of ids) {
      const dueTs = Number(pending[id]);
      if (!dueTs || isNaN(dueTs)) { delete pending[id]; changed = true; continue; }
      if (now >= dueTs + MAIL_DELETE_GIVEUP_MS) {
        console.log(`[TMN][MAIL] Giving up on deleting mail ${id} (too old)`);
        delete pending[id];
        changed = true;
        continue;
      }
      if (now >= dueTs) due.push(id);
    }
    if (changed) savePendingMailDeletions(pending);
    if (!due.length) return false;

    // Not on the mailbox page — go there first
    if (getCurrentPage() !== 'mailbox') {
      console.log(`[TMN][MAIL] ${due.length} invite mail(s) due for deletion — opening mailbox`);
      updateStatus('Deleting accepted invite mail...');
      safeNavigate('/authenticated/mailbox.aspx?p=m&' + Date.now());
      return true;
    }

    // On the mailbox page — handle ONE per visit (delete causes a postback)
    for (const id of due) {
      const result = deleteMailMessageById(id);
      if (result === 'clicked') {
        delete pending[id];
        savePendingMailDeletions(pending);
        updateStatus(`Invite mail ${id} deleted`);
        return true;
      }
      if (result === 'not-found') {
        console.log(`[TMN][MAIL] Mail ${id} no longer in inbox — clearing from queue`);
        delete pending[id];
        savePendingMailDeletions(pending);
      }
    }
    return false;
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
    // v17.24 - base playerproperty.aspx (no p= param) shows Money/Credits/Bullets
    // and the Artillery Bunker panel by default.
    if (path.includes('playerproperty.aspx') && !search.includes('p=')) return 'bunker';
    if (path.includes('credits.aspx')) return 'credits';
    if (path.includes('travel.aspx')) return 'travel';
    if (path.includes('store.aspx') && search.includes('p=b')) return 'store';
    if (path.includes('store.aspx') && search.includes('p=s')) return 'scrapyard';
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
      // Buttons might not be rendered yet (page still loading, or script started
      // before DOM was fully ready). Retry once after a short delay before giving up.
      const retryKey = 'tmnCrimeRetryCount';
      const retries = parseInt(localStorage.getItem(retryKey) || '0', 10);
      if (retries < 3) {
        localStorage.setItem(retryKey, String(retries + 1));
        console.log(`[TMN] No crime buttons found — retry ${retries + 1}/3 in 2s`);
        updateStatus(`Crime buttons loading... (retry ${retries + 1}/3)`);
        state.isPerformingAction = false;
        state.currentAction = '';
        GM_setValue('actionStartTime', 0);
        // v17.50 - Force a page reload on retry to ensure fresh DOM. This
        // used to be delayed 2s via setTimeout, but mainLoop reschedules
        // itself every ~1.8-3.2s on its own - the next tick could easily
        // fire before that delayed flag was ever set, meaning the page
        // never actually got told to refresh and the retry counter just
        // burned through itself doing nothing. Set the flag immediately;
        // mainLoop's own scheduling delay already provides the "wait"
        // before the next attempt.
        state.needsRefresh = true;
        saveState();
        return;
      }
      localStorage.removeItem(retryKey);
      updateStatus("No available crime buttons found");
      state.isPerformingAction = false;
      state.currentAction = '';
      // v17.50 - also force a refresh once retries are exhausted (GTA's
      // give-up branch already did this; crime's didn't, so it just stayed
      // permanently stuck reporting "no buttons found" every tick with no
      // way to recover without a manual reload).
      state.needsRefresh = true;
      GM_setValue('actionStartTime', 0);
      saveState();
      return;
    }
    // Clear retry counter on success
    localStorage.removeItem('tmnCrimeRetryCount');

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
      const retryKey = 'tmnGTARetryCount';
      const retries = parseInt(localStorage.getItem(retryKey) || '0', 10);
      if (retries < 3) {
        localStorage.setItem(retryKey, String(retries + 1));
        console.log(`[TMN] No GTA options found — retry ${retries + 1}/3 in 2s`);
        updateStatus(`GTA options loading... (retry ${retries + 1}/3)`);
        state.isPerformingAction = false;
        state.currentAction = '';
        GM_setValue('actionStartTime', 0);
        // v17.50 - set immediately instead of after a 2s setTimeout; see
        // the crime-retry comment above for why the delay was a race bug.
        state.needsRefresh = true;
        saveState();
        return;
      }
      localStorage.removeItem(retryKey);
      updateStatus("No GTA options found - resetting action state");
      state.isPerformingAction = false;
      state.currentAction = '';
      state.needsRefresh = true;
      GM_setValue('actionStartTime', 0);
      saveState();
      return;
    }
    localStorage.removeItem('tmnGTARetryCount');

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
      const retryKey = 'tmnBoozeRetryCount';
      const retries = parseInt(localStorage.getItem(retryKey) || '0', 10);
      if (retries < 3) {
        localStorage.setItem(retryKey, String(retries + 1));
        console.log(`[TMN] No booze options found — retry ${retries + 1}/3 in 2s`);
        updateStatus(`Booze options loading... (retry ${retries + 1}/3)`);
        state.isPerformingAction = false;
        state.currentAction = '';
        GM_setValue('actionStartTime', 0);
        // v17.50 - set immediately instead of after a 2s setTimeout; see
        // the crime-retry comment above for why the delay was a race bug.
        state.needsRefresh = true;
        saveState();
        return;
      }
      localStorage.removeItem(retryKey);
      updateStatus("No booze options available");
      state.isPerformingAction = false;
      state.currentAction = '';
      // v17.50 - also force a refresh once retries are exhausted, same fix
      // as crime's give-up branch above (this one had the identical gap).
      state.needsRefresh = true;
      GM_setValue('actionStartTime', 0);
      saveState();
    }
  }

  function doJailbreak() {
    if (!state.autoJail || state.isPerformingAction || state.inJail || automationPaused) return;

    const now = Date.now();
    if (now - state.lastJail < config.jailbreakInterval * 1000) return;

    // v17.58 - dropped the needsRefresh-triggered forced reload added in
    // v17.57. That flag gets set to true after every successful click (see
    // below) - with a 120s+ cooldown a follow-up forced reload on the next
    // entry was a rounding error, but now that the cooldown is intentionally
    // just 4s, forcing an extra reload on top of the click's own natural
    // postback reload every single cycle would double navigation overhead
    // right when the whole point is to check as fast as possible. Only
    // navigate if we're not actually on the jail page at all.
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
      // v17.57 - was explicitly force-navigating back to jail.aspx via
      // safeNavigate() a fixed 1.1-1.9s after the click, regardless of
      // whether the click's own __doPostBack had actually finished. If the
      // server hadn't responded yet, that forced navigation could cancel
      // the in-flight postback outright - the click would be logged as
      // "attempted" but the actual bail-out might never complete
      // server-side. Just letting the click's natural postback reload
      // happen on its own, with no explicit follow-up action needed here -
      // v17.58 also dropped the needsRefresh fallback flag itself (see
      // above), since with a 4s cooldown any lingering staleness gets
      // caught by the next cycle anyway.
      saveState();

      setTimeout(() => {
        state.isPerformingAction = false;
        state.currentAction = '';
        GM_setValue('actionStartTime', 0);
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
        GM_setValue('actionStartTime', Date.now());
        console.log(`[TMN] Buying health - current: ${health}%`);
        updateStatus(`Buying health (${health}% -> ${Math.min(100, health + 10)}%)`);
        buyBtn.click();

        // After purchase, reload to continue buying if needed
        setTimeout(() => {
          state.isPerformingAction = false;
          state.currentAction = '';
          GM_setValue('actionStartTime', 0);
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
  // Artillery Bunker 14-Day Extension (v17.31, ported v17.36)
  // ---------------------------
  // Kept as a separate opt-in from bullet deposits (autoBunker) since this
  // spends 75 credits - its toggle lives in the Settings page, not the main
  // toggle grid. Detection happens as a side-effect of the existing bunker
  // page visit in doBunkerSubmit() (no extra navigation needed to notice
  // it's due); the purchase itself reuses the exact same navigate-to-
  // Credits-page + click-and-reload pattern as checkAndBuyHealth above,
  // since it's the same page and the same kind of action.

  // Bunker expiry is shown as "D-M-YYYY HH:MM:SS" (day-month-year - a
  // reading like "5-8-2026" as Aug 5 fits a few days out from today,
  // whereas May 8 would already be in the past). Returns a timestamp, or
  // null if the text doesn't match.
  function parseBunkerExpireDate(text) {
    // v17.40 - was anchored (^...$), which required the label's ENTIRE
    // trimmed text to be nothing but the date. The real label is a full
    // sentence with the date embedded in the middle - e.g. "Your bunker
    // will blow up on 5-8-2026 00:03:09 unless you extend it from the
    // Credits page before that." - so the anchored version never matched
    // anything, ever, and bunkerExtendPending never got set (silently -
    // only a console.log, nothing visible in the on-screen status).
    // Un-anchored: pull the D-M-YYYY HH:MM:SS pattern out of wherever it
    // sits in the sentence instead of requiring an exact full-string match.
    const m = (text || '').match(/(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    const hour = parseInt(m[4], 10);
    const minute = parseInt(m[5], 10);
    const second = parseInt(m[6], 10);
    // v17.42 - was `new Date(year, month-1, day, ...)`, which builds the
    // timestamp in the BROWSER's local timezone. parseTMNDateFromText
    // (used for mail row timestamps, right above) already notes TMN server
    // times are UTC and uses Date.UTC() for exactly that reason. Comparing
    // a UTC mail timestamp against a locally-interpreted expiry silently
    // skews the "hours left" math by the browser's UTC offset (e.g. UK
    // BST = UTC+1 in summer) - close enough to explain why the 24h gate
    // could fire early/late/never depending on time of year and machine.
    // Switched to Date.UTC() so both timestamps are apples-to-apples.
    const ts = Date.UTC(year, month - 1, day, hour, minute, second);
    return isNaN(ts) ? null : ts;
  }

  const BUNKER_EXT_COST = 75; // credits, from the Credits page "Purchase items" table
  const BUNKER_EXT_THRESHOLD_MS = 48 * 60 * 60 * 1000; // only act with <=48h left

  function checkAndExtendBunker() {
    if (!state.autoBunkerExtend || state.isPerformingAction || automationPaused) return;
    if (!state.bunkerExtendPending) return; // Nothing queued - nothing to do

    const credits = getCredits();

    if (credits < BUNKER_EXT_COST) {
      // Cheap check, no navigation - just wait and try again next tick in
      // case credits arrive. Doesn't disable the toggle (unlike Auto
      // Health) since a 75-credit lump sum recurring every ~14 days is a
      // normal thing to not have on hand every moment it's checked.
      updateStatus(`Bunker expiring soon - need ${BUNKER_EXT_COST} credits (have ${credits})`);
      return;
    }

    // If not on credits page, navigate there
    if (!/\/authenticated\/credits\.aspx$/i.test(location.pathname)) {
      updateStatus("Bunker expiring soon - navigating to buy extension");
      console.log('[TMN][BUNKER-EXT] Navigating to Credits page to extend bunker');
      setTimeout(() => location.href = '/authenticated/credits.aspx', 1500);
      return;
    }

    // On credits page - buy the extension
    const extBtn = document.querySelector('#ctl00_main_btnArtilleryBunkerExt');
    if (extBtn) {
      state.isPerformingAction = true;
      state.currentAction = 'bunkerExtend';
      GM_setValue('actionStartTime', Date.now());
      saveState();
      console.log(`[TMN][BUNKER-EXT] Buying Artillery Bunker 14-day extension (${BUNKER_EXT_COST} credits)`);
      updateStatus(`Extending Artillery Bunker (14 days, ${BUNKER_EXT_COST} credits)...`);
      extBtn.click();

      setTimeout(() => {
        state.isPerformingAction = false;
        state.currentAction = '';
        GM_setValue('actionStartTime', 0);
        state.bunkerExtendPending = false;
        // v17.42 - clear the cached expiry too: it's now 14 days stale, so
        // leaving it in place would make the mail-scan trigger immediately
        // re-fire bunkerExtendPending off the old timestamp on the very
        // next mail. It'll get repopulated next time the bunker page is
        // visited (doBunkerSubmit).
        state.bunkerExpiresAt = 0;
        saveState();
        updateStatus("✅ Artillery Bunker extended 14 days");
        sendTelegramMessage(
          '🔫 <b>Bunker Extended</b>\n\n' +
          `Player: ${state.playerName || 'Unknown'}\n` +
          `+14 days for ${BUNKER_EXT_COST} credits`
        );
        location.reload();
      }, 1500);
    } else {
      // Button not found - Credits page layout may have changed. Don't
      // clear bunkerExtendPending; it'll simply retry on the next tick /
      // next visit rather than silently giving up.
      console.log('[TMN][BUNKER-EXT] Extend button not found on Credits page');
      updateStatus("Bunker extend button not found on Credits page");
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

  // Robust garage row parser. TMN has changed garage table column order before,
  // so do not rely on row.children[1] for the car name or row.children[4] for damage.
  // This finds the known car model anywhere in the row text and extracts the first
  // percentage-looking value as damage. It also returns damageParsed so the crusher
  // can tell "0% damage" apart from "couldn't read damage" and skip the latter.
  function escapeRegExp(str) {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getGarageRowInfo(row) {
    const text = (row ? row.textContent : '').replace(/\s+/g, ' ').trim();
    const cells = row ? Array.from(row.children) : [];
    let carName = '';

    // Prefer exact known model names found in the whole row. Sort longest first so
    // a shorter name cannot win over a longer specific model.
    const knownHit = KNOWN_CARS
      .slice()
      .sort((a, b) => b.name.length - a.name.length)
      .find(car => new RegExp(`(^|\\b)${escapeRegExp(car.name)}($|\\b)`, 'i').test(text));
    if (knownHit) {
      carName = knownHit.name;
    } else {
      // Fallback: use the first non-checkbox cell that looks like text rather than
      // money, damage, location-only, or an action column.
      for (const cell of cells) {
        const t = (cell.textContent || '').replace(/\s+/g, ' ').trim();
        if (!t) continue;
        if (/^\d+%$/.test(t)) continue;
        if (/^\$?[\d,]+$/.test(t)) continue;
        if (/^(sell|repair|crush|location|value|damage)$/i.test(t)) continue;
        if (cell.querySelector('input[type="checkbox"]')) continue;
        carName = t;
        break;
      }
    }

    let damage = 0;
    const pctMatch = text.match(/(\d{1,3})\s*%/);
    if (pctMatch) damage = Math.max(0, Math.min(100, parseInt(pctMatch[1], 10) || 0));
    // damageParsed lets the crusher distinguish a genuine 0% from an unreadable cell.
    const damageParsed = !!pctMatch;

    return {
      carName,
      damage,
      damageParsed,
      checkbox: row ? row.querySelector('input[type="checkbox"]') : null,
      text
    };
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
  const LS_GIFTED_MODELS_PREFIX  = 'tmnGiftedModels_';
  const LS_PENDING_CRUSH_NAME    = 'tmnPendingCrushName';
  const LS_CRUSHER_FULL_UNTIL    = 'tmnCrusherFullUntil';
  const LS_CRUSHER_LOOP_COUNT    = 'tmnCrusherLoopCount';
  const CRUSHER_ERROR_REGEX      = /you can only crush cars that you stole yourself/i;
  const CRUSHER_FULL_REGEX       = /crusher queue full|daily capacity reached/i;
  const CRUSHER_FULL_PAUSE_MS    = 60 * 60 * 1000;   // 1 hour
  const GIFTED_MODEL_COOLDOWN_MS = 30 * 60 * 1000;   // 30 minutes
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
          // STRICT damage > 0: crushing an undamaged car flags script usage, so we
          // only ever send a car that genuinely shows damage. getGarageRowInfo's
          // robust row-scan is used ONLY to read name+damage reliably; if the damage
          // can't be parsed (damageParsed === false) we skip the car entirely.
          let chosenRow = null;
          let chosenName = '';
          for (const row of carRows) {
            const info = getGarageRowInfo(row);
            const carName = info.carName;
            const damage = info.damage;
            const damageParsed = info.damageParsed;
            const checkbox = info.checkbox;
            // Skip: missing checkbox/name, manual-only cars, non-crusher cars, OC cars,
            // unreadable damage, undamaged cars, models on a gifted cooldown
            if (!checkbox || !carName) continue;
            if (isManualOnlyCar(carName)) continue;
            if (!isCrusherCar(carName)) continue;
            if (isVIPCar(carName)) continue;
            if (!damageParsed) continue;   // couldn't read damage — never risk it
            if (damage <= 0) continue;     // strict: only crush genuinely damaged cars
            if (isModelOnGiftedCooldown(carName)) continue;
            chosenRow = row;
            chosenName = carName;
            break;
          }

          if (chosenRow) {
            // Uncheck EVERYTHING in the entire car table first — not just rows we know
            // about, but the Check All header checkbox and any stray checkboxes too.
            // Belt-and-braces against a multi-car submission.
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
      const info = getGarageRowInfo(row);
      const carName = info.carName;
      const checkbox = info.checkbox;
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
      const info = getGarageRowInfo(row);
      const carName = info.carName;
      const damage = info.damage;
      const checkbox = info.checkbox;

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
  // Artillery Bunker Auto-Deposit (v17.24)
  // ---------------------------
  // Periodically (config.bunkerCheckInterval, default 15 min) checks on-hand
  // FMJ/JHP (already scraped from the header stats bar) and deposits whatever
  // is available into the Artillery Bunker on playerproperty.aspx. The
  // deposit form only accepts one bullet type + amount per submit, so if both
  // FMJ and JHP are on hand, this drains one type per visit and the next
  // mainLoop tick immediately picks up the other - the 15-minute timer is
  // only reset once a check finds nothing left to deposit.
  function doBunkerSubmit() {
    if (state.isPerformingAction || state.inJail || automationPaused) return;
    // v17.31 - autoBunkerExtend is a separate opt-in from autoBunker
    // (deposits). Either one alone is enough reason to visit the bunker
    // page on the usual interval - deposits happen if autoBunker is on and
    // there's something to deposit; the expiry check below happens
    // regardless, so extension-only setups (autoBunker off) still work.
    if (!state.autoBunker && !state.autoBunkerExtend) return;

    const now = Date.now();
    if (now - state.lastBunkerCheck < config.bunkerCheckInterval * 1000) return;

    if (getCurrentPage() !== 'bunker') {
      updateStatus("Navigating to Artillery Bunker...");
      safeNavigate('/authenticated/playerproperty.aspx?' + Date.now());
      return;
    }

    const bunkerPanel = document.getElementById('ctl00_main_pnlArtilleryBunker');
    if (!bunkerPanel) {
      // Bunker panel not present - e.g. it may have expired/blown up, or a
      // different sub-tab rendered. Don't spin on this every tick.
      console.log('[TMN][BUNKER] Artillery Bunker panel not found on page');
      updateStatus("Artillery Bunker not found");
      state.lastBunkerCheck = now;
      state.bunkerCheckInProgress = false;
      GM_setValue('bunkerCheckStartedAt', 0);
      saveState();
      return;
    }

    // BLOCKING-ERROR GATE - same pattern as garage: if there's an unrelated
    // TMN error on the page (jail, hospital, etc.), don't touch the form.
    {
      const errEl = document.getElementById('ctl00_lblMsg');
      const errTxt = (errEl && errEl.classList.contains('TMNErrorFont')) ? (errEl.textContent || '').trim() : '';
      if (errTxt) {
        console.log(`[TMN][BUNKER] Blocking error on page, aborting cycle: "${errTxt.substring(0, 160)}"`);
        updateStatus(`Bunker blocked: ${errTxt.substring(0, 60)}`);
        state.lastBunkerCheck = now;
        state.bunkerCheckInProgress = false;
        GM_setValue('bunkerCheckStartedAt', 0);
        saveState();
        return;
      }
    }

    // v17.31 - Auto Extend Bunker: check the expiry label while we're
    // already here, regardless of what happens with deposits below. Only
    // ever queues the extension when <=48h are left - this is the hard
    // gate the whole feature is built around.
    // v17.42 - always cache the parsed timestamp into state.bunkerExpiresAt
    // (even when it's not yet due), regardless of the autoBunkerExtend
    // toggle or whether bunkerExtendPending is already set. This is what
    // lets the mail-scan trigger in unifiedMailCheck compare a fresh
    // mail's own timestamp against a KNOWN expiry later, without needing
    // another page visit in between.
    if (state.autoBunkerExtend) {
      const expireEl = document.getElementById('ctl00_main_lblArtBunkExpireDate');
      const expiresAt = expireEl ? parseBunkerExpireDate(expireEl.textContent) : null;
      if (expiresAt) {
        if (expiresAt !== state.bunkerExpiresAt) {
          state.bunkerExpiresAt = expiresAt;
          saveState();
        }
        if (!state.bunkerExtendPending) {
          const msRemaining = expiresAt - now;
          if (msRemaining <= BUNKER_EXT_THRESHOLD_MS) {
            const hoursLeft = (msRemaining / (1000 * 60 * 60)).toFixed(1);
            console.log(`[TMN][BUNKER-EXT] ${hoursLeft}h left on bunker (<=48h) - queuing extension`);
            state.bunkerExtendPending = true;
            saveState();
          }
        }
      } else if (expireEl) {
        console.log('[TMN][BUNKER-EXT] Could not parse expiry date text:', expireEl.textContent);
      }
    }

    // On-hand bullets come from the header stats bar, present on every page.
    // Deposits only happen if autoBunker itself is on - an extension-only
    // setup (autoBunker off, autoBunkerExtend on) should visit this page for
    // the expiry check above but never touch the deposit form.
    if (!state.autoBunker) {
      state.lastBunkerCheck = now;
      state.bunkerCheckInProgress = false;
      GM_setValue('bunkerCheckStartedAt', 0);
      saveState();
      return;
    }

    // On-hand bullets come from the header stats bar, present on every page.
    const fmjEl = document.getElementById('ctl00_userInfo_lblfmj');
    const jhpEl = document.getElementById('ctl00_userInfo_lbljhp');
    const fmjOnHand = fmjEl ? (parseInt(fmjEl.textContent.trim(), 10) || 0) : 0;
    const jhpOnHand = jhpEl ? (parseInt(jhpEl.textContent.trim(), 10) || 0) : 0;

    if (fmjOnHand <= 0 && jhpOnHand <= 0) {
      updateStatus("Bunker: no FMJ/JHP on hand to deposit");
      state.lastBunkerCheck = now;
      state.bunkerCheckInProgress = false;
      GM_setValue('bunkerCheckStartedAt', 0);
      saveState();
      return;
    }

    const amtInput = document.getElementById('ctl00_main_tbArtBunkAddBullets');
    const typeSelect = document.getElementById('ctl00_main_ddlArtBunkBulletType');
    const depositBtn = document.getElementById('ctl00_main_btnArtBunkDeposit');
    if (!amtInput || !typeSelect || !depositBtn) {
      console.log('[TMN][BUNKER] Deposit form controls not found');
      updateStatus("Bunker deposit form not found");
      state.lastBunkerCheck = now;
      state.bunkerCheckInProgress = false;
      GM_setValue('bunkerCheckStartedAt', 0);
      saveState();
      return;
    }

    // Deposit FMJ first if available, else JHP. Whichever type is left (if
    // any) gets picked up on the very next tick after this postback reloads
    // the page - lastBunkerCheck is deliberately NOT updated here, only in
    // the "nothing to deposit" branch above.
    const depositFMJ = fmjOnHand > 0;
    const amount = depositFMJ ? fmjOnHand : jhpOnHand;

    // v17.25 fix: don't assume the dropdown's underlying option values (the
    // previous '1'/'2' guess left JHP unselectable - setting select.value to
    // a value that doesn't exist on any <option> is a silent no-op, so the
    // dropdown stayed on FMJ and JHP was never actually submitted). Match by
    // the option's visible label text instead, which is robust regardless of
    // what value attribute the page actually uses.
    const wantedLabel = depositFMJ ? 'fmj' : 'jhp';
    const matchedOption = Array.from(typeSelect.options || [])
      .find(o => (o.textContent || o.value || '').trim().toLowerCase().includes(wantedLabel));
    if (matchedOption) {
      typeSelect.value = matchedOption.value;
    } else {
      // Fallback to the old guess only if we can't find the option by text -
      // logged so a future mismatch is visible instead of silently failing.
      console.warn(`[TMN][BUNKER] Could not find "${wantedLabel}" option by text - falling back to guessed value`);
      typeSelect.value = depositFMJ ? '1' : '2';
    }
    try { typeSelect.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
    amtInput.value = String(amount);

    state.isPerformingAction = true;
    state.currentAction = 'bunker';
    GM_setValue('actionStartTime', now);
    saveState();

    console.log(`[TMN][BUNKER] Depositing ${amount} ${depositFMJ ? 'FMJ' : 'JHP'}`);
    scheduleOCDTMAction(
      `🔫 Depositing ${amount} ${depositFMJ ? 'FMJ' : 'JHP'} to Artillery Bunker`,
      () => {
        depositBtn.click();
        state.isPerformingAction = false;
        state.currentAction = '';
        GM_setValue('actionStartTime', 0);
        saveState();
        updateStatus(`✅ Deposited ${amount} ${depositFMJ ? 'FMJ' : 'JHP'} to bunker`);
        sendTelegramMessage(
          '🔫 <b>Bunker Deposit</b>\n\n' +
          `Player: ${state.playerName || 'Unknown'}\n` +
          `Deposited: ${amount} ${depositFMJ ? 'FMJ' : 'JHP'}\n` +
          (depositFMJ && jhpOnHand > 0 ? 'JHP still on hand - will deposit next cycle' : '✅ Automation resumed')
        );
      }
    );
  }

  // ---------------------------
  // Scrapyard Auto-Buy FMJ (v17.28)
  // ---------------------------
  // Spends spare scrap (from the crusher) on 1000-FMJ buys at the Scrapyard
  // (store.aspx?p=s) whenever there's enough scrap for at least one buy.
  // Same pause pattern as the Artillery Bunker: the check "burst buys" every
  // tick without waiting for the full interval as long as scrap remains, and
  // only resets lastScrapyardCheck (falling back to the normal hourly
  // cadence) once the balance drops below the cost of a single buy.
  const SCRAPYARD_FMJ_COST = 5; // scrap cost per 1000 FMJ, from the store page label
  function doScrapyardSubmit() {
    if (!state.autoScrapyard || state.isPerformingAction || state.inJail || automationPaused) return;

    const now = Date.now();

    if (getCurrentPage() !== 'scrapyard') {
      updateStatus("Navigating to Scrapyard...");
      safeNavigate('/authenticated/store.aspx?p=s&' + Date.now());
      return;
    }

    const scrapPanel = document.getElementById('ctl00_main_pnlScrapyardContainer');
    if (!scrapPanel) {
      console.log('[TMN][SCRAPYARD] Scrapyard panel not found on page');
      updateStatus("Scrapyard panel not found");
      state.lastScrapyardCheck = now;
      state.scrapyardCheckInProgress = false;
      GM_setValue('scrapyardCheckStartedAt', 0);
      saveState();
      return;
    }

    // BLOCKING-ERROR GATE - same pattern as bunker/garage: if there's an
    // unrelated TMN error on the page (jail, hospital, etc.), don't touch it.
    {
      const errEl = document.getElementById('ctl00_lblMsg');
      const errTxt = (errEl && errEl.classList.contains('TMNErrorFont')) ? (errEl.textContent || '').trim() : '';
      if (errTxt) {
        console.log(`[TMN][SCRAPYARD] Blocking error on page, aborting cycle: "${errTxt.substring(0, 160)}"`);
        updateStatus(`Scrapyard blocked: ${errTxt.substring(0, 60)}`);
        state.lastScrapyardCheck = now;
        state.scrapyardCheckInProgress = false;
        GM_setValue('scrapyardCheckStartedAt', 0);
        saveState();
        return;
      }
    }

    const balEl = document.getElementById('ctl00_main_lblScrapBalance');
    const scrapBalance = balEl ? (parseFloat((balEl.textContent || '').trim().replace(/,/g, '')) || 0) : 0;

    if (scrapBalance < SCRAPYARD_FMJ_COST) {
      // Nothing left to spend on FMJ this round - this is the ONLY branch
      // that resets lastScrapyardCheck, which is what lets the loop fall
      // back to the normal hourly cadence instead of hammering the page.
      updateStatus(`Scrapyard: ${scrapBalance.toFixed(2)} scrap left, not enough for FMJ (needs ${SCRAPYARD_FMJ_COST})`);
      state.lastScrapyardCheck = now;
      state.scrapyardCheckInProgress = false;
      GM_setValue('scrapyardCheckStartedAt', 0);
      saveState();
      return;
    }

    const buyLink = document.getElementById('ctl00_main_lbBuy1kFMJScrap');
    if (!buyLink) {
      console.log('[TMN][SCRAPYARD] Buy FMJ link not found');
      updateStatus("Scrapyard: Buy FMJ link not found");
      state.lastScrapyardCheck = now;
      state.scrapyardCheckInProgress = false;
      GM_setValue('scrapyardCheckStartedAt', 0);
      saveState();
      return;
    }

    // Deliberately NOT updating lastScrapyardCheck here - scrapyardCheckInProgress
    // stays true so the very next tick (after this postback reloads the page)
    // immediately buys again if scrap remains, draining the balance in a burst
    // rather than waiting a full interval between each 1000 FMJ buy.
    state.isPerformingAction = true;
    state.currentAction = 'scrapyard';
    GM_setValue('actionStartTime', now);
    saveState();

    console.log(`[TMN][SCRAPYARD] Buying 1000 FMJ for ${SCRAPYARD_FMJ_COST} scrap (balance: ${scrapBalance})`);
    scheduleOCDTMAction(
      `⚙️ Buying 1000 FMJ from Scrapyard (${scrapBalance.toFixed(2)} scrap on hand)`,
      () => {
        buyLink.click();
        state.isPerformingAction = false;
        state.currentAction = '';
        GM_setValue('actionStartTime', 0);
        saveState();
        updateStatus(`✅ Bought 1000 FMJ from Scrapyard`);
        sendTelegramMessage(
          '⚙️ <b>Scrapyard Purchase</b>\n\n' +
          `Player: ${state.playerName || 'Unknown'}\n` +
          `Bought: 1000 FMJ (${SCRAPYARD_FMJ_COST} scrap)\n` +
          `Scrap remaining: ~${(scrapBalance - SCRAPYARD_FMJ_COST).toFixed(2)}`
        );
      }
    );
  }

  // Hoisted to module scope (v17.45) so both mainLoop's gating and
  // checkHotCitySafetyNet below can reference the same constant.
  const TRAVEL_BACK_DELAY_MS = 22 * 60 * 1000;

  // ---------------------------
  // Hot City Safety Net (v17.45)
  // ---------------------------
  // A backstop independent of the four DTM-completion triggers: every
  // config.hotCitySafetyCheckInterval (default 30 min), re-verify we're
  // actually sitting in the hot city, in case all four triggers were missed
  // for some reason (manual travel elsewhere, a trigger silently failing,
  // etc). Deliberately reuses the exact same pendingTravelBack /
  // travelBackQueuedAt / doTravelBackToHotCity machinery as the DTM
  // triggers rather than duplicating the hot-city-comparison or travel-
  // click logic: this only ever sets travelBackQueuedAt to a value that's
  // ALREADY past the 22-minute wait, so mainLoop's existing gate is
  // satisfied on the very next tick and goes straight into
  // navigate-and-check. If it turns out we're already in the hot city,
  // doTravelBackToHotCity() itself clears pendingTravelBack right back off
  // silently - no travel, no wasted jet cooldown. If not, it travels
  // immediately via the same private jet button as always.
  function checkHotCitySafetyNet(now) {
    if (!state.autoTravelAfterDTM) return;
    // Something's already queued or actively running (from a DTM trigger,
    // or a previous safety-net check) - don't stomp it, just wait our turn.
    if (state.pendingTravelBack || state.travelBackInProgress) return;
    if (now - state.lastHotCitySafetyCheck < config.hotCitySafetyCheckInterval * 1000) return;

    state.lastHotCitySafetyCheck = now;
    state.pendingTravelBack = true;
    state.carsTransportedForThisTravelBack = false;
    GM_setValue('carTransportStartedAt', 0); // v17.49 - fresh cycle, clear any stale watchdog timestamp
    // Already "expired" relative to TRAVEL_BACK_DELAY_MS, so the mainLoop
    // gate treats this as immediately due instead of waiting 22 more minutes.
    state.travelBackQueuedAt = now - TRAVEL_BACK_DELAY_MS - 1000;
    saveState();
    console.log('[TMN][TRAVEL-BACK] Hot city safety net check due - verifying current city now');
  }

  // ---------------------------
  // Transport Garage Cars to Hot City before flying back (v17.46)
  // ---------------------------
  // Whenever a travel-back is queued (state.pendingTravelBack) but we're
  // NOT currently sitting in the hot city, any cars in the garage are
  // presumably wherever we are right now too - not the hot city. If we just
  // jet back without moving them, they get left behind. So mainLoop routes
  // here FIRST (see the pendingTravelBack gate below) whenever that's the
  // case, and only proceeds to doTravelBackToHotCity() once this reports
  // done (transported, nothing to transport, or skipped for a known
  // reason). Reuses the garage page's own "Transport selected cars to:
  // <ddlCities>" + "Transport" button - the same UI Auto Garage's crusher
  // logic already knows how to reach.
  //
  // Unlike the crusher (which sends exactly one car at a time to dodge a
  // "not your car" error on gifted cars), this selects and transports ALL
  // garage cars in a single submission - there's no known equivalent
  // rejection risk for transport, and going car-by-car would mean a
  // separate page load per car for no benefit. If that assumption turns
  // out wrong for some account, this is the first place to revisit.
  //
  // carsTransportedForThisTravelBack is a one-shot latch, reset to false at
  // every site that sets pendingTravelBack = true. It exists because
  // transporting cars doesn't move the player - isInHotCity() alone can't
  // tell "still needs transporting" apart from "already handled, just
  // waiting on the jet" once transport succeeds.
  const CAR_TRANSPORT_CITY_IDS = {
    'paris': '1',
    'las vegas': '2',
    'sydney': '4',
    'london': '5',
    'new york': '6',
    'toronto': '7'
    // NOTE: option value "3" hasn't been seen yet. If TMN's ddlCities list
    // ever shows a city not in this map, transport is skipped (with a
    // warning) rather than guessing - add it here once known.
  };

  function transportCarsToHotCity() {
    if (!state.autoTravelAfterDTM || !state.pendingTravelBack) {
      state.pendingCarTransport = false;
      return;
    }
    if (state.isPerformingAction || state.inJail || automationPaused) return;

    // Already handled this cycle, or turns out we're already in the hot
    // city after all - nothing to transport, let mainLoop fall through to
    // the jet-travel step next tick.
    if (state.carsTransportedForThisTravelBack || isInHotCity()) {
      state.pendingCarTransport = false;
      saveState();
      return;
    }

    // Auto Garage off = script isn't authorized to touch the garage page at
    // all. Skip transport and just fly back - cars stay put.
    if (!state.autoGarage) {
      console.log('[TMN][CAR-TRANSPORT] Auto Garage is off - skipping car transport, flying back without moving cars');
      state.carsTransportedForThisTravelBack = true;
      state.pendingCarTransport = false;
      saveState();
      return;
    }

    // Resolve the hot city NAME before we can pick a garage-dropdown option.
    // getHotCity() reads a localStorage cache that's only populated when the
    // stats page has been scraped recently - it can easily be empty right
    // when a travel-back is queued, which is what produced the "unknown
    // hot city null" warning. doTravelBackToHotCity() never hits this
    // because it reads the hot city LIVE off travel.aspx's .hot-marked
    // span rather than the cache. Do the same here: if the cache is empty,
    // detour through travel.aspx first, scrape the live marker, refresh the
    // cache via saveHotCity(), then continue on to the garage on a later
    // tick once it's known.
    let hotCity = getHotCity();
    if (!hotCity) {
      if (getCurrentPage() === 'travel') {
        try {
          const hotCitySpan = document.querySelector('#ctl00_main_citieslist .hot');
          const label = hotCitySpan ? hotCitySpan.querySelector('label') : null;
          const liveName = label ? (label.textContent.split(' - ')[0] || '').trim() : '';
          if (liveName) {
            saveHotCity(liveName);
            hotCity = liveName;
            console.log(`[TMN][CAR-TRANSPORT] Refreshed hot city cache from live travel page: "${liveName}"`);
          }
        } catch (e) {
          console.warn('[TMN][CAR-TRANSPORT] Failed to read hot city from travel page:', e);
        }
        if (!hotCity) {
          // v17.49 fix: this used to just `return` here with no state
          // change at all - if the live .hot marker was ever missing for
          // more than an instant (page not fully loaded, a brief gap
          // between hot-city rotations, whatever the cause), mainLoop kept
          // calling this every tick, kept hitting this same dead end, and
          // kept claiming the tick anyway (travelBackHandledThisTick is set
          // by the caller regardless of what this function did) - a
          // permanent stall that blocked crime/GTA/every other action.
          // Give up on car transport specifically instead of retrying
          // forever: doTravelBackToHotCity() runs right after this on the
          // very next tick and does its own independent read of the same
          // .hot marker - if it was just a transient timing hiccup, that
          // attempt has a good chance of succeeding; if the marker is
          // genuinely absent, that function already handles it correctly
          // (clears pendingTravelBack and logs, rather than looping).
          console.warn('[TMN][CAR-TRANSPORT] No hot city marker found on travel page - giving up on car transport for this cycle, proceeding to travel-back');
          state.carsTransportedForThisTravelBack = true;
          state.pendingCarTransport = false;
          saveState();
          return;
        }
        // Fall through below now that hotCity is known - next tick will
        // navigate to the garage since getCurrentPage() !== 'garage' yet.
      } else {
        updateStatus('Checking hot city before transporting cars...');
        safeNavigate('/authenticated/travel.aspx?' + Date.now());
        return;
      }
    }

    if (getCurrentPage() !== 'garage') {
      updateStatus('Navigating to garage to transport cars to hot city...');
      safeNavigate('/authenticated/playerproperty.aspx?p=g&' + Date.now());
      return;
    }

    const targetId = CAR_TRANSPORT_CITY_IDS[hotCity.trim().toLowerCase()];
    if (!targetId) {
      console.warn(`[TMN][CAR-TRANSPORT] No known city-id mapping for hot city "${hotCity}" - skipping transport, flying back without moving cars`);
      updateStatus(`Car transport: unknown city "${hotCity}" - skipped`);
      state.carsTransportedForThisTravelBack = true;
      state.pendingCarTransport = false;
      saveState();
      return;
    }

    const table = document.getElementById('ctl00_main_gvCars');
    const rows = table ? Array.from(table.querySelectorAll('tr')).slice(1) : [];
    const carRows = rows.filter(row => row.querySelector('input[type="checkbox"]'));

    if (carRows.length === 0) {
      console.log('[TMN][CAR-TRANSPORT] No cars in garage - nothing to transport');
      state.carsTransportedForThisTravelBack = true;
      state.pendingCarTransport = false;
      saveState();
      return;
    }

    const select = document.getElementById('ctl00_main_ddlCities');
    const transportBtn = document.getElementById('ctl00_main_btnTransport');
    if (!select || !transportBtn) {
      console.warn('[TMN][CAR-TRANSPORT] Transport dropdown or button not found - skipping transport, flying back without moving cars');
      state.carsTransportedForThisTravelBack = true;
      state.pendingCarTransport = false;
      saveState();
      return;
    }

    state.isPerformingAction = true;
    state.currentAction = 'carTransport';
    GM_setValue('actionStartTime', Date.now());
    saveState();

    console.log(`[TMN][CAR-TRANSPORT] Selecting all ${carRows.length} garage car(s) and transporting to hot city (${hotCity})`);
    scheduleOCDTMAction(`🚗 Transporting ${carRows.length} car(s) to hot city (${hotCity})`, () => {
      carRows.forEach(row => {
        const cb = row.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = true;
      });
      select.value = targetId;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      transportBtn.click();

      state.carsTransportedForThisTravelBack = true;
      state.pendingCarTransport = false;
      state.isPerformingAction = false;
      state.currentAction = '';
      state.lastCarTransport = Date.now();
      GM_setValue('actionStartTime', 0);
      saveState();
      updateStatus(`✅ Transported ${carRows.length} car(s) to hot city (${hotCity})`);
      sendTelegramMessage(
        '🚗 <b>Cars Transported to Hot City</b>\n\n' +
        `Player: ${state.playerName || 'Unknown'}\n` +
        `Destination: ${hotCity}\n` +
        `Cars: ${carRows.length}\n` +
        'Flying back next.'
      );
    });
  }

  // ---------------------------
  // Travel Back to Hot City after DTM (v17.29, updated v17.32)
  // ---------------------------
  // Triggered by state.pendingTravelBack (set true when a DTM completes, see
  // the scheduleOCDTMAction callback in the DTM completion flow). Waits a
  // fixed 22 minutes from state.travelBackQueuedAt (was: the real travel
  // cooldown via getTravelTimerStatus()) - the wait is gated in mainLoop,
  // not in here - then travels to whichever city is marked hot directly on
  // the live travel.aspx page (the site itself wraps the hot city's
  // radio/label in <span class="hot">) using the "Travel (Private jet*)"
  // button specifically - never the normal travel button.
  function doTravelBackToHotCity() {
    if (!state.autoTravelAfterDTM || !state.pendingTravelBack) {
      // Nothing queued, or the feature got turned off mid-flight - bail out
      // and let the caller clear travelBackInProgress.
      return;
    }
    if (state.isPerformingAction || state.inJail || automationPaused) return;

    if (getCurrentPage() !== 'travel') {
      updateStatus("Navigating to Airport to travel back to hot city...");
      safeNavigate('/authenticated/travel.aspx?' + Date.now());
      return;
    }

    const currentCityEl = document.getElementById('ctl00_userInfo_lblcity');
    const currentCity = currentCityEl ? currentCityEl.textContent.trim() : '';

    const hotCitySpan = document.querySelector('#ctl00_main_citieslist .hot');
    if (!hotCitySpan) {
      console.log('[TMN][TRAVEL-BACK] No hot city marked on travel page - clearing pending travel');
      state.pendingTravelBack = false;
      state.travelBackInProgress = false;
      state.travelBackQueuedAt = 0;
      GM_setValue('travelBackStartedAt', 0);
      saveState();
      updateStatus("Travel back: no hot city found on page - skipped");
      return;
    }

    const hotCityRadio = hotCitySpan.querySelector('input[type="radio"]');
    const hotCityLabelEl = hotCitySpan.querySelector('label');
    // Label text looks like "Toronto - Canada - $28,095 / $112,380" - just the
    // city name (first segment) is what we want for matching/display.
    const hotCityName = hotCityLabelEl ? (hotCityLabelEl.textContent.split(' - ')[0] || '').trim() : 'hot city';

    // Already in the hot city - nothing to travel for.
    if (currentCity && hotCityName && currentCity.toLowerCase() === hotCityName.toLowerCase()) {
      console.log(`[TMN][TRAVEL-BACK] Already in hot city (${currentCity}) - clearing pending travel`);
      state.pendingTravelBack = false;
      state.travelBackInProgress = false;
      state.travelBackQueuedAt = 0;
      GM_setValue('travelBackStartedAt', 0);
      saveState();
      updateStatus(`Already in hot city (${currentCity}) - travel skipped`);
      return;
    }

    const travelPrivateBtn = document.getElementById('ctl00_main_btnTravelPrivate');
    if (!hotCityRadio || !travelPrivateBtn) {
      console.warn('[TMN][TRAVEL-BACK] Hot city radio or Travel (Private jet) button not found - will retry next tick');
      return;
    }

    state.isPerformingAction = true;
    state.currentAction = 'travelBack';
    GM_setValue('actionStartTime', Date.now());
    saveState();

    console.log(`[TMN][TRAVEL-BACK] Traveling (private jet) to hot city: ${hotCityName}`);
    scheduleOCDTMAction(`🛫 Traveling to hot city via jet (${hotCityName})`, () => {
      hotCityRadio.checked = true;
      travelPrivateBtn.click();
      state.pendingTravelBack = false;
      state.travelBackInProgress = false;
      state.travelBackQueuedAt = 0;
      state.isPerformingAction = false;
      state.currentAction = '';
      GM_setValue('actionStartTime', 0);
      GM_setValue('travelBackStartedAt', 0);
      saveState();
      updateStatus(`✅ Traveling to hot city (${hotCityName}) via jet`);
      sendTelegramMessage(
        '🛫 <b>Traveling to Hot City</b>\n\n' +
        `Player: ${state.playerName || 'Unknown'}\n` +
        `Destination: ${hotCityName}\n` +
        'Private jet travel initiated (22 min after DTM completion)'
      );
    });
  }

  // ---------------------------
  // Hot City System
  // ---------------------------
  // The "hot city" is the city with the OC bonus, rotating daily at CET midnight.
  // Scraped from the statistics page, cached in localStorage until next midnight.
  const LS_HOT_CITY         = 'tmnOCDTMHotCity';
  const LS_HOT_CITY_UNTIL   = 'tmnOCDTMHotCityUntil';
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
      // The statistics page uses mat-inline-symbol spans with #990000 colour for each city.
      // The HOT city is identified by the icon text "Swords" (Material icon name) in the
      // #990000 span. The city name is in the next sibling span element.
      // Structure: <span class="mat-inline-symbol" style="...#990000...">Swords</span>
      //            <span>Toronto</span>
      //            followed by text containing ": Hot city, There is less..."
      //
      // Alternative approach: look for any text node containing "Hot city" and work
      // backwards to find the city name. This is more resilient to layout changes.

      // Approach 1: Find "Swords" icon span -> next sibling is the city name
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

      // Approach 2: Fallback - search for "Hot city" text in any element
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false);
      while (walker.nextNode()) {
        const text = walker.currentNode.textContent;
        if (/hot\s*city/i.test(text)) {
          // Walk up to find a city name - usually in a nearby span
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
    console.log(`[TMN][HotCity] Hot city set: "${city}" - cache valid until CET midnight`);
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
    if (!hotCity) return false; // No cached city -> don't allow (need to scrape first)
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
            console.log('[TMN][HotCity] Hot city captured - returning to crimes page');
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
  // State machine: idle -> setup (steps 0-4) -> polling (waiting for commit)
  // Steps: 0=Start OC, 1=Invite Transporter, 2=Invite Weapon Master,
  //        3=Invite Explosive Expert, 4=Buy Laptop, 5=Polling for Commit
  const LS_CREATE_OC_STATE        = 'tmnCreateOCState';        // idle | setup | polling
  const LS_CREATE_OC_STEP         = 'tmnCreateOCStep';         // 0-5
  const LS_CREATE_OC_NEXT_CHECK   = 'tmnCreateOCNextCheckAt';  // ms timestamp
  const LS_CREATE_OC_RETRY_AFTER  = 'tmnCreateOCRetryAfter';   // ms timestamp
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
  // Returns 0 if empty/invalid (meaning no schedule - trigger on cooldown only).
  function parseScheduledTime(str) {
    if (!str || !str.trim()) return 0;
    const d = new Date(str.trim());
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function isOCScheduleReady() {
    const scheduledMs = parseScheduledTime(state.ocScheduledTime);
    if (scheduledMs === 0) return true; // No schedule set - always ready (trigger on cooldown)
    return Date.now() >= scheduledMs;
  }

  // Called when OC timer shows ready and Create OC is enabled
  function triggerCreateOC() {
    if (!state.createOC) return;

    // Check scheduled time - both schedule AND cooldown must be ready
    if (!isOCScheduleReady()) {
      const scheduledMs = parseScheduledTime(state.ocScheduledTime);
      const minsLeft = Math.ceil((scheduledMs - Date.now()) / 60000);
      console.log(`[TMN][CreateOC] OC cooldown ready but scheduled time not reached - ${minsLeft} min remaining`);
      return;
    }

    // Check retry cooldown
    const retryAfter = parseInt(localStorage.getItem(LS_CREATE_OC_RETRY_AFTER) || '0', 10);
    if (retryAfter && Date.now() < retryAfter) {
      console.log(`[TMN][CreateOC] Retry suppressed - ${Math.ceil((retryAfter - Date.now()) / 1000)}s remaining`);
      return;
    }

    // Ensure we know the hot city
    if (!getHotCity()) {
      console.log('[TMN][CreateOC] Hot city not cached - fetching before proceeding');
      fetchHotCity();
      return;
    }

    // Ensure we're in the hot city
    if (!isInHotCity()) {
      const hotCity = getHotCity() || '?';
      const currentCity = getCurrentCity();
      console.log(`[TMN][CreateOC] Not in hot city - current="${currentCity}" hot="${hotCity}" - skipping`);
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
      console.log(`[TMN][CreateOC] Team not fully configured - T="${t}" W="${w}" E="${e}"`);
      sendTelegramMessage(
        '⚠️ <b>OC Ready But Team Not Set</b>\n\n' +
        `Player: ${state.playerName || 'Unknown'}\n` +
        'Set team members in Settings -> OC Team before creating'
      );
      return;
    }

    console.log('[TMN][CreateOC] OC is ready - initiating setup');
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

  // Main OC creation handler - closely based on the proven working flow from
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

    const step             = getCreateOCStep();
    const transporter      = state.ocTeamTransporter.trim();
    const weaponMaster     = state.ocTeamWeaponMaster.trim();
    const explosiveExpert  = state.ocTeamExplosive.trim();
    const username         = state.playerName || 'Unknown';

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
          console.log('[TMN][CreateOC] Polling: Commit button ready - submitting!');
          await sleepMs(randomDelay(DELAYS.normal));
          formSubmitButton(commitBtn);

          // Determine whether to continue or stop based on repeat mode
          const mode = state.ocRepeatMode || 'once';
          let willRepeat = false;
          let statusMsg = 'Cooldown started';

          if (mode === 'continuous') {
            willRepeat = true;
            statusMsg = 'Cooldown started - will create again when ready (continuous)';
          } else if (mode === 'once') {
            willRepeat = false;
            statusMsg = 'Cooldown started - one-off complete, Create OC disabled';
          } else {
            // repeat_1, repeat_2, repeat_3
            const left = (state.ocRepeatsLeft || 0) - 1;
            if (left > 0) {
              state.ocRepeatsLeft = left;
              willRepeat = true;
              statusMsg = `Cooldown started - ${left} repeat(s) remaining`;
            } else {
              willRepeat = false;
              statusMsg = 'Cooldown started - all repeats done, Create OC disabled';
            }
          }

          sendTelegramMessage(
            '✅ <b>OC Committed!</b>\n\n' +
            `Leader: ${username}\n` +
            statusMsg
          );

          resetCreateOC();

          if (!willRepeat) {
            // Turn off Create OC - one-off or all repeats used
            state.createOC = false;
            state.ocScheduledTime = '';
            state.ocRepeatsLeft = 0;
            saveState();
            // Update UI if open
            try {
              const host = document.getElementById('tmn-automation-host');
              if (host && host.shadowRoot) {
                const cb = host.shadowRoot.querySelector('#tmn-create-oc');
                if (cb) cb.checked = false;
              }
            } catch (e) {}
            console.log('[TMN][CreateOC] Create OC disabled - schedule complete');
          } else {
            saveState();
            console.log(`[TMN][CreateOC] Will repeat - mode=${mode}, repeatsLeft=${state.ocRepeatsLeft}`);
          }
          return true;
        }
        // Not ready yet - check back in 60s
        console.log('[TMN][CreateOC] Polling: Commit not ready - rechecking in 60s');
        localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 60000));
        // Navigate away so normal automation can continue
        window.location.href = '/authenticated/crimes.aspx?' + Date.now();
        return true;
      }

      // CANCELLATION DETECTION: if we're in setup (step 1-4) but the OC page shows
      // neither the invite form NOR active start buttons NOR a commit button, the OC
      // was dismissed/cancelled externally (player cancelled in-game). Auto-reset.
      if (step >= 1 && step <= 4) {
        const hasInviteForm = !!document.getElementById('ctl00_main_txtinvitename');
        const hasStartBtn = !!(
          (document.getElementById('ctl00_main_btnStartOCRobCasino') && !document.getElementById('ctl00_main_btnStartOCRobCasino').disabled) ||
          (document.getElementById('ctl00_main_btnStartOCRobArmoury') && !document.getElementById('ctl00_main_btnStartOCRobArmoury').disabled) ||
          (document.getElementById('ctl00_main_btnStartOCRobBank') && !document.getElementById('ctl00_main_btnStartOCRobBank').disabled)
        );
        const hasCommitBtn = !!document.getElementById('ctl00_main_btnCommitOC');
        const hasBuyBtn = !!document.getElementById('ctl00_main_btnBuySecurity');

        if (!hasInviteForm && !hasCommitBtn && !hasBuyBtn && hasStartBtn) {
          // Start buttons are showing again -> OC was cancelled/dismissed
          console.log('[TMN][CreateOC] OC appears to have been cancelled externally - resetting');
          sendTelegramMessage(
            '⚠️ <b>OC Cancelled (External)</b>\n\n' +
            `Player: ${username}\n` +
            'OC was dismissed in-game - resetting Create OC state'
          );
          resetCreateOC();
          return false;
        }
      }

      // STEP 0: Click start button based on user's OC type preference
      if (step === 0) {
        const casinoBtn  = document.getElementById('ctl00_main_btnStartOCRobCasino');
        const armouryBtn = document.getElementById('ctl00_main_btnStartOCRobArmoury');
        const bankBtn    = document.getElementById('ctl00_main_btnStartOCRobBank');

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
          console.log('[TMN][CreateOC] No enabled start button found - retrying in 5s');
          localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 5000));
          return false;
        }
        const typeName = startBtn.id.includes('Casino') ? 'Casino'
                       : startBtn.id.includes('Armoury') ? 'Armoury' : 'Bank';
        console.log(`[TMN][CreateOC] Step 0: Starting OC - ${typeName}`);
        await sleepMs(randomDelay(DELAYS.normal));
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
        const nameInput  = document.getElementById('ctl00_main_txtinvitename');
        const roleSelect = document.getElementById('ctl00_main_roleslist');
        const inviteBtn  = document.getElementById('ctl00_main_btninvite');
        if (!nameInput || !roleSelect || !inviteBtn) {
          console.log('[TMN][CreateOC] Step 1: Invite form not found - retrying in 5s');
          localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 5000));
          return true;
        }
        console.log('[TMN][CreateOC] Step 1: Clearing field');
        nameInput.value = '';
        await sleepMs(randomDelay(DELAYS.normal));
        console.log('[TMN][CreateOC] Step 1: Enter ' + transporter);
        nameInput.value = transporter;
        await sleepMs(randomDelay(DELAYS.normal));
        console.log('[TMN][CreateOC] Step 1: Select Transporter');
        roleSelect.value = 'Transporter';
        await sleepMs(randomDelay(DELAYS.normal));
        console.log('[TMN][CreateOC] Step 1: Click invite');
        sendTelegramMessage(
          `🏢 <b>OC Step 2/5</b>\n\nLeader: ${username}\n` +
          `Invited ${transporter} as Transporter`
        );
        // Advance step BEFORE click - postback reloads page immediately
        localStorage.setItem(LS_CREATE_OC_STEP, '2');
        localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 10000));
        inviteBtn.click();
        return true;
      }

      // STEP 2: Invite Weapon Master
      if (step === 2) {
        if (!weaponMaster) { console.log('[TMN][CreateOC] Weapon Master not set'); resetCreateOC(); return false; }
        const nameInput  = document.getElementById('ctl00_main_txtinvitename');
        const roleSelect = document.getElementById('ctl00_main_roleslist');
        const inviteBtn  = document.getElementById('ctl00_main_btninvite');
        if (!nameInput || !roleSelect || !inviteBtn) {
          console.log('[TMN][CreateOC] Step 2: Invite form not found - retrying in 5s');
          localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 5000));
          return true;
        }
        console.log('[TMN][CreateOC] Step 2: Clearing field');
        nameInput.value = '';
        await sleepMs(randomDelay(DELAYS.normal));
        console.log('[TMN][CreateOC] Step 2: Enter ' + weaponMaster);
        nameInput.value = weaponMaster;
        await sleepMs(randomDelay(DELAYS.normal));
        console.log('[TMN][CreateOC] Step 2: Select WeaponMaster');
        roleSelect.value = 'WeaponMaster';
        await sleepMs(randomDelay(DELAYS.normal));
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
        const nameInput  = document.getElementById('ctl00_main_txtinvitename');
        const roleSelect = document.getElementById('ctl00_main_roleslist');
        const inviteBtn  = document.getElementById('ctl00_main_btninvite');
        if (!nameInput || !roleSelect || !inviteBtn) {
          console.log('[TMN][CreateOC] Step 3: Invite form not found - retrying in 5s');
          localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 5000));
          return true;
        }
        console.log('[TMN][CreateOC] Step 3: Clearing field');
        nameInput.value = '';
        await sleepMs(randomDelay(DELAYS.normal));
        console.log('[TMN][CreateOC] Step 3: Enter ' + explosiveExpert);
        nameInput.value = explosiveExpert;
        await sleepMs(randomDelay(DELAYS.normal));
        console.log('[TMN][CreateOC] Step 3: Select ExplosiveExpert');
        roleSelect.value = 'ExplosiveExpert';
        await sleepMs(randomDelay(DELAYS.normal));
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
        const commanderEl   = document.querySelector('#ctl00_main_lblcommanderstatus');
        const transporterEl = document.querySelector('#ctl00_main_lbltransporterstatus');
        const explosiveEl   = document.querySelector('#ctl00_main_lblexplosiveexpertstatus');

        const commanderStatus   = commanderEl   ? commanderEl.textContent.trim().toLowerCase()   : '';
        const transporterStatus = transporterEl ? transporterEl.textContent.trim().toLowerCase() : '';
        const explosiveStatus   = explosiveEl   ? explosiveEl.textContent.trim().toLowerCase()   : '';

        console.log(`[TMN][CreateOC] Step 4: Team status - Commander: ${commanderStatus}, Transporter: ${transporterStatus}, Explosive: ${explosiveStatus}`);

        if (commanderStatus.includes('open') || transporterStatus.includes('open') || explosiveStatus.includes('open')) {
          console.log('[TMN][CreateOC] Step 4: Team incomplete - cancelling');
          sendTelegramMessage(
            '⚠️ <b>OC Cancelled</b>\n\n' +
            `Leader: ${username}\n` +
            'Team incomplete - someone left or declined'
          );
          resetCreateOC();
          return false;
        }

        const secSelect = document.getElementById('ctl00_main_securitydeviceslist');
        const buyBtn    = document.getElementById('ctl00_main_btnBuySecurity');

        if (!secSelect || !buyBtn) {
          console.log('[TMN][CreateOC] Step 4: Buy form not found - retrying in 5s');
          localStorage.setItem(LS_CREATE_OC_NEXT_CHECK, String(Date.now() + 5000));
          return true;
        }

        console.log('[TMN][CreateOC] Step 4: Select Laptop');
        secSelect.value = '6';
        await sleepMs(randomDelay(DELAYS.normal));

        console.log('[TMN][CreateOC] Step 4: Click Buy');
        sendTelegramMessage(
          `🏢 <b>OC Step 5/5</b>\n\nLeader: ${username}\n` +
          'Bought laptop - waiting for team to commit'
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

  // ---------------------------
  // Millisecond sleep helper for OC creation. Kept separate (renamed from the old
  // duplicate humanDelay(ms)) so it never shadows the early humanDelay(range) helper.
  // ---------------------------
  function sleepMs(ms) {
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
      .tmn-watch-row {
        display: grid;
        grid-template-columns: 18px 1fr auto;
        gap: 7px;
        align-items: center;
        padding: 6px;
        background: rgba(0,0,0,0.18);
        border: 1px solid #263244;
        border-radius: 5px;
        margin-bottom: 5px;
        font-size: 0.82rem;
      }
    `;
    shadowRoot.appendChild(style);

    const wrapper = document.createElement('div');
    wrapper.id = 'tmn-wrapper';
    wrapper.innerHTML = `
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center" id="tmn-drag-handle" style="cursor: grab;">
          <strong>TMN TDS Auto v17.59</strong>
          <div>
            <button id="tmn-lock-btn" class="btn btn-sm btn-outline-secondary me-1" title="Lock/Unlock position">ð</button>
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
                <input class="form-check-input" type="checkbox" id="tmn-auto-jail">
                <label class="form-check-label" for="tmn-auto-jail">Auto Jail</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-booze">
                <label class="form-check-label" for="tmn-auto-booze">Auto Booze</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-oc">
                <label class="form-check-label" for="tmn-auto-oc">🕵️ Auto OC</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-dtm">
                <label class="form-check-label" for="tmn-auto-dtm">🚚 Auto DTM</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-travel-back">
                <label class="form-check-label" for="tmn-auto-travel-back" title="After a DTM completes, waits 22 minutes then travels back (private jet) to whichever city is currently hot. Also runs an independent safety-net check (see Settings) that verifies you're actually in the hot city every so often and travels back immediately if not.">🛫 Auto Travel</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-garage">
                <label class="form-check-label" for="tmn-auto-garage">Auto Garage</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-bunker">
                <label class="form-check-label" for="tmn-auto-bunker">🔫 Auto Bunker</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-scrapyard">
                <label class="form-check-label" for="tmn-auto-scrapyard">⚙️ Auto Scrapyard</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-auto-crusher">
                <label class="form-check-label" for="tmn-auto-crusher">Auto Crusher</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-notify-ocdtm-ready">
                <label class="form-check-label" for="tmn-notify-ocdtm-ready">🔔 OC/DTM Alerts</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-create-oc">
                <label class="form-check-label" for="tmn-create-oc" id="tmn-create-oc-label" style="cursor:pointer; text-decoration:underline; color:#60a5fa;">🏢 Create OC</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="tmn-whitelist-enabled">
                <label class="form-check-label" for="tmn-whitelist-enabled" id="tmn-whitelist-label" style="cursor:pointer; text-decoration:underline; color:#60a5fa;">Whitelist</label>
              </div>
              <div class="form-check form-switch" style="grid-column: 1 / span 2;">
                <input class="form-check-input" type="checkbox" id="tmn-online-watch-enabled">
                <label class="form-check-label" for="tmn-online-watch-enabled" id="tmn-online-watch-label" style="cursor:pointer; text-decoration:underline; color:#60a5fa;">🟢 Online Watch Alerts</label>
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
            <div class="d-flex justify-content-between align-items-center">
              <div class="d-flex align-items-center" style="width: 50%;">
                <span style="color:#9ca3af; width: 55px;">Prot:</span>
                <span id="tmn-protection-timer" style="font-weight: 500;">${cachedDisplayValues.protection || '<span style="color:#9ca3af;">●</span> --'}</span>
              </div>
              <div class="form-check form-switch" style="width: 50%; display:flex; align-items:center; margin:0; padding-top:0; padding-bottom:0;">
                <input class="form-check-input" type="checkbox" id="tmn-auto-login-submit" style="margin-top:0 !important; margin-bottom:0 !important;">
                <label class="form-check-label" for="tmn-auto-login-submit" style="margin-top:0; margin-bottom:0; margin-left:8px; line-height:1.2;" title="Automatically submits the login form once a captcha token is detected, instead of requiring you to click Login yourself. Same setting as &quot;Auto-submit after captcha&quot; in Settings - toggling either one updates both.">Auto Login</label>
              </div>
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
                  <small class="text-muted d-block mb-2">Auto Bunker: deposits any on-hand FMJ/JHP into the Artillery Bunker</small>
                  <label class="form-label">Bunker check interval (min):
                    <input type="number" id="tmn-bunker-interval" class="form-control form-control-sm tmn-compact-input" value="${Math.round(config.bunkerCheckInterval / 60)}" min="1" max="120">
                  </label>
                </div>

                <div class="mt-3 p-2" style="background: rgba(0,0,0,0.2); border-radius: 4px;">
                  <div class="form-check form-switch mb-1">
                    <input class="form-check-input" type="checkbox" id="tmn-auto-bunker-extend">
                    <label class="form-check-label" for="tmn-auto-bunker-extend">Auto Extend Bunker (uses credits)</label>
                  </div>
                  <small class="text-muted d-block">Watches the bunker's expiry date/time (shown on the Artillery Bunker panel) and, only once <b>48 hours or less</b> remain, buys the 14-day extension for ${BUNKER_EXT_COST} credits from the Credits page. Works independently of the deposit toggle above - reuses the same check interval to notice it's due, but never deposits bullets on its own.</small>
                </div>

                <div class="mt-3">
                  <small class="text-muted d-block mb-2">Auto Scrapyard: buys 1000 FMJ at a time from the Scrapyard while you have enough scrap, then falls back to this interval once scrap runs out</small>
                  <label class="form-label">Scrapyard check interval (min):
                    <input type="number" id="tmn-scrapyard-interval" class="form-control form-control-sm tmn-compact-input" value="${Math.round(config.scrapyardCheckInterval / 60)}" min="1" max="240">
                  </label>
                </div>

                <div class="mt-3">
                  <small class="text-muted d-block mb-2">🛫 Auto Travel safety net: independently re-checks you're actually in the hot city, in case a DTM-completion trigger was missed - travels back immediately (private jet) if not</small>
                  <label class="form-label">Hot city safety check interval (min):
                    <input type="number" id="tmn-hotcity-safety-interval" class="form-control form-control-sm tmn-compact-input" value="${Math.round(config.hotCitySafetyCheckInterval / 60)}" min="5" max="240">
                  </label>
                </div>

                <div class="mt-3">
                  <small class="text-muted d-block mb-2">Per-car category overrides - choose what happens to each car when Auto Garage runs:</small>
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
                            <div style="color:#9ca3af; font-style: italic;" title="Never auto-processed - handle manually in-game">${car.name} 🔧</div>
                            <div style="grid-column: 2 / span 3; text-align: center; color:#6b7280; font-style: italic; font-size: 0.75rem;">Manual only</div>
                          `;
                        }
                        const cat = car.locked ? car.defaultCategory : ((state.carCategories && state.carCategories[car.name]) || car.defaultCategory);
                        const disabled = car.locked ? 'disabled' : '';
                        const lockIcon = car.locked ? ' 🔒' : '';
                        const nameStyle = car.locked ? 'color:#9ca3af; font-style: italic;' : 'color:#cbd5e1;';
                        const lockTitle = car.locked ? ' title="Locked - main OC car"' : '';
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
              <h6 style="color:#cbd5e1;">Online Watch Alerts</h6>
              <div class="mb-3">
                <small class="text-muted d-block mb-2">Watch up to 10 player names and alert when they appear online on the players page.</small>
                <div class="form-check form-switch mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-online-watch-modal-enabled">
                  <label class="form-check-label" for="tmn-online-watch-modal-enabled">Enable Online Watch</label>
                </div>
                <div class="mb-2">
                  <label class="form-label small">Scan interval (sec):</label>
                  <input type="number" id="tmn-online-watch-seconds" class="form-control form-control-sm tmn-compact-input" value="${onlineWatchConfig.scanSeconds}" min="20" max="3600">
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-online-watch-browser">
                  <label class="form-check-label" for="tmn-online-watch-browser">Browser notification</label>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-online-watch-tabflash">
                  <label class="form-check-label" for="tmn-online-watch-tabflash">Tab title flash</label>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-online-watch-sound">
                  <label class="form-check-label" for="tmn-online-watch-sound">Sound alert</label>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-online-watch-telegram">
                  <label class="form-check-label" for="tmn-online-watch-telegram">Telegram watch alert</label>
                </div>
                <div id="tmn-online-watch-status" class="small text-muted mb-2">Not scanned yet</div>
                <button id="tmn-open-online-watch" class="btn btn-sm btn-outline-info">Edit Watch List</button>
                <button id="tmn-online-watch-scan-now" class="btn btn-sm btn-outline-success ms-1">Scan Now</button>
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
                  <input class="form-check-input" type="checkbox" id="tmn-notify-script-test">
                  <label class="form-check-label" for="tmn-notify-script-test">Alert 5x on inbox title "Script test"</label>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-notify-staff-mail">
                  <label class="form-check-label" for="tmn-notify-staff-mail">Alert 5x on SQL/Stipe inbox messages</label>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-notify-sql">
                  <label class="form-check-label" for="tmn-notify-sql">Notify on SQL/Stipe Script Check page</label>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-notify-logout">
                  <label class="form-check-label" for="tmn-notify-logout">Notify on Logout/Timeout</label>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="tmn-notify-bank">
                  <label class="form-check-label" for="tmn-notify-bank">Notify on Bank Withdrawal</label>
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

      <div id="tmn-online-watch-modal" class="modal" role="dialog" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content" style="width: 340px;">
            <div class="modal-header" style="padding: 8px 12px;">
              <h6 class="modal-title" style="margin:0;">🟢 Online Watch Alerts</h6>
              <button id="tmn-online-watch-close" type="button" class="btn btn-sm btn-outline-secondary" title="Close"><i class="bi bi-x"></i></button>
            </div>
            <div class="modal-body" style="padding: 10px 12px;">
              <small class="text-muted d-block mb-2">Add up to 10 player names. Alerts fire when a watched name changes to online, or again after the cooldown.</small>
              <div id="tmn-online-watch-list"></div>
              <div class="d-flex gap-2 mt-2">
                <input type="text" id="tmn-online-watch-new-name" class="form-control form-control-sm" maxlength="40" placeholder="Player name">
                <button id="tmn-online-watch-add" class="btn btn-sm btn-outline-success" style="white-space:nowrap;">+ Add</button>
              </div>
              <div class="d-flex gap-2 mt-2">
                <button id="tmn-online-watch-modal-scan" class="btn btn-sm btn-outline-info" style="flex:1;">Scan Now</button>
                <button id="tmn-online-watch-clear" class="btn btn-sm btn-outline-warning" style="flex:1;">Clear Status</button>
              </div>
              <small class="text-muted d-block mt-2">Uses the existing Telegram settings above when Telegram watch alert is enabled.</small>
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

                <div class="mt-2">
                  <label style="color:#9ca3af; font-size: 0.85rem;">Repeat:</label>
                  <select id="tmn-oc-repeat-mode" style="background:#0b1220; color:#e5e7eb; border:1px solid #334155; border-radius:4px; padding:3px 6px; font-size:0.85rem; margin-left: 6px;">
                    <option value="once" ${state.ocRepeatMode === 'once' ? 'selected' : ''}>Once (then stop)</option>
                    <option value="repeat_1" ${state.ocRepeatMode === 'repeat_1' ? 'selected' : ''}>+ 1 repeat (2 total)</option>
                    <option value="repeat_2" ${state.ocRepeatMode === 'repeat_2' ? 'selected' : ''}>+ 2 repeats (3 total)</option>
                    <option value="repeat_3" ${state.ocRepeatMode === 'repeat_3' ? 'selected' : ''}>+ 3 repeats (4 total)</option>
                    <option value="continuous" ${state.ocRepeatMode === 'continuous' ? 'selected' : ''}>Continuous</option>
                  </select>
                </div>
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
    shadowRoot.querySelector("#tmn-auto-bunker").checked = state.autoBunker;
    shadowRoot.querySelector("#tmn-auto-scrapyard").checked = state.autoScrapyard;
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
        crusherLabel.title = 'Crusher not owned - use "Reset crusher status" in settings if you buy one';
      }
    }
    shadowRoot.querySelector("#tmn-auto-oc").checked = state.autoOC;
    shadowRoot.querySelector("#tmn-create-oc").checked = state.createOC;
    shadowRoot.querySelector("#tmn-auto-dtm").checked = state.autoDTM;
    shadowRoot.querySelector("#tmn-auto-travel-back").checked = state.autoTravelAfterDTM;
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
    shadowRoot.querySelector("#tmn-auto-bunker").addEventListener('change', e => {
      state.autoBunker = e.target.checked;
      saveState();
      updateStatus('Auto Bunker ' + (state.autoBunker ? 'Enabled' : 'Disabled'));
    });
    shadowRoot.querySelector("#tmn-auto-scrapyard").addEventListener('change', e => {
      state.autoScrapyard = e.target.checked;
      saveState();
      updateStatus('Auto Scrapyard ' + (state.autoScrapyard ? 'Enabled' : 'Disabled'));
    });
    shadowRoot.querySelector("#tmn-auto-crusher").addEventListener('change', e => {
      // Defence in depth: reject re-enable if we've confirmed no crusher
      if (e.target.checked && state.crusherOwned === false) {
        e.target.checked = false;
        updateStatus('Crusher not owned - use "Reset crusher status" first');
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
        updateStatus(`${carName} -> ${category}`);
      });
    });

    // Reset car categories to defaults
    const carResetBtn = shadowRoot.querySelector('#tmn-carcat-reset');
    if (carResetBtn) {
      carResetBtn.addEventListener('click', () => {
        state.carCategories = {};
        saveState();
        // Re-check the default radio for each known car (skips locked - they already show default)
        KNOWN_CARS.forEach(car => {
          const safeId = car.name.replace(/[^A-Za-z0-9]/g, '');
          const radios = shadowRoot.querySelectorAll(`input[type="radio"][name="tmn-carcat-${safeId}"]`);
          radios.forEach(r => { r.checked = (r.value === car.defaultCategory); });
        });
        updateStatus('Car categories reset to defaults');
      });
    }

    // Reset crusher ownership status - clears the "no crusher" lockout so the script
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
        updateStatus('Crusher status reset - will re-detect on next garage visit');
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
    shadowRoot.querySelector("#tmn-auto-travel-back").addEventListener('change', e => {
      state.autoTravelAfterDTM = e.target.checked;
      if (!state.autoTravelAfterDTM) {
        // Turning it off mid-flight cancels anything already queued too.
        state.pendingTravelBack = false;
        state.travelBackInProgress = false;
        state.travelBackQueuedAt = 0;
        state.pendingCarTransport = false;
        GM_setValue('travelBackStartedAt', 0);
        GM_setValue('carTransportStartedAt', 0);
      }
      saveState();
      updateStatus('🛫 Auto Travel ' + (state.autoTravelAfterDTM ? 'Enabled' : 'Disabled'));
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

    // OC Team name inputs - save on blur
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

    // OC Schedule time input - save on change
    const schedInput = shadowRoot.querySelector('#tmn-oc-schedule-time');
    if (schedInput) {
      schedInput.addEventListener('change', () => {
        state.ocScheduledTime = schedInput.value;
        saveState();
        if (schedInput.value) {
          const d = new Date(schedInput.value);
          updateStatus(`OC scheduled: ${formatDateUK(d)}`);
        } else {
          updateStatus('OC schedule cleared - will trigger on cooldown');
        }
      });
    }

    // OC Repeat mode selector
    const repeatSelect = shadowRoot.querySelector('#tmn-oc-repeat-mode');
    if (repeatSelect) {
      repeatSelect.addEventListener('change', () => {
        state.ocRepeatMode = repeatSelect.value;
        // Set repeatsLeft based on mode
        if (repeatSelect.value === 'repeat_1') state.ocRepeatsLeft = 1;
        else if (repeatSelect.value === 'repeat_2') state.ocRepeatsLeft = 2;
        else if (repeatSelect.value === 'repeat_3') state.ocRepeatsLeft = 3;
        else state.ocRepeatsLeft = 0;
        saveState();
        const labels = {
          once: 'Once (then stop)',
          repeat_1: '+ 1 repeat (2 total)',
          repeat_2: '+ 2 repeats (3 total)',
          repeat_3: '+ 3 repeats (4 total)',
          continuous: 'Continuous'
        };
        updateStatus(`OC repeat: ${labels[repeatSelect.value] || repeatSelect.value}`);
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
      localStorage.removeItem(LS_PENDING_MAIL_DELETIONS);
      updateStatus('OC/DTM cooldowns, pending invites and queued mail deletions cleared');
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

    // Online Watch toggle, settings, and modal
    const onlineWatchMainToggle = shadowRoot.querySelector("#tmn-online-watch-enabled");
    const onlineWatchModalToggle = shadowRoot.querySelector("#tmn-online-watch-modal-enabled");

    function setOnlineWatchEnabled(enabled) {
      onlineWatchConfig.enabled = Boolean(enabled);
      saveOnlineWatchConfig();
      startOnlineWatchScheduler();
      if (onlineWatchMainToggle) onlineWatchMainToggle.checked = onlineWatchConfig.enabled;
      if (onlineWatchModalToggle) onlineWatchModalToggle.checked = onlineWatchConfig.enabled;
      updateStatus('Online Watch Alerts ' + (onlineWatchConfig.enabled ? 'Enabled' : 'Disabled'));
      if (onlineWatchConfig.enabled && onlineWatchConfig.browserNotify && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }

    if (onlineWatchMainToggle) {
      onlineWatchMainToggle.checked = onlineWatchConfig.enabled;
      onlineWatchMainToggle.addEventListener('change', e => setOnlineWatchEnabled(e.target.checked));
    }

    if (onlineWatchModalToggle) {
      onlineWatchModalToggle.checked = onlineWatchConfig.enabled;
      onlineWatchModalToggle.addEventListener('change', e => setOnlineWatchEnabled(e.target.checked));
    }

    const onlineWatchLabel = shadowRoot.querySelector("#tmn-online-watch-label");
    const onlineWatchModal = shadowRoot.querySelector('#tmn-online-watch-modal');
    const onlineWatchBackdrop = shadowRoot.querySelector('#tmn-modal-backdrop');

    function showOnlineWatchModal() {
      if (!onlineWatchModal || !onlineWatchBackdrop) return;
      onlineWatchModal.classList.add('show');
      onlineWatchModal.setAttribute('aria-hidden', 'false');
      onlineWatchBackdrop.style.display = 'block';
      renderOnlineWatchUI();
    }

    function hideOnlineWatchModal() {
      if (!onlineWatchModal || !onlineWatchBackdrop) return;
      onlineWatchModal.classList.remove('show');
      onlineWatchModal.setAttribute('aria-hidden', 'true');
      onlineWatchBackdrop.style.display = 'none';
      saveOnlineWatchConfig();
    }

    if (onlineWatchLabel) {
      onlineWatchLabel.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showOnlineWatchModal();
      });
    }

    const openOnlineWatchBtn = shadowRoot.querySelector('#tmn-open-online-watch');
    if (openOnlineWatchBtn) openOnlineWatchBtn.addEventListener('click', showOnlineWatchModal);

    const closeOnlineWatchBtn = shadowRoot.querySelector('#tmn-online-watch-close');
    if (closeOnlineWatchBtn) closeOnlineWatchBtn.addEventListener('click', hideOnlineWatchModal);

    const addOnlineWatchBtn = shadowRoot.querySelector('#tmn-online-watch-add');
    const newOnlineWatchName = shadowRoot.querySelector('#tmn-online-watch-new-name');
    if (addOnlineWatchBtn && newOnlineWatchName) {
      const addFromInput = () => {
        addOnlineWatchPlayer(newOnlineWatchName.value);
        newOnlineWatchName.value = '';
        newOnlineWatchName.focus();
      };
      addOnlineWatchBtn.addEventListener('click', addFromInput);
      newOnlineWatchName.addEventListener('keydown', e => {
        if (e.key === 'Enter') addFromInput();
      });
    }

    const onlineWatchSeconds = shadowRoot.querySelector('#tmn-online-watch-seconds');
    if (onlineWatchSeconds) {
      onlineWatchSeconds.value = onlineWatchConfig.scanSeconds;
      onlineWatchSeconds.addEventListener('change', e => {
        onlineWatchConfig.scanSeconds = Math.max(ONLINE_WATCH_MIN_SCAN_SECONDS, Math.min(3600, Number(e.target.value || ONLINE_WATCH_DEFAULT_SCAN_SECONDS)));
        e.target.value = onlineWatchConfig.scanSeconds;
        saveOnlineWatchConfig();
        startOnlineWatchScheduler();
        updateStatus(`Online watch interval: ${onlineWatchConfig.scanSeconds}s`);
      });
    }

    const onlineWatchBrowser = shadowRoot.querySelector('#tmn-online-watch-browser');
    if (onlineWatchBrowser) {
      onlineWatchBrowser.checked = onlineWatchConfig.browserNotify;
      onlineWatchBrowser.addEventListener('change', e => {
        onlineWatchConfig.browserNotify = e.target.checked;
        saveOnlineWatchConfig();
        if (onlineWatchConfig.browserNotify) {
          requestBrowserNotificationPermission().catch(() => {});
        }
      });
    }

    const onlineWatchTabFlash = shadowRoot.querySelector('#tmn-online-watch-tabflash');
    if (onlineWatchTabFlash) {
      onlineWatchTabFlash.checked = onlineWatchConfig.tabFlash;
      onlineWatchTabFlash.addEventListener('change', e => {
        onlineWatchConfig.tabFlash = e.target.checked;
        saveOnlineWatchConfig();
      });
    }

    const onlineWatchSound = shadowRoot.querySelector('#tmn-online-watch-sound');
    if (onlineWatchSound) {
      onlineWatchSound.checked = onlineWatchConfig.soundAlert;
      onlineWatchSound.addEventListener('change', e => {
        onlineWatchConfig.soundAlert = e.target.checked;
        saveOnlineWatchConfig();
      });
    }

    const onlineWatchTelegram = shadowRoot.querySelector('#tmn-online-watch-telegram');
    if (onlineWatchTelegram) {
      onlineWatchTelegram.checked = onlineWatchConfig.telegramNotify;
      onlineWatchTelegram.addEventListener('change', e => {
        onlineWatchConfig.telegramNotify = e.target.checked;
        saveOnlineWatchConfig();
      });
    }

    const onlineWatchScanNow = shadowRoot.querySelector('#tmn-online-watch-scan-now');
    if (onlineWatchScanNow) onlineWatchScanNow.addEventListener('click', () => runOnlineWatchScan('manual'));

    const onlineWatchModalScan = shadowRoot.querySelector('#tmn-online-watch-modal-scan');
    if (onlineWatchModalScan) onlineWatchModalScan.addEventListener('click', () => runOnlineWatchScan('manual'));

    const onlineWatchClear = shadowRoot.querySelector('#tmn-online-watch-clear');
    if (onlineWatchClear) {
      onlineWatchClear.addEventListener('click', () => {
        onlineWatchConfig.lastOnline = {};
        onlineWatchConfig.lastAlert = {};
        onlineWatchConfig.lastScanAt = 0;
        onlineWatchConfig.lastScanOk = false;
        onlineWatchConfig.lastScanMessage = 'Status cleared';
        saveOnlineWatchConfig();
        renderOnlineWatchUI();
        updateStatus('Online watch status cleared');
      });
    }

    renderOnlineWatchUI();

    // ALL ON/OFF toggle functionality
    shadowRoot.querySelector("#tmn-auto-all").addEventListener('change', e => {
      const allEnabled = e.target.checked;

      state.autoCrime = allEnabled;
      state.autoGTA = allEnabled;
      state.autoBooze = allEnabled;
      state.autoJail = allEnabled;
      state.autoHealth = allEnabled;
      state.autoGarage = allEnabled;
      state.autoBunker = allEnabled;
      state.autoScrapyard = allEnabled;
      state.autoOC = allEnabled;
      state.autoDTM = allEnabled;

      shadowRoot.querySelector("#tmn-auto-crime").checked = allEnabled;
      shadowRoot.querySelector("#tmn-auto-gta").checked = allEnabled;
      shadowRoot.querySelector("#tmn-auto-booze").checked = allEnabled;
      shadowRoot.querySelector("#tmn-auto-jail").checked = allEnabled;
      shadowRoot.querySelector("#tmn-auto-health").checked = allEnabled;
      shadowRoot.querySelector("#tmn-auto-garage").checked = allEnabled;
      shadowRoot.querySelector("#tmn-auto-bunker").checked = allEnabled;
      shadowRoot.querySelector("#tmn-auto-scrapyard").checked = allEnabled;
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
      const allEnabled = state.autoCrime && state.autoGTA && state.autoBooze && state.autoJail && state.autoHealth && state.autoGarage && state.autoBunker && state.autoScrapyard && state.autoOC && state.autoDTM;

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
    shadowRoot.querySelector('#tmn-bunker-interval').addEventListener('change', e => {
      const minutes = Math.max(1, Math.min(120, parseInt(e.target.value)));
      config.bunkerCheckInterval = minutes * 60; // Convert minutes to seconds for internal use
      GM_setValue("bunkerCheckInterval", config.bunkerCheckInterval);
      e.target.value = minutes;
    });
    shadowRoot.querySelector("#tmn-auto-bunker-extend").checked = state.autoBunkerExtend;
    shadowRoot.querySelector("#tmn-auto-bunker-extend").addEventListener('change', e => {
      state.autoBunkerExtend = e.target.checked;
      if (!state.autoBunkerExtend) {
        // Turning it off cancels anything queued - don't leave a stale
        // pending purchase waiting to fire if it's re-enabled later at a
        // point where the bunker's no longer close to expiring.
        state.bunkerExtendPending = false;
        state.bunkerExpiresAt = 0;
      }
      saveState();
      updateStatus('🔫 Auto Extend Bunker ' + (state.autoBunkerExtend ? 'Enabled' : 'Disabled'));
    });
    shadowRoot.querySelector('#tmn-scrapyard-interval').addEventListener('change', e => {
      const minutes = Math.max(1, Math.min(240, parseInt(e.target.value)));
      config.scrapyardCheckInterval = minutes * 60; // Convert minutes to seconds for internal use
      GM_setValue("scrapyardCheckInterval", config.scrapyardCheckInterval);
      e.target.value = minutes;
    });
    shadowRoot.querySelector('#tmn-hotcity-safety-interval').addEventListener('change', e => {
      const minutes = Math.max(5, Math.min(240, parseInt(e.target.value)));
      config.hotCitySafetyCheckInterval = minutes * 60; // Convert minutes to seconds for internal use
      GM_setValue("hotCitySafetyCheckInterval", config.hotCitySafetyCheckInterval);
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
        localStorage.removeItem('tmnPendingMailDeletions');
        localStorage.removeItem('tmnProtectionEndTs');
        localStorage.removeItem('tmnProtectionStatus');
        localStorage.removeItem('tmnProtWarn12h');
        localStorage.removeItem('tmnProtWarn6h');
        updateStatus('Player data cleared - reload to detect new player');
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
    shadowRoot.querySelector("#tmn-notify-script-test").checked = telegramConfig.notifyInboxScriptTest;
    shadowRoot.querySelector("#tmn-notify-staff-mail").checked = telegramConfig.notifyStaffMailCheck;

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

    shadowRoot.querySelector("#tmn-notify-script-test").addEventListener('change', e => {
      telegramConfig.notifyInboxScriptTest = e.target.checked;
      saveTelegramConfig();
    });

    shadowRoot.querySelector("#tmn-notify-staff-mail").addEventListener('change', e => {
      telegramConfig.notifyStaffMailCheck = e.target.checked;
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

    shadowRoot.querySelector("#tmn-notify-bank").checked = telegramConfig.notifyBankWithdrawal;

    shadowRoot.querySelector("#tmn-notify-bank").addEventListener('change', e => {
      telegramConfig.notifyBankWithdrawal = e.target.checked;
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
  // Keep the main-panel "Auto Login" switch in sync - same underlying
  // setting, shown in two places (both always in the DOM at once, since
  // the Settings modal is just hidden/shown via a class, not
  // created/destroyed).
  const mainPanelCb = shadowRoot.querySelector("#tmn-auto-login-submit");
  if (mainPanelCb) mainPanelCb.checked = LOGIN_CONFIG.AUTO_SUBMIT_ENABLED;
});

    // Main-panel "Auto Login" switch - same LOGIN_CONFIG.AUTO_SUBMIT_ENABLED
    // setting as "Auto-submit after captcha" above, just surfaced as a
    // regular switch alongside the other Auto toggles for convenience.
    shadowRoot.querySelector("#tmn-auto-login-submit").checked = LOGIN_CONFIG.AUTO_SUBMIT_ENABLED;
    shadowRoot.querySelector("#tmn-auto-login-submit").addEventListener('change', e => {
      LOGIN_CONFIG.AUTO_SUBMIT_ENABLED = e.target.checked;
      GM_setValue('autoSubmitEnabled', LOGIN_CONFIG.AUTO_SUBMIT_ENABLED);
      updateStatus('Auto Login ' + (LOGIN_CONFIG.AUTO_SUBMIT_ENABLED ? 'Enabled' : 'Disabled'));
      const settingsCb = shadowRoot.querySelector("#tmn-auto-submit-enabled");
      if (settingsCb) settingsCb.checked = LOGIN_CONFIG.AUTO_SUBMIT_ENABLED;
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
      if (logoutAlertConfig.browserNotify) {
        requestBrowserNotificationPermission().then(perm => {
          updateStatus('Browser notifications: ' + perm);
        });
      } else {
        updateStatus('Browser notify disabled');
      }
    });

    shadowRoot.querySelector("#tmn-test-logout-alert").addEventListener('click', () => {
      updateStatus('Testing logout alerts...');
      triggerLogoutAlerts();
      if (telegramConfig.enabled && telegramConfig.notifyLogout) {
        sendTelegramMessage(
          '🚪 <b>LOGOUT/TIMEOUT TEST ALERT</b>\n\n' +
          `Player: ${state.playerName || 'Unknown'}\n` +
          `Time: ${formatDateUK()}\n\n` +
          'This is a manual test of the Logout/Timeout Telegram alert option.'
        );
      }
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
      // Also close any popup modals (whitelist, OC leader, online watch) that share the backdrop
      const wlModal = shadowRoot.querySelector('#tmn-whitelist-modal');
      if (wlModal) { wlModal.classList.remove('show'); wlModal.setAttribute('aria-hidden', 'true'); }
      const ocLeaderModal = shadowRoot.querySelector('#tmn-oc-leader-modal');
      if (ocLeaderModal) { ocLeaderModal.classList.remove('show'); ocLeaderModal.setAttribute('aria-hidden', 'true'); }
      const onlineWatchModal2 = shadowRoot.querySelector('#tmn-online-watch-modal');
      if (onlineWatchModal2) { onlineWatchModal2.classList.remove('show'); onlineWatchModal2.setAttribute('aria-hidden', 'true'); }
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
    // v17.51 - Top-level safety net. Previously nothing wrapped this entire
    // ~700-line function - if ANY unexpected error was thrown anywhere in
    // here (a DOM structure the site changed, a null reference, anything
    // not already individually try/caught), it would propagate all the way
    // up through this setTimeout-based callback uncaught. Since nothing
    // downstream of the throw ever runs, none of mainLoop's own
    // setTimeout(mainLoop, ...) reschedule calls would fire either - the
    // entire recursive loop would die silently and permanently, with
    // automation stopped until a manual page reload, and no error visible
    // anywhere except the browser's own console. Given how much of this
    // script depends on the live site's DOM staying exactly as expected,
    // this was a standing risk for exactly the kind of "it just hangs"
    // symptom seen earlier in this session (for different, now-fixed,
    // reasons) - this catch-all guards against ANY future instance of that
    // same failure class, known or not-yet-discovered.
    try {
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
    checkForLogout();
    checkForLowHealth();
    checkForBankWithdrawal();

    // Staff script check - if detected, pause automation and alert
    if (checkForSqlScriptCheck()) {
      automationPaused = true;
      updateStatus('⚠️ STAFF CHECK - automation paused, respond manually!');
      setTimeout(mainLoop, 10000); // Keep checking in case it clears
      return;
    }

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

      // IDLE: OC ready but waiting for scheduled time - poll every loop iteration
      if (ocCreateState === 'idle') {
        try {
          const ocStatus = getOCTimerStatus();
          const ocReady = ocStatus && (ocStatus.canOC === true || (ocStatus.totalSeconds || 0) <= 0);
          if (ocReady && isOCScheduleReady()) {
            console.log('[TMN][CreateOC] Schedule + cooldown both ready - triggering');
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
          // Not on OC page but in setup/polling - check if it's time to navigate back
          const nextCheck = parseInt(localStorage.getItem(LS_CREATE_OC_NEXT_CHECK) || '0', 10);
          if (nextCheck > 0 && Date.now() >= nextCheck && !state.isPerformingAction) {
            console.log('[TMN][CreateOC] Time to check OC page - navigating');
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
        state.currentAction = 'dtm-invite';
        GM_setValue('actionStartTime', Date.now());
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
        // Don't navigate to OC page while in jail - wait for release
        if (state.inJail) {
          console.log('[TMN] Pending OC URL but in jail - waiting for release');
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
          state.currentAction = 'oc-invite';
          GM_setValue('actionStartTime', Date.now());
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
    // Runs every 60s normally, or IMMEDIATELY when on the mailbox page.
    // Gate widened so Script test and SQL/Stipe staff-mail alerts still scan when
    // general "New Messages" notifications are disabled.
    // v17.38 - added state.autoTravelAfterDTM here too. The v17.34 changelog
    // claimed this outer gate was widened to also run for an Auto-Travel-only
    // setup (so the DTM-completion-mail trigger could be seen), and
    // unifiedMailCheck()'s own internal gate does check autoTravelAfterDTM -
    // but this outer gate never actually got the flag added, so
    // unifiedMailCheck() was never even called for a DTM leader running with
    // only Auto Travel on (no Auto DTM/Auto OC, no relevant Telegram
    // toggles) - the leader never goes through the invite-accept flow that
    // sets tmnPendingDTMHandle (see handleDTMPageAfterAccept), so the mail
    // trigger was their ONLY route to a queued travel-back, and it was being
    // silently skipped every tick.
    // v17.41 - same bug, same fix, now for state.autoBunkerExtend: its
    // mail-based expiry detection (looksLikeBunkerWarning, above) is
    // useless if unifiedMailCheck() never runs in the first place for a
    // Bunker-Extend-only setup (no OC/DTM/Travel, no relevant Telegram
    // toggles) - the inner gate already allowed it, this outer gate didn't.
    if ((state.autoOC || state.autoDTM || state.autoTravelAfterDTM || state.autoBunkerExtend || (telegramConfig.enabled && (telegramConfig.notifyMessages || telegramConfig.notifyInboxScriptTest || telegramConfig.notifyStaffMailCheck)))
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

    // ===== PRIORITY 3.5: Auto-delete accepted OC/DTM invite mails =====
    if (!state.inJail && !state.isPerformingAction) {
      try {
        if (checkAndProcessMailDeletions()) {
          setTimeout(mainLoop, 3000);
          return;
        }
      } catch (e) {
        console.warn('[TMN][MAIL] Deletion check error:', e);
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

    // v17.31 - Check bunker extension (credits) if one is queued - same
    // high-priority pattern as Auto Health above, since it's the same kind
    // of "navigate to Credits page and buy something" action. Detection of
    // whether one is due lives in doBunkerSubmit (runs on the normal bunker
    // page visit); this just drives it to completion once queued.
    if (state.autoBunkerExtend && !state.isPerformingAction && state.bunkerExtendPending) {
      checkAndExtendBunker();
      if (state.bunkerExtendPending) {
        setTimeout(mainLoop, 1800 + Math.floor(Math.random() * 1400));
        return;
      }
    }

    if (!state.isPerformingAction) {
      const currentPage = getCurrentPage();
      const now = Date.now();

      if (!state.autoCrime && !state.autoGTA && !state.autoBooze && !state.autoJail && !state.autoGarage && !state.autoHealth && !state.autoOC && !state.autoDTM && !state.autoBunker && !state.autoBunkerExtend && !state.autoScrapyard) {
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

        // v17.27 - Artillery Bunker: pause ALL other actions (crime/GTA/
        // booze/jailbreak/garage) while a bunker check is in progress,
        // instead of competing with them for a turn. Previously the bunker
        // check only got a turn in a low-priority branch that auto-
        // jailbreak's frequent 3s interval almost always won, so it rarely
        // ran; making it fully independent caused a different problem -
        // competing async navigations (safeNavigate schedules the actual
        // page load a couple seconds later) that could fire to two
        // different pages in close succession and never let either finish
        // loading. This pause flag fixes both: bunkerCheckInProgress is set
        // the moment a check starts and is GM-backed so it survives the
        // page reload mid-check; nothing else in this block runs again
        // until it clears. It only clears once doBunkerSubmit() reaches a
        // genuine end state (submitted with nothing left to deposit, no
        // panel, no bullets, missing form controls, or a blocking page
        // error) - a partial deposit (FMJ done, JHP still to go) leaves it
        // set so the pause continues into the next tick instead of handing
        // the turn to jailbreak before JHP gets submitted.
        const bunkerOverdue = (state.autoBunker || state.autoBunkerExtend) && (now - state.lastBunkerCheck >= config.bunkerCheckInterval * 1000);
        // Tracks whether the bunker logic below handled this tick, so the
        // pendingAction/garage/priority-chain block further down gets
        // skipped (paused) for this tick without ever using `return` here -
        // mainLoop's own trailing setTimeout must still fire every tick even
        // when a bunker check resolves without an actual page navigation
        // (e.g. "no bullets to deposit"), or automation would silently stop
        // rescheduling itself entirely.
        let bunkerHandledThisTick = false;

        if (state.bunkerCheckInProgress) {
          // Safety watchdog: if a check has been "in progress" for over 90s
          // (long enough for a couple of navigations plus the 3-20s deposit
          // delay), something went wrong - clear the pause so automation
          // isn't stuck forever.
          const bunkerCheckStartedAt = GM_getValue('bunkerCheckStartedAt', 0);
          if (bunkerCheckStartedAt && (now - bunkerCheckStartedAt > 90000)) {
            console.warn('[TMN][BUNKER] Check stuck in progress for 90s+ - clearing pause and resuming other actions');
            state.bunkerCheckInProgress = false;
            state.lastBunkerCheck = now;
            GM_setValue('bunkerCheckStartedAt', 0);
            saveState();
            // Don't set bunkerHandledThisTick - fall through to normal
            // crime/GTA/etc handling now that the pause is cleared.
          } else if (currentPage === 'bunker') {
            doBunkerSubmit();
            bunkerHandledThisTick = true;
          } else {
            updateStatus("Navigating to Artillery Bunker...");
            safeNavigate('/authenticated/playerproperty.aspx?' + Date.now());
            bunkerHandledThisTick = true;
          }
        } else if (bunkerOverdue) {
          state.bunkerCheckInProgress = true;
          GM_setValue('bunkerCheckStartedAt', now);
          saveState();
          if (currentPage === 'bunker') {
            doBunkerSubmit();
          } else {
            updateStatus("Navigating to Artillery Bunker...");
            safeNavigate('/authenticated/playerproperty.aspx?' + Date.now());
          }
          bunkerHandledThisTick = true;
        }

        // v17.28 - Scrapyard: same pause pattern as the bunker above, and
        // deliberately only evaluated when the bunker didn't already claim
        // this tick, so at most one "resource top-up" feature is ever
        // navigating/submitting at a time (the whole reason the bunker
        // needed this pattern in the first place - two independent features
        // scheduling navigations in the same window race each other).
        const scrapyardOverdue = state.autoScrapyard && (now - state.lastScrapyardCheck >= config.scrapyardCheckInterval * 1000);
        let scrapyardHandledThisTick = false;

        if (!bunkerHandledThisTick) {
          if (state.scrapyardCheckInProgress) {
            const scrapyardCheckStartedAt = GM_getValue('scrapyardCheckStartedAt', 0);
            if (scrapyardCheckStartedAt && (now - scrapyardCheckStartedAt > 90000)) {
              console.warn('[TMN][SCRAPYARD] Check stuck in progress for 90s+ - clearing pause and resuming other actions');
              state.scrapyardCheckInProgress = false;
              state.lastScrapyardCheck = now;
              GM_setValue('scrapyardCheckStartedAt', 0);
              saveState();
              // Don't set scrapyardHandledThisTick - fall through to normal
              // crime/GTA/etc handling now that the pause is cleared.
            } else if (currentPage === 'scrapyard') {
              doScrapyardSubmit();
              scrapyardHandledThisTick = true;
            } else {
              updateStatus("Navigating to Scrapyard...");
              safeNavigate('/authenticated/store.aspx?p=s&' + Date.now());
              scrapyardHandledThisTick = true;
            }
          } else if (scrapyardOverdue) {
            state.scrapyardCheckInProgress = true;
            GM_setValue('scrapyardCheckStartedAt', now);
            saveState();
            if (currentPage === 'scrapyard') {
              doScrapyardSubmit();
            } else {
              updateStatus("Navigating to Scrapyard...");
              safeNavigate('/authenticated/store.aspx?p=s&' + Date.now());
            }
            scrapyardHandledThisTick = true;
          }
        }

        // v17.29 - Travel back to hot city after DTM. Same "in progress"
        // pause pattern as bunker/scrapyard, but the trigger isn't an
        // interval - it's state.pendingTravelBack (set on DTM completion),
        // gated (v17.32) by a fixed 22-minute wait from
        // state.travelBackQueuedAt instead of the real travel cooldown -
        // travel now uses the private jet (20-min real cooldown), so 22
        // minutes gives a small buffer. While still waiting this
        // deliberately does NOT claim the tick, so crime/GTA/etc keep
        // running normally in the meantime - it only takes over once the
        // 22 minutes are up.
        let travelBackHandledThisTick = false;

        // v17.45 - Hot city safety net: cheap timestamp check most ticks: if
        // due, this sets pendingTravelBack (with an already-expired
        // travelBackQueuedAt) so the block right below picks it up this
        // same tick, exactly like a DTM-triggered queue would.
        checkHotCitySafetyNet(now);

        if (!bunkerHandledThisTick && !scrapyardHandledThisTick) {
          if (state.travelBackInProgress) {
            const travelBackStartedAt = GM_getValue('travelBackStartedAt', 0);
            if (travelBackStartedAt && (now - travelBackStartedAt > 90000)) {
              console.warn('[TMN][TRAVEL-BACK] Stuck in progress for 90s+ - clearing pause and giving up on this travel');
              state.travelBackInProgress = false;
              state.pendingTravelBack = false;
              state.travelBackQueuedAt = 0;
              state.pendingCarTransport = false;
              GM_setValue('travelBackStartedAt', 0);
              GM_setValue('carTransportStartedAt', 0);
              saveState();
              // Don't set travelBackHandledThisTick - fall through to normal
              // crime/GTA/etc handling now that the pause is cleared.
            } else if (currentPage === 'travel') {
              doTravelBackToHotCity();
              travelBackHandledThisTick = true;
            } else {
              updateStatus("Navigating to Airport to travel back to hot city...");
              safeNavigate('/authenticated/travel.aspx?' + Date.now());
              travelBackHandledThisTick = true;
            }
          } else if (state.autoTravelAfterDTM && state.pendingTravelBack) {
            const queuedAt = state.travelBackQueuedAt || 0;
            if (queuedAt && (now - queuedAt) >= TRAVEL_BACK_DELAY_MS) {
              // v17.46 - before flying back, make sure garage cars aren't
              // left behind: if we're not currently in the hot city and
              // haven't transported cars yet this travel-back cycle, do
              // that first (garage page, "Transport selected cars to:").
              // Keeps re-entering this branch tick after tick (e.g. while
              // the garage page loads) until carsTransportedForThisTravelBack
              // flips true, exactly like the queued-wait above does for jet
              // travel.
              if (!state.carsTransportedForThisTravelBack && !isInHotCity()) {
                // v17.49 - watchdog mirroring travelBackInProgress's below:
                // if car transport has been "in progress" for 90s+ without
                // resolving (any cause, not just the specific dead-end just
                // fixed above), give up on it rather than staying stuck
                // here indefinitely and blocking every other action.
                const carTransportStartedAt = GM_getValue('carTransportStartedAt', 0);
                if (carTransportStartedAt && (now - carTransportStartedAt > 90000)) {
                  console.warn('[TMN][CAR-TRANSPORT] Stuck for 90s+ - giving up on car transport, proceeding to travel-back');
                  state.carsTransportedForThisTravelBack = true;
                  state.pendingCarTransport = false;
                  GM_setValue('carTransportStartedAt', 0);
                  saveState();
                  // Don't set travelBackHandledThisTick - let this same
                  // tick fall through to the else branch below (jet travel)
                  // now that the latch is set, instead of waiting a full
                  // extra tick.
                } else {
                  if (!carTransportStartedAt) GM_setValue('carTransportStartedAt', now);
                  state.pendingCarTransport = true;
                  saveState();
                  transportCarsToHotCity();
                  travelBackHandledThisTick = true;
                }
              }
              if (!travelBackHandledThisTick && (state.carsTransportedForThisTravelBack || isInHotCity())) {
                GM_setValue('carTransportStartedAt', 0);
                state.travelBackInProgress = true;
                GM_setValue('travelBackStartedAt', now);
                saveState();
                if (currentPage === 'travel') {
                  doTravelBackToHotCity();
                } else {
                  updateStatus("Navigating to Airport to travel back to hot city...");
                  safeNavigate('/authenticated/travel.aspx?' + Date.now());
                }
                travelBackHandledThisTick = true;
              }
            }
            // else: still waiting out the 22-minute delay - don't claim the
            // tick, let crime/GTA/etc proceed normally; we'll check again
            // next tick.
          }
        }

        if (!bunkerHandledThisTick && !scrapyardHandledThisTick && !travelBackHandledThisTick) {
        // Check if we have a pending action from being jailed
        if (state.pendingAction) {
          updateStatus(`Resuming pending action: ${state.pendingAction}`);
          // v17.51 - every one of these three branches used to `return`
          // with no setTimeout(mainLoop, ...) beforehand, UNLIKE every other
          // early return in this whole function. That's harmless in the
          // else/safeNavigate half (navigation reloads the page, which
          // reinjects the script and restarts the chain from init()) but a
          // real dead end in the if/currentPage-matches half: no reload
          // happens there, so mainLoop's recursive setTimeout chain just
          // stopped forever - all automation silently halted in that tab
          // until a manual page refresh. Only reachable via a specific
          // combination (released from jail while already sitting on the
          // matching page with a pending action queued), which is likely
          // why it went unnoticed. Added the same reschedule every other
          // branch uses; harmless on the navigate side since a reload
          // cancels the pending timer anyway.
          if (state.pendingAction === 'crime' && shouldDoCrime) {
            if (currentPage === 'crimes') {
              doCrime();
            } else {
              updateStatus("Navigating to crimes page to resume pending action...");
              safeNavigate('/authenticated/crimes.aspx?' + Date.now());
            }
            setTimeout(mainLoop, 1800 + Math.floor(Math.random() * 1400));
            return;
          // v17.59 - added "!shouldDoCrime" (and the equivalent guards
          // below) to every lower-priority branch. Before this, resuming a
          // pending action ignored whether a HIGHER-priority action was
          // ALSO currently due - it only ever checked whether ITS OWN
          // cooldown and the matching pendingAction happened to line up.
          // That was survivable for gta/booze in practice only because
          // their cooldowns (245s/120s) are so much longer than mainLoop's
          // ~1.8-3.2s tick that the fallthrough-clear below almost always
          // got a chance to fire soon after one resume attempt, unsticking
          // things. Jailbreak's cooldown is 4s - comparable to the tick
          // interval itself - so shouldDoJailbreak essentially never went
          // false long enough for that fallthrough-clear to ever run once
          // pendingAction became 'jailbreak': it got stuck there
          // PERMANENTLY, and this whole block - which never even looks at
          // crime/GTA/booze once locked onto resuming jailbreak - silently
          // ate every single tick from then on, completely bypassing the
          // real priority-selection logic further down where crime/GTA/
          // booze normally get their turn. That's the "stopped running the
          // main loop, just keeps jailbreaking" bug. These guards make the
          // resume mechanism defer to the same priority order the
          // selection logic below already uses: the instant something
          // higher-priority is due, none of the specific branches match
          // anymore, so pendingAction gets cleared via the final else and
          // control falls straight through to normal priority selection in
          // the very same tick - permanently unstuck, not just delayed.
          } else if (state.pendingAction === 'gta' && shouldDoGTA && !shouldDoCrime) {
            if (currentPage === 'gta') {
              doGTA();
            } else {
              updateStatus("Navigating to GTA page to resume pending action...");
              safeNavigate('/authenticated/crimes.aspx?p=g&' + Date.now());
            }
            setTimeout(mainLoop, 1800 + Math.floor(Math.random() * 1400));
            return;
          } else if (state.pendingAction === 'booze' && shouldDoBooze && !shouldDoCrime && !shouldDoGTA) {
            if (currentPage === 'booze') {
              doBooze();
            } else {
              updateStatus("Navigating to booze page to resume pending action...");
              safeNavigate('/authenticated/crimes.aspx?p=b&' + Date.now());
            }
            setTimeout(mainLoop, 1800 + Math.floor(Math.random() * 1400));
            return;
          } else if (state.pendingAction === 'jailbreak' && shouldDoJailbreak && !shouldDoCrime && !shouldDoGTA && !shouldDoBooze) {
            if (currentPage === 'jail') {
              doJailbreak();
            } else {
              updateStatus("Navigating to jail page to resume pending action...");
              safeNavigate('/authenticated/jail.aspx?' + Date.now());
            }
            setTimeout(mainLoop, 1800 + Math.floor(Math.random() * 1400));
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
          const bunkerRemainingSec = Math.max(0, Math.ceil((config.bunkerCheckInterval * 1000 - (now - state.lastBunkerCheck)) / 1000));
          const bunkerRemainingMin = Math.ceil(bunkerRemainingSec / 60);
          const scrapyardRemainingSec = Math.max(0, Math.ceil((config.scrapyardCheckInterval * 1000 - (now - state.lastScrapyardCheck)) / 1000));
          const scrapyardRemainingMin = Math.ceil(scrapyardRemainingSec / 60);

          if (crimeRemaining > 0 || gtaRemaining > 0 || boozeRemaining > 0 || jailRemaining > 0 || garageRemainingSec > 0 || bunkerRemainingSec > 0 || scrapyardRemainingSec > 0) {
            const pendingInfo = state.pendingAction ? `, Pending: ${state.pendingAction}` : '';
            const bunkerInfo = (state.autoBunker || state.autoBunkerExtend) ? `, Bunker ${bunkerRemainingMin}m` : '';
            const scrapyardInfo = state.autoScrapyard ? `, Scrapyard ${scrapyardRemainingMin}m` : '';
            updateStatus(`Crime ${crimeRemaining}s, GTA ${gtaRemaining}s, Booze ${boozeRemaining}s, Jail ${jailRemaining}s, Garage ${garageRemainingMin}m${bunkerInfo}${scrapyardInfo}${pendingInfo}`);
          }
        }
        }
      }
    }

    setTimeout(mainLoop, 1800 + Math.floor(Math.random() * 1400));
    } catch (err) {
      // Something unexpected went wrong somewhere above - log it (so it's
      // visible/debuggable) but always reschedule, exactly like every
      // normal path through this function does. This is the one path that
      // must never skip the reschedule, since there's no more specific
      // handler left to fall back on. The inner try/catch around
      // updateStatus is deliberate belt-and-braces: even if the recovery
      // logging itself fails (e.g. the panel's DOM is in a bad state), the
      // reschedule below must still happen unconditionally.
      try {
        console.error('[TMN] mainLoop hit an unexpected error - recovering and continuing:', err);
        updateStatus('⚠️ Unexpected error - recovering automatically');
      } catch (e2) {}
      setTimeout(mainLoop, 1800 + Math.floor(Math.random() * 1400));
    }
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

    // Start integrated online player watch alerts (single-master-tab guarded)
    startOnlineWatchScheduler();

    // Initialize hot city detection (scrapes stats page if we're on it)
    try { initHotCity(); } catch (e) { console.warn('[TMN][HotCity] init error:', e); }

    // NOTE: Mail checking is now integrated into mainLoop (Priority 3) with localStorage-based cooldown.
    // No separate timer needed - survives page navigations unlike the old setInterval/setTimeout approach.

    // Show appropriate status based on tab status
    if (tabManager.isMasterTab) {
      updateStatus("TMN TDS Auto v17.59 loaded - Master tab (single tab mode)");
    } else {
      updateStatus("⏸ Secondary tab - close this tab or it will remain inactive");
    }

    // Check jail state immediately on startup
    checkJailStateOnAnyPage();

    // Handle page unload - release master status
    window.addEventListener('beforeunload', () => {
      tabManager.releaseMaster();
      stopUnifiedMailWatcher();
      stopOnlineWatchScheduler();
      if (onlineWatchTitleFlashTimer) {
        clearInterval(onlineWatchTitleFlashTimer);
        onlineWatchTitleFlashTimer = null;
      }
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
