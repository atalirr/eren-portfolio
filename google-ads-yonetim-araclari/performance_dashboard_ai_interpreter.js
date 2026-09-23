/**
 * ==============================================================================
 * ATLI MEDIKAL — ENTERPRISE GOOGLE ADS AUTOMATION SUITE
 * Script: R2 Daily Autonomous Performance & AI Interpretation Dashboard
 * File: performance_dashboard_ai_interpreter.js
 * Version: 1.0.0-PROD
 * Runtime: Google Ads Scripts (V8 Engine) / GAQL / Google Apps Script
 *
 * SCOPE & RESPONSIBILITIES:
 * 1. Multi-timeframe GAQL extraction across 30d, 14d, 7d, and Yesterday
 * 2. 11 core KPIs extraction & aggregation with Period-over-Period (PoP) deltas
 * 3. Directional trend arrows (▲, ▼, ▬) and inverted color coding for cost/CPA metrics
 * 4. Boundary handling for Impression Share (<0.1 -> "<10%", >0.9 -> ">90%")
 * 5. 8-Rule Anomaly Alerting Engine (Spend Spikes, Zero-Conv Leaks, CTR/CPC Volatility, IS Losses)
 * 6. Copyable AI Interpretation Markdown Block (Ready for Claude, ChatGPT, Gemini)
 * 7. Google Sheets 5-Tab Dashboard Exporter with batch matrix setValues()
 * 8. Strict non-billing security gatekeeper (validateGAQLSafety)
 * ==============================================================================
 */

// ==============================================================================
// 1. CONFIGURATION BLOCK
// ==============================================================================
const CONFIG = {
  // Target Google Sheet URL or ID. If left empty, a new Spreadsheet will be created automatically.
  SPREADSHEET_URL: '',

  // Account Identification & Localisation
  ACCOUNT_NAME: 'Atli Medikal',
  CUSTOMER_ID: '893-465-2990',
  TIMEZONE: 'Europe/Istanbul',
  CURRENCY_SYMBOL: '₺',

  // Target Efficiency Benchmarks
  TARGETS: {
    TARGET_CPA: 150.00,  // Target Cost Per Acquisition in TRY
    TARGET_ROAS: 3.50    // Target Return on Ad Spend (multiplier)
  },

  // 8-Rule Anomaly Alerting Thresholds
  THRESHOLDS: {
    // ANO-01: Account Spend Spike
    MIN_ACCOUNT_DAILY_SPEND: 200.00, // Minimum yesterday spend (TRY) to evaluate account spend spike
    SPEND_SPIKE_MULTIPLIER: 1.50,     // >150% of 7-day daily average triggers CRITICAL alert

    // ANO-02: Campaign Spend Spike
    MIN_CAMPAIGN_DAILY_SPEND: 100.00, // Minimum yesterday spend (TRY) to evaluate campaign spike
    CAMPAIGN_SPEND_SPIKE_MULT: 1.75,  // >175% of campaign 7-day daily average triggers WARNING

    // ANO-03: Keyword Zero-Conversion Bleed
    ZERO_CONV_KW_COST_LIMIT: 300.00,  // Keywords spending >= 300 TRY with 0 conversions trigger CRITICAL

    // ANO-04: Search Term Waste
    ZERO_CONV_TERM_COST_LIMIT: 150.00, // Search queries spending >= 150 TRY with 0 conversions trigger CRITICAL

    // ANO-05: Severe CTR Collapse
    MIN_CTR_IMPRESSIONS: 200,         // Minimum impressions gate to eliminate statistical noise
    CTR_DROP_RATIO: 0.30,             // >30% drop vs 7D/14D baseline triggers WARNING

    // ANO-06: Severe CPC Surge
    MIN_CPC_CLICKS: 15,               // Minimum clicks gate to eliminate outlier clicks
    CPC_SURGE_RATIO: 0.40,            // >40% inflation vs 7D/14D baseline triggers WARNING

    // ANO-07: Budget-Constrained Champion (Opportunity)
    BUDGET_LOST_IS_ALERT: 0.20,       // >= 20% Search Budget Lost IS on profitable campaigns

    // ANO-08: Severe Quality/Rank Deficit
    RANK_LOST_IS_ALERT: 0.40          // >= 40% Search Rank Lost IS triggers WARNING
  },

  // Sheet Tab Identifiers
  TABS: {
    DASHBOARD_KPI: 'DASHBOARD_KPI',
    ANOMALIES_ALERTS: 'ANOMALIES_ALERTS',
    AI_PROMPT_SUMMARY: 'AI_PROMPT_SUMMARY',
    CAMPAIGN_PERFORMANCE: 'CAMPAIGN_PERFORMANCE',
    SETTINGS_CONFIG: 'SETTINGS_CONFIG'
  },

  // Color Palette Constants
  PALETTE: {
    HEADER_BG: '#0F172A',         // Deep Slate Navy
    HEADER_TEXT: '#FFFFFF',       // Crisp White
    SUBHEADER_BG: '#1E293B',      // Slate Gray
    CARD_BG: '#F8FAFC',           // Ghost White
    BORDER: '#CBD5E1',            // Border Slate
    ZEBRA_EVEN: '#FFFFFF',        // White
    ZEBRA_ODD: '#F1F5F9',         // Very Soft Slate
    WIN_BG: '#DCFCE7',            // Soft Emerald
    WIN_TEXT: '#166534',          // Dark Emerald
    WARN_BG: '#FEF3C7',           // Soft Amber
    WARN_TEXT: '#92400E',         // Dark Amber
    CRITICAL_BG: '#FEE2E2',       // Soft Crimson
    CRITICAL_TEXT: '#991B1B',     // Dark Crimson
    NEUTRAL_BG: '#F8FAFC',        // Neutral Slate
    NEUTRAL_TEXT: '#475569'       // Muted Slate
  }
};

// ==============================================================================
// 2. SECURITY & PRIVACY GATEKEEPER
// ==============================================================================

/**
 * Strict validator preventing queries from accessing restricted billing resources.
 * Mandated by Project Safety & Privacy Gatekeeper contract.
 *
 * @param {string} query GAQL query string to validate
 * @returns {boolean} True if safe, throws Error if prohibited
 */
function validateGAQLSafety(query) {
  if (!query || typeof query !== 'string') {
    throw new Error('GAQL Safety Violation: Invalid or empty query provided.');
  }

  const FORBIDDEN_BILLING_RESOURCES = [
    'billing_setup',
    'account_budget',
    'invoice',
    'payments_account',
    'billing_status'
  ];

  const lowerQuery = query.toLowerCase();
  for (let i = 0; i < FORBIDDEN_BILLING_RESOURCES.length; i++) {
    const forbidden = FORBIDDEN_BILLING_RESOURCES[i];
    // Regex ensuring boundary matching (e.g. account_budget vs campaign_budget)
    const regex = new RegExp('\\b' + forbidden + '\\b', 'i');
    if (regex.test(lowerQuery)) {
      throw new Error(`SAFETY VIOLATION: Query references restricted billing resource: ${forbidden}`);
    }
  }

  return true;
}

// ==============================================================================
// 3. CORE METRIC UTILITIES & MATHEMATICAL ENGINE
// ==============================================================================

/**
 * Normalizes micro-currency values (cost_micros, average_cpc) to standard currency.
 *
 * @param {number|string|null} micros Amount in micros (1/1,000,000)
 * @returns {number} Normalized currency value rounded to 2 decimals
 */
function microsToCurrency(micros) {
  if (micros === null || micros === undefined || isNaN(micros)) {
    return 0.00;
  }
  return Number((Number(micros) / 1000000.0).toFixed(2));
}

/**
 * Null-safe property traversal handling discrepancies between GAQL snake_case
 * and Google Ads Scripts V8 lowerCamelCase object properties.
 *
 * @param {Object} row GAQL row object
 * @param {string} path Dot-separated property path (e.g. 'metrics.cost_micros')
 * @param {*} fallback Value to return if property does not exist
 * @returns {*} Retrieved value or fallback
 */
function getSafeValue(row, path, fallback = null) {
  if (!row || !path) return fallback;
  const parts = path.split('.');
  let current = row;

  for (let i = 0; i < parts.length; i++) {
    if (current === null || current === undefined) return fallback;
    const part = parts[i];

    if (part in current) {
      current = current[part];
    } else {
      // Try snake_case -> lowerCamelCase
      const camel = part.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
      if (camel in current) {
        current = current[camel];
      } else {
        // Try lowerCamelCase -> snake_case
        const snake = part.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (snake in current) {
          current = current[snake];
        } else {
          return fallback;
        }
      }
    }
  }

  return (current !== undefined && current !== null) ? current : fallback;
}

/**
 * Robust boundary handling for Impression Share metrics according to Google Ads API spec:
 * - < 0.10 (API returns <= 0.0999) formatted as "< 10%"
 * - > 0.90 (API returns >= 0.9001) formatted as "> 90%"
 * - null/undefined/missing formatted as "--"
 * - Numeric ratios formatted as percentage (e.g. 68.4%)
 *
 * @param {number|string|null} val Raw impression share value
 * @returns {string} Formatted impression share string
 */
function formatImpressionShare(val) {
  if (val === null || val === undefined || val === '' || val === '--') {
    return '--';
  }
  const num = typeof val === 'string' ? parseFloat(val) : Number(val);
  if (isNaN(num)) {
    return String(val);
  }
  if (num <= 0.0999) {
    return '< 10%';
  }
  if (num >= 0.9001) {
    return '> 90%';
  }
  return (num * 100).toFixed(1) + '%';
}

/**
 * Parses impression share string or numeric representation into a standard float (0.0 to 1.0).
 *
 * @param {*} val Raw impression share representation
 * @returns {number} Normalized float ratio
 */
function parseImpressionShareToNumber(val) {
  if (val === null || val === undefined || val === '' || val === '--') return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    if (val.includes('<')) return 0.0999;
    if (val.includes('>')) return 0.9001;
    const clean = parseFloat(val.replace('%', '').trim());
    return isNaN(clean) ? 0 : clean / 100.0;
  }
  return 0;
}

/**
 * Calculates Period-over-Period (PoP) percentage delta safely handling zero baselines.
 *
 * @param {number} current Current period metric
 * @param {number} prior Baseline period metric
 * @returns {number} Percentage change
 */
function calculateDelta(current, prior) {
  const c = Number(current) || 0;
  const p = Number(prior) || 0;
  if (p === 0 && c === 0) return 0.0;
  if (p === 0 && c > 0) return 100.0;
  if (c === 0 && p > 0) return -100.0;
  return ((c - p) / p) * 100.0;
}

/**
 * Formats trend deltas with directional indicators (▲, ▼, ▬) and color polarity.
 *
 * @param {number} delta Calculated percentage change
 * @param {boolean} isInverted If true, cost/CPA metrics where increases are negative
 * @returns {Object} { symbol, text, delta, textColor, bgColor }
 */
