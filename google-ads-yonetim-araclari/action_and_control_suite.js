/**
 * ==============================================================================
 * ATLI MEDIKAL - ENTERPRISE GOOGLE ADS SCRIPTS AUTOMATION SUITE
 * Milestone 3: Command-Based Action & Control Suite (R3)
 * ==============================================================================
 * File: action_and_control_suite.js
 * Version: 3.0.0
 * Engine: Modern V8 JavaScript Runtime
 * Query Standard: Google Ads Query Language (GAQL)
 * Exclusively Owns: action_and_control_suite.js
 *
 * Operational Modules:
 *   1. Tool 1 (F20): Dynamic Budget Manager & Pacing Controller
 *      - MTD spend analysis, run-rate projection, ±20% safe delta clamping,
 *        min/max floors, and Google 2x daily spend buffer protection.
 *   2. Tool 2 (F21): Zombie Keyword Pauser
 *      - High spend & 0 conversions detection via GAQL keyword_view.
 *      - Composite ID selector [[adGroupId, criterionId]].
 *      - Date-stamped tracking labels (Zombie_Paused_YYYYMMDD).
 *   3. Tool 3 (F22): Negative Keyword Miner
 *      - High spend & 0 conversions query mining via GAQL search_term_view.
 *      - Brand protection whitelist guardrails.
 *      - Exact match [query] insertion to Campaign or Shared Negative Lists (PMax).
 *   4. Tool 4 (F23): Universal Bulk Status Controller
 *      - Multi-campaign type manager: Search, Display, PMax, Shopping, Video, AdGroups.
 *      - Granular filtering via IDs, Name Regex patterns, and Labels.
 *   5. Safety Architecture (F24, F25):
 *      - Programmatic DRY_RUN simulation mode (logs planned actions without mutating).
 *      - Conversion Tracking Circuit Breaker (checks 48h history, halts zombie pause).
 *      - High-performance matrix setValues() Google Sheets Audit Trail Logger.
 *      - One-Click Rollback engine restoring paused entities by label.
 * ==============================================================================
 */

/**
 * ------------------------------------------------------------------------------
 * MASTER CONFIGURATION BLOCK
 * ------------------------------------------------------------------------------
 * Modify parameters below according to campaign management objectives.
 */
const R3_CONFIG = {
  // --- Global & Safety Settings ---
  // Google Spreadsheet URL for Audit Trail logging (set to empty string or valid URL)
  SPREADSHEET_URL: '',

  // DRY_RUN: Set to TRUE for simulation mode (no live changes made to Google Ads).
  // Set to FALSE only when ready to execute live mutations.
  DRY_RUN: true,

  // Account Currency Code
  ACCOUNT_CURRENCY: 'TRY',

  // --- Active Command Selector ---
  // Available Commands:
  //   'RUN_ALL'        : Executes Budget Manager, Zombie Pauser, and Negative Miner sequentially.
  //   'BUDGET_PACING'  : Executes only Dynamic Budget Manager & Pacing Controller.
  //   'ZOMBIE_PAUSER'  : Executes only Zombie Keyword Pauser (with circuit breaker).
  //   'NEGATIVE_MINER' : Executes only Negative Keyword Miner.
  //   'BULK_STATUS'    : Executes Universal Bulk Status Controller based on BULK_STATUS config.
  //   'ROLLBACK'       : Executes One-Click Rollback for the specified target label.
  ACTIVE_COMMAND: 'RUN_ALL',

  // --- 1. Dynamic Budget Manager & Pacing Parameters ---
  BUDGET_PACING: {
    ENABLED: true,
    MAX_BUDGET_CHANGE_PCT: 0.20,       // Maximum permissible budget adjustment (±20%)
    MIN_DAILY_BUDGET_FLOOR: 20.0,       // Absolute minimum daily budget floor (TRY)
    MAX_DAILY_BUDGET_CEILING: 10000.0,  // Absolute maximum daily budget ceiling (TRY)
    PACING_BUFFER_PCT: 0.95,           // 5% safety buffer against Google's 2x daily surge rule
    ADJUST_SHARED_BUDGETS: false,      // Safety guard: skip shared budgets to prevent unintended cross-campaign impact
    TARGET_MONTHLY_BUDGETS: {
      // Optional explicit monthly target budgets by Campaign Name or Campaign ID:
      // 'Atli_Search_Brand': 15000.0,
      // 'Atli_Search_Generic_Ortopedi': 30000.0,
      // Set 'DEFAULT_TARGET' to null to automatically infer target as (currentDailyBudget * daysInMonth)
      DEFAULT_TARGET: null
    }
  },

  // --- 2. Zombie Keyword Pauser Parameters ---
  ZOMBIE_PAUSER: {
    ENABLED: true,
    COST_THRESHOLD: 300.0,             // Spend threshold (TRY) with 0 conversions to trigger pausing
    CLICKS_THRESHOLD: 40,              // Secondary click threshold with 0 conversions
    LOOKBACK_WINDOW: 'LAST_30_DAYS',   // GAQL date lookback range
    MAX_ZOMBIES_PER_RUN: 50,           // Maximum keyword pause actions per execution run
    LABEL_PREFIX: 'Zombie_Paused_',    // Label prefix (appended with YYYYMMDD)
    CIRCUIT_BREAKER_HOURS: 48,         // Halts pausing if 0 conversions recorded account-wide in last 48h
    MIN_HISTORICAL_CONVERSIONS: 2      // Minimum 30-day conversions required to arm circuit breaker
  },

  // --- 3. Negative Keyword Miner Parameters ---
  NEGATIVE_MINER: {
    ENABLED: true,
    SPEND_THRESHOLD: 150.0,            // Spend threshold (TRY) with 0 conversions to trigger negative keyword
    CLICKS_THRESHOLD: 25,              // Secondary click threshold with 0 conversions
    LOOKBACK_WINDOW: 'LAST_30_DAYS',   // GAQL date lookback range
    MAX_NEGATIVES_PER_RUN: 50,         // Maximum negative terms to add per execution run
    MATCH_TYPE: 'EXACT',               // Default match type standard: 'EXACT' ([search term])
    ADD_TO_SHARED_LIST: true,          // Add to Shared Negative Keyword List to protect PMax & all campaigns
    SHARED_LIST_NAME: 'Atli_Medikal_Ortak_Negatifler', // Shared Negative Keyword List name
    PROTECTED_BRAND_PATTERNS: [
      /atli/i,
      /atlimedikal/i,
      /atlı/i,
      /atlımedikal/i,
      /ortopedi/i
    ]
  },

  // --- 4. Universal Bulk Status Controller Parameters ---
  BULK_STATUS: {
    ENABLED: false,                    // Must be explicitly enabled when executing bulk status commands
    ACTION: 'PAUSE',                   // Desired status: 'PAUSE' | 'ENABLE'
    TARGET_ENTITY: 'CAMPAIGN',         // Entity level: 'CAMPAIGN' | 'AD_GROUP'
    TARGET_CAMPAIGN_TYPES: [
      'SEARCH_DISPLAY',
      'PERFORMANCE_MAX',
      'SHOPPING',
      'VIDEO'
    ],
    FILTER: {
      BY_IDS: [],                      // e.g. [123456, 789012] (Empty array matches all)
      BY_NAME_REGEX: '',               // e.g. '.*_Promo_.*' or '^BlackFriday_'
      BY_LABEL: null                   // e.g. 'Seasonal_Campaign'
    },
    LABEL_ON_PAUSE_PREFIX: 'Bulk_Paused_'
  },

  // --- 5. One-Click Rollback Parameters ---
  ROLLBACK: {
    TARGET_LABEL: ''                   // e.g. 'Zombie_Paused_20260923' or 'Bulk_Paused_20260923'
  }
};

/**
 * ------------------------------------------------------------------------------
 * SHARED UTILITY & SAFETY CONTRACT IMPLEMENTATIONS
 * ------------------------------------------------------------------------------
 */

/**
 * Validates that GAQL query does NOT touch any prohibited billing or invoice resources.
 * Throws an Error if a prohibited resource token is detected.
 * @param {string} query
 * @returns {boolean}
 */
function validateGAQLSafety(query) {
  if (typeof query !== 'string') {
    throw new Error('validateGAQLSafety: GAQL query must be a string.');
  }

  const prohibitedResources = [
    'billing_setup',
    'account_budget',
    'invoice',
    'payments_account',
    'billing_status'
  ];

  const lowerQuery = query.toLowerCase();
  for (let i = 0; i < prohibitedResources.length; i++) {
    const resource = prohibitedResources[i];
    const regex = new RegExp('\\b' + resource + '\\b', 'i');
    if (regex.test(lowerQuery)) {
      throw new Error(
        'GAQL Safety Violation: Query attempts to access prohibited billing resource: ' + resource
      );
    }
  }

  return true;
}