function formatTrendDelta(delta, isInverted = false) {
  const d = Number(delta) || 0;
  let symbol = '▬';
  let formatted = Math.abs(d) < 0.05 ? '0.0%' : (d > 0 ? `+${d.toFixed(1)}%` : `${d.toFixed(1)}%`);
  let textColor = CONFIG.PALETTE.NEUTRAL_TEXT;
  let bgColor = CONFIG.PALETTE.NEUTRAL_BG;

  if (d > 2.0) {
    symbol = '▲';
    formatted = `+${d.toFixed(1)}%`;
    if (isInverted) {
      textColor = CONFIG.PALETTE.CRITICAL_TEXT;
      bgColor = CONFIG.PALETTE.CRITICAL_BG;
    } else {
      textColor = CONFIG.PALETTE.WIN_TEXT;
      bgColor = CONFIG.PALETTE.WIN_BG;
    }
  } else if (d < -2.0) {
    symbol = '▼';
    formatted = `${d.toFixed(1)}%`;
    if (isInverted) {
      textColor = CONFIG.PALETTE.WIN_TEXT;
      bgColor = CONFIG.PALETTE.WIN_BG;
    } else {
      textColor = CONFIG.PALETTE.CRITICAL_TEXT;
      bgColor = CONFIG.PALETTE.CRITICAL_BG;
    }
  }

  return {
    symbol,
    text: `${symbol} ${formatted}`,
    delta: d,
    textColor,
    bgColor
  };
}

/**
 * Formats dates in ISO 'yyyy-MM-dd' format respecting the account timezone.
 *
 * @param {Date|number} date Date object or timestamp
 * @param {string} tz Timezone (default: Europe/Istanbul)
 * @returns {string} Formatted ISO date
 */
function formatDateIso(date, tz) {
  const timezone = tz || CONFIG.TIMEZONE || 'Europe/Istanbul';
  if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
    try {
      return Utilities.formatDate(new Date(date), timezone, 'yyyy-MM-dd');
    } catch (e) {
      // Fallback
    }
  }

  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Computes offset date strings (e.g. 7 days ago).
 *
 * @param {number} daysAgo Number of days back
 * @param {string} tz Timezone
 * @returns {string} Formatted date string
 */
function getDateOffset(daysAgo, tz) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return formatDateIso(d, tz);
}

// ==============================================================================
// 4. GAQL INGESTION & DATA COLLECTION ENGINE
// ==============================================================================

/**
 * Executes a GAQL query with mandatory security validation.
 *
 * @param {string} query GAQL query string
 * @returns {Array<Object>} Query result rows
 */
function executeGAQLQuery(query) {
  validateGAQLSafety(query);
  const rows = [];

  if (typeof AdsApp !== 'undefined' && AdsApp.search) {
    try {
      const iterator = AdsApp.search(query);
      while (iterator.hasNext()) {
        rows.push(iterator.next());
      }
    } catch (err) {
      Logger.log(`GAQL Execution Error for query: ${query}\nError: ${err.message}`);
      throw err;
    }
  }

  return rows;
}

/**
 * Parses and maps a raw GAQL campaign row into a normalized structure.
 *
 * @param {Object} row Raw GAQL row
 * @returns {Object} Normalized campaign data
 */
function parseCampaignRow(row) {
  const id = String(getSafeValue(row, 'campaign.id', ''));
  const name = String(getSafeValue(row, 'campaign.name', 'Unnamed Campaign'));
  const status = String(getSafeValue(row, 'campaign.status', 'UNKNOWN'));
  const channelType = String(getSafeValue(row, 'campaign.advertising_channel_type', 'UNKNOWN'));
  const budgetMicros = Number(getSafeValue(row, 'campaign_budget.amount_micros', 0)) || 0;
  const budget = microsToCurrency(budgetMicros);

  const impressions = Number(getSafeValue(row, 'metrics.impressions', 0)) || 0;
  const clicks = Number(getSafeValue(row, 'metrics.clicks', 0)) || 0;
  const costMicros = Number(getSafeValue(row, 'metrics.cost_micros', 0)) || 0;
  const cost = microsToCurrency(costMicros);
  const conversions = Number(getSafeValue(row, 'metrics.conversions', 0)) || 0;
  const conversionsValue = Number(getSafeValue(row, 'metrics.conversions_value', 0)) || 0;

  const ctr = impressions > 0 ? (clicks / impressions) : 0.0;
  const averageCpc = clicks > 0 ? Number((cost / clicks).toFixed(2)) : 0.0;
  const cpa = conversions > 0 ? Number((cost / conversions).toFixed(2)) : 0.0;
  const roas = cost > 0 ? Number((conversionsValue / cost).toFixed(2)) : 0.0;

  const searchIS = getSafeValue(row, 'metrics.search_impression_share');
  const searchBudgetLostIS = getSafeValue(row, 'metrics.search_budget_lost_impression_share');
  const searchRankLostIS = getSafeValue(row, 'metrics.search_rank_lost_impression_share');

  return {
    id,
    name,
    status,
    channelType,
    budget,
    impressions,
    clicks,
    cost,
    costMicros,
    conversions,
    conversionsValue: Number(conversionsValue.toFixed(2)),
    ctr,
    averageCpc,
    cpa,
    roas,
    searchIS,
    searchBudgetLostIS,
    searchRankLostIS
  };
}

/**
 * Aggregates campaign-level records into account-wide multi-timeframe KPI totals.
 *
 * @param {Array<Object>} campaignRows Normalized campaign records
 * @returns {Object} Aggregated account KPIs
 */
function aggregateTimeframeMetrics(campaignRows) {
  let impressions = 0;
  let clicks = 0;
  let costMicros = 0;
  let conversions = 0;
  let conversionsValue = 0;

  let searchImpressions = 0;
  let totalWeightedIS = 0;
  let totalWeightedBudgetLostIS = 0;
  let totalWeightedRankLostIS = 0;
  let hasSearchData = false;

  for (let i = 0; i < campaignRows.length; i++) {
    const c = campaignRows[i];
    impressions += c.impressions;
    clicks += c.clicks;
    costMicros += c.costMicros;
    conversions += c.conversions;
    conversionsValue += c.conversionsValue;

    if (c.searchIS !== null && c.searchIS !== undefined && c.impressions > 0) {
      hasSearchData = true;
      const numIS = parseImpressionShareToNumber(c.searchIS);
      const numBudgetLost = parseImpressionShareToNumber(c.searchBudgetLostIS);
      const numRankLost = parseImpressionShareToNumber(c.searchRankLostIS);

      searchImpressions += c.impressions;
      totalWeightedIS += (numIS * c.impressions);
      totalWeightedBudgetLostIS += (numBudgetLost * c.impressions);
      totalWeightedRankLostIS += (numRankLost * c.impressions);
    }
  }

  const cost = microsToCurrency(costMicros);
  const ctr = impressions > 0 ? (clicks / impressions) : 0.0;
  const averageCpc = clicks > 0 ? Number((cost / clicks).toFixed(2)) : 0.0;
  const cpa = conversions > 0 ? Number((cost / conversions).toFixed(2)) : 0.0;
  const roas = cost > 0 ? Number((conversionsValue / cost).toFixed(2)) : 0.0;

  const searchIS = (hasSearchData && searchImpressions > 0) ? (totalWeightedIS / searchImpressions) : null;
  const searchBudgetLostIS = (hasSearchData && searchImpressions > 0) ? (totalWeightedBudgetLostIS / searchImpressions) : null;
  const searchRankLostIS = (hasSearchData && searchImpressions > 0) ? (totalWeightedRankLostIS / searchImpressions) : null;

  return {
    impressions,
    clicks,
    ctr,
    averageCpc,
    cost,
    costMicros,
    conversions,
    cpa,
    conversionsValue: Number(conversionsValue.toFixed(2)),
    roas,
    searchIS,
    searchBudgetLostIS,
    searchRankLostIS
  };
}

/**
 * Builds the base GAQL query string for campaign performance.
 *
 * @param {string} dateFilter GAQL date filter (e.g. "segments.date DURING YESTERDAY")
 * @returns {string} GAQL query string
 */
function buildCampaignQuery(dateFilter) {
  return `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign_budget.amount_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros,
      metrics.conversions,
      metrics.cost_per_conversion,
      metrics.conversions_value,
      metrics.conversions_value_per_cost,
      metrics.search_impression_share,
      metrics.search_budget_lost_impression_share,
      metrics.search_rank_lost_impression_share
    FROM campaign
    WHERE campaign.status != 'REMOVED'
      AND ${dateFilter}
  `.trim();
}

/**
 * Ingests all telemetry data across all rolling and baseline comparison windows.
 *
 * @param {Object} config Configuration settings
 * @returns {Object} Comprehensive telemetry package
 */