/**
 * Converts micro-currency units (e.g. cost_micros) to standard account currency units.
 * Formula: micros / 1,000,000.0, rounded to 2 decimal places.
 * @param {number|string|null} micros
 * @returns {number}
 */
function microsToCurrency(micros) {
  if (micros === null || micros === undefined || isNaN(micros)) {
    return 0.0;
  }
  return Number((Number(micros) / 1000000.0).toFixed(2));
}

/**
 * Converts standard currency units to Google Ads micro-currency units.
 * Formula: round(currency * 1,000,000).
 * @param {number|string|null} amount
 * @returns {number}
 */
function currencyToMicros(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 0;
  }
  return Math.round(Number(amount) * 1000000);
}

/**
 * Null-safe object property accessor that seamlessly traverses casing discrepancies
 * between GAQL snake_case and Apps Script V8 lowerCamelCase.
 * @param {Object} row
 * @param {string} path - Dot-separated path, e.g. "metrics.cost_micros"
 * @param {*} defaultValue
 * @returns {*}
 */
function getSafeValue(row, path, defaultValue = null) {
  if (!row || !path) {
    return defaultValue;
  }

  const parts = path.split('.');
  let current = row;

  for (let i = 0; i < parts.length; i++) {
    if (current === null || current === undefined) {
      return defaultValue;
    }

    const part = parts[i];

    // 1. Direct key match
    if (part in current) {
      current = current[part];
      continue;
    }

    // 2. camelCase variation (e.g. cost_micros -> costMicros)
    const camelPart = part.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (camelPart in current) {
      current = current[camelPart];
      continue;
    }

    // 3. snake_case variation (e.g. costMicros -> cost_micros)
    const snakePart = part.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase());
    if (snakePart in current) {
      current = current[snakePart];
      continue;
    }

    return defaultValue;
  }

  return (current !== undefined && current !== null) ? current : defaultValue;
}

/**
 * High-performance spreadsheet matrix exporter chunked at 5,000 rows to prevent
 * Google Apps Script 30-minute execution timeouts.
 * @param {Object} sheet - SpreadsheetApp Sheet instance
 * @param {number} startRow - 1-indexed start row
 * @param {number} startCol - 1-indexed start col
 * @param {Array<Array<*>>} matrix - 2D rectangular data array
 * @param {number} [chunkSize=5000] - Rows per batch write
 * @returns {number} - Total written rows
 */
function writeMatrixToSheet(sheet, startRow, startCol, matrix, chunkSize = 5000) {
  if (!sheet || !matrix || matrix.length === 0 || matrix[0].length === 0) {
    return 0;
  }

  const totalRows = matrix.length;
  const numCols = matrix[0].length;
  let writtenRows = 0;

  for (let offset = 0; offset < totalRows; offset += chunkSize) {
    const chunk = matrix.slice(offset, offset + chunkSize);
    const targetRow = startRow + offset;
    const range = sheet.getRange(targetRow, startCol, chunk.length, numCols);
    range.setValues(chunk);
    writtenRows += chunk.length;
  }

  return writtenRows;
}

/**
 * ------------------------------------------------------------------------------
 * DATE & TIME HELPER UTILITIES
 * ------------------------------------------------------------------------------
 */

/**
 * Formats a Date object into YYYYMMDD string adhering to Google Ads account timezone.
 * @param {Date} [date]
 * @returns {string} e.g. "20260923"
 */