function fetchAllTelemetryData(config) {
  const tz = config.TIMEZONE || 'Europe/Istanbul';

  // Compute exact ISO date ranges for comparative baseline windows
  const d2Date = getDateOffset(2, tz);
  const p7Start = getDateOffset(14, tz);
  const p7End = getDateOffset(8, tz);
  const p14Start = getDateOffset(28, tz);
  const p14End = getDateOffset(15, tz);
  const p30Start = getDateOffset(60, tz);
  const p30End = getDateOffset(31, tz);

  // Queries for Current and Prior Windows
  const queries = {
    yesterday: buildCampaignQuery('segments.date DURING YESTERDAY'),
    d2: buildCampaignQuery(`segments.date BETWEEN '${d2Date}' AND '${d2Date}'`),
    last7d: buildCampaignQuery('segments.date DURING LAST_7_DAYS'),
    prior7d: buildCampaignQuery(`segments.date BETWEEN '${p7Start}' AND '${p7End}'`),
    last14d: buildCampaignQuery('segments.date DURING LAST_14_DAYS'),
    prior14d: buildCampaignQuery(`segments.date BETWEEN '${p14Start}' AND '${p14End}'`),
    last30d: buildCampaignQuery('segments.date DURING LAST_30_DAYS'),
    prior30d: buildCampaignQuery(`segments.date BETWEEN '${p30Start}' AND '${p30End}'`)
  };

  const rawData = {};
  const campaignsData = {};
  const timeframeAggregates = {};

  for (const windowKey of Object.keys(queries)) {
    const rawRows = executeGAQLQuery(queries[windowKey]);
    rawData[windowKey] = rawRows;
    const parsedCampaigns = rawRows.map(parseCampaignRow);
    campaignsData[windowKey] = parsedCampaigns;
    timeframeAggregates[windowKey] = aggregateTimeframeMetrics(parsedCampaigns);
  }

  // Query Zero-Conversion Keywords for Anomaly Rule ANO-03 (Last 30 Days)
  const kwLimitMicros = Math.floor(config.THRESHOLDS.ZERO_CONV_KW_COST_LIMIT * 1000000);
  const zeroConvKwQuery = `
    SELECT
      campaign.name,
      campaign.id,
      ad_group.name,
      ad_group.id,
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions
    FROM ad_group_criterion
    WHERE ad_group_criterion.type = 'KEYWORD'
      AND campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      AND ad_group_criterion.status = 'ENABLED'
      AND segments.date DURING LAST_30_DAYS
      AND metrics.conversions = 0
      AND metrics.cost_micros >= ${kwLimitMicros}
  `.trim();

  const rawZeroConvKws = executeGAQLQuery(zeroConvKwQuery);
  const zeroConvKeywords = rawZeroConvKws.map(row => ({
    campaignName: String(getSafeValue(row, 'campaign.name', 'Unnamed Campaign')),
    campaignId: String(getSafeValue(row, 'campaign.id', '')),
    adGroupName: String(getSafeValue(row, 'ad_group.name', 'Unnamed AdGroup')),
    adGroupId: String(getSafeValue(row, 'ad_group.id', '')),
    criterionId: String(getSafeValue(row, 'ad_group_criterion.criterion_id', '')),
    text: String(getSafeValue(row, 'ad_group_criterion.keyword.text', '')),
    matchType: String(getSafeValue(row, 'ad_group_criterion.keyword.match_type', 'EXACT')),
    cost: microsToCurrency(getSafeValue(row, 'metrics.cost_micros', 0)),
    clicks: Number(getSafeValue(row, 'metrics.clicks', 0)) || 0,
    impressions: Number(getSafeValue(row, 'metrics.impressions', 0)) || 0,
    conversions: Number(getSafeValue(row, 'metrics.conversions', 0)) || 0
  })).sort((a, b) => b.cost - a.cost);

  // Query Wasteful Search Terms for Anomaly Rule ANO-04 (Last 30 Days)
  const termLimitMicros = Math.floor(config.THRESHOLDS.ZERO_CONV_TERM_COST_LIMIT * 1000000);
  const wasteTermsQuery = `
    SELECT
      search_term_view.search_term,
      campaign.name,
      campaign.id,
      ad_group.name,
      ad_group.id,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions
    FROM search_term_view
    WHERE segments.date DURING LAST_30_DAYS
      AND metrics.conversions = 0
      AND metrics.cost_micros >= ${termLimitMicros}
  `.trim();

  const rawWasteTerms = executeGAQLQuery(wasteTermsQuery);
  const wasteSearchTerms = rawWasteTerms.map(row => ({
    text: String(getSafeValue(row, 'search_term_view.search_term', '')),
    campaignName: String(getSafeValue(row, 'campaign.name', 'Unnamed Campaign')),
    campaignId: String(getSafeValue(row, 'campaign.id', '')),
    adGroupName: String(getSafeValue(row, 'ad_group.name', 'Unnamed AdGroup')),
    adGroupId: String(getSafeValue(row, 'ad_group.id', '')),
    cost: microsToCurrency(getSafeValue(row, 'metrics.cost_micros', 0)),
    clicks: Number(getSafeValue(row, 'metrics.clicks', 0)) || 0,
    impressions: Number(getSafeValue(row, 'metrics.impressions', 0)) || 0,
    conversions: Number(getSafeValue(row, 'metrics.conversions', 0)) || 0
  })).sort((a, b) => b.cost - a.cost);

  return {
    timeframes: timeframeAggregates,
    campaigns: campaignsData,
    zeroConvKeywords,
    wasteSearchTerms,
    dates: {
      yesterday: getDateOffset(1, tz),
      d2: d2Date,
      p7Start, p7End,
      p14Start, p14End,
      p30Start, p30End
    }
  };
}

// ==============================================================================
// 5. 8-RULE ANOMALY ALERTING ENGINE
// ==============================================================================

/**
 * Evaluates account, campaign, keyword, and search query telemetry against the
 * 8 mathematical anomaly rules and thresholds.
 *
 * @param {Object} telemetry Collected telemetry data
 * @param {Object} config Configuration settings
 * @returns {Array<Object>} List of triggered anomalies sorted by severity
 */
function evaluateAnomalies(telemetry, config) {
  const anomalies = [];
  const thresholds = config.THRESHOLDS;
  const targets = config.TARGETS;
  const yest = telemetry.timeframes.yesterday;
  const l7d = telemetry.timeframes.last7d;
  const l14d = telemetry.timeframes.last14d;
  const l30d = telemetry.timeframes.last30d;

  // 1. ANO-01: Account Spend Spike (>150% of 7-day daily average, min spend gate 200 TRY)
  const l7dDailyAvgSpend = (l7d.cost || 0) / 7.0;
  if (l7dDailyAvgSpend > 0 && yest.cost >= thresholds.MIN_ACCOUNT_DAILY_SPEND) {
    const spikeLimit = l7dDailyAvgSpend * thresholds.SPEND_SPIKE_MULTIPLIER;
    if (yest.cost > spikeLimit) {
      const deltaPct = ((yest.cost - l7dDailyAvgSpend) / l7dDailyAvgSpend) * 100.0;
      anomalies.push({
        ruleId: 'ANO-01',
        name: 'Account Spend Spike',
        severity: 'CRITICAL',
        entityType: 'ACCOUNT',
        entityName: config.ACCOUNT_NAME || 'Atli Medikal',
        entityId: config.CUSTOMER_ID || 'ACCOUNT',
        observedMetric: `Yesterday Spend: ${yest.cost.toFixed(2)} ${config.CURRENCY_SYMBOL}`,
        baseline: `7D Daily Avg: ${l7dDailyAvgSpend.toFixed(2)} ${config.CURRENCY_SYMBOL} (Limit: ${spikeLimit.toFixed(2)} ${config.CURRENCY_SYMBOL})`,
        deltaBleed: `+${deltaPct.toFixed(1)}% (+${(yest.cost - l7dDailyAvgSpend).toFixed(2)} ${config.CURRENCY_SYMBOL})`,
        recommendation: 'Immediate investigation of runaway automated bidding, anomalous broad query surge, or malicious invalid clicks.'
      });
    }
  }

  // 2. ANO-02: Campaign Spend Spike (>175% of campaign 7-day daily average, min spend gate 100 TRY)
  const campsYest = telemetry.campaigns.yesterday || [];
  const camps7dMap = new Map((telemetry.campaigns.last7d || []).map(c => [c.id, c]));
  for (let i = 0; i < campsYest.length; i++) {
    const cYest = campsYest[i];
    if (cYest.cost >= thresholds.MIN_CAMPAIGN_DAILY_SPEND) {
      const c7d = camps7dMap.get(cYest.id);
      const campDailyAvg = c7d ? (c7d.cost / 7.0) : 0;
      if (campDailyAvg > 0) {
        const campSpikeLimit = campDailyAvg * thresholds.CAMPAIGN_SPEND_SPIKE_MULT;
        if (cYest.cost > campSpikeLimit) {
          const deltaPct = ((cYest.cost - campDailyAvg) / campDailyAvg) * 100.0;
          anomalies.push({
            ruleId: 'ANO-02',
            name: 'Campaign Spend Spike',
            severity: 'WARNING',
            entityType: 'CAMPAIGN',
            entityName: cYest.name,
            entityId: cYest.id,
            observedMetric: `Yesterday Spend: ${cYest.cost.toFixed(2)} ${config.CURRENCY_SYMBOL}`,
            baseline: `7D Daily Avg: ${campDailyAvg.toFixed(2)} ${config.CURRENCY_SYMBOL}`,
            deltaBleed: `+${deltaPct.toFixed(1)}%`,
            recommendation: 'Audit recent budget adjustments or search term expansion causing campaign spend acceleration.'
          });
        }
      }
    }
  }

  // 3. ANO-03: Keyword Zero-Conversion Bleed (Cost >= 300 TRY or 2x Target CPA with 0 conversions)
  const kwLimit = Math.max(thresholds.ZERO_CONV_KW_COST_LIMIT, 2.0 * targets.TARGET_CPA);
  const zeroConvKeywords = telemetry.zeroConvKeywords || [];
  for (let i = 0; i < zeroConvKeywords.length; i++) {
    const kw = zeroConvKeywords[i];
    if (kw.cost >= kwLimit && kw.conversions === 0) {
      anomalies.push({
        ruleId: 'ANO-03',
        name: 'Keyword Zero-Conversion Bleed',
        severity: 'CRITICAL',
        entityType: 'KEYWORD',
        entityName: `"${kw.text}" [${kw.matchType}] in ${kw.campaignName} > ${kw.adGroupName}`,
        entityId: `${kw.adGroupId}~${kw.criterionId}`,
        observedMetric: `30D Cost: ${kw.cost.toFixed(2)} ${config.CURRENCY_SYMBOL} (Clicks: ${kw.clicks})`,
        baseline: `Threshold: ${kwLimit.toFixed(2)} ${config.CURRENCY_SYMBOL} (0 Conv)`,
        deltaBleed: `${kw.cost.toFixed(2)} ${config.CURRENCY_SYMBOL} wasted`,
        recommendation: 'Queue for R3 Zombie Keyword Pauser to pause entity and apply label AUTOPAUSED_ZOMBIE.'
      });
    }
  }

  // 4. ANO-04: Search Term Waste (Cost >= 150 TRY or 1x Target CPA with 0 conversions)
  const termLimit = Math.max(thresholds.ZERO_CONV_TERM_COST_LIMIT, 1.0 * targets.TARGET_CPA);
  const wasteTerms = telemetry.wasteSearchTerms || [];
  for (let i = 0; i < wasteTerms.length; i++) {
    const term = wasteTerms[i];
    if (term.cost >= termLimit && term.conversions === 0) {
      anomalies.push({
        ruleId: 'ANO-04',
        name: 'Search Term Waste',
        severity: 'CRITICAL',
        entityType: 'SEARCH_TERM',
        entityName: `"${term.text}" in ${term.campaignName}`,
        entityId: term.campaignId || 'TERM',
        observedMetric: `30D Cost: ${term.cost.toFixed(2)} ${config.CURRENCY_SYMBOL} (Clicks: ${term.clicks})`,
        baseline: `Threshold: ${termLimit.toFixed(2)} ${config.CURRENCY_SYMBOL} (0 Conv)`,
        deltaBleed: `${term.cost.toFixed(2)} ${config.CURRENCY_SYMBOL} wasted`,
        recommendation: 'Queue for R3 Negative Keyword Miner to add as exact negative keyword.'
      });
    }
  }

  // 5. ANO-05: Severe CTR Collapse (>30% drop vs 7D/14D baseline, min 200 imp gate)
  const baselineCTR = (l7d.impressions >= 200 && l7d.ctr > 0) ? l7d.ctr : ((l14d.impressions >= 200 && l14d.ctr > 0) ? l14d.ctr : 0.0);
  if (yest.impressions >= thresholds.MIN_CTR_IMPRESSIONS && baselineCTR > 0) {
    const ctrDropRatio = (baselineCTR - yest.ctr) / baselineCTR;
    if (ctrDropRatio >= thresholds.CTR_DROP_RATIO) {
      anomalies.push({
        ruleId: 'ANO-05',
        name: 'Severe CTR Collapse',
        severity: 'WARNING',
        entityType: 'ACCOUNT',
        entityName: config.ACCOUNT_NAME || 'Atli Medikal',
        entityId: config.CUSTOMER_ID || 'ACCOUNT',
        observedMetric: `Yesterday CTR: ${(yest.ctr * 100).toFixed(2)}% (Impr: ${yest.impressions})`,
        baseline: `Baseline CTR: ${(baselineCTR * 100).toFixed(2)}%`,
        deltaBleed: `-${(ctrDropRatio * 100).toFixed(1)}% drop`,
        recommendation: 'Check for creative fatigue, ad asset disapprovals, or broad match query dilution.'
      });
    }
  }

  // 6. ANO-06: Severe CPC Surge (>40% inflation vs 7D/14D baseline, min 15 clicks gate)
  const baselineCPC = (l7d.clicks >= 15 && l7d.averageCpc > 0) ? l7d.averageCpc : ((l14d.clicks >= 15 && l14d.averageCpc > 0) ? l14d.averageCpc : 0.0);
  if (yest.clicks >= thresholds.MIN_CPC_CLICKS && baselineCPC > 0) {
    const cpcSurgeRatio = (yest.averageCpc - baselineCPC) / baselineCPC;
    if (cpcSurgeRatio >= thresholds.CPC_SURGE_RATIO) {
      anomalies.push({
        ruleId: 'ANO-06',
        name: 'Severe CPC Surge',
        severity: 'WARNING',
        entityType: 'ACCOUNT',
        entityName: config.ACCOUNT_NAME || 'Atli Medikal',
        entityId: config.CUSTOMER_ID || 'ACCOUNT',
        observedMetric: `Yesterday CPC: ${yest.averageCpc.toFixed(2)} ${config.CURRENCY_SYMBOL} (Clicks: ${yest.clicks})`,
        baseline: `Baseline CPC: ${baselineCPC.toFixed(2)} ${config.CURRENCY_SYMBOL}`,
        deltaBleed: `+${(cpcSurgeRatio * 100).toFixed(1)}% inflation`,
        recommendation: 'Check auction insights for competitor aggression or aggressive smart bidding adjustments.'
      });
    }
  }

  // 7. ANO-07: Budget-Constrained Champion (High Budget Lost IS >= 20% on profitable campaigns)
  const camps30d = telemetry.campaigns.last30d || [];
  for (let i = 0; i < camps30d.length; i++) {
    const c = camps30d[i];
    const budgetLostIS = parseImpressionShareToNumber(c.searchBudgetLostIS);
    const isProfitable = (c.roas >= targets.TARGET_ROAS) || (c.conversions >= 3 && c.cpa <= targets.TARGET_CPA);
    if (budgetLostIS >= thresholds.BUDGET_LOST_IS_ALERT && isProfitable) {
      anomalies.push({
        ruleId: 'ANO-07',
        name: 'Budget-Constrained Champion',
        severity: 'OPPORTUNITY',
        entityType: 'CAMPAIGN',
        entityName: c.name,
        entityId: c.id,
        observedMetric: `Budget Lost IS: ${(budgetLostIS * 100).toFixed(1)}% (ROAS: ${c.roas.toFixed(2)}x, Conv: ${c.conversions})`,
        baseline: `Threshold: ${(thresholds.BUDGET_LOST_IS_ALERT * 100).toFixed(0)}% Lost IS`,
        deltaBleed: `Uncaptured Scale (Budget: ${Number(c.budget || 0).toFixed(2)} ${config.CURRENCY_SYMBOL}/day)`,
        recommendation: 'Increase campaign daily budget by +20% to +30% to capture unfulfilled profitable conversions.'
      });
    }
  }

  // 8. ANO-08: Severe Quality/Rank Deficit (Search Rank Lost IS >= 40%)
  for (let i = 0; i < camps30d.length; i++) {
    const c = camps30d[i];
    const rankLostIS = parseImpressionShareToNumber(c.searchRankLostIS);
    if (rankLostIS >= thresholds.RANK_LOST_IS_ALERT && c.impressions >= 100) {
      anomalies.push({
        ruleId: 'ANO-08',
        name: 'Severe Quality/Rank Deficit',
        severity: 'WARNING',
        entityType: 'CAMPAIGN',
        entityName: c.name,
        entityId: c.id,
        observedMetric: `Search Rank Lost IS: ${(rankLostIS * 100).toFixed(1)}% (Impr: ${c.impressions})`,
        baseline: `Threshold: ${(thresholds.RANK_LOST_IS_ALERT * 100).toFixed(0)}% Rank Lost IS`,
        deltaBleed: 'Ad Rank Visibility Loss',
        recommendation: 'Audit Quality Score (Expected CTR, Ad Relevance, Landing Page) and refresh RSA headline assets.'
      });
    }
  }

  // Sort: CRITICAL first, then WARNING, then OPPORTUNITY
  const severityRank = { CRITICAL: 1, WARNING: 2, OPPORTUNITY: 3 };
  anomalies.sort((a, b) => (severityRank[a.severity] || 99) - (severityRank[b.severity] || 99));

  return anomalies;
}

// ==============================================================================
// 6. COPYABLE AI INTERPRETATION MARKDOWN GENERATOR
// ==============================================================================

/**
 * Synthesizes telemetry data, comparative deltas, and detected anomalies into a
 * structured, self-contained Markdown prompt block ready for copy-pasting into LLMs.
 *
 * @param {Object} telemetry Collected telemetry data
 * @param {Array<Object>} anomalies Triggered anomalies
 * @param {Object} config Configuration settings
 * @param {string} timestamp Execution ISO timestamp
 * @returns {string} Fully formatted Markdown prompt
 */
function generateAIPromptMarkdown(telemetry, anomalies, config, timestamp) {
  const tf = telemetry.timeframes;
  const sym = config.CURRENCY_SYMBOL || '₺';

  // Format Multi-Window Performance Table
  const formatTableRow = (label, curr) => {
    const c = curr || {};
    const cost = Number(c.cost || 0).toFixed(2);
    const imp = Number(c.impressions || 0);
    const clk = Number(c.clicks || 0);
    const ctr = (Number(c.ctr || 0) * 100).toFixed(2);
    const cpc = Number(c.averageCpc || 0).toFixed(2);
    const conv = Number(c.conversions || 0).toFixed(1);
    const cpa = Number(c.cpa || 0).toFixed(2);
    const val = Number(c.conversionsValue || 0).toFixed(2);
    const roas = Number(c.roas || 0).toFixed(2);
    return `| ${label} | ${cost} | ${imp} | ${clk} | ${ctr}% | ${cpc} | ${conv} | ${cpa} | ${val} | ${roas}x |`;
  };

  const formatDeltaRow = (label, curr, prior) => {
    const dCost = formatTrendDelta(calculateDelta(curr.cost, prior.cost), true).text;
    const dImp = formatTrendDelta(calculateDelta(curr.impressions, prior.impressions), false).text;
    const dClk = formatTrendDelta(calculateDelta(curr.clicks, prior.clicks), false).text;
    const dCtr = formatTrendDelta(calculateDelta(curr.ctr, prior.ctr), false).text;
    const dCpc = formatTrendDelta(calculateDelta(curr.averageCpc, prior.averageCpc), true).text;
    const dConv = formatTrendDelta(calculateDelta(curr.conversions, prior.conversions), false).text;
    const dCpa = formatTrendDelta(calculateDelta(curr.cpa, prior.cpa), true).text;
    const dVal = formatTrendDelta(calculateDelta(curr.conversionsValue, prior.conversionsValue), false).text;
    const dRoas = formatTrendDelta(calculateDelta(curr.roas, prior.roas), false).text;

    return `| **${label}** | **${dCost}** | **${dImp}** | **${dClk}** | **${dCtr}** | **${dCpc}** | **${dConv}** | **${dCpa}** | **${dVal}** | **${dRoas}** |`;
  };

  // Section 2: Top 3 Growth Opportunities
  const oppAnomalies = anomalies.filter(a => a.severity === 'OPPORTUNITY');
  const camps30d = (telemetry.campaigns.last30d || []).slice().sort((a, b) => b.roas - a.roas);
  let oppItems = [];

  for (let i = 0; i < oppAnomalies.length && oppItems.length < 3; i++) {
    const opp = oppAnomalies[i];
    oppItems.push(`- [OPP-${oppItems.length + 1}] **Campaign:** ${opp.entityName} | **Diagnosis:** ${opp.observedMetric}\n  - *Action Plan:* ${opp.recommendation}`);
  }

  // Backfill with top ROAS campaigns if fewer than 3 found
  for (let i = 0; i < camps30d.length && oppItems.length < 3; i++) {
    const c = camps30d[i];
    if (!oppItems.some(item => item.includes(c.name)) && c.conversions > 0) {
      oppItems.push(`- [OPP-${oppItems.length + 1}] **Campaign:** ${c.name} | **ROAS:** ${c.roas.toFixed(2)}x | **Search IS:** ${formatImpressionShare(c.searchIS)}\n  - *Action Plan:* Strong conversion velocity. Explore expanding high-intent keywords and testing target CPA reduction.`);
    }
  }

  if (oppItems.length === 0) {
    oppItems.push('- [OPP-1] **General Scaling:** Account is operating within steady parameters. Evaluate adding exact-match variations of high-converting search terms.');
  }

  // Section 3: Bleeding Leaks & Waste Points
  const zeroConvKws = telemetry.zeroConvKeywords || [];
  const wasteTerms = telemetry.wasteSearchTerms || [];
  const totalKwWaste = zeroConvKws.reduce((acc, k) => acc + k.cost, 0);
  const totalTermWaste = wasteTerms.reduce((acc, t) => acc + t.cost, 0);

  let kwOffenders = '';
  if (zeroConvKws.length > 0) {
    kwOffenders = zeroConvKws.slice(0, 3).map((k, idx) =>
      `    ${idx + 1}. "${k.text}" [${k.matchType}] in ${k.campaignName} (${k.cost.toFixed(2)} ${sym}, ${k.clicks} clicks)`
    ).join('\n');
  } else {
    kwOffenders = '    - None exceeding threshold.';
  }

  let termOffenders = '';
  if (wasteTerms.length > 0) {
    termOffenders = wasteTerms.slice(0, 3).map(t => `"${t.text}" (${t.cost.toFixed(2)} ${sym})`).join(', ');
  } else {
    termOffenders = 'None exceeding threshold.';
  }

  const volAnomalies = anomalies.filter(a => a.ruleId === 'ANO-05' || a.ruleId === 'ANO-06' || a.ruleId === 'ANO-01');
  const volSummary = volAnomalies.length > 0
    ? volAnomalies.map(a => `${a.name}: ${a.observedMetric} vs ${a.baseline}`).join('; ')
    : 'No severe spend spikes, CTR collapses, or CPC inflation detected.';

  // Section 4: Budget Efficiency & Pacing Verdict
  const avg7dSpend = (tf.last7d.cost || 0) / 7.0;
  const projectedMonthlySpend = avg7dSpend * 30.0;
  const pacingStatus = avg7dSpend > 0
    ? (tf.yesterday.cost > avg7dSpend * 1.2 ? `Accelerating (+${(((tf.yesterday.cost - avg7dSpend) / avg7dSpend) * 100).toFixed(0)}% vs 7D average)` : 'Consistent with 7-Day Average')
    : 'Insufficient Baseline';

  const aggBudgetLostIS = tf.last30d.searchBudgetLostIS !== null ? formatImpressionShare(tf.last30d.searchBudgetLostIS) : '--';

  let efficiencyVerdict = '';
  if (anomalies.filter(a => a.severity === 'CRITICAL').length > 0) {
    efficiencyVerdict = `Account has active bleeding points (${totalKwWaste.toFixed(2)} ${sym} in zero-conversion keywords and ${totalTermWaste.toFixed(2)} ${sym} in non-converting search terms). Immediate pruning required to preserve margins.`;
  } else if (tf.last30d.roas >= config.TARGETS.TARGET_ROAS) {
    efficiencyVerdict = `Healthy account performance with a 30-day ROAS of ${tf.last30d.roas.toFixed(2)}x (Target: ${config.TARGETS.TARGET_ROAS.toFixed(2)}x). Opportunity exists to capture additional market share currently lost to budget caps.`;
  } else {
    efficiencyVerdict = `Account is stabilizing around target metrics (30D CPA: ${tf.last30d.cpa.toFixed(2)} ${sym}, ROAS: ${tf.last30d.roas.toFixed(2)}x). Refine keyword match types and negative list filtering to boost efficiency.`;
  }

  // Section 5: Actionable Prioritized Directives
  const zombieCount = zeroConvKws.length;
  const wasteTermCount = wasteTerms.length;

  let markdown = `# GOOGLE ADS PERFORMANCE TELEMETRY & STRATEGIC DIRECTIVES
**Account:** ${config.ACCOUNT_NAME} (CID: ${config.CUSTOMER_ID})
**Execution Timestamp:** ${timestamp} (Timezone: ${config.TIMEZONE})
**Reporting Scope:** Multi-Window Autonomous Telemetry (Yesterday vs 7d vs 14d vs 30d)

---
### PROMPT INSTRUCTION FOR AI AGENT (Copy everything below):
You are an Elite Performance Marketing Director & Google Ads Optimization Strategist auditing ${config.ACCOUNT_NAME}'s account.
Analyze the multi-period telemetry data, anomaly flags, and competitive search shares below.
Provide:
1. Executive Diagnosis (macro trend analysis & health score 1-100)
2. Top 3 Growth Bottlenecks & Scale Unlocks
3. Immediate Waste Elimination Directives
4. Exact Campaign-by-Campaign Tactical Adjustments (budgets, bids, negative terms)

---
## 1. Executive Performance Overview

| Timeframe Window | Spend (${sym}) | Impressions | Clicks | CTR | Avg CPC (${sym}) | Conversions | CPA (${sym}) | Conv Value (${sym}) | ROAS |
|---|---|---|---|---|---|---|---|---|---|
${formatTableRow('Yesterday', tf.yesterday)}
${formatTableRow('Prior Day (D-2)', tf.d2)}
${formatDeltaRow('Yesterday Delta (PoP)', tf.yesterday, tf.d2)}
${formatTableRow('Last 7 Days', tf.last7d)}
${formatTableRow('Prior 7 Days', tf.prior7d)}
${formatDeltaRow('7-Day Delta (PoP)', tf.last7d, tf.prior7d)}
${formatTableRow('Last 14 Days', tf.last14d)}
${formatTableRow('Prior 14 Days', tf.prior14d)}
${formatDeltaRow('14-Day Delta (PoP)', tf.last14d, tf.prior14d)}
${formatTableRow('Last 30 Days', tf.last30d)}
${formatTableRow('Prior 30 Days', tf.prior30d)}
${formatDeltaRow('30-Day Delta (PoP)', tf.last30d, tf.prior30d)}

---
## 2. Top 3 Growth Opportunities (Scale Unlocks)
${oppItems.join('\n')}

---
## 3. Bleeding Leaks & Waste Points (Zero-Conversion & Inefficient Spend)
- [LEAK-1] **Zero-Conv Keywords:** ${zombieCount} active keywords spent **${totalKwWaste.toFixed(2)} ${sym}** over the last 30 days generating 0 conversions.
  - *Top Offenders:*
${kwOffenders}
- [LEAK-2] **Search Term Waste:** ${wasteTermCount} search queries spent **${totalTermWaste.toFixed(2)} ${sym}** with 0 conversions.
  - *Immediate Negatives Needed:* ${termOffenders}
- [LEAK-3] **Volatility & Anomaly Pulse:** ${volSummary}

---
## 4. Budget Efficiency & Pacing Verdict
- **Current Pacing Status:** ${pacingStatus}
- **Projected 30-Day Run Rate:** ${projectedMonthlySpend.toFixed(2)} ${sym}
- **Search Budget Lost Share Aggregate:** Account is losing estimated **${aggBudgetLostIS}** of eligible search traffic strictly due to daily budget exhaustion.
- **Efficiency Verdict:** ${efficiencyVerdict}

---
## 5. Actionable Prioritized Directives
1. **Tier 1 (Immediate Execution - Next 2 Hours):**
   - Execute R3 Zombie Keyword Pauser on ${zombieCount} keywords with spend >= ${config.THRESHOLDS.ZERO_CONV_KW_COST_LIMIT} ${sym} and 0 conversions.
   - Inject top wasted search terms into Account-Level Negative Keyword List.
2. **Tier 2 (Budget Reallocation - Next 24 Hours):**
   - Review budget caps on campaigns experiencing >= 20% Budget Lost IS while exceeding Target ROAS (${config.TARGETS.TARGET_ROAS.toFixed(2)}x).
3. **Tier 3 (Bid & Creative Optimization - This Week):**
   - Audit ad groups experiencing CTR collapse or Search Rank Lost IS >= 40%; refresh RSA headlines and check landing page loading speeds.
`;

  // Safe cell truncation guard (Google Sheets limit is 50,000 characters per cell)
  if (markdown.length > 40000) {
    markdown = markdown.substring(0, 39900) + '\n\n[... Truncated for Google Sheets 50,000 cell character safety ...]';
  }

  return markdown;
}