function getAccountDateFormatted(date) {
  const d = date || new Date();
  if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
    const tz = (typeof AdsApp !== 'undefined' && AdsApp.currentAccount && AdsApp.currentAccount().getTimeZone)
      ? AdsApp.currentAccount().getTimeZone()
      : 'Europe/Istanbul';
    return Utilities.formatDate(d, tz, 'yyyyMMdd');
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * Returns ISO 8601 timestamp string.
 * @param {Date} [date]
 * @returns {string}
 */
function getIsoTimestamp(date) {
  return (date || new Date()).toISOString();
}

/**
 * ------------------------------------------------------------------------------
 * LABEL & SHARED ENTITY LIFECYCLE MANAGERS
 * ------------------------------------------------------------------------------
 */

/**
 * Ensures an AdsApp label exists, creating it safely if missing.
 * Handles label name limits and prevents duplicate creation exceptions.
 * @param {string} labelName
 * @param {string} [description=""]
 * @param {string} [colorHex="#E53935"]
 * @returns {Object|null} AdsApp Label instance
 */
function ensureLabel(labelName, description = '', colorHex = '#E53935') {
  if (typeof AdsApp === 'undefined' || typeof AdsApp.labels !== 'function') {
    return null;
  }

  // Sanitize label name to 100 character API limit
  const sanitizedName = String(labelName).substring(0, 100);

  try {
    const labelIter = AdsApp.labels()
      .withCondition(`label.name = '${sanitizedName}'`)
      .get();
    if (labelIter.hasNext()) {
      return labelIter.next();
    }
  } catch (e1) {
    try {
      const labelIter = AdsApp.labels()
        .withCondition(`Name = '${sanitizedName}'`)
        .get();
      if (labelIter.hasNext()) {
        return labelIter.next();
      }
    } catch (e2) {}
  }

  // Label does not exist yet; create it
  try {
    AdsApp.createLabel(sanitizedName, description || '', colorHex || '#E53935');
    // Fetch and return newly created label
    const labelIter = AdsApp.labels()
      .withCondition(`label.name = '${sanitizedName}'`)
      .get();
    if (labelIter.hasNext()) {
      return labelIter.next();
    }
  } catch (errCreate) {
    // If creation threw because label was concurrently created, search without filter
    try {
      const allLabels = AdsApp.labels().get();
      while (allLabels.hasNext()) {
        const l = allLabels.next();
        if (l.getName() === sanitizedName) {
          return l;
        }
      }
    } catch (errFind) {}
  }

  return null;
}

/**
 * Locates an existing Shared Negative Keyword List or creates it via builder.
 * @param {string} listName
 * @returns {Object|null}
 */
function ensureSharedNegativeKeywordList(listName) {
  if (typeof AdsApp === 'undefined' || typeof AdsApp.negativeKeywordLists !== 'function') {
    return null;
  }

  try {
    let listIter;
    try {
      listIter = AdsApp.negativeKeywordLists()
        .withCondition(`name = '${listName}'`)
        .get();
    } catch (e1) {
      listIter = AdsApp.negativeKeywordLists()
        .withCondition(`Name = '${listName}'`)
        .get();
    }

    if (listIter && listIter.hasNext()) {
      return listIter.next();
    }

    // Try building a new list if supported
    if (typeof AdsApp.newNegativeKeywordListBuilder === 'function') {
      const op = AdsApp.newNegativeKeywordListBuilder()
        .withName(listName)
        .build();
      if (op && typeof op.getResult === 'function') {
        return op.getResult();
      }
    }
  } catch (err) {
    Logger.log(`[WARN] Could not find or create shared negative keyword list "${listName}": ${err.message}`);
  }

  return null;
}

/**
 * ------------------------------------------------------------------------------
 * SAFETY ARCHITECTURE & AUDIT TRAIL LOGGING
 * ------------------------------------------------------------------------------
 */

/**
 * Audit Logger maintaining an in-memory matrix buffer of all simulated or live actions,
 * batch-flushing execution records to the Google Sheet tab "ACTION_AUDIT_LOG".
 */
class AuditLogger {
  /**
   * @param {string} spreadsheetUrl
   */
  constructor(spreadsheetUrl) {
    this.spreadsheetUrl = spreadsheetUrl;
    this.records = [];
  }

  /**
   * Appends an audit entry.
   * @param {Object} entry
   * @param {string} [entry.timestamp]
   * @param {string} entry.action - E.g. 'BUDGET_UPDATE', 'PAUSE', 'ADD_NEGATIVE', 'ENABLE', 'ROLLBACK'
   * @param {string} entry.entityType - E.g. 'CAMPAIGN', 'KEYWORD', 'SHARED_NEGATIVE', 'AD_GROUP'
   * @param {string|number} entry.entityId
   * @param {string} entry.entityName
   * @param {string|number} entry.oldValue
   * @param {string|number} entry.newValue
   * @param {string} entry.status - 'SUCCESS' | 'SIMULATED' | 'FAILED' | 'SKIPPED'
   * @param {string} entry.mode - 'DRY_RUN' | 'LIVE'
   * @param {string} [entry.details]
   */
  record(entry) {
    const formatted = {
      timestamp: entry.timestamp || getIsoTimestamp(),
      action: entry.action || 'UNKNOWN',
      entityType: entry.entityType || 'UNKNOWN',
      entityId: String(entry.entityId !== undefined ? entry.entityId : ''),
      entityName: String(entry.entityName !== undefined ? entry.entityName : ''),
      oldValue: String(entry.oldValue !== undefined ? entry.oldValue : ''),
      newValue: String(entry.newValue !== undefined ? entry.newValue : ''),
      status: entry.status || 'SUCCESS',
      mode: entry.mode || 'LIVE',
      details: String(entry.details || '')
    };

    this.records.push(formatted);

    // Immediate human-readable console logging
    const logPrefix = `[${formatted.mode}][${formatted.status}] ${formatted.action}`;
    Logger.log(
      `${logPrefix} | ${formatted.entityType} "${formatted.entityName}" (ID: ${formatted.entityId}) ` +
      `| Old: ${formatted.oldValue} -> New: ${formatted.newValue} | ${formatted.details}`
    );
  }

  /**
   * Flushes all buffered audit records to Google Sheet tab "ACTION_AUDIT_LOG" via setValues().
   */
  flushToSheet() {
    if (this.records.length === 0) {
      Logger.log('[AuditLogger] No records to flush.');
      return;
    }

    if (typeof SpreadsheetApp === 'undefined') {
      Logger.log(`[AuditLogger] SpreadsheetApp unavailable. Flushed ${this.records.length} records to console.`);
      return;
    }

    let spreadsheet = null;
    try {
      if (this.spreadsheetUrl && this.spreadsheetUrl.startsWith('http') && !this.spreadsheetUrl.includes('YOUR_SPREADSHEET_ID')) {
        spreadsheet = SpreadsheetApp.openByUrl(this.spreadsheetUrl);
      } else if (typeof SpreadsheetApp.getActiveSpreadsheet === 'function') {
        spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      }
    } catch (errOpen) {
      Logger.log(`[WARN] Spreadsheet access failed: ${errOpen.message}`);
    }

    if (!spreadsheet) {
      Logger.log(`[AuditLogger] Valid target Spreadsheet not found. ${this.records.length} actions logged to Logger.`);
      return;
    }

    const tabName = 'ACTION_AUDIT_LOG';
    let sheet = spreadsheet.getSheetByName(tabName);

    // Schema headers per contract:
    // Timestamp, Action, Entity_Type, Entity_ID, Entity_Name, Old_Value, New_Value, Status, Mode, Details
    const headers = [
      'Timestamp',
      'Action',
      'Entity_Type',
      'Entity_ID',
      'Entity_Name',
      'Old_Value',
      'New_Value',
      'Status',
      'Mode',
      'Details'
    ];

    if (!sheet) {
      sheet = spreadsheet.insertSheet(tabName);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      try {
        sheet.getRange(1, 1, 1, headers.length)
          .setBackground('#1A365D')
          .setFontColor('#FFFFFF')
          .setFontWeight('bold');
        sheet.setFrozenRows(1);
      } catch (errStyle) {}
    }

    const matrix = this.records.map(r => [
      r.timestamp,
      r.action,
      r.entityType,
      r.entityId,
      r.entityName,
      r.oldValue,
      r.newValue,
      r.status,
      r.mode,
      r.details
    ]);

    const lastRow = sheet.getLastRow();
    const startRow = lastRow + 1;
    writeMatrixToSheet(sheet, startRow, 1, matrix);
    Logger.log(`[AuditLogger] Successfully wrote ${matrix.length} audit records to sheet tab "${tabName}".`);
  }
}

/**
 * MutationExecutor wraps all account mutations with DRY_RUN simulation gating,
 * error handling, and structured audit trail dispatching.
 */
class MutationExecutor {
  /**
   * @param {boolean} dryRun
   * @param {AuditLogger} [auditLogger]
   */
  constructor(dryRun = true, auditLogger = null) {
    this.dryRun = Boolean(dryRun);
    this.logger = auditLogger;
  }

  /**
   * Executes or simulates a single mutation.
   * @param {Object} actionMeta
   * @param {string} actionMeta.action
   * @param {string} actionMeta.entityType
   * @param {string|number} actionMeta.entityId
   * @param {string} actionMeta.entityName
   * @param {string|number} actionMeta.oldValue
   * @param {string|number} actionMeta.newValue
   * @param {string} [actionMeta.details]
   * @param {Function} [actionMeta.mutateFn]
   * @returns {{success: boolean, simulated: boolean, error?: string}}
   */
  execute(actionMeta) {
    const { action, entityType, entityId, entityName, oldValue, newValue, details, mutateFn } = actionMeta;

    if (this.dryRun) {
      if (this.logger) {
        this.logger.record({
          action,
          entityType,
          entityId,
          entityName,
          oldValue,
          newValue,
          status: 'SIMULATED',
          mode: 'DRY_RUN',
          details: details || 'Simulated planned mutation'
        });
      }
      return { success: true, simulated: true };
    }

    try {
      if (typeof mutateFn === 'function') {
        mutateFn();
      }

      if (this.logger) {
        this.logger.record({
          action,
          entityType,
          entityId,
          entityName,
          oldValue,
          newValue,
          status: 'SUCCESS',
          mode: 'LIVE',
          details: details || 'Live mutation completed'
        });
      }
      return { success: true, simulated: false };
    } catch (err) {
      Logger.log(`[ERROR] Mutation failed for ${entityType} "${entityName}" (${entityId}): ${err.message}`);
      if (this.logger) {
        this.logger.record({
          action,
          entityType,
          entityId,
          entityName,
          oldValue,
          newValue,
          status: 'FAILED',
          mode: 'LIVE',
          details: 'Mutation error: ' + err.message
        });
      }
      return { success: false, simulated: false, error: err.message };
    }
  }
}

/**
 * Conversion Tracking Circuit Breaker
 * Queries account conversion statistics over the past 48 hours and compares against 30-day baseline.
 * If 0 conversions are recorded recently despite active spend and healthy historical baseline,
 * it trips to prevent catastrophic mass-pausing caused by broken GTM tags.
 */
class ConversionCircuitBreaker {
  /**
   * Evaluates conversion tracking health.
   * @param {Object} config - ZOMBIE_PAUSER config block
   * @returns {{isTripped: boolean, reason?: string, details?: Object}}
   */
  static evaluate(config) {
    if (typeof AdsApp === 'undefined' || typeof AdsApp.search !== 'function') {
      return { isTripped: false, reason: 'AdsApp.search not available; circuit breaker inactive' };
    }

    const minHistoricalConv = (config && config.MIN_HISTORICAL_CONVERSIONS) || 2;

    try {
      // 1. Query recent conversion metrics (last 48 hours)
      let recentConversions = 0;
      let recentCostMicros = 0;

      const recentQuery =
        'SELECT metrics.conversions, metrics.cost_micros ' +
        'FROM customer ' +
        'WHERE segments.date DURING LAST_48_HOURS';

      validateGAQLSafety(recentQuery);

      try {
        const recentIter = AdsApp.search(recentQuery);
        while (recentIter.hasNext()) {
          const row = recentIter.next();
          recentConversions += Number(getSafeValue(row, 'metrics.conversions', 0));
          recentCostMicros += Number(getSafeValue(row, 'metrics.cost_micros', 0));
        }
      } catch (errRecent) {
        // Fallback to YESTERDAY if LAST_48_HOURS is unsupported by runtime
        const fallbackQuery =
          'SELECT metrics.conversions, metrics.cost_micros ' +
          'FROM customer ' +
          'WHERE segments.date DURING YESTERDAY';
        validateGAQLSafety(fallbackQuery);
        const fallbackIter = AdsApp.search(fallbackQuery);
        while (fallbackIter.hasNext()) {
          const row = fallbackIter.next();
          recentConversions += Number(getSafeValue(row, 'metrics.conversions', 0));
          recentCostMicros += Number(getSafeValue(row, 'metrics.cost_micros', 0));
        }
      }

      // If conversions are actively coming in, tracking is intact
      if (recentConversions > 0) {
        return {
          isTripped: false,
          details: {
            recentConversions,
            recentCost: microsToCurrency(recentCostMicros),
            status: 'HEALTHY'
          }
        };
      }

      // 2. When recent conversions are 0, check 30-day baseline
      const baselineQuery =
        'SELECT metrics.conversions, metrics.cost_micros ' +
        'FROM customer ' +
        'WHERE segments.date DURING LAST_30_DAYS';

      validateGAQLSafety(baselineQuery);

      let baselineConversions = 0;
      let baselineCostMicros = 0;
      const baselineIter = AdsApp.search(baselineQuery);
      while (baselineIter.hasNext()) {
        const row = baselineIter.next();
        baselineConversions += Number(getSafeValue(row, 'metrics.conversions', 0));
        baselineCostMicros += Number(getSafeValue(row, 'metrics.cost_micros', 0));
      }

      // If account historically generated conversions (>= minHistoricalConv) and spent budget recently,
      // but has 0 recent conversions, TRIP THE CIRCUIT BREAKER!
      if (baselineConversions >= minHistoricalConv && recentCostMicros > 0) {
        const recentCost = microsToCurrency(recentCostMicros);
        const alertMsg =
          `[CIRCUIT_BREAKER_TRIGGERED] Conversion tracking tag failure suspected! ` +
          `Account spent ${recentCost} TRY recently with 0 conversions, while 30-day baseline had ${baselineConversions} conversions. ` +
          `Halting Zombie Keyword Pauser to protect active campaigns.`;

        Logger.log(alertMsg);
        return {
          isTripped: true,
          reason: alertMsg,
          details: {
            recentConversions: 0,
            recentCost,
            baselineConversions,
            status: 'TRIPPED'
          }
        };
      }

      return {
        isTripped: false,
        details: {
          recentConversions: 0,
          recentCost: microsToCurrency(recentCostMicros),
          baselineConversions,
          status: 'LOW_BASELINE'
        }
      };
    } catch (err) {
      Logger.log(`[WARN] Circuit breaker check encountered error: ${err.message}`);
      return { isTripped: false, reason: 'Circuit breaker error: ' + err.message };
    }
  }
}

/**
 * ------------------------------------------------------------------------------
 * TOOL 1: DYNAMIC BUDGET MANAGER & PACING CONTROLLER (F20)
 * ------------------------------------------------------------------------------
 */
class BudgetManager {
  /**
   * @param {Object} config
   * @param {MutationExecutor} executor
   */
  constructor(config, executor) {
    this.config = config.BUDGET_PACING;
    this.globalConfig = config;
    this.executor = executor;
  }

  /**
   * Computes calendar month pacing metrics.
   * @returns {{daysInMonth: number, currentDay: number, daysPassed: number, daysRemaining: number}}
   */
  static getMonthCalendarMetrics() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    // Total days in current month: day 0 of next month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const currentDay = now.getDate();
    const daysPassed = Math.max(0, currentDay - 1);
    const daysRemaining = Math.max(1, daysInMonth - currentDay + 1);

    return { daysInMonth, currentDay, daysPassed, daysRemaining };
  }

  /**
   * Executes dynamic budget pacing and adjustments across active campaigns.
   * Supports Search, Display, and Performance Max campaigns.
   */
  run() {
    Logger.log('===============================================================');
    Logger.log('STARTING TOOL 1: DYNAMIC BUDGET MANAGER & PACING');
    Logger.log('===============================================================');

    if (!this.config.ENABLED) {
      Logger.log('[BudgetManager] Skipped: Module disabled in configuration.');
      return;
    }

    const { daysInMonth, currentDay, daysPassed, daysRemaining } = BudgetManager.getMonthCalendarMetrics();
    Logger.log(
      `[BudgetManager] Month Progress: Day ${currentDay}/${daysInMonth} ` +
      `(Passed: ${daysPassed}, Remaining: ${daysRemaining})`
    );

    // Fetch month-to-date spend via GAQL for all enabled campaigns
    const mtdSpendMap = this.fetchMtdSpendMap();

    // 1. Process Standard Campaigns (Search & Display)
    this.processStandardCampaigns(mtdSpendMap, daysInMonth, daysPassed, daysRemaining);

    // 2. Process Performance Max Campaigns
    this.processPmaxCampaigns(mtdSpendMap, daysInMonth, daysPassed, daysRemaining);

    Logger.log('[BudgetManager] Completed dynamic budget evaluation.');
  }

  /**
   * Queries MTD spend per campaign via GAQL.
   * @returns {Map<string, number>} Campaign ID -> MTD Spend (TRY)
   */
  fetchMtdSpendMap() {
    const spendMap = new Map();
    if (typeof AdsApp === 'undefined' || typeof AdsApp.search !== 'function') {
      return spendMap;
    }

    try {
      const query =
        'SELECT campaign.id, campaign.name, metrics.cost_micros ' +
        'FROM campaign ' +
        'WHERE campaign.status = \'ENABLED\' AND segments.date DURING THIS_MONTH';

      validateGAQLSafety(query);
      const iter = AdsApp.search(query);

      while (iter.hasNext()) {
        const row = iter.next();
        const campId = String(getSafeValue(row, 'campaign.id', ''));
        const costMicros = Number(getSafeValue(row, 'metrics.cost_micros', 0));
        spendMap.set(campId, microsToCurrency(costMicros));
      }
    } catch (err) {
      Logger.log(`[BudgetManager] Warning: GAQL MTD spend fetch failed: ${err.message}. Using campaign.getStats().`);
    }

    return spendMap;
  }

  /**
   * Evaluates and updates budgets for standard campaigns.
   */
  processStandardCampaigns(mtdSpendMap, daysInMonth, daysPassed, daysRemaining) {
    if (typeof AdsApp === 'undefined' || typeof AdsApp.campaigns !== 'function') return;

    try {
      const campIter = AdsApp.campaigns()
        .withCondition("campaign.status = 'ENABLED'")
        .get();

      while (campIter.hasNext()) {
        const campaign = campIter.next();
        this.evaluateCampaignBudget(campaign, 'SEARCH_DISPLAY', mtdSpendMap, daysInMonth, daysPassed, daysRemaining);
      }
    } catch (err) {
      Logger.log(`[BudgetManager] Error processing standard campaigns: ${err.message}`);
    }
  }

  /**
   * Evaluates and updates budgets for Performance Max campaigns.
   */
  processPmaxCampaigns(mtdSpendMap, daysInMonth, daysPassed, daysRemaining) {
    if (typeof AdsApp === 'undefined' || typeof AdsApp.performanceMaxCampaigns !== 'function') return;

    try {
      const pmaxIter = AdsApp.performanceMaxCampaigns()
        .withCondition("campaign.status = 'ENABLED'")
        .get();

      while (pmaxIter.hasNext()) {
        const pmax = pmaxIter.next();
        this.evaluateCampaignBudget(pmax, 'PERFORMANCE_MAX', mtdSpendMap, daysInMonth, daysPassed, daysRemaining);
      }
    } catch (err) {
      Logger.log(`[BudgetManager] Error processing PMax campaigns: ${err.message}`);
    }
  }

  /**
   * Calculates pacing formula, safety clamps, and applies budget adjustment for a campaign.
   */
  evaluateCampaignBudget(campaign, entityType, mtdSpendMap, daysInMonth, daysPassed, daysRemaining) {
    const campId = String(campaign.getId());
    const campName = campaign.getName();
    const budgetObj = campaign.getBudget();

    if (!budgetObj) {
      Logger.log(`[BudgetManager] Campaign "${campName}" (${campId}) has no budget object. Skipping.`);
      return;
    }

    const currentDailyBudget = Number(budgetObj.getAmount());

    // Safety Guard: Check if budget is explicitly shared among multiple campaigns
    if (typeof budgetObj.isExplicitlyShared === 'function' && budgetObj.isExplicitlyShared()) {
      if (!this.config.ADJUST_SHARED_BUDGETS) {
        Logger.log(
          `[BudgetManager] Campaign "${campName}" is linked to an explicitly shared budget. ` +
          `Skipping modification to prevent unintended side-effects on peer campaigns.`
        );
        return;
      }
    }

    // Determine MTD Spend
    let mtdSpend = mtdSpendMap.get(campId);
    if (mtdSpend === undefined) {
      try {
        const stats = campaign.getStatsFor('THIS_MONTH');
        mtdSpend = Number(stats.getCost());
      } catch (e) {
        mtdSpend = 0.0;
      }
    }

    // Determine Target Monthly Budget
    const targetMap = this.config.TARGET_MONTHLY_BUDGETS || {};
    let targetMonthlyBudget = null;

    if (targetMap[campName] !== undefined && targetMap[campName] !== null) {
      targetMonthlyBudget = Number(targetMap[campName]);
    } else if (targetMap[campId] !== undefined && targetMap[campId] !== null) {
      targetMonthlyBudget = Number(targetMap[campId]);
    } else if (targetMap.DEFAULT_TARGET !== undefined && targetMap.DEFAULT_TARGET !== null) {
      targetMonthlyBudget = Number(targetMap.DEFAULT_TARGET);
    } else {
      // Inferred target based on current daily budget * days in month
      targetMonthlyBudget = Number((currentDailyBudget * daysInMonth).toFixed(2));
    }

    if (targetMonthlyBudget <= 0) {
      Logger.log(`[BudgetManager] Target monthly budget for "${campName}" is <= 0. Skipping.`);
      return;
    }

    // Mathematical Run-Rate and Projections:
    // Average daily spend so far:
    const avgDailySpend = daysPassed > 0 ? (mtdSpend / daysPassed) : currentDailyBudget;
    const projectedSpend = Number((mtdSpend + (avgDailySpend * daysRemaining)).toFixed(2));
    const pacingPct = Number(((projectedSpend / targetMonthlyBudget) * 100).toFixed(1));

    // Raw recommended daily budget for remaining days with pacing buffer:
    const remainingBudget = Math.max(0, targetMonthlyBudget - mtdSpend);
    const pacingBuffer = Number(this.config.PACING_BUFFER_PCT) || 0.95;
    const rawDailyBudget = (remainingBudget / daysRemaining) * pacingBuffer;

    // Safety Clamping (±MAX_BUDGET_CHANGE_PCT):
    const maxChangePct = Number(this.config.MAX_BUDGET_CHANGE_PCT) || 0.20;
    const minAllowedBudget = currentDailyBudget * (1.0 - maxChangePct);
    const maxAllowedBudget = currentDailyBudget * (1.0 + maxChangePct);

    // Apply Floors and Ceilings:
    const minFloor = Number(this.config.MIN_DAILY_BUDGET_FLOOR) || 20.0;
    const maxCeiling = Number(this.config.MAX_DAILY_BUDGET_CEILING) || 10000.0;

    // Nested clamping formula:
    // clamped = max(MIN_FLOOR, min(MAX_CEILING, min(maxAllowed, max(minAllowed, rawDailyBudget))))
    const deltaClamped = Math.min(maxAllowedBudget, Math.max(minAllowedBudget, rawDailyBudget));
    const finalClampedBudget = Number(Math.max(minFloor, Math.min(maxCeiling, deltaClamped)).toFixed(2));

    const budgetDelta = Math.abs(finalClampedBudget - currentDailyBudget);
    const isSignificantChange = budgetDelta >= 1.0; // Avoid unnecessary API churn for micro-deltas

    Logger.log(
      `[BudgetManager] Campaign "${campName}" | Current: ${currentDailyBudget} TRY | ` +
      `MTD Spend: ${mtdSpend} TRY | Target: ${targetMonthlyBudget} TRY | ` +
      `Projected: ${projectedSpend} TRY (${pacingPct}%) | Recommended: ${finalClampedBudget} TRY`
    );

    if (!isSignificantChange) {
      Logger.log(`[BudgetManager] Campaign "${campName}" is ON_TRACK. Budget delta < 1.0 TRY; no update required.`);
      return;
    }

    // Execute budget adjustment via MutationExecutor
    this.executor.execute({
      action: 'BUDGET_UPDATE',
      entityType: entityType,
      entityId: campId,
      entityName: campName,
      oldValue: `${currentDailyBudget.toFixed(2)} TRY/day`,
      newValue: `${finalClampedBudget.toFixed(2)} TRY/day`,
      details:
        `Pacing: ${pacingPct}%, MTD Spend: ${mtdSpend} TRY, Projected: ${projectedSpend} TRY, ` +
        `Target: ${targetMonthlyBudget} TRY, Delta Clamp: ±${(maxChangePct * 100)}%`,
      mutateFn: () => {
        budgetObj.setAmount(finalClampedBudget);
      }
    });
  }
}

/**
 * ------------------------------------------------------------------------------
 * TOOL 2: ZOMBIE KEYWORD PAUSER (F21)
 * ------------------------------------------------------------------------------
 */
class ZombieKeywordPauser {
  /**
   * @param {Object} config
   * @param {MutationExecutor} executor
   */
  constructor(config, executor) {
    this.config = config.ZOMBIE_PAUSER;
    this.globalConfig = config;
    this.executor = executor;
  }

  /**
   * Scans keyword_view via GAQL for zero-conversion high-spend keywords,
   * checks circuit breaker, pauses them via composite IDs, and applies tracking labels.
   */
  run() {
    Logger.log('===============================================================');
    Logger.log('STARTING TOOL 2: ZOMBIE KEYWORD PAUSER');
    Logger.log('===============================================================');

    if (!this.config.ENABLED) {
      Logger.log('[ZombiePauser] Skipped: Module disabled in configuration.');
      return;
    }

    // Step 1: Conversion Tracking Circuit Breaker Check
    const cbResult = ConversionCircuitBreaker.evaluate(this.config);
    if (cbResult.isTripped) {
      Logger.log(`[CRITICAL_ABORT] Zombie Keyword Pauser halted by Circuit Breaker: ${cbResult.reason}`);
      this.executor.logger.record({
        action: 'CIRCUIT_BREAKER_ABORT',
        entityType: 'ACCOUNT',
        entityId: 'ALL',
        entityName: 'Conversion Tracking Circuit Breaker',
        oldValue: 'ARMED',
        newValue: 'TRIPPED',
        status: 'SKIPPED',
        mode: this.executor.dryRun ? 'DRY_RUN' : 'LIVE',
        details: cbResult.reason
      });
      return;
    }

    // Step 2: Ensure Date-Stamped Rollback Label Exists
    const todayStr = getAccountDateFormatted();
    const labelPrefix = this.config.LABEL_PREFIX || 'Zombie_Paused_';
    const labelName = `${labelPrefix}${todayStr}`;
    ensureLabel(labelName, 'Paused by autonomous Zombie Keyword Pauser', '#E53935');

    // Step 3: Fast GAQL Keyword Scan
    const costThresholdMicros = currencyToMicros(this.config.COST_THRESHOLD || 300.0);
    const maxZombies = Number(this.config.MAX_ZOMBIES_PER_RUN) || 50;
    const lookback = this.config.LOOKBACK_WINDOW || 'LAST_30_DAYS';

    const gaqlQuery =
      'SELECT ' +
      'campaign.id, ' +
      'campaign.name, ' +
      'ad_group.id, ' +
      'ad_group.name, ' +
      'ad_group_criterion.criterion_id, ' +
      'ad_group_criterion.keyword.text, ' +
      'ad_group_criterion.keyword.match_type, ' +
      'metrics.cost_micros, ' +
      'metrics.clicks, ' +
      'metrics.conversions ' +
      'FROM keyword_view ' +
      'WHERE ' +
      'campaign.status = \'ENABLED\' ' +
      'AND ad_group.status = \'ENABLED\' ' +
      'AND ad_group_criterion.status = \'ENABLED\' ' +
      'AND metrics.conversions = 0 ' +
      `AND metrics.cost_micros >= ${costThresholdMicros} ` +
      `AND segments.date DURING ${lookback} ` +
      'ORDER BY metrics.cost_micros DESC ' +
      `LIMIT ${maxZombies}`;

    validateGAQLSafety(gaqlQuery);

    const zombieCandidates = [];
    if (typeof AdsApp !== 'undefined' && typeof AdsApp.search === 'function') {
      try {
        const iter = AdsApp.search(gaqlQuery);
        while (iter.hasNext()) {
          const row = iter.next();
          const adGroupId = String(getSafeValue(row, 'ad_group.id', ''));
          const criterionId = String(getSafeValue(row, 'ad_group_criterion.criterion_id', ''));
          const keywordText = String(getSafeValue(row, 'ad_group_criterion.keyword.text', ''));
          const costMicros = Number(getSafeValue(row, 'metrics.cost_micros', 0));
          const clicks = Number(getSafeValue(row, 'metrics.clicks', 0));
          const campName = String(getSafeValue(row, 'campaign.name', ''));
          const adGroupName = String(getSafeValue(row, 'ad_group.name', ''));

          if (adGroupId && criterionId) {
            zombieCandidates.push({
              adGroupId,
              criterionId,
              keywordText,
              costMicros,
              costTRY: microsToCurrency(costMicros),
              clicks,
              campName,
              adGroupName
            });
          }
        }
      } catch (err) {
        Logger.log(`[ZombiePauser] GAQL scan failed: ${err.message}`);
      }
    }

    Logger.log(`[ZombiePauser] Identified ${zombieCandidates.length} zombie keyword candidate(s).`);
    if (zombieCandidates.length === 0) {
      return;
    }

    // Step 4: Targeted Batch Mutation via Composite IDs [[adGroupId, criterionId]]
    const compositeIds = zombieCandidates.map(z => [z.adGroupId, z.criterionId]);
    const candidateMap = new Map();
    zombieCandidates.forEach(z => {
      candidateMap.set(`${z.adGroupId}_${z.criterionId}`, z);
    });

    if (typeof AdsApp !== 'undefined' && typeof AdsApp.keywords === 'function') {
      try {
        const kwIter = AdsApp.keywords().withIds(compositeIds).get();

        while (kwIter.hasNext()) {
          const keyword = kwIter.next();
          const agId = String(keyword.getAdGroup().getId());
          const kwId = String(keyword.getId());
          const key = `${agId}_${kwId}`;
          const candidate = candidateMap.get(key);

          const text = candidate ? candidate.keywordText : keyword.getText();
          const cost = candidate ? candidate.costTRY : 0;
          const clicks = candidate ? candidate.clicks : 0;

          this.executor.execute({
            action: 'PAUSE',
            entityType: 'KEYWORD',
            entityId: `${agId}_${kwId}`,
            entityName: text,
            oldValue: 'ENABLED',
            newValue: 'PAUSED',
            details: `Spend: ${cost} TRY, Clicks: ${clicks}, Conv: 0, Threshold: ${this.config.COST_THRESHOLD} TRY, Tagged: ${labelName}`,
            mutateFn: () => {
              keyword.pause();
              keyword.applyLabel(labelName);
            }
          });
        }
      } catch (errKw) {
        Logger.log(`[ZombiePauser] Error executing keyword pauses: ${errKw.message}`);
      }
    }

    Logger.log('[ZombiePauser] Completed zombie keyword pause operations.');
  }
}