// ==============================================================================
// 7. GOOGLE SHEETS 5-TAB DASHBOARD EXPORTER
// ==============================================================================

/**
 * Chunked 2D array exporter writing matrices to Google Sheets via setValues()
 * chunked at 5,000 rows to guarantee completion well within the 30-minute limit.
 *
 * @param {Object} sheet Target Sheet object
 * @param {number} startRow Starting row (1-indexed)
 * @param {number} startCol Starting column (1-indexed)
 * @param {Array<Array<*>>} matrix 2D data matrix
 * @param {number} chunkSize Max rows per setValues() call (default: 5000)
 */
function writeMatrixToSheet(sheet, startRow, startCol, matrix, chunkSize = 5000) {
  if (!sheet || !matrix || matrix.length === 0 || matrix[0].length === 0) return;
  const numCols = matrix[0].length;

  for (let i = 0; i < matrix.length; i += chunkSize) {
    const chunk = matrix.slice(i, i + chunkSize);
    const range = sheet.getRange(startRow + i, startCol, chunk.length, numCols);
    range.setValues(chunk);
  }
}

/**
 * Retrieves existing sheet tab or creates a new one cleanly.
 *
 * @param {Object} spreadsheet Google Spreadsheet instance
 * @param {string} tabName Name of tab
 * @returns {Object} Sheet tab reference
 */
function getOrCreateSheet(spreadsheet, tabName) {
  let sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(tabName);
  }
  return sheet;
}

/**
 * Safely applies batch background colors if method is supported by environment.
 *
 * @param {Object} range Sheet range
 * @param {Array<Array<string>>} backgrounds 2D array of hex codes
 */
function safeSetBackgrounds(range, backgrounds) {
  if (range && typeof range.setBackgrounds === 'function' && backgrounds.length > 0) {
    try {
      range.setBackgrounds(backgrounds);
    } catch (e) {
      Logger.log(`Warning: Failed to set backgrounds: ${e.message}`);
    }
  }
}

/**
 * Safely applies batch font weights if method is supported by environment.
 *
 * @param {Object} range Sheet range
 * @param {Array<Array<string>>} weights 2D array of weights ('bold', 'normal')
 */
function safeSetFontWeights(range, weights) {
  if (range && typeof range.setFontWeights === 'function' && weights.length > 0) {
    try {
      range.setFontWeights(weights);
    } catch (e) {
      Logger.log(`Warning: Failed to set font weights: ${e.message}`);
    }
  }
}

/**
 * Safely applies batch font colors if method is supported by environment.
 *
 * @param {Object} range Sheet range
 * @param {Array<Array<string>>} colors 2D array of font color hex codes
 */
function safeSetFontColors(range, colors) {
  if (range && typeof range.setFontColors === 'function' && colors.length > 0) {
    try {
      range.setFontColors(colors);
    } catch (e) {
      Logger.log(`Warning: Failed to set font colors: ${e.message}`);
    }
  }
}

/**
 * Populates Tab 1: DASHBOARD_KPI with multi-timeframe KPI matrix, KPI tiles, and campaign summary.
 */
function renderDashboardKPITab(sheet, telemetry, anomalies, config, timestamp) {
  sheet.clear();
  const tf = telemetry.timeframes;
  const sym = config.CURRENCY_SYMBOL || '₺';

  const criticalAnomaliesCount = anomalies.filter(a => a.severity === 'CRITICAL').length;
  const avg7dDaily = (tf.last7d.cost || 0) / 7.0;

  const matrix = [];
  const backgrounds = [];
  const fontWeights = [];
  const fontColors = [];

  const addRow = (vals, bg = CONFIG.PALETTE.ZEBRA_EVEN, weight = 'normal', color = CONFIG.PALETTE.NEUTRAL_TEXT) => {
    matrix.push(vals);
    backgrounds.push(new Array(vals.length).fill(bg));
    fontWeights.push(new Array(vals.length).fill(weight));
    fontColors.push(new Array(vals.length).fill(color));
  };

  // Header Section
  const numCols = 13;
  const blankRow = new Array(numCols).fill('');

  addRow([`ATLI MEDIKAL — AUTONOMOUS PERFORMANCE TELEMETRY DASHBOARD`, ...new Array(numCols - 1).fill('')],
    CONFIG.PALETTE.HEADER_BG, 'bold', CONFIG.PALETTE.HEADER_TEXT);
  addRow([`Account: ${config.ACCOUNT_NAME} (${config.CUSTOMER_ID}) | Timezone: ${config.TIMEZONE} | Generated: ${timestamp}`, ...new Array(numCols - 1).fill('')],
    CONFIG.PALETTE.SUBHEADER_BG, 'normal', '#E2E8F0');
  addRow(blankRow);

  // Executive KPI Summary Cards
  addRow([
    'Yesterday Spend', '7D Daily Avg Spend', '30D Total Spend', '30D Conversions', '30D Account CPA', '30D Account ROAS', 'Critical Anomalies',
    ...new Array(numCols - 7).fill('')
  ], CONFIG.PALETTE.SUBHEADER_BG, 'bold', CONFIG.PALETTE.HEADER_TEXT);

  addRow([
    `${tf.yesterday.cost.toFixed(2)} ${sym}`,
    `${avg7dDaily.toFixed(2)} ${sym}`,
    `${tf.last30d.cost.toFixed(2)} ${sym}`,
    `${tf.last30d.conversions.toFixed(1)}`,
    `${tf.last30d.cpa.toFixed(2)} ${sym}`,
    `${tf.last30d.roas.toFixed(2)}x`,
    `${criticalAnomaliesCount} Active`,
    ...new Array(numCols - 7).fill('')
  ], CONFIG.PALETTE.CARD_BG, 'bold', criticalAnomaliesCount > 0 ? CONFIG.PALETTE.CRITICAL_TEXT : CONFIG.PALETTE.WIN_TEXT);

  addRow(blankRow);

  // Section 1 Header: Multi-Timeframe Comparative Matrix
  addRow([`MULTI-TIMEFRAME COMPARATIVE PERFORMANCE MATRIX (WITH PERIOD-OVER-PERIOD TRENDS)`, ...new Array(numCols - 1).fill('')],
    CONFIG.PALETTE.HEADER_BG, 'bold', CONFIG.PALETTE.HEADER_TEXT);

  const tableHeaders = [
    'Metric / KPI', 'Yesterday', 'Prior Day (D-2)', 'Yesterday PoP',
    'Last 7 Days', 'Prior 7 Days', '7D PoP',
    'Last 14 Days', 'Prior 14 Days', '14D PoP',
    'Last 30 Days', 'Prior 30 Days', '30D PoP'
  ];
  addRow(tableHeaders, CONFIG.PALETTE.SUBHEADER_BG, 'bold', CONFIG.PALETTE.HEADER_TEXT);

  // Helper to construct a single KPI row across 4 comparison windows
  const buildKpiRow = (name, extractor, isInverted = false, formatType = 'standard') => {
    const valY = extractor(tf.yesterday);
    const valD2 = extractor(tf.d2);
    const d1 = formatTrendDelta(calculateDelta(valY, valD2), isInverted);

    const val7 = extractor(tf.last7d);
    const valP7 = extractor(tf.prior7d);
    const d7 = formatTrendDelta(calculateDelta(val7, valP7), isInverted);

    const val14 = extractor(tf.last14d);
    const valP14 = extractor(tf.prior14d);
    const d14 = formatTrendDelta(calculateDelta(val14, valP14), isInverted);

    const val30 = extractor(tf.last30d);
    const valP30 = extractor(tf.prior30d);
    const d30 = formatTrendDelta(calculateDelta(val30, valP30), isInverted);

    const fmt = (v) => {
      if (v === null || v === undefined) return '--';
      if (formatType === 'currency') return `${Number(v).toFixed(2)} ${sym}`;
      if (formatType === 'percent') return `${(Number(v) * 100).toFixed(2)}%`;
      if (formatType === 'ratio') return `${Number(v).toFixed(2)}x`;
      if (formatType === 'share') return formatImpressionShare(v);
      return Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 });
    };

    const rowVals = [
      name,
      fmt(valY), fmt(valD2), d1.text,
      fmt(val7), fmt(valP7), d7.text,
      fmt(val14), fmt(valP14), d14.text,
      fmt(val30), fmt(valP30), d30.text
    ];

    const rowIndex = matrix.length;
    matrix.push(rowVals);

    const isOdd = rowIndex % 2 === 1;
    const baseBg = isOdd ? CONFIG.PALETTE.ZEBRA_ODD : CONFIG.PALETTE.ZEBRA_EVEN;
    const rowBg = new Array(numCols).fill(baseBg);
    rowBg[3] = d1.bgColor;
    rowBg[6] = d7.bgColor;
    rowBg[9] = d14.bgColor;
    rowBg[12] = d30.bgColor;
    backgrounds.push(rowBg);

    const rowWeight = new Array(numCols).fill('normal');
    rowWeight[0] = 'bold';
    rowWeight[3] = 'bold';
    rowWeight[6] = 'bold';
    rowWeight[9] = 'bold';
    rowWeight[12] = 'bold';
    fontWeights.push(rowWeight);

    const rowColors = new Array(numCols).fill(CONFIG.PALETTE.NEUTRAL_TEXT);
    rowColors[3] = d1.textColor;
    rowColors[6] = d7.textColor;
    rowColors[9] = d14.textColor;
    rowColors[12] = d30.textColor;
    fontColors.push(rowColors);
  };

  // 11 Core KPIs + Conversion Value
  buildKpiRow('1. Impressions', m => m.impressions, false, 'number');
  buildKpiRow('2. Clicks', m => m.clicks, false, 'number');
  buildKpiRow('3. Click-Through Rate (CTR)', m => m.ctr, false, 'percent');
  buildKpiRow('4. Average CPC', m => m.averageCpc, true, 'currency');
  buildKpiRow('5. Total Cost / Spend', m => m.cost, true, 'currency');
  buildKpiRow('6. Conversions', m => m.conversions, false, 'number');
  buildKpiRow('7. Cost Per Conversion (CPA)', m => m.cpa, true, 'currency');
  buildKpiRow('8. Conversion Value (Revenue)', m => m.conversionsValue, false, 'currency');
  buildKpiRow('9. Return on Ad Spend (ROAS)', m => m.roas, false, 'ratio');
  buildKpiRow('10. Search Impression Share', m => m.searchIS, false, 'share');
  buildKpiRow('11. Search Budget Lost IS', m => m.searchBudgetLostIS, true, 'share');
  buildKpiRow('12. Search Rank Lost IS', m => m.searchRankLostIS, true, 'share');

  addRow(blankRow);

  // Section 2: Top Active Campaigns Summary (Last 7 Days)
  addRow([`TOP CAMPAIGNS SUMMARY (LAST 7 DAYS ACTIVITY)`, ...new Array(numCols - 1).fill('')],
    CONFIG.PALETTE.HEADER_BG, 'bold', CONFIG.PALETTE.HEADER_TEXT);

  const campHeaders = [
    'Campaign Name', 'Channel', 'Status', 'Daily Budget', 'Cost (7D)',
    'Clicks (7D)', 'CTR (7D)', 'Avg CPC (7D)', 'Conv (7D)', 'CPA (7D)',
    'ROAS (7D)', 'Search IS (7D)', 'Budget Lost IS (7D)'
  ];
  addRow(campHeaders, CONFIG.PALETTE.SUBHEADER_BG, 'bold', CONFIG.PALETTE.HEADER_TEXT);

  const camps7d = (telemetry.campaigns.last7d || []).slice().sort((a, b) => b.cost - a.cost);
  for (let i = 0; i < camps7d.length; i++) {
    const c = camps7d[i];
    const isOdd = i % 2 === 1;
    addRow([
      c.name || 'Unnamed Campaign',
      c.channelType || 'UNKNOWN',
      c.status || 'UNKNOWN',
      `${Number(c.budget || 0).toFixed(2)} ${sym}`,
      `${Number(c.cost || 0).toFixed(2)} ${sym}`,
      Number(c.clicks || 0),
      `${(Number(c.ctr || 0) * 100).toFixed(2)}%`,
      `${Number(c.averageCpc || 0).toFixed(2)} ${sym}`,
      Number(c.conversions || 0).toFixed(1),
      `${Number(c.cpa || 0).toFixed(2)} ${sym}`,
      `${Number(c.roas || 0).toFixed(2)}x`,
      formatImpressionShare(c.searchIS),
      formatImpressionShare(c.searchBudgetLostIS)
    ], isOdd ? CONFIG.PALETTE.ZEBRA_ODD : CONFIG.PALETTE.ZEBRA_EVEN);
  }

  // Single-call batch write and formatting
  writeMatrixToSheet(sheet, 1, 1, matrix);
  const range = sheet.getRange(1, 1, matrix.length, numCols);
  safeSetBackgrounds(range, backgrounds);
  safeSetFontWeights(range, fontWeights);
  safeSetFontColors(range, fontColors);

  if (typeof sheet.setFrozenRows === 'function') {
    sheet.setFrozenRows(2);
  }
}

/**
 * Populates Tab 2: ANOMALIES_ALERTS with detected rule violations.
 */
function renderAnomaliesAlertsTab(sheet, anomalies, config, timestamp) {
  sheet.clear();
  const matrix = [];
  const backgrounds = [];
  const fontWeights = [];
  const fontColors = [];
  const numCols = 10;

  const addRow = (vals, bg = CONFIG.PALETTE.ZEBRA_EVEN, weight = 'normal', color = CONFIG.PALETTE.NEUTRAL_TEXT) => {
    matrix.push(vals);
    backgrounds.push(new Array(vals.length).fill(bg));
    fontWeights.push(new Array(vals.length).fill(weight));
    fontColors.push(new Array(vals.length).fill(color));
  };

  addRow([`ANOMALY DETECTION & DIAGNOSTIC AUDIT LOG`, ...new Array(numCols - 1).fill('')],
    CONFIG.PALETTE.HEADER_BG, 'bold', CONFIG.PALETTE.HEADER_TEXT);
  addRow([`Active 8-Rule Anomaly Engine | Generated: ${timestamp} | Evaluated Entities: Campaigns, Keywords, Search Terms`, ...new Array(numCols - 1).fill('')],
    CONFIG.PALETTE.SUBHEADER_BG, 'normal', '#E2E8F0');
  addRow(new Array(numCols).fill(''));

  const tableHeaders = [
    'Severity', 'Rule ID', 'Anomaly Name', 'Entity Type',
    'Entity Name / Query', 'Entity ID', 'Observed Metric',
    'Baseline / Threshold', 'Delta / Bleed', 'Recommended Action / Next Step'
  ];
  addRow(tableHeaders, CONFIG.PALETTE.SUBHEADER_BG, 'bold', CONFIG.PALETTE.HEADER_TEXT);

  if (anomalies.length === 0) {
    addRow([
      'HEALTHY', 'ANO-OK', 'No Anomalies Detected', 'ACCOUNT',
      'All Entities', '--', 'All telemetry within expected variance',
      'Within thresholds', '0.00 ₺', 'Maintain normal monitoring cadence'
    ], CONFIG.PALETTE.WIN_BG, 'normal', CONFIG.PALETTE.WIN_TEXT);
  } else {
    for (let i = 0; i < anomalies.length; i++) {
      const a = anomalies[i];
      let rowBg = CONFIG.PALETTE.ZEBRA_EVEN;
      let rowText = CONFIG.PALETTE.NEUTRAL_TEXT;

      if (a.severity === 'CRITICAL') {
        rowBg = CONFIG.PALETTE.CRITICAL_BG;
        rowText = CONFIG.PALETTE.CRITICAL_TEXT;
      } else if (a.severity === 'WARNING') {
        rowBg = CONFIG.PALETTE.WARN_BG;
        rowText = CONFIG.PALETTE.WARN_TEXT;
      } else if (a.severity === 'OPPORTUNITY') {
        rowBg = CONFIG.PALETTE.WIN_BG;
        rowText = CONFIG.PALETTE.WIN_TEXT;
      }

      addRow([
        a.severity,
        a.ruleId,
        a.name,
        a.entityType,
        a.entityName,
        a.entityId,
        a.observedMetric,
        a.baseline,
        a.deltaBleed,
        a.recommendation
      ], rowBg, 'normal', rowText);
    }
  }

  writeMatrixToSheet(sheet, 1, 1, matrix);
  const range = sheet.getRange(1, 1, matrix.length, numCols);
  safeSetBackgrounds(range, backgrounds);
  safeSetFontWeights(range, fontWeights);
  safeSetFontColors(range, fontColors);

  if (typeof sheet.setFrozenRows === 'function') {
    sheet.setFrozenRows(4);
  }
}