/**
 * ------------------------------------------------------------------------------
 * TOOL 3: NEGATIVE KEYWORD MINER (F22)
 * ------------------------------------------------------------------------------
 */
class NegativeKeywordMiner {
  /**
   * @param {Object} config
   * @param {MutationExecutor} executor
   */
  constructor(config, executor) {
    this.config = config.NEGATIVE_MINER;
    this.globalConfig = config;
    this.executor = executor;
    this.processedTerms = new Set();
  }

  /**
   * Evaluates if a term is protected by the Brand Whitelist.
   * @param {string} term
   * @returns {boolean}
   */
  isBrandProtected(term) {
    const patterns = this.config.PROTECTED_BRAND_PATTERNS || [];
    const normalized = String(term).toLowerCase().trim();
    for (let i = 0; i < patterns.length; i++) {
      if (patterns[i].test(normalized)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Formats search term into exact match negative string.
   * Exact Match standard: [search term]
   * @param {string} term
   * @returns {string}
   */
  formatNegativeText(term) {
    const clean = term.replace(/[\[\]]/g, '').trim();
    return `[${clean}]`;
  }

  /**
   * Scans search_term_view via GAQL and adds wasteful queries as exact match negatives.
   */
  run() {
    Logger.log('===============================================================');
    Logger.log('STARTING TOOL 3: NEGATIVE KEYWORD MINER');
    Logger.log('===============================================================');

    if (!this.config.ENABLED) {
      Logger.log('[NegativeMiner] Skipped: Module disabled in configuration.');
      return;
    }

    const spendThresholdMicros = currencyToMicros(this.config.SPEND_THRESHOLD || 150.0);
    const maxNegatives = Number(this.config.MAX_NEGATIVES_PER_RUN) || 50;
    const lookback = this.config.LOOKBACK_WINDOW || 'LAST_30_DAYS';

    const gaqlQuery =
      'SELECT ' +
      'search_term_view.search_term, ' +
      'search_term_view.status, ' +
      'campaign.id, ' +
      'campaign.name, ' +
      'campaign.advertising_channel_type, ' +
      'ad_group.id, ' +
      'ad_group.name, ' +
      'metrics.cost_micros, ' +
      'metrics.clicks, ' +
      'metrics.conversions ' +
      'FROM search_term_view ' +
      'WHERE ' +
      'search_term_view.status = \'NONE\' ' +
      'AND metrics.conversions = 0 ' +
      `AND metrics.cost_micros >= ${spendThresholdMicros} ` +
      `AND segments.date DURING ${lookback} ` +
      'ORDER BY metrics.cost_micros DESC ' +
      `LIMIT ${maxNegatives}`;

    validateGAQLSafety(gaqlQuery);

    const candidates = [];
    if (typeof AdsApp !== 'undefined' && typeof AdsApp.search === 'function') {
      try {
        const iter = AdsApp.search(gaqlQuery);
        while (iter.hasNext()) {
          const row = iter.next();
          const queryText = String(getSafeValue(row, 'search_term_view.search_term', ''));
          const campId = String(getSafeValue(row, 'campaign.id', ''));
          const campName = String(getSafeValue(row, 'campaign.name', ''));
          const channelType = String(getSafeValue(row, 'campaign.advertising_channel_type', ''));
          const costMicros = Number(getSafeValue(row, 'metrics.cost_micros', 0));
          const clicks = Number(getSafeValue(row, 'metrics.clicks', 0));

          if (queryText) {
            candidates.push({
              queryText,
              campId,
              campName,
              channelType,
              costTRY: microsToCurrency(costMicros),
              clicks
            });
          }
        }
      } catch (err) {
        Logger.log(`[NegativeMiner] GAQL search_term_view query failed: ${err.message}`);
      }
    }

    Logger.log(`[NegativeMiner] Found ${candidates.length} search term candidate(s) meeting negative criteria.`);
    if (candidates.length === 0) {
      return;
    }

    // Resolve Shared Negative Keyword List for Performance Max campaigns or account-wide insertion
    let sharedList = null;
    if (this.config.ADD_TO_SHARED_LIST) {
      const listName = this.config.SHARED_LIST_NAME || 'Atli_Medikal_Ortak_Negatifler';
      sharedList = ensureSharedNegativeKeywordList(listName);
    }

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const rawTerm = candidate.queryText;
      const exactNegative = this.formatNegativeText(rawTerm);
      const normalizedKey = exactNegative.toLowerCase();

      // Check deduplication
      if (this.processedTerms.has(normalizedKey)) {
        continue;
      }
      this.processedTerms.add(normalizedKey);

      // Check Brand Protection Whitelist
      if (this.isBrandProtected(rawTerm)) {
        Logger.log(`[NegativeMiner] Term "${rawTerm}" matched Brand Protection Whitelist. Skipping.`);
        this.executor.logger.record({
          action: 'ADD_NEGATIVE',
          entityType: 'SEARCH_TERM',
          entityId: candidate.campId,
          entityName: rawTerm,
          oldValue: 'NONE',
          newValue: 'PROTECTED',
          status: 'SKIPPED',
          mode: this.executor.dryRun ? 'DRY_RUN' : 'LIVE',
          details: 'Protected brand keyword whitelist match'
        });
        continue;
      }

      const isPmax = candidate.channelType === 'PERFORMANCE_MAX' || candidate.campName.toLowerCase().includes('pmax');

      // Routing: Performance Max MUST use Shared Negative Keyword List
      if ((isPmax || this.config.ADD_TO_SHARED_LIST) && sharedList) {
        this.executor.execute({
          action: 'ADD_NEGATIVE',
          entityType: 'SHARED_NEGATIVE',
          entityId: this.config.SHARED_LIST_NAME,
          entityName: exactNegative,
          oldValue: 'NONE',
          newValue: exactNegative,
          details: `Query: "${rawTerm}", Spend: ${candidate.costTRY} TRY, Clicks: ${candidate.clicks}, Source: ${candidate.campName}`,
          mutateFn: () => {
            sharedList.addNegativeKeyword(exactNegative);
          }
        });
      } else {
        // Standard Campaign Negative Insertion
        this.addNegativeToCampaign(candidate, exactNegative, rawTerm);
      }
    }

    Logger.log('[NegativeMiner] Completed negative keyword mining operations.');
  }

  /**
   * Adds negative keyword to a specific standard campaign.
   */
  addNegativeToCampaign(candidate, exactNegative, rawTerm) {
    if (typeof AdsApp === 'undefined' || typeof AdsApp.campaigns !== 'function') return;

    try {
      const campIter = AdsApp.campaigns().withIds([candidate.campId]).get();
      if (campIter.hasNext()) {
        const campaign = campIter.next();
        this.executor.execute({
          action: 'ADD_NEGATIVE',
          entityType: 'CAMPAIGN_NEGATIVE',
          entityId: candidate.campId,
          entityName: exactNegative,
          oldValue: 'NONE',
          newValue: exactNegative,
          details: `Campaign: "${candidate.campName}", Query: "${rawTerm}", Spend: ${candidate.costTRY} TRY, Clicks: ${candidate.clicks}`,
          mutateFn: () => {
            campaign.createNegativeKeyword(exactNegative);
          }
        });
      }
    } catch (err) {
      Logger.log(`[NegativeMiner] Failed to add negative to campaign ${candidate.campId}: ${err.message}`);
    }
  }
}

/**
 * ------------------------------------------------------------------------------
 * TOOL 4: UNIVERSAL BULK STATUS CONTROLLER (F23)
 * ------------------------------------------------------------------------------
 */
class BulkStatusController {
  /**
   * @param {Object} config
   * @param {MutationExecutor} executor
   */
  constructor(config, executor) {
    this.config = config.BULK_STATUS;
    this.globalConfig = config;
    this.executor = executor;
  }

  /**
   * Evaluates if an entity matches configured filters (IDs, Name Regex, Label).
   * @param {Object} entity
   * @param {string} name
   * @param {string|number} id
   * @returns {boolean}
   */
  matchesFilter(entity, name, id) {
    const filter = this.config.FILTER || {};

    // 1. Filter by IDs
    if (filter.BY_IDS && filter.BY_IDS.length > 0) {
      const idMatches = filter.BY_IDS.some(filterId => String(filterId) === String(id));
      if (!idMatches) return false;
    }

    // 2. Filter by Name Regex
    if (filter.BY_NAME_REGEX && filter.BY_NAME_REGEX.trim() !== '') {
      try {
        const regex = new RegExp(filter.BY_NAME_REGEX, 'i');
        if (!regex.test(name)) return false;
      } catch (errRegex) {
        Logger.log(`[BulkStatus] Invalid name regex "${filter.BY_NAME_REGEX}": ${errRegex.message}`);
        return false;
      }
    }

    // 3. Filter by Label
    if (filter.BY_LABEL) {
      try {
        const labelsIter = entity.labels().get();
        let hasLabel = false;
        while (labelsIter.hasNext()) {
          if (labelsIter.next().getName() === filter.BY_LABEL) {
            hasLabel = true;
            break;
          }
        }
        if (!hasLabel) return false;
      } catch (e) {
        return false;
      }
    }

    return true;
  }

  /**
   * Runs bulk status mutations across all requested campaign types or ad groups.
   */
  run() {
    Logger.log('===============================================================');
    Logger.log('STARTING TOOL 4: UNIVERSAL BULK STATUS CONTROLLER');
    Logger.log('===============================================================');

    if (!this.config.ENABLED) {
      Logger.log('[BulkStatus] Skipped: Module disabled in configuration.');
      return;
    }

    const desiredAction = (this.config.ACTION || 'PAUSE').toUpperCase();
    const targetEntity = (this.config.TARGET_ENTITY || 'CAMPAIGN').toUpperCase();
    const todayStr = getAccountDateFormatted();
    const labelPrefix = this.config.LABEL_ON_PAUSE_PREFIX || 'Bulk_Paused_';
    const trackingLabel = `${labelPrefix}${todayStr}`;

    if (desiredAction === 'PAUSE') {
      ensureLabel(trackingLabel, 'Bulk paused by autonomous controller', '#FB8C00');
    }

    if (targetEntity === 'AD_GROUP') {
      this.mutateAdGroups(desiredAction, trackingLabel);
    } else {
      this.mutateCampaigns(desiredAction, trackingLabel);
    }

    Logger.log('[BulkStatus] Completed bulk status operations.');
  }

  /**
   * Executes status changes across multi-type campaigns: Search, PMax, Shopping, Video.
   */
  mutateCampaigns(desiredAction, trackingLabel) {
    const types = this.config.TARGET_CAMPAIGN_TYPES || ['SEARCH_DISPLAY', 'PERFORMANCE_MAX', 'SHOPPING', 'VIDEO'];

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      let iterator = null;

      try {
        switch (type) {
          case 'SEARCH_DISPLAY':
            if (typeof AdsApp !== 'undefined' && typeof AdsApp.campaigns === 'function') {
              iterator = AdsApp.campaigns().get();
            }
            break;
          case 'PERFORMANCE_MAX':
            if (typeof AdsApp !== 'undefined' && typeof AdsApp.performanceMaxCampaigns === 'function') {
              iterator = AdsApp.performanceMaxCampaigns().get();
            }
            break;
          case 'SHOPPING':
            if (typeof AdsApp !== 'undefined' && typeof AdsApp.shoppingCampaigns === 'function') {
              iterator = AdsApp.shoppingCampaigns().get();
            }
            break;
          case 'VIDEO':
            if (typeof AdsApp !== 'undefined' && typeof AdsApp.videoCampaigns === 'function') {
              iterator = AdsApp.videoCampaigns().get();
            }
            break;
        }

        if (!iterator) continue;

        while (iterator.hasNext()) {
          const campaign = iterator.next();
          const name = campaign.getName();
          const id = String(campaign.getId());

          if (!this.matchesFilter(campaign, name, id)) {
            continue;
          }

          const isCurrentlyEnabled = typeof campaign.isEnabled === 'function' ? campaign.isEnabled() : true;
          const currentStatus = isCurrentlyEnabled ? 'ENABLED' : 'PAUSED';

          if (desiredAction === 'PAUSE' && isCurrentlyEnabled) {
            this.executor.execute({
              action: 'PAUSE',
              entityType: `CAMPAIGN_${type}`,
              entityId: id,
              entityName: name,
              oldValue: currentStatus,
              newValue: 'PAUSED',
              details: `Bulk status update to PAUSED. Tagged with ${trackingLabel}`,
              mutateFn: () => {
                campaign.pause();
                if (typeof campaign.applyLabel === 'function') {
                  campaign.applyLabel(trackingLabel);
                }
              }
            });
          } else if (desiredAction === 'ENABLE' && !isCurrentlyEnabled) {
            this.executor.execute({
              action: 'ENABLE',
              entityType: `CAMPAIGN_${type}`,
              entityId: id,
              entityName: name,
              oldValue: currentStatus,
              newValue: 'ENABLED',
              details: `Bulk status update to ENABLED. Untagged ${trackingLabel}`,
              mutateFn: () => {
                campaign.enable();
                if (typeof campaign.removeLabel === 'function') {
                  try {
                    campaign.removeLabel(trackingLabel);
                  } catch (e) {}
                }
              }
            });
          }
        }
      } catch (errType) {
        Logger.log(`[BulkStatus] Error processing campaign type ${type}: ${errType.message}`);
      }
    }
  }

  /**
   * Executes status changes across Ad Groups.
   */
  mutateAdGroups(desiredAction, trackingLabel) {
    if (typeof AdsApp === 'undefined' || typeof AdsApp.adGroups !== 'function') return;

    try {
      const agIter = AdsApp.adGroups().get();

      while (agIter.hasNext()) {
        const adGroup = agIter.next();
        const name = adGroup.getName();
        const id = String(adGroup.getId());

        if (!this.matchesFilter(adGroup, name, id)) {
          continue;
        }

        const isCurrentlyEnabled = typeof adGroup.isEnabled === 'function' ? adGroup.isEnabled() : true;
        const currentStatus = isCurrentlyEnabled ? 'ENABLED' : 'PAUSED';

        if (desiredAction === 'PAUSE' && isCurrentlyEnabled) {
          this.executor.execute({
            action: 'PAUSE',
            entityType: 'AD_GROUP',
            entityId: id,
            entityName: name,
            oldValue: currentStatus,
            newValue: 'PAUSED',
            details: `Bulk status update to PAUSED. Tagged with ${trackingLabel}`,
            mutateFn: () => {
              adGroup.pause();
              if (typeof adGroup.applyLabel === 'function') {
                adGroup.applyLabel(trackingLabel);
              }
            }
          });
        } else if (desiredAction === 'ENABLE' && !isCurrentlyEnabled) {
          this.executor.execute({
            action: 'ENABLE',
            entityType: 'AD_GROUP',
            entityId: id,
            entityName: name,
            oldValue: currentStatus,
            newValue: 'ENABLED',
            details: `Bulk status update to ENABLED. Untagged ${trackingLabel}`,
            mutateFn: () => {
              adGroup.enable();
              if (typeof adGroup.removeLabel === 'function') {
                try {
                  adGroup.removeLabel(trackingLabel);
                } catch (e) {}
              }
            }
          });
        }
      }
    } catch (err) {
      Logger.log(`[BulkStatus] Error processing ad groups: ${err.message}`);
    }
  }
}

/**
 * ------------------------------------------------------------------------------
 * TOOL 5: ONE-CLICK ROLLBACK ENGINE (F25)
 * ------------------------------------------------------------------------------
 */
class RollbackManager {
  /**
   * @param {Object} config
   * @param {MutationExecutor} executor
   */
  constructor(config, executor) {
    this.config = config.ROLLBACK;
    this.globalConfig = config;
    this.executor = executor;
  }