/**
 * Populates Tab 3: AI_PROMPT_SUMMARY with ready-to-copy Markdown prompt.
 */
function renderAIPromptSummaryTab(sheet, aiMarkdown, timestamp) {
  sheet.clear();
  const matrix = [
    ['COPYABLE AI STRATEGIC INTERPRETATION PROMPT (FOR CHATGPT / CLAUDE / GEMINI)'],
    [`Instructions: Copy the entire markdown prompt in Cell A4 below and paste directly into your AI assistant for deep strategic analysis.`],
    [''],
    [aiMarkdown]
  ];

  writeMatrixToSheet(sheet, 1, 1, matrix);

  // Style Header
  const headerRange = sheet.getRange(1, 1, 1, 1);
  safeSetBackgrounds(headerRange, [[CONFIG.PALETTE.HEADER_BG]]);
  safeSetFontWeights(headerRange, [['bold']]);
  safeSetFontColors(headerRange, [[CONFIG.PALETTE.HEADER_TEXT]]);

  const subRange = sheet.getRange(2, 1, 1, 1);
  safeSetBackgrounds(subRange, [[CONFIG.PALETTE.SUBHEADER_BG]]);
  safeSetFontColors(subRange, [['#E2E8F0']]);

  const promptCell = sheet.getRange(4, 1, 1, 1);
  safeSetBackgrounds(promptCell, [[CONFIG.PALETTE.CARD_BG]]);
  if (typeof promptCell.setWrap === 'function') {
    promptCell.setWrap(true);
  }

  if (typeof sheet.setColumnWidth === 'function') {
    sheet.setColumnWidth(1, 1000);
  }
}

/**
 * Populates Tab 4: CAMPAIGN_PERFORMANCE with granular campaign multi-window records.
 */
function renderCampaignPerformanceTab(sheet, telemetry, config, timestamp) {
  sheet.clear();
  const sym = config.CURRENCY_SYMBOL || '₺';
  const matrix = [];
  const backgrounds = [];
  const fontWeights = [];
  const fontColors = [];

  const headers = [
    'Campaign ID', 'Campaign Name', 'Channel Type', 'Status', 'Daily Budget',
    'Cost (Yest)', 'Impr (Yest)', 'Clicks (Yest)', 'CTR (Yest)', 'Avg CPC (Yest)', 'Conv (Yest)', 'CPA (Yest)', 'ROAS (Yest)',
    'Cost (7D)', 'Impr (7D)', 'Clicks (7D)', 'CTR (7D)', 'Avg CPC (7D)', 'Conv (7D)', 'CPA (7D)', 'ROAS (7D)', 'Search IS (7D)', 'Budget Lost IS (7D)', 'Rank Lost IS (7D)',
    'Cost (30D)', 'Impr (30D)', 'Clicks (30D)', 'CTR (30D)', 'Avg CPC (30D)', 'Conv (30D)', 'CPA (30D)', 'ROAS (30D)', 'Search IS (30D)', 'Budget Lost IS (30D)', 'Rank Lost IS (30D)'
  ];
  const numCols = headers.length;

  const addRow = (vals, bg = CONFIG.PALETTE.ZEBRA_EVEN, weight = 'normal', color = CONFIG.PALETTE.NEUTRAL_TEXT) => {
    matrix.push(vals);
    backgrounds.push(new Array(vals.length).fill(bg));
    fontWeights.push(new Array(vals.length).fill(weight));
    fontColors.push(new Array(vals.length).fill(color));
  };

  addRow([`CAMPAIGN PERFORMANCE AUDIT MATRIX (MULTI-TIMEFRAME)`, ...new Array(numCols - 1).fill('')],
    CONFIG.PALETTE.HEADER_BG, 'bold', CONFIG.PALETTE.HEADER_TEXT);
  addRow([`Account: ${config.ACCOUNT_NAME} | Detailed breakdown across Yesterday, 7 Days, and 30 Days | Generated: ${timestamp}`, ...new Array(numCols - 1).fill('')],
    CONFIG.PALETTE.SUBHEADER_BG, 'normal', '#E2E8F0');
  addRow(new Array(numCols).fill(''));
  addRow(headers, CONFIG.PALETTE.SUBHEADER_BG, 'bold', CONFIG.PALETTE.HEADER_TEXT);

  const campsYestMap = new Map((telemetry.campaigns.yesterday || []).map(c => [c.id, c]));
  const camps7dMap = new Map((telemetry.campaigns.last7d || []).map(c => [c.id, c]));
  const camps30d = (telemetry.campaigns.last30d || []).slice().sort((a, b) => b.cost - a.cost);

  for (let i = 0; i < camps30d.length; i++) {
    const c30 = camps30d[i];
    const cYest = campsYestMap.get(c30.id) || { cost: 0, impressions: 0, clicks: 0, ctr: 0, averageCpc: 0, conversions: 0, cpa: 0, roas: 0 };
    const c7d = camps7dMap.get(c30.id) || { cost: 0, impressions: 0, clicks: 0, ctr: 0, averageCpc: 0, conversions: 0, cpa: 0, roas: 0, searchIS: null, searchBudgetLostIS: null, searchRankLostIS: null };

    const isOdd = i % 2 === 1;
    addRow([
      c30.id || '',
      c30.name || 'Unnamed Campaign',
      c30.channelType || 'UNKNOWN',
      c30.status || 'UNKNOWN',
      `${Number(c30.budget || 0).toFixed(2)} ${sym}`,

      // Yesterday
      `${Number(cYest.cost || 0).toFixed(2)} ${sym}`,
      Number(cYest.impressions || 0),
      Number(cYest.clicks || 0),
      `${(Number(cYest.ctr || 0) * 100).toFixed(2)}%`,
      `${Number(cYest.averageCpc || 0).toFixed(2)} ${sym}`,
      Number(cYest.conversions || 0).toFixed(1),
      `${Number(cYest.cpa || 0).toFixed(2)} ${sym}`,
      `${Number(cYest.roas || 0).toFixed(2)}x`,

      // 7 Days
      `${Number(c7d.cost || 0).toFixed(2)} ${sym}`,
      Number(c7d.impressions || 0),
      Number(c7d.clicks || 0),
      `${(Number(c7d.ctr || 0) * 100).toFixed(2)}%`,
      `${Number(c7d.averageCpc || 0).toFixed(2)} ${sym}`,
      Number(c7d.conversions || 0).toFixed(1),
      `${Number(c7d.cpa || 0).toFixed(2)} ${sym}`,
      `${Number(c7d.roas || 0).toFixed(2)}x`,
      formatImpressionShare(c7d.searchIS),
      formatImpressionShare(c7d.searchBudgetLostIS),
      formatImpressionShare(c7d.searchRankLostIS),

      // 30 Days
      `${Number(c30.cost || 0).toFixed(2)} ${sym}`,
      Number(c30.impressions || 0),
      Number(c30.clicks || 0),
      `${(Number(c30.ctr || 0) * 100).toFixed(2)}%`,
      `${Number(c30.averageCpc || 0).toFixed(2)} ${sym}`,
      Number(c30.conversions || 0).toFixed(1),
      `${Number(c30.cpa || 0).toFixed(2)} ${sym}`,
      `${Number(c30.roas || 0).toFixed(2)}x`,
      formatImpressionShare(c30.searchIS),
      formatImpressionShare(c30.searchBudgetLostIS),
      formatImpressionShare(c30.searchRankLostIS)
    ], isOdd ? CONFIG.PALETTE.ZEBRA_ODD : CONFIG.PALETTE.ZEBRA_EVEN);
  }

  writeMatrixToSheet(sheet, 1, 1, matrix);
  const range = sheet.getRange(1, 1, matrix.length, numCols);
  safeSetBackgrounds(range, backgrounds);
  safeSetFontWeights(range, fontWeights);
  safeSetFontColors(range, fontColors);

  if (typeof sheet.setFrozenRows === 'function') {
    sheet.setFrozenRows(4);
  }
}

/**
 * Populates Tab 5: SETTINGS_CONFIG with transparent configuration parameters.
 */
function renderSettingsConfigTab(sheet, config, timestamp) {
  sheet.clear();
  const matrix = [];
  const backgrounds = [];
  const fontWeights = [];
  const fontColors = [];
  const numCols = 5;

  const addRow = (vals, bg = CONFIG.PALETTE.ZEBRA_EVEN, weight = 'normal', color = CONFIG.PALETTE.NEUTRAL_TEXT) => {
    matrix.push(vals);
    backgrounds.push(new Array(vals.length).fill(bg));
    fontWeights.push(new Array(vals.length).fill(weight));
    fontColors.push(new Array(vals.length).fill(color));
  };

  addRow([`CONFIGURATION, THRESHOLDS & TELEMETRY METADATA`, ...new Array(numCols - 1).fill('')],
    CONFIG.PALETTE.HEADER_BG, 'bold', CONFIG.PALETTE.HEADER_TEXT);
  addRow([`Parameters governing autonomous anomaly alerts and PoP calculations | Last Execution: ${timestamp}`, ...new Array(numCols - 1).fill('')],
    CONFIG.PALETTE.SUBHEADER_BG, 'normal', '#E2E8F0');
  addRow(new Array(numCols).fill(''));

  const tableHeaders = ['Parameter Key', 'Configured Value', 'Unit / Type', 'Description & Mathematical Rule', 'Severity When Breached'];
  addRow(tableHeaders, CONFIG.PALETTE.SUBHEADER_BG, 'bold', CONFIG.PALETTE.HEADER_TEXT);

  const settingsList = [
    ['MIN_ACCOUNT_DAILY_SPEND', config.THRESHOLDS.MIN_ACCOUNT_DAILY_SPEND, 'Currency (TRY)', 'Minimum yesterday spend required to evaluate account spend spikes', 'GATING RULE'],
    ['SPEND_SPIKE_MULTIPLIER', config.THRESHOLDS.SPEND_SPIKE_MULTIPLIER, 'Multiplier', 'Spend > 1.50x of 7-day daily average triggers critical alert', 'CRITICAL'],
    ['MIN_CAMPAIGN_DAILY_SPEND', config.THRESHOLDS.MIN_CAMPAIGN_DAILY_SPEND, 'Currency (TRY)', 'Minimum yesterday spend for single campaign spike evaluation', 'GATING RULE'],
    ['CAMPAIGN_SPEND_SPIKE_MULT', config.THRESHOLDS.CAMPAIGN_SPEND_SPIKE_MULT, 'Multiplier', 'Campaign spend > 1.75x of campaign 7-day daily average', 'WARNING'],
    ['ZERO_CONV_KW_COST_LIMIT', config.THRESHOLDS.ZERO_CONV_KW_COST_LIMIT, 'Currency (TRY)', 'Keywords spending >= 300 TRY with 0 conversions flagged for pausing', 'CRITICAL'],
    ['ZERO_CONV_TERM_COST_LIMIT', config.THRESHOLDS.ZERO_CONV_TERM_COST_LIMIT, 'Currency (TRY)', 'Search queries spending >= 150 TRY with 0 conversions flagged for negative list', 'CRITICAL'],
    ['MIN_CTR_IMPRESSIONS', config.THRESHOLDS.MIN_CTR_IMPRESSIONS, 'Count', 'Minimum impressions required to evaluate CTR collapse', 'GATING RULE'],
    ['CTR_DROP_RATIO', config.THRESHOLDS.CTR_DROP_RATIO, 'Ratio', 'CTR dropping > 30% vs baseline indicates creative fatigue or broad query dilution', 'WARNING'],
    ['MIN_CPC_CLICKS', config.THRESHOLDS.MIN_CPC_CLICKS, 'Count', 'Minimum clicks required to evaluate CPC surge', 'GATING RULE'],
    ['CPC_SURGE_RATIO', config.THRESHOLDS.CPC_SURGE_RATIO, 'Ratio', 'CPC inflating > 40% vs baseline indicates auction aggression', 'WARNING'],
    ['BUDGET_LOST_IS_ALERT', config.THRESHOLDS.BUDGET_LOST_IS_ALERT, 'Ratio', 'Search Budget Lost IS >= 20% on winning campaigns (ROAS >= Target)', 'OPPORTUNITY'],
    ['RANK_LOST_IS_ALERT', config.THRESHOLDS.RANK_LOST_IS_ALERT, 'Ratio', 'Search Rank Lost IS >= 40% indicates Ad Rank / Quality Score deficit', 'WARNING'],
    ['TARGET_CPA', config.TARGETS.TARGET_CPA, 'Currency (TRY)', 'Target Cost Per Acquisition for profitability gating', 'BENCHMARK'],
    ['TARGET_ROAS', config.TARGETS.TARGET_ROAS, 'Multiplier', 'Target Return on Ad Spend for scaling unlocks', 'BENCHMARK'],
    ['TIMEZONE', config.TIMEZONE, 'Timezone String', 'Account reporting timezone for ISO date slicing', 'SYSTEM'],
    ['CURRENCY_SYMBOL', config.CURRENCY_SYMBOL, 'Symbol', 'Currency display symbol', 'SYSTEM'],
    ['SPREADSHEET_URL', config.SPREADSHEET_URL || '(Auto-Created)', 'URL', 'Destination Google Spreadsheet', 'SYSTEM']
  ];

  for (let i = 0; i < settingsList.length; i++) {
    const s = settingsList[i];
    const isOdd = i % 2 === 1;
    addRow(s, isOdd ? CONFIG.PALETTE.ZEBRA_ODD : CONFIG.PALETTE.ZEBRA_EVEN);
  }

  writeMatrixToSheet(sheet, 1, 1, matrix);
  const range = sheet.getRange(1, 1, matrix.length, numCols);
  safeSetBackgrounds(range, backgrounds);
  safeSetFontWeights(range, fontWeights);
  safeSetFontColors(range, fontColors);

  if (typeof sheet.setFrozenRows === 'function') {
    sheet.setFrozenRows(4);
  }
}

/**
 * Master exporter coordinating writing all 5 dashboard tabs.
 *
 * @param {Object} spreadsheet Google Spreadsheet instance
 * @param {Object} telemetry Collected telemetry data
 * @param {Array<Object>} anomalies Detected anomalies
 * @param {string} aiMarkdown Markdown prompt string
 * @param {Object} config Configuration settings
 * @param {string} timestamp Execution ISO timestamp
 */
function exportDashboardToSheets(spreadsheet, telemetry, anomalies, aiMarkdown, config, timestamp) {
  const tabs = config.TABS;

  const kpiSheet = getOrCreateSheet(spreadsheet, tabs.DASHBOARD_KPI);
  renderDashboardKPITab(kpiSheet, telemetry, anomalies, config, timestamp);

  const anomaliesSheet = getOrCreateSheet(spreadsheet, tabs.ANOMALIES_ALERTS);
  renderAnomaliesAlertsTab(anomaliesSheet, anomalies, config, timestamp);

  const aiSheet = getOrCreateSheet(spreadsheet, tabs.AI_PROMPT_SUMMARY);
  renderAIPromptSummaryTab(aiSheet, aiMarkdown, timestamp);

  const campSheet = getOrCreateSheet(spreadsheet, tabs.CAMPAIGN_PERFORMANCE);
  renderCampaignPerformanceTab(campSheet, telemetry, config, timestamp);

  const configSheet = getOrCreateSheet(spreadsheet, tabs.SETTINGS_CONFIG);
  renderSettingsConfigTab(configSheet, config, timestamp);
}

// ==============================================================================
// 8. MAIN ENTRYPOINT
// ==============================================================================

/**
 * Main execution function called by Google Ads Scripts scheduler.
 */
function main() {
  const executionStartTime = new Date();
  const timestamp = formatDateIso(executionStartTime, CONFIG.TIMEZONE) + ' ' +
    executionStartTime.toTimeString().split(' ')[0];

  Logger.log(`==============================================================================`);
  Logger.log(`[START] ATLI MEDIKAL — R2 PERFORMANCE & AI INTERPRETER DASHBOARD`);
  Logger.log(`Execution Timestamp: ${timestamp} (Timezone: ${CONFIG.TIMEZONE})`);
  Logger.log(`==============================================================================`);

  // Step 1: Ingest multi-window telemetry data via GAQL
  Logger.log(`[Step 1/5] Ingesting GAQL telemetry across Yesterday, 7D, 14D, and 30D...`);
  const telemetry = fetchAllTelemetryData(CONFIG);
  Logger.log(`-> Telemetry successfully gathered for 8 comparison windows.`);

  // Step 2: Evaluate 8-rule mathematical anomaly engine
  Logger.log(`[Step 2/5] Evaluating 8-rule anomaly detection engine...`);
  const anomalies = evaluateAnomalies(telemetry, CONFIG);
  Logger.log(`-> Anomaly check complete: ${anomalies.length} active flag(s) identified.`);
  for (let i = 0; i < anomalies.length; i++) {
    Logger.log(`   [${anomalies[i].severity}] ${anomalies[i].ruleId} - ${anomalies[i].name} on ${anomalies[i].entityName}`);
  }

  // Step 3: Synthesize Copyable AI Interpretation Markdown block
  Logger.log(`[Step 3/5] Synthesizing Copyable AI Interpretation Markdown block...`);
  const aiMarkdown = generateAIPromptMarkdown(telemetry, anomalies, CONFIG, timestamp);
  Logger.log(`-> AI Prompt synthesized (${aiMarkdown.length} characters). Emitting to Logger:`);
  Logger.log(`\n--- BEGIN COPYABLE AI PROMPT ---\n${aiMarkdown}\n--- END COPYABLE AI PROMPT ---\n`);

  // Step 4: Provision Google Spreadsheet
  Logger.log(`[Step 4/5] Connecting to Google Spreadsheet...`);
  let spreadsheet;
  if (typeof SpreadsheetApp !== 'undefined') {
    if (CONFIG.SPREADSHEET_URL && CONFIG.SPREADSHEET_URL.trim() !== '') {
      if (CONFIG.SPREADSHEET_URL.startsWith('https://')) {
        spreadsheet = SpreadsheetApp.openByUrl(CONFIG.SPREADSHEET_URL);
      } else {
        spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_URL);
      }
    } else {
      spreadsheet = SpreadsheetApp.create(`Atli Medikal — Autonomous Performance & AI Dashboard (${timestamp.split(' ')[0]})`);
      Logger.log(`-> Created new Google Spreadsheet: ${spreadsheet.getUrl()}`);
    }

    // Step 5: Batch export 5 tabs
    Logger.log(`[Step 5/5] Exporting 5-Tab Dashboard via batch matrix setValues()...`);
    exportDashboardToSheets(spreadsheet, telemetry, anomalies, aiMarkdown, CONFIG, timestamp);
    Logger.log(`-> All 5 tabs exported successfully: DASHBOARD_KPI, ANOMALIES_ALERTS, AI_PROMPT_SUMMARY, CAMPAIGN_PERFORMANCE, SETTINGS_CONFIG`);
    Logger.log(`-> Spreadsheet URL: ${spreadsheet.getUrl()}`);
  } else {
    Logger.log(`[Notice] SpreadsheetApp runtime not detected (Node.js/CLI environment). Skipping sheet write.`);
  }

  const durationSec = ((new Date().getTime() - executionStartTime.getTime()) / 1000).toFixed(1);
  Logger.log(`==============================================================================`);
  Logger.log(`[COMPLETE] Script executed successfully in ${durationSec}s.`);
  Logger.log(`==============================================================================`);
}

// ==============================================================================
// 9. MODULE EXPORTS (FOR AUTOMATED TESTING & NODE HARNESS)
// ==============================================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONFIG,
    main,
    validateGAQLSafety,
    microsToCurrency,
    getSafeValue,
    formatImpressionShare,
    parseImpressionShareToNumber,
    calculateDelta,
    formatTrendDelta,
    formatDateIso,
    getDateOffset,
    buildCampaignQuery,
    parseCampaignRow,
    aggregateTimeframeMetrics,
    fetchAllTelemetryData,
    evaluateAnomalies,
    generateAIPromptMarkdown,
    writeMatrixToSheet,
    getOrCreateSheet,
    renderDashboardKPITab,
    renderAnomaliesAlertsTab,
    renderAIPromptSummaryTab,
    renderCampaignPerformanceTab,
    renderSettingsConfigTab,
    exportDashboardToSheets
  };
}