  /**
   * Restores paused keywords, campaigns, and ad groups that carry the target label.
   */
  run() {
    Logger.log('===============================================================');
    Logger.log('STARTING TOOL 5: ONE-CLICK ROLLBACK ENGINE');
    Logger.log('===============================================================');

    const targetLabel = this.config.TARGET_LABEL;
    if (!targetLabel || targetLabel.trim() === '') {
      Logger.log('[Rollback] ABORTED: No target label specified in CONFIG.ROLLBACK.TARGET_LABEL.');
      return;
    }

    if (typeof AdsApp === 'undefined' || typeof AdsApp.labels !== 'function') {
      Logger.log('[Rollback] AdsApp.labels unavailable.');
      return;
    }

    Logger.log(`[Rollback] Searching for entities tagged with label "${targetLabel}"...`);

    let labelObj = null;
    try {
      const labelIter = AdsApp.labels().withCondition(`label.name = '${targetLabel}'`).get();
      if (labelIter.hasNext()) {
        labelObj = labelIter.next();
      } else {
        const altIter = AdsApp.labels().withCondition(`Name = '${targetLabel}'`).get();
        if (altIter.hasNext()) {
          labelObj = altIter.next();
        }
      }
    } catch (e) {}

    if (!labelObj) {
      Logger.log(`[Rollback] Label "${targetLabel}" not found in account.`);
      return;
    }

    let restoredKeywords = 0;
    let restoredCampaigns = 0;
    let restoredAdGroups = 0;

    // 1. Rollback Keywords
    try {
      if (typeof labelObj.keywords === 'function') {
        const kwIter = labelObj.keywords().get();
        while (kwIter.hasNext()) {
          const kw = kwIter.next();
          const id = String(kw.getId());
          const text = kw.getText();

          this.executor.execute({
            action: 'ROLLBACK',
            entityType: 'KEYWORD',
            entityId: id,
            entityName: text,
            oldValue: 'PAUSED',
            newValue: 'ENABLED',
            details: `Rollback applied. Re-enabled keyword and removed label "${targetLabel}"`,
            mutateFn: () => {
              kw.enable();
              kw.removeLabel(targetLabel);
            }
          });
          restoredKeywords++;
        }
      }
    } catch (errKw) {
      Logger.log(`[Rollback] Error rolling back keywords: ${errKw.message}`);
    }

    // 2. Rollback Campaigns
    try {
      if (typeof labelObj.campaigns === 'function') {
        const campIter = labelObj.campaigns().get();
        while (campIter.hasNext()) {
          const camp = campIter.next();
          const id = String(camp.getId());
          const name = camp.getName();

          this.executor.execute({
            action: 'ROLLBACK',
            entityType: 'CAMPAIGN',
            entityId: id,
            entityName: name,
            oldValue: 'PAUSED',
            newValue: 'ENABLED',
            details: `Rollback applied. Re-enabled campaign and removed label "${targetLabel}"`,
            mutateFn: () => {
              camp.enable();
              camp.removeLabel(targetLabel);
            }
          });
          restoredCampaigns++;
        }
      }
    } catch (errCamp) {
      Logger.log(`[Rollback] Error rolling back campaigns: ${errCamp.message}`);
    }

    // 3. Rollback Ad Groups
    try {
      if (typeof labelObj.adGroups === 'function') {
        const agIter = labelObj.adGroups().get();
        while (agIter.hasNext()) {
          const ag = agIter.next();
          const id = String(ag.getId());
          const name = ag.getName();

          this.executor.execute({
            action: 'ROLLBACK',
            entityType: 'AD_GROUP',
            entityId: id,
            entityName: name,
            oldValue: 'PAUSED',
            newValue: 'ENABLED',
            details: `Rollback applied. Re-enabled ad group and removed label "${targetLabel}"`,
            mutateFn: () => {
              ag.enable();
              ag.removeLabel(targetLabel);
            }
          });
          restoredAdGroups++;
        }
      }
    } catch (errAg) {
      Logger.log(`[Rollback] Error rolling back ad groups: ${errAg.message}`);
    }

    Logger.log(
      `[Rollback] Completed rollback for "${targetLabel}": ` +
      `${restoredKeywords} keyword(s), ${restoredCampaigns} campaign(s), ${restoredAdGroups} ad group(s) restored.`
    );
  }
}

/**
 * ------------------------------------------------------------------------------
 * MASTER COMMAND DISPATCHER & MAIN ENTRYPOINT
 * ------------------------------------------------------------------------------
 */

/**
 * Master entrypoint invoked by the Google Ads Scripts scheduler or manual run.
 */
function main() {
  const startTime = new Date();
  Logger.log('==============================================================================');
  Logger.log('ATLI MEDIKAL - R3: COMMAND-BASED ACTION & CONTROL SUITE');
  Logger.log(`Execution Mode : ${R3_CONFIG.DRY_RUN ? 'DRY_RUN (Simulation Mode)' : 'LIVE (Mutations Active)'}`);
  Logger.log(`Active Command : ${R3_CONFIG.ACTIVE_COMMAND}`);
  Logger.log(`Timestamp      : ${startTime.toISOString()}`);
  Logger.log('==============================================================================');

  const auditLogger = new AuditLogger(R3_CONFIG.SPREADSHEET_URL);
  const executor = new MutationExecutor(R3_CONFIG.DRY_RUN, auditLogger);

  const command = (R3_CONFIG.ACTIVE_COMMAND || 'RUN_ALL').toUpperCase();

  try {
    switch (command) {
      case 'BUDGET_PACING': {
        const budgetMgr = new BudgetManager(R3_CONFIG, executor);
        budgetMgr.run();
        break;
      }

      case 'ZOMBIE_PAUSER': {
        const zombiePauser = new ZombieKeywordPauser(R3_CONFIG, executor);
        zombiePauser.run();
        break;
      }

      case 'NEGATIVE_MINER': {
        const negativeMiner = new NegativeKeywordMiner(R3_CONFIG, executor);
        negativeMiner.run();
        break;
      }

      case 'BULK_STATUS': {
        const bulkStatus = new BulkStatusController(R3_CONFIG, executor);
        bulkStatus.run();
        break;
      }

      case 'ROLLBACK': {
        const rollbackMgr = new RollbackManager(R3_CONFIG, executor);
        rollbackMgr.run();
        break;
      }

      case 'RUN_ALL': {
        Logger.log('[MAIN] Running sequential suite: Budget Manager -> Zombie Pauser -> Negative Miner');

        // 1. Budget Manager & Pacing
        const budgetMgr = new BudgetManager(R3_CONFIG, executor);
        budgetMgr.run();

        // 2. Zombie Keyword Pauser
        const zombiePauser = new ZombieKeywordPauser(R3_CONFIG, executor);
        zombiePauser.run();

        // 3. Negative Keyword Miner
        const negativeMiner = new NegativeKeywordMiner(R3_CONFIG, executor);
        negativeMiner.run();
        break;
      }

      default:
        Logger.log(`[MAIN] Unknown ACTIVE_COMMAND "${command}". Please select a valid command.`);
        break;
    }
  } catch (errMain) {
    Logger.log(`[MAIN FATAL ERROR] Uncaught exception during command execution: ${errMain.message}`);
    auditLogger.record({
      action: 'SYSTEM_ERROR',
      entityType: 'SCRIPT',
      entityId: 'MAIN',
      entityName: 'action_and_control_suite.js',
      oldValue: command,
      newValue: 'ERROR',
      status: 'FAILED',
      mode: R3_CONFIG.DRY_RUN ? 'DRY_RUN' : 'LIVE',
      details: errMain.message
    });
  } finally {
    // Flush buffered audit records to Google Sheet via matrix setValues()
    auditLogger.flushToSheet();

    const endTime = new Date();
    const durationSec = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(1);
    Logger.log('==============================================================================');
    Logger.log(`Execution completed in ${durationSec}s. Total audit records: ${auditLogger.records.length}`);
    Logger.log('==============================================================================');
  }
}

/**
 * ------------------------------------------------------------------------------
 * COMMONJS EXPORT ADAPTER (FOR NODE.JS TEST RUNNERS & MOCK HARNESSES)
 * ------------------------------------------------------------------------------
 * Seamlessly exposes functions and classes in Node.js while remaining inert in Apps Script V8.
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    R3_CONFIG,
    CONFIG: R3_CONFIG,
    main,
    validateGAQLSafety,
    microsToCurrency,
    currencyToMicros,
    getSafeValue,
    writeMatrixToSheet,
    getAccountDateFormatted,
    getIsoTimestamp,
    ensureLabel,
    ensureSharedNegativeKeywordList,
    AuditLogger,
    MutationExecutor,
    ConversionCircuitBreaker,
    BudgetManager,
    ZombieKeywordPauser,
    NegativeKeywordMiner,
    BulkStatusController,
    RollbackManager
  };
}
