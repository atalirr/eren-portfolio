/**
 * ==============================================================================
 * ATLI MEDIKAL — ENTERPRISE GOOGLE ADS AUTOMATION SUITE
 * Script: R1 Comprehensive Account Inventory & Diagnostics
 * File: account_inventory_diagnostics.js
 * Version: 1.0.0-PROD
 * Runtime: Google Ads Scripts (V8 Engine) / GAQL / Google Apps Script
 *
 * SCOPE & RESPONSIBILITIES (Milestone 1 / R1):
 * 1. Multi-Channel Campaign Inventory (Search, Display, PMax, Video, Shopping, Demand Gen)
 * 2. Ad Group Topology & Bid Analysis
 * 3. Keyword Performance & Match Type Catalog
 * 4. 4-Way Deep Quality Score Diagnostics (Overall QS, Expected CTR, Ad Relevance, Landing Page)
 * 5. Search Term Mining View (Queries, Status, Spend & Conversions, Recommendations)
 * 6. Ads & Responsive Search Ads (RSA) Topology & RSA Asset Performance Labels
 * 7. Unified Extensions & Asset Catalog (Sitelinks, Callouts, Calls, Snippets across Account & Campaign)
 * 8. Negative List Intelligence (Campaign Negatives, Ad Group Negatives, Shared Negative Sets)
 * 9. Demographic Breakdowns (Discrete Gender View & Age Range View)
 * 10. Audience Catalog & User Lists
 * 11. Ad Schedules & Device Performance Segmentation
 * 12. 13-Tab Multi-Matrix Google Sheets Exporter (Navy #1F4E79, frozen rows, chunked setValues at 5,000 rows)
 * 13. Strict Billing Privacy & Safety Invariant (validateGAQLSafety)
 * 14. Universal Micro-Currency Normalization (/ 1,000,000.0)
 * ==============================================================================
 */

// ==============================================================================
// 1. MASTER CONFIGURATION BLOCK
// ==============================================================================
const CONFIG = {
  // Target Google Sheet URL or ID. If left empty, a new Spreadsheet will be created automatically.
  SPREADSHEET_URL: '',

  // Evaluation Date Range for performance metrics:
  // Options: 'LAST_30_DAYS', 'LAST_14_DAYS', 'LAST_7_DAYS', 'THIS_MONTH', 'LAST_MONTH'
  DATE_RANGE: 'LAST_30_DAYS',

  // Account Identification & Localisation
  ACCOUNT_NAME: 'Atli Medikal',
  CUSTOMER_ID: '893-465-2990',
  TIMEZONE: 'Europe/Istanbul',
  CURRENCY_SYMBOL: '₺',

  // Spreadsheet Performance & Batching Settings
  CHUNK_SIZE: 5000, // Maximum rows per setValues() call to prevent Apps Script timeouts

  // 13 Target Sheet Tab Names
  TABS: {
    SUMMARY: 'SUMMARY',
    CAMPAIGNS: 'CAMPAIGNS',
    AD_GROUPS: 'AD_GROUPS',
    KEYWORDS: 'KEYWORDS',
    QUALITY_SCORE: 'QUALITY_SCORE',
    SEARCH_TERMS: 'SEARCH_TERMS',
    ADS_RSA: 'ADS_RSA',
    ASSETS_EXTENSIONS: 'ASSETS_EXTENSIONS',
    NEGATIVE_LISTS: 'NEGATIVE_LISTS',
    DEMOGRAPHICS_GENDER: 'DEMOGRAPHICS_GENDER',
    DEMOGRAPHICS_AGE: 'DEMOGRAPHICS_AGE',
    AUDIENCES: 'AUDIENCES',
    SCHEDULE_DEVICE: 'SCHEDULE_DEVICE'
  },

  // Color Palette Constants
  PALETTE: {
    HEADER_BG: '#1F4E79',        // Corporate Dark Navy
    HEADER_TEXT: '#FFFFFF',      // Crisp White
    SUBHEADER_BG: '#2E5B88',     // Medium Slate Navy
    CARD_BG: '#F8FAFC',          // Ghost White
    BORDER: '#CBD5E1',           // Border Slate
    ZEBRA_EVEN: '#FFFFFF',       // Crisp White
    ZEBRA_ODD: '#F2F4F8',        // Cool Light Gray
    GREEN_BG: '#E2EFDA',         // Soft Green
    GREEN_TEXT: '#375623',       // Dark Forest Green
    YELLOW_BG: '#FFF2CC',        // Soft Yellow
    YELLOW_TEXT: '#833C0C',      // Dark Amber
    RED_BG: '#FCE4D6',           // Soft Red
    RED_TEXT: '#C65911',         // Dark Crimson
    NEUTRAL_TEXT: '#262626'      // Charcoal Text
  },

  // Diagnostic Thresholds
  THRESHOLDS: {
    LOW_QUALITY_SCORE: 4,        // QS <= 4 flagged as Critical / Poor
    HIGH_WASTE_SEARCH_TERM: 150, // Non-converting query spending >= 150 TRY flagged for negative
    REVIEW_WASTE_SEARCH_TERM: 50,// Non-converting query spending >= 50 TRY flagged for review
    WINNING_SEARCH_TERM_CONV: 2  // Queries with >= 2 conversions recommended as exact keywords
  }
};

// ==============================================================================
// 2. PRIVACY & SECURITY GATEKEEPER
// ==============================================================================

/**
 * Strict AST/token-based validator preventing any query targeting billing, invoice,
 * credit card, payment, or banking resources.
 * Mandated by Project Safety & Privacy Invariant (F01).
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
    'account_budget_proposal',
    'payments_account',
    'invoice',
    'billing_status',
    'credit_card',
    'payment_method',
    'bank_account',
    'tax_id',
    'vat'
  ];

  const lowerQuery = query.toLowerCase();
  for (let i = 0; i < FORBIDDEN_BILLING_RESOURCES.length; i++) {
    const forbidden = FORBIDDEN_BILLING_RESOURCES[i];
    // Regular expression ensuring boundary matching (e.g. account_budget vs campaign_budget)
    const regex = new RegExp('\\b' + forbidden + '\\b', 'i');
    if (regex.test(lowerQuery)) {
      throw new Error(`SAFETY VIOLATION: Query references restricted billing resource: ${forbidden}`);
    }
  }

  return true;
}

// ==============================================================================
// 3. CORE METRIC UTILITIES & DATA ACCESSORS
// ==============================================================================

/**
 * Normalizes micro-currency values (cost_micros, amount_micros, cpc_bid_micros, average_cpc)
 * to standard currency units (/ 1,000,000.0).
 * Mandated by F13 Micro-Currency Standardizer.
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
 * Formats a Date object into ISO YYYY-MM-DD string with timezone support.
 *
 * @param {Date} date Date instance
 * @param {string} timezone Target timezone
 * @returns {string} Formatted date string
 */
function formatDateIso(date, timezone = 'UTC') {
  if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
    try {
      return Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
    } catch (e) {
      // Fallback if timezone string is invalid in mock
    }
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Executes a GAQL query with safety verification and error trapping.
 *
 * @param {string} query Validated GAQL query
 * @returns {Array<Object>} Array of result rows
 */
function executeGAQLQuery(query) {
  validateGAQLSafety(query);

  const results = [];
  if (typeof AdsApp === 'undefined' || !AdsApp.search) {
    return results;
  }

  try {
    const iterator = AdsApp.search(query);
    while (iterator.hasNext()) {
      results.push(iterator.next());
    }
  } catch (error) {
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log(`GAQL Execution Error: ${error.message} | Query: ${query.substring(0, 100)}...`);
    }
    throw error;
  }

  return results;
}

// ==============================================================================
// 4. ENTITY EXTRACTORS (GAQL ENGINE)
// ==============================================================================

/**
 * F02: Universal Campaign Inventory Extractor
 * Extracts all campaign types (Search, Display, PMax, Video, Shopping, Demand Gen)
 * with budgets, bidding strategies, and performance metrics.
 *
 * @param {string} dateRange GAQL date range token
 * @returns {Array<Object>} Normalized campaign objects
 */
function extractCampaigns(dateRange = 'LAST_30_DAYS') {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.advertising_channel_sub_type,
      campaign.bidding_strategy_type,
      campaign_budget.id,
      campaign_budget.name,
      campaign_budget.amount_micros,
      campaign_budget.delivery_method,
      campaign_budget.is_explicitly_shared,
      campaign.target_cpa.target_cpa_micros,
      campaign.target_roas.target_roas,
      campaign.maximize_conversions.target_cpa_micros,
      campaign.maximize_conversion_value.target_roas,
      campaign.start_date,
      campaign.end_date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE campaign.status != 'REMOVED'
      AND segments.date DURING ${dateRange}
    ORDER BY metrics.cost_micros DESC
  `;

  const rows = executeGAQLQuery(query);
  const campaigns = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cost = microsToCurrency(getSafeValue(row, 'metrics.cost_micros', 0));
    const impressions = Number(getSafeValue(row, 'metrics.impressions', 0));
    const clicks = Number(getSafeValue(row, 'metrics.clicks', 0));
    const conversions = Number(Number(getSafeValue(row, 'metrics.conversions', 0)).toFixed(2));
    const convValue = Number(Number(getSafeValue(row, 'metrics.conversions_value', 0)).toFixed(2));
    const ctr = Number(Number(getSafeValue(row, 'metrics.ctr', 0)).toFixed(4));
    const avgCpc = microsToCurrency(getSafeValue(row, 'metrics.average_cpc', 0));

    // Target CPA extraction across standard target_cpa and maximize_conversions
    const targetCpaMicros = getSafeValue(row, 'campaign.target_cpa.target_cpa_micros') ||
      getSafeValue(row, 'campaign.maximize_conversions.target_cpa_micros');
    const targetCpa = targetCpaMicros ? microsToCurrency(targetCpaMicros) : null;

    // Target ROAS extraction across standard target_roas and maximize_conversion_value
    const targetRoasVal = getSafeValue(row, 'campaign.target_roas.target_roas') ||
      getSafeValue(row, 'campaign.maximize_conversion_value.target_roas');
    const targetRoas = targetRoasVal ? Number(Number(targetRoasVal).toFixed(2)) : null;

    const cpa = conversions > 0 ? Number((cost / conversions).toFixed(2)) : (cost > 0 ? 'No Conv' : 0.00);
    const roas = cost > 0 ? Number((convValue / cost).toFixed(2)) : 0.00;

    campaigns.push({
      id: String(getSafeValue(row, 'campaign.id', '')),
      name: String(getSafeValue(row, 'campaign.name', '')),
      status: String(getSafeValue(row, 'campaign.status', '')),
      channelType: String(getSafeValue(row, 'campaign.advertising_channel_type', '')),
      subType: String(getSafeValue(row, 'campaign.advertising_channel_sub_type', '--')),
      biddingStrategy: String(getSafeValue(row, 'campaign.bidding_strategy_type', '')),
      budgetId: String(getSafeValue(row, 'campaign_budget.id', '')),
      budgetName: String(getSafeValue(row, 'campaign_budget.name', '')),
      dailyBudget: microsToCurrency(getSafeValue(row, 'campaign_budget.amount_micros', 0)),
      isSharedBudget: Boolean(getSafeValue(row, 'campaign_budget.is_explicitly_shared', false)),
      targetCpa: targetCpa !== null ? targetCpa : '--',
      targetRoas: targetRoas !== null ? `${targetRoas}x` : '--',
      startDate: String(getSafeValue(row, 'campaign.start_date', '--')),
      endDate: String(getSafeValue(row, 'campaign.end_date', '--')),
      impressions: impressions,
      clicks: clicks,
      cost: cost,
      conversions: conversions,
      conversionsValue: convValue,
      ctr: ctr,
      avgCpc: avgCpc,
      cpa: cpa,
      roas: roas
    });
  }

  return campaigns;
}

/**
 * F03: Ad Group Topology Scanner
 * Extracts ad groups, statuses, types, and default bids.
 *
 * @param {string} dateRange GAQL date range token
 * @returns {Array<Object>} Normalized ad group objects
 */
function extractAdGroups(dateRange = 'LAST_30_DAYS') {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      ad_group.id,
      ad_group.name,
      ad_group.status,
      ad_group.type,
      ad_group.cpc_bid_micros,
      ad_group.cpm_bid_micros,
      ad_group.target_cpa_micros,
      ad_group.target_roas,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc
    FROM ad_group
    WHERE campaign.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
      AND segments.date DURING ${dateRange}
    ORDER BY metrics.cost_micros DESC
  `;

  const rows = executeGAQLQuery(query);
  const adGroups = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cost = microsToCurrency(getSafeValue(row, 'metrics.cost_micros', 0));
    const impressions = Number(getSafeValue(row, 'metrics.impressions', 0));
    const clicks = Number(getSafeValue(row, 'metrics.clicks', 0));
    const conversions = Number(Number(getSafeValue(row, 'metrics.conversions', 0)).toFixed(2));
    const convValue = Number(Number(getSafeValue(row, 'metrics.conversions_value', 0)).toFixed(2));
    const ctr = Number(Number(getSafeValue(row, 'metrics.ctr', 0)).toFixed(4));
    const avgCpc = microsToCurrency(getSafeValue(row, 'metrics.average_cpc', 0));

    const defaultCpc = microsToCurrency(getSafeValue(row, 'ad_group.cpc_bid_micros', 0));
    const cpmBid = microsToCurrency(getSafeValue(row, 'ad_group.cpm_bid_micros', 0));
    const targetCpa = microsToCurrency(getSafeValue(row, 'ad_group.target_cpa_micros', 0));
    const targetRoas = getSafeValue(row, 'ad_group.target_roas');

    const cpa = conversions > 0 ? Number((cost / conversions).toFixed(2)) : (cost > 0 ? 'No Conv' : 0.00);

    adGroups.push({
      campaignId: String(getSafeValue(row, 'campaign.id', '')),
      campaignName: String(getSafeValue(row, 'campaign.name', '')),
      campaignStatus: String(getSafeValue(row, 'campaign.status', '')),
      adGroupId: String(getSafeValue(row, 'ad_group.id', '')),
      adGroupName: String(getSafeValue(row, 'ad_group.name', '')),
      status: String(getSafeValue(row, 'ad_group.status', '')),
      type: String(getSafeValue(row, 'ad_group.type', '')),
      defaultCpcBid: defaultCpc > 0 ? defaultCpc : '--',
      cpmBid: cpmBid > 0 ? cpmBid : '--',
      targetCpa: targetCpa > 0 ? targetCpa : '--',
      targetRoas: targetRoas ? `${Number(targetRoas).toFixed(2)}x` : '--',
      impressions: impressions,
      clicks: clicks,
      cost: cost,
      conversions: conversions,
      conversionsValue: convValue,
      ctr: ctr,
      avgCpc: avgCpc,
      cpa: cpa
    });
  }

  return adGroups;
}

/**
 * F04: Keyword Performance & Match Type Catalog
 * Retrieves keyword attributes, match types, bids, serving status, and performance metrics.
 *
 * @param {string} dateRange GAQL date range token
 * @returns {Array<Object>} Normalized keyword objects
 */
function extractKeywords(dateRange = 'LAST_30_DAYS') {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      ad_group_criterion.cpc_bid_micros,
      ad_group_criterion.effective_cpc_bid_micros,
      ad_group_criterion.system_serving_status,
      ad_group_criterion.approval_status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc
    FROM keyword_view
    WHERE campaign.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
      AND ad_group_criterion.status != 'REMOVED'
      AND segments.date DURING ${dateRange}
    ORDER BY metrics.cost_micros DESC
  `;

  const rows = executeGAQLQuery(query);
  const keywords = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cost = microsToCurrency(getSafeValue(row, 'metrics.cost_micros', 0));
    const impressions = Number(getSafeValue(row, 'metrics.impressions', 0));
    const clicks = Number(getSafeValue(row, 'metrics.clicks', 0));
    const conversions = Number(Number(getSafeValue(row, 'metrics.conversions', 0)).toFixed(2));
    const convValue = Number(Number(getSafeValue(row, 'metrics.conversions_value', 0)).toFixed(2));
    const ctr = Number(Number(getSafeValue(row, 'metrics.ctr', 0)).toFixed(4));
    const avgCpc = microsToCurrency(getSafeValue(row, 'metrics.average_cpc', 0));

    const cpcBid = microsToCurrency(getSafeValue(row, 'ad_group_criterion.cpc_bid_micros', 0));
    const effectiveCpc = microsToCurrency(getSafeValue(row, 'ad_group_criterion.effective_cpc_bid_micros', 0));
    const cpa = conversions > 0 ? Number((cost / conversions).toFixed(2)) : (cost > 0 ? 'No Conv' : 0.00);

    keywords.push({
      campaignId: String(getSafeValue(row, 'campaign.id', '')),
      campaignName: String(getSafeValue(row, 'campaign.name', '')),
      adGroupId: String(getSafeValue(row, 'ad_group.id', '')),
      adGroupName: String(getSafeValue(row, 'ad_group.name', '')),
      criterionId: String(getSafeValue(row, 'ad_group_criterion.criterion_id', '')),
      keywordText: String(getSafeValue(row, 'ad_group_criterion.keyword.text', '')),
      matchType: String(getSafeValue(row, 'ad_group_criterion.keyword.match_type', '')),
      status: String(getSafeValue(row, 'ad_group_criterion.status', '')),
      cpcBid: cpcBid > 0 ? cpcBid : '--',
      effectiveCpcBid: effectiveCpc > 0 ? effectiveCpc : '--',
      servingStatus: String(getSafeValue(row, 'ad_group_criterion.system_serving_status', '--')),
      approvalStatus: String(getSafeValue(row, 'ad_group_criterion.approval_status', '--')),
      impressions: impressions,
      clicks: clicks,
      cost: cost,
      conversions: conversions,
      conversionsValue: convValue,
      ctr: ctr,
      avgCpc: avgCpc,
      cpa: cpa
    });
  }

  return keywords;
}

/**
 * F05: 4-Way Quality Score Diagnostic Extractor
 * Extracts Overall Quality Score, Expected CTR (search_predicted_ctr),
 * Ad Relevance (creative_quality_score), and Landing Page Experience (post_click_quality_score).
 *
 * @returns {Array<Object>} Quality score diagnostic records
 */
function extractQualityScore() {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      ad_group_criterion.quality_info.quality_score,
      ad_group_criterion.quality_info.search_predicted_ctr,
      ad_group_criterion.quality_info.creative_quality_score,
      ad_group_criterion.quality_info.post_click_quality_score
    FROM ad_group_criterion
    WHERE ad_group_criterion.type = 'KEYWORD'
      AND campaign.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
      AND ad_group_criterion.status != 'REMOVED'
  `;

  const rows = executeGAQLQuery(query);
  const diagnostics = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawQs = getSafeValue(row, 'ad_group_criterion.quality_info.quality_score');
    const qs = (rawQs !== null && rawQs !== undefined && !isNaN(rawQs)) ? Number(rawQs) : null;

    const expectedCtr = String(getSafeValue(row, 'ad_group_criterion.quality_info.search_predicted_ctr', '--'));
    const adRelevance = String(getSafeValue(row, 'ad_group_criterion.quality_info.creative_quality_score', '--'));
    const landingPageExp = String(getSafeValue(row, 'ad_group_criterion.quality_info.post_click_quality_score', '--'));

    let health = 'UNGRADED / LOW_DATA';
    if (qs !== null) {
      if (qs >= 8) {
        health = 'EXCELLENT (8-10)';
      } else if (qs >= 5) {
        health = 'AVERAGE (5-7)';
      } else {
        health = 'CRITICAL: POOR (1-4)';
      }
    }

    diagnostics.push({
      campaignId: String(getSafeValue(row, 'campaign.id', '')),
      campaignName: String(getSafeValue(row, 'campaign.name', '')),
      adGroupId: String(getSafeValue(row, 'ad_group.id', '')),
      adGroupName: String(getSafeValue(row, 'ad_group.name', '')),
      criterionId: String(getSafeValue(row, 'ad_group_criterion.criterion_id', '')),
      keywordText: String(getSafeValue(row, 'ad_group_criterion.keyword.text', '')),
      matchType: String(getSafeValue(row, 'ad_group_criterion.keyword.match_type', '')),
      status: String(getSafeValue(row, 'ad_group_criterion.status', '')),
      qualityScore: qs !== null ? qs : '--',
      expectedCtr: expectedCtr,
      adRelevance: adRelevance,
      landingPageExp: landingPageExp,
      health: health
    });
  }

  return diagnostics;
}

/**
 * F06: Search Term Diagnostics Extractor
 * Extracts user queries via search_term_view with spend, conversions, and actionable tags.
 *
 * @param {string} dateRange GAQL date range token
 * @returns {Array<Object>} Normalized search term records
 */
function extractSearchTerms(dateRange = 'LAST_30_DAYS') {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      search_term_view.search_term,
      search_term_view.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc
    FROM search_term_view
    WHERE segments.date DURING ${dateRange}
    ORDER BY metrics.cost_micros DESC
  `;

  const rows = executeGAQLQuery(query);
  const searchTerms = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cost = microsToCurrency(getSafeValue(row, 'metrics.cost_micros', 0));
    const impressions = Number(getSafeValue(row, 'metrics.impressions', 0));
    const clicks = Number(getSafeValue(row, 'metrics.clicks', 0));
    const conversions = Number(Number(getSafeValue(row, 'metrics.conversions', 0)).toFixed(2));
    const convValue = Number(Number(getSafeValue(row, 'metrics.conversions_value', 0)).toFixed(2));
    const ctr = Number(Number(getSafeValue(row, 'metrics.ctr', 0)).toFixed(4));
    const avgCpc = microsToCurrency(getSafeValue(row, 'metrics.average_cpc', 0));
    const status = String(getSafeValue(row, 'search_term_view.status', 'NONE'));

    let recommendation = 'MONITOR';
    if (status === 'ADDED') {
      recommendation = 'ALREADY_ACTIVE_KEYWORD';
    } else if (status === 'EXCLUDED') {
      recommendation = 'ALREADY_EXCLUDED';
    } else {
      if (conversions === 0 && cost >= CONFIG.THRESHOLDS.HIGH_WASTE_SEARCH_TERM) {
        recommendation = 'CRITICAL: ADD_AS_NEGATIVE';
      } else if (conversions === 0 && cost >= CONFIG.THRESHOLDS.REVIEW_WASTE_SEARCH_TERM) {
        recommendation = 'REVIEW: HIGH_SPEND_NO_CONV';
      } else if (conversions >= CONFIG.THRESHOLDS.WINNING_SEARCH_TERM_CONV) {
        recommendation = 'OPPORTUNITY: ADD_AS_KEYWORD';
      }
    }

    const cpa = conversions > 0 ? Number((cost / conversions).toFixed(2)) : (cost > 0 ? 'No Conv' : 0.00);

    searchTerms.push({
      campaignId: String(getSafeValue(row, 'campaign.id', '')),
      campaignName: String(getSafeValue(row, 'campaign.name', '')),
      adGroupId: String(getSafeValue(row, 'ad_group.id', '')),
      adGroupName: String(getSafeValue(row, 'ad_group.name', '')),
      searchTerm: String(getSafeValue(row, 'search_term_view.search_term', '')),
      status: status,
      impressions: impressions,
      clicks: clicks,
      cost: cost,
      conversions: conversions,
      conversionsValue: convValue,
      ctr: ctr,
      avgCpc: avgCpc,
      cpa: cpa,
      recommendation: recommendation
    });
  }

  return searchTerms;
}

/**
 * F07: Responsive Search Ads (RSA) & Asset Performance Labels Extractor
 * Extracts ad topology, headlines, descriptions, paths, ad strength, and
 * asset-level performance ratings (BEST, GOOD, LOW, LEARNING).
 *
 * @param {string} dateRange GAQL date range token
 * @returns {Array<Object>} Unified RSA and asset performance records
 */
function extractAdsAndRSA(dateRange = 'LAST_30_DAYS') {
  const records = [];

  // Query 6A: Ad-level records from ad_group_ad
  const adQuery = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_ad.ad.id,
      ad_group_ad.ad.name,
      ad_group_ad.ad.type,
      ad_group_ad.status,
      ad_group_ad.ad_strength,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad.responsive_search_ad.path1,
      ad_group_ad.ad.responsive_search_ad.path2,
      ad_group_ad.ad.final_urls,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM ad_group_ad
    WHERE campaign.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
      AND ad_group_ad.status != 'REMOVED'
      AND segments.date DURING ${dateRange}
    ORDER BY metrics.impressions DESC
  `;

  const adRows = executeGAQLQuery(adQuery);

  for (let i = 0; i < adRows.length; i++) {
    const row = adRows[i];
    const cost = microsToCurrency(getSafeValue(row, 'metrics.cost_micros', 0));
    const impressions = Number(getSafeValue(row, 'metrics.impressions', 0));
    const clicks = Number(getSafeValue(row, 'metrics.clicks', 0));
    const conversions = Number(Number(getSafeValue(row, 'metrics.conversions', 0)).toFixed(2));
    const convValue = Number(Number(getSafeValue(row, 'metrics.conversions_value', 0)).toFixed(2));

    // Format headlines
    const rawHeadlines = getSafeValue(row, 'ad_group_ad.ad.responsive_search_ad.headlines', []);
    let headlinesText = '--';
    let headlineCount = 0;
    if (Array.isArray(rawHeadlines) && rawHeadlines.length > 0) {
      headlineCount = rawHeadlines.length;
      headlinesText = rawHeadlines.map(h => {
        const text = typeof h === 'object' ? (h.text || JSON.stringify(h)) : String(h);
        const pin = h && h.pinnedField ? ` [${h.pinnedField}]` : '';
        return text + pin;
      }).join(' | ');
    }

    // Format descriptions
    const rawDescriptions = getSafeValue(row, 'ad_group_ad.ad.responsive_search_ad.descriptions', []);
    let descriptionsText = '--';
    let descCount = 0;
    if (Array.isArray(rawDescriptions) && rawDescriptions.length > 0) {
      descCount = rawDescriptions.length;
      descriptionsText = rawDescriptions.map(d => {
        const text = typeof d === 'object' ? (d.text || JSON.stringify(d)) : String(d);
        const pin = d && d.pinnedField ? ` [${d.pinnedField}]` : '';
        return text + pin;
      }).join(' | ');
    }

    const finalUrls = getSafeValue(row, 'ad_group_ad.ad.final_urls', []);
    const finalUrlStr = Array.isArray(finalUrls) ? finalUrls.join(', ') : String(finalUrls || '--');

    records.push({
      recordType: 'AD_OVERVIEW',
      campaignId: String(getSafeValue(row, 'campaign.id', '')),
      campaignName: String(getSafeValue(row, 'campaign.name', '')),
      adGroupId: String(getSafeValue(row, 'ad_group.id', '')),
      adGroupName: String(getSafeValue(row, 'ad_group.name', '')),
      adId: String(getSafeValue(row, 'ad_group_ad.ad.id', '')),
      adTypeOrField: String(getSafeValue(row, 'ad_group_ad.ad.type', '')),
      statusOrLabel: String(getSafeValue(row, 'ad_group_ad.status', '')),
      adStrength: String(getSafeValue(row, 'ad_group_ad.ad_strength', '--')),
      headlineCount: headlineCount,
      headlinesText: headlinesText,
      descCount: descCount,
      descriptionsText: descriptionsText,
      path1: String(getSafeValue(row, 'ad_group_ad.ad.responsive_search_ad.path1', '--')),
      path2: String(getSafeValue(row, 'ad_group_ad.ad.responsive_search_ad.path2', '--')),
      finalUrls: finalUrlStr,
      impressions: impressions,
      clicks: clicks,
      cost: cost,
      conversions: conversions,
      conversionsValue: convValue
    });
  }

  // Query 6B: Asset-level performance labels from ad_group_ad_asset_view
  try {
    const assetQuery = `
      SELECT
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        ad_group_ad.ad.id,
        ad_group_ad_asset_view.asset,
        ad_group_ad_asset_view.field_type,
        ad_group_ad_asset_view.performance_label,
        asset.text_asset.text,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros
      FROM ad_group_ad_asset_view
      WHERE segments.date DURING ${dateRange}
      ORDER BY metrics.impressions DESC
    `;

    const assetRows = executeGAQLQuery(assetQuery);

    for (let j = 0; j < assetRows.length; j++) {
      const aRow = assetRows[j];
      const cost = microsToCurrency(getSafeValue(aRow, 'metrics.cost_micros', 0));
      const impressions = Number(getSafeValue(aRow, 'metrics.impressions', 0));
      const clicks = Number(getSafeValue(aRow, 'metrics.clicks', 0));

      records.push({
        recordType: 'RSA_ASSET_RATING',
        campaignId: String(getSafeValue(aRow, 'campaign.id', '')),
        campaignName: String(getSafeValue(aRow, 'campaign.name', '')),
        adGroupId: String(getSafeValue(aRow, 'ad_group.id', '')),
        adGroupName: String(getSafeValue(aRow, 'ad_group.name', '')),
        adId: String(getSafeValue(aRow, 'ad_group_ad.ad.id', '')),
        adTypeOrField: String(getSafeValue(aRow, 'ad_group_ad_asset_view.field_type', '')),
        statusOrLabel: String(getSafeValue(aRow, 'ad_group_ad_asset_view.performance_label', 'LEARNING')),
        adStrength: '--',
        headlineCount: '--',
        headlinesText: String(getSafeValue(aRow, 'asset.text_asset.text', '--')),
        descCount: '--',
        descriptionsText: '--',
        path1: '--',
        path2: '--',
        finalUrls: String(getSafeValue(aRow, 'ad_group_ad_asset_view.asset', '--')),
        impressions: impressions,
        clicks: clicks,
        cost: cost,
        conversions: 0,
        conversionsValue: 0
      });
    }
  } catch (err) {
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log(`Notice: ad_group_ad_asset_view query skipped or unavailable: ${err.message}`);
    }
  }

  return records;
}

/**
 * F08: Unified Assets & Extensions Extractor
 * Extracts Sitelinks, Callouts, Call Assets, and Structured Snippets
 * across Campaign and Account levels.
 *
 * @param {string} dateRange GAQL date range token
 * @returns {Array<Object>} Asset extension records
 */
function extractAssetsAndExtensions(dateRange = 'LAST_30_DAYS') {
  const assets = [];

  // Query 8A: Campaign-level assets
  const campAssetQuery = `
    SELECT
      campaign.id,
      campaign.name,
      asset.id,
      asset.name,
      asset.type,
      campaign_asset.field_type,
      campaign_asset.status,
      asset.sitelink_asset.link_text,
      asset.sitelink_asset.description1,
      asset.sitelink_asset.description2,
      asset.callout_asset.callout_text,
      asset.call_asset.phone_number,
      asset.call_asset.country_code,
      asset.structured_snippet_asset.header,
      asset.structured_snippet_asset.values,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM campaign_asset
    WHERE campaign.status != 'REMOVED'
      AND campaign_asset.status != 'REMOVED'
      AND segments.date DURING ${dateRange}
  `;

  try {
    const campRows = executeGAQLQuery(campAssetQuery);
    for (let i = 0; i < campRows.length; i++) {
      const row = campRows[i];
      assets.push(normalizeAssetRow(row, 'CAMPAIGN'));
    }
  } catch (e) {
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log(`Notice: campaign_asset query error: ${e.message}`);
    }
  }

  // Query 8B: Customer (Account) level assets
  const custAssetQuery = `
    SELECT
      asset.id,
      asset.name,
      asset.type,
      customer_asset.field_type,
      customer_asset.status,
      asset.sitelink_asset.link_text,
      asset.sitelink_asset.description1,
      asset.sitelink_asset.description2,
      asset.callout_asset.callout_text,
      asset.call_asset.phone_number,
      asset.call_asset.country_code,
      asset.structured_snippet_asset.header,
      asset.structured_snippet_asset.values,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM customer_asset
    WHERE customer_asset.status != 'REMOVED'
      AND segments.date DURING ${dateRange}
  `;

  try {
    const custRows = executeGAQLQuery(custAssetQuery);
    for (let j = 0; j < custRows.length; j++) {
      const row = custRows[j];
      assets.push(normalizeAssetRow(row, 'ACCOUNT'));
    }
  } catch (e) {
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log(`Notice: customer_asset query error: ${e.message}`);
    }
  }

  return assets;
}

/**
 * Normalizes an asset row across sitelinks, callouts, calls, and snippets.
 *
 * @param {Object} row GAQL row
 * @param {string} scope 'CAMPAIGN' or 'ACCOUNT'
 * @returns {Object} Normalized asset record
 */
function normalizeAssetRow(row, scope) {
  const assetType = String(getSafeValue(row, 'asset.type', ''));
  let text = String(getSafeValue(row, 'asset.name', '--'));
  let detail = '--';
  let subDetail = '--';
  let destination = '--';

  if (assetType === 'SITELINK') {
    text = String(getSafeValue(row, 'asset.sitelink_asset.link_text', text));
    detail = String(getSafeValue(row, 'asset.sitelink_asset.description1', '--'));
    subDetail = String(getSafeValue(row, 'asset.sitelink_asset.description2', '--'));
  } else if (assetType === 'CALLOUT') {
    text = String(getSafeValue(row, 'asset.callout_asset.callout_text', text));
  } else if (assetType === 'CALL') {
    text = String(getSafeValue(row, 'asset.call_asset.phone_number', text));
    detail = String(getSafeValue(row, 'asset.call_asset.country_code', '--'));
  } else if (assetType === 'STRUCTURED_SNIPPET') {
    detail = String(getSafeValue(row, 'asset.structured_snippet_asset.header', '--'));
    const vals = getSafeValue(row, 'asset.structured_snippet_asset.values', []);
    subDetail = Array.isArray(vals) ? vals.join(', ') : String(vals || '--');
  }

  const cost = microsToCurrency(getSafeValue(row, 'metrics.cost_micros', 0));
  const impressions = Number(getSafeValue(row, 'metrics.impressions', 0));
  const clicks = Number(getSafeValue(row, 'metrics.clicks', 0));

  return {
    scope: scope,
    campaignId: scope === 'CAMPAIGN' ? String(getSafeValue(row, 'campaign.id', '')) : '--',
    campaignName: scope === 'CAMPAIGN' ? String(getSafeValue(row, 'campaign.name', '')) : 'Account-Level',
    assetId: String(getSafeValue(row, 'asset.id', '')),
    assetName: String(getSafeValue(row, 'asset.name', '')),
    assetType: assetType,
    fieldType: String(getSafeValue(row, 'campaign_asset.field_type') || getSafeValue(row, 'customer_asset.field_type') || '--'),
    status: String(getSafeValue(row, 'campaign_asset.status') || getSafeValue(row, 'customer_asset.status') || '--'),
    primaryText: text,
    detailText: detail,
    subDetailText: subDetail,
    destination: destination,
    impressions: impressions,
    clicks: clicks,
    cost: cost
  };
}

/**
 * F09: Negative List Intelligence Extractor
 * Extracts negative keywords across Campaign Criteria, Ad Group Criteria,
 * and Shared Negative Keyword Lists.
 *
 * @returns {Array<Object>} Comprehensive negative keyword catalog
 */
function extractNegativeLists() {
  const negatives = [];

  // Query 9A: Campaign-level negative keywords
  const campNegQuery = `
    SELECT
      campaign.id,
      campaign.name,
      campaign_criterion.criterion_id,
      campaign_criterion.keyword.text,
      campaign_criterion.keyword.match_type,
      campaign_criterion.status
    FROM campaign_criterion
    WHERE campaign_criterion.type = 'KEYWORD'
      AND campaign_criterion.negative = TRUE
      AND campaign.status != 'REMOVED'
  `;

  try {
    const campRows = executeGAQLQuery(campNegQuery);
    for (let i = 0; i < campRows.length; i++) {
      const row = campRows[i];
      negatives.push({
        level: 'CAMPAIGN',
        campaignId: String(getSafeValue(row, 'campaign.id', '')),
        campaignName: String(getSafeValue(row, 'campaign.name', '')),
        adGroupId: '--',
        adGroupName: '--',
        sharedSetId: '--',
        sharedSetName: '--',
        criterionId: String(getSafeValue(row, 'campaign_criterion.criterion_id', '')),
        keywordText: String(getSafeValue(row, 'campaign_criterion.keyword.text', '')),
        matchType: String(getSafeValue(row, 'campaign_criterion.keyword.match_type', '')),
        status: String(getSafeValue(row, 'campaign_criterion.status', 'ENABLED'))
      });
    }
  } catch (e) {
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log(`Notice: campaign negative query error: ${e.message}`);
    }
  }

  // Query 9B: Ad Group-level negative keywords
  const agNegQuery = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status
    FROM ad_group_criterion
    WHERE ad_group_criterion.type = 'KEYWORD'
      AND ad_group_criterion.negative = TRUE
      AND campaign.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
  `;

  try {
    const agRows = executeGAQLQuery(agNegQuery);
    for (let j = 0; j < agRows.length; j++) {
      const row = agRows[j];
      negatives.push({
        level: 'AD_GROUP',
        campaignId: String(getSafeValue(row, 'campaign.id', '')),
        campaignName: String(getSafeValue(row, 'campaign.name', '')),
        adGroupId: String(getSafeValue(row, 'ad_group.id', '')),
        adGroupName: String(getSafeValue(row, 'ad_group.name', '')),
        sharedSetId: '--',
        sharedSetName: '--',
        criterionId: String(getSafeValue(row, 'ad_group_criterion.criterion_id', '')),
        keywordText: String(getSafeValue(row, 'ad_group_criterion.keyword.text', '')),
        matchType: String(getSafeValue(row, 'ad_group_criterion.keyword.match_type', '')),
        status: String(getSafeValue(row, 'ad_group_criterion.status', 'ENABLED'))
      });
    }
  } catch (e) {
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log(`Notice: ad_group negative query error: ${e.message}`);
    }
  }

  // Query 9C: Shared Negative Keyword Lists & Criteria
  const sharedCritQuery = `
    SELECT
      shared_set.id,
      shared_set.name,
      shared_set.type,
      shared_set.member_count,
      shared_criterion.criterion_id,
      shared_criterion.keyword.text,
      shared_criterion.keyword.match_type
    FROM shared_criterion
    WHERE shared_set.type = 'NEGATIVE_KEYWORDS'
  `;

  try {
    const sharedRows = executeGAQLQuery(sharedCritQuery);
    for (let k = 0; k < sharedRows.length; k++) {
      const row = sharedRows[k];
      negatives.push({
        level: 'SHARED_SET',
        campaignId: '--',
        campaignName: '--',
        adGroupId: '--',
        adGroupName: '--',
        sharedSetId: String(getSafeValue(row, 'shared_set.id', '')),
        sharedSetName: String(getSafeValue(row, 'shared_set.name', '')),
        criterionId: String(getSafeValue(row, 'shared_criterion.criterion_id', '')),
        keywordText: String(getSafeValue(row, 'shared_criterion.keyword.text', '')),
        matchType: String(getSafeValue(row, 'shared_criterion.keyword.match_type', '')),
        status: 'ENABLED'
      });
    }
  } catch (e) {
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log(`Notice: shared negative query error: ${e.message}`);
    }
  }

  return negatives;
}

/**
 * F10A: Demographic Segmentation Extractor — Gender View
 *
 * @param {string} dateRange GAQL date range token
 * @returns {Array<Object>} Gender performance records
 */
function extractDemographicsGender(dateRange = 'LAST_30_DAYS') {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.criterion_id,
      ad_group_criterion.gender.type,
      ad_group_criterion.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc
    FROM gender_view
    WHERE campaign.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
      AND segments.date DURING ${dateRange}
    ORDER BY metrics.cost_micros DESC
  `;

  const rows = executeGAQLQuery(query);
  const items = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cost = microsToCurrency(getSafeValue(row, 'metrics.cost_micros', 0));
    const impressions = Number(getSafeValue(row, 'metrics.impressions', 0));
    const clicks = Number(getSafeValue(row, 'metrics.clicks', 0));
    const conversions = Number(Number(getSafeValue(row, 'metrics.conversions', 0)).toFixed(2));
    const convValue = Number(Number(getSafeValue(row, 'metrics.conversions_value', 0)).toFixed(2));
    const ctr = Number(Number(getSafeValue(row, 'metrics.ctr', 0)).toFixed(4));
    const avgCpc = microsToCurrency(getSafeValue(row, 'metrics.average_cpc', 0));
    const cpa = conversions > 0 ? Number((cost / conversions).toFixed(2)) : (cost > 0 ? 'No Conv' : 0.00);

    items.push({
      campaignId: String(getSafeValue(row, 'campaign.id', '')),
      campaignName: String(getSafeValue(row, 'campaign.name', '')),
      adGroupId: String(getSafeValue(row, 'ad_group.id', '')),
      adGroupName: String(getSafeValue(row, 'ad_group.name', '')),
      criterionId: String(getSafeValue(row, 'ad_group_criterion.criterion_id', '')),
      gender: String(getSafeValue(row, 'ad_group_criterion.gender.type', 'UNDETERMINED')),
      status: String(getSafeValue(row, 'ad_group_criterion.status', 'ENABLED')),
      impressions: impressions,
      clicks: clicks,
      cost: cost,
      conversions: conversions,
      conversionsValue: convValue,
      ctr: ctr,
      avgCpc: avgCpc,
      cpa: cpa
    });
  }

  return items;
}

/**
 * F10B: Demographic Segmentation Extractor — Age Range View
 *
 * @param {string} dateRange GAQL date range token
 * @returns {Array<Object>} Age range performance records
 */
function extractDemographicsAge(dateRange = 'LAST_30_DAYS') {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.criterion_id,
      ad_group_criterion.age_range.type,
      ad_group_criterion.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc
    FROM age_range_view
    WHERE campaign.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
      AND segments.date DURING ${dateRange}
    ORDER BY metrics.cost_micros DESC
  `;

  const rows = executeGAQLQuery(query);
  const items = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cost = microsToCurrency(getSafeValue(row, 'metrics.cost_micros', 0));
    const impressions = Number(getSafeValue(row, 'metrics.impressions', 0));
    const clicks = Number(getSafeValue(row, 'metrics.clicks', 0));
    const conversions = Number(Number(getSafeValue(row, 'metrics.conversions', 0)).toFixed(2));
    const convValue = Number(Number(getSafeValue(row, 'metrics.conversions_value', 0)).toFixed(2));
    const ctr = Number(Number(getSafeValue(row, 'metrics.ctr', 0)).toFixed(4));
    const avgCpc = microsToCurrency(getSafeValue(row, 'metrics.average_cpc', 0));
    const cpa = conversions > 0 ? Number((cost / conversions).toFixed(2)) : (cost > 0 ? 'No Conv' : 0.00);

    items.push({
      campaignId: String(getSafeValue(row, 'campaign.id', '')),
      campaignName: String(getSafeValue(row, 'campaign.name', '')),
      adGroupId: String(getSafeValue(row, 'ad_group.id', '')),
      adGroupName: String(getSafeValue(row, 'ad_group.name', '')),
      criterionId: String(getSafeValue(row, 'ad_group_criterion.criterion_id', '')),
      ageRange: String(getSafeValue(row, 'ad_group_criterion.age_range.type', 'UNDETERMINED')),
      status: String(getSafeValue(row, 'ad_group_criterion.status', 'ENABLED')),
      impressions: impressions,
      clicks: clicks,
      cost: cost,
      conversions: conversions,
      conversionsValue: convValue,
      ctr: ctr,
      avgCpc: avgCpc,
      cpa: cpa
    });
  }

  return items;
}

/**
 * F10C: Audience Segments & User Lists Extractor
 *
 * @returns {Array<Object>} User list records
 */
function extractAudiences() {
  const query = `
    SELECT
      user_list.id,
      user_list.name,
      user_list.type,
      user_list.membership_status,
      user_list.size_for_search,
      user_list.size_for_display,
      user_list.eligible_for_search,
      user_list.eligible_for_display
    FROM user_list
    ORDER BY user_list.size_for_search DESC
  `;

  const rows = executeGAQLQuery(query);
  const audiences = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    audiences.push({
      id: String(getSafeValue(row, 'user_list.id', '')),
      name: String(getSafeValue(row, 'user_list.name', '')),
      type: String(getSafeValue(row, 'user_list.type', '')),
      membershipStatus: String(getSafeValue(row, 'user_list.membership_status', '')),
      sizeForSearch: Number(getSafeValue(row, 'user_list.size_for_search', 0)),
      sizeForDisplay: Number(getSafeValue(row, 'user_list.size_for_display', 0)),
      eligibleForSearch: Boolean(getSafeValue(row, 'user_list.eligible_for_search', false)),
      eligibleForDisplay: Boolean(getSafeValue(row, 'user_list.eligible_for_display', false))
    });
  }

  return audiences;
}

/**
 * F11: Ad Schedules & Device Performance Extractor
 * Extracts campaign hourly/daily ad schedules and device adjustments/performance.
 *
 * @param {string} dateRange GAQL date range token
 * @returns {Array<Object>} Schedule and device records
 */
function extractScheduleAndDevice(dateRange = 'LAST_30_DAYS') {
  const records = [];

  // Query 11A: Campaign Ad Schedules
  const scheduleQuery = `
    SELECT
      campaign.id,
      campaign.name,
      campaign_criterion.criterion_id,
      campaign_criterion.status,
      campaign_criterion.ad_schedule.day_of_week,
      campaign_criterion.ad_schedule.start_hour,
      campaign_criterion.ad_schedule.start_minute,
      campaign_criterion.ad_schedule.end_hour,
      campaign_criterion.ad_schedule.end_minute,
      campaign_criterion.bid_modifier
    FROM campaign_criterion
    WHERE campaign_criterion.type = 'AD_SCHEDULE'
      AND campaign.status != 'REMOVED'
  `;

  try {
    const schedRows = executeGAQLQuery(scheduleQuery);
    for (let i = 0; i < schedRows.length; i++) {
      const row = schedRows[i];
      const startH = String(getSafeValue(row, 'campaign_criterion.ad_schedule.start_hour', 0)).padStart(2, '0');
      const startM = String(getSafeValue(row, 'campaign_criterion.ad_schedule.start_minute', 0)).padStart(2, '0');
      const endH = String(getSafeValue(row, 'campaign_criterion.ad_schedule.end_hour', 0)).padStart(2, '0');
      const endM = String(getSafeValue(row, 'campaign_criterion.ad_schedule.end_minute', 0)).padStart(2, '0');

      records.push({
        type: 'AD_SCHEDULE',
        campaignId: String(getSafeValue(row, 'campaign.id', '')),
        campaignName: String(getSafeValue(row, 'campaign.name', '')),
        targetOrSegment: String(getSafeValue(row, 'campaign_criterion.ad_schedule.day_of_week', '')),
        startTime: `${startH}:${startM}`,
        endTime: `${endH}:${endM}`,
        bidModifier: Number(getSafeValue(row, 'campaign_criterion.bid_modifier', 1.0)),
        impressions: '--',
        clicks: '--',
        cost: '--',
        conversions: '--',
        conversionsValue: '--',
        ctr: '--',
        avgCpc: '--'
      });
    }
  } catch (e) {
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log(`Notice: ad_schedule query error: ${e.message}`);
    }
  }

  // Query 11B: Campaign Device Segment Performance
  const deviceQuery = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      segments.device,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE campaign.status != 'REMOVED'
      AND segments.date DURING ${dateRange}
    ORDER BY metrics.cost_micros DESC
  `;

  try {
    const devRows = executeGAQLQuery(deviceQuery);
    for (let j = 0; j < devRows.length; j++) {
      const row = devRows[j];
      const cost = microsToCurrency(getSafeValue(row, 'metrics.cost_micros', 0));
      const impressions = Number(getSafeValue(row, 'metrics.impressions', 0));
      const clicks = Number(getSafeValue(row, 'metrics.clicks', 0));
      const conversions = Number(Number(getSafeValue(row, 'metrics.conversions', 0)).toFixed(2));
      const convValue = Number(Number(getSafeValue(row, 'metrics.conversions_value', 0)).toFixed(2));
      const ctr = Number(Number(getSafeValue(row, 'metrics.ctr', 0)).toFixed(4));
      const avgCpc = microsToCurrency(getSafeValue(row, 'metrics.average_cpc', 0));

      records.push({
        type: 'DEVICE_SEGMENT',
        campaignId: String(getSafeValue(row, 'campaign.id', '')),
        campaignName: String(getSafeValue(row, 'campaign.name', '')),
        targetOrSegment: String(getSafeValue(row, 'segments.device', '')),
        startTime: '--',
        endTime: '--',
        bidModifier: 1.0,
        impressions: impressions,
        clicks: clicks,
        cost: cost,
        conversions: conversions,
        conversionsValue: convValue,
        ctr: ctr,
        avgCpc: avgCpc
      });
    }
  } catch (e) {
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log(`Notice: device performance query error: ${e.message}`);
    }
  }

  return records;
}

/**
 * F12: Account-Level Executive Diagnostic & Health Synthesis
 * Aggregates all extracted topology records into high-level KPIs, channel distribution,
 * and diagnostic alerts.
 *
 * @param {Object} data Map of all extracted data entities
 * @param {Object} config Configuration settings
 * @param {Object} accountMetadata Account name, ID, currency, timezone
 * @returns {Object} Structured summary metrics
 */
function generateSummaryMetrics(data, config, accountMetadata) {
  const campaigns = data.campaigns || [];
  const adGroups = data.adGroups || [];
  const keywords = data.keywords || [];
  const qualityScores = data.qualityScores || [];
  const searchTerms = data.searchTerms || [];
  const ads = data.ads || [];
  const assets = data.assets || [];
  const negatives = data.negatives || [];
  const audiences = data.audiences || [];

  let totalCost = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalConversions = 0;
  let totalConvValue = 0;

  let activeCampaigns = 0;
  let pausedCampaigns = 0;
  const channelBreakdown = {};

  for (let i = 0; i < campaigns.length; i++) {
    const c = campaigns[i];
    totalCost += Number(c.cost) || 0;
    totalImpressions += Number(c.impressions) || 0;
    totalClicks += Number(c.clicks) || 0;
    totalConversions += Number(c.conversions) || 0;
    totalConvValue += Number(c.conversionsValue) || 0;

    if (c.status === 'ENABLED') activeCampaigns++;
    if (c.status === 'PAUSED') pausedCampaigns++;

    const ch = c.channelType || 'OTHER';
    if (!channelBreakdown[ch]) {
      channelBreakdown[ch] = {
        count: 0,
        cost: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        conversionsValue: 0
      };
    }
    channelBreakdown[ch].count++;
    channelBreakdown[ch].cost += Number(c.cost) || 0;
    channelBreakdown[ch].impressions += Number(c.impressions) || 0;
    channelBreakdown[ch].clicks += Number(c.clicks) || 0;
    channelBreakdown[ch].conversions += Number(c.conversions) || 0;
    channelBreakdown[ch].conversionsValue += Number(c.conversionsValue) || 0;
  }

  totalCost = Number(totalCost.toFixed(2));
  totalConversions = Number(totalConversions.toFixed(2));
  totalConvValue = Number(totalConvValue.toFixed(2));

  const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) : 0;
  const overallAvgCpc = totalClicks > 0 ? Number((totalCost / totalClicks).toFixed(2)) : 0.00;
  const overallCpa = totalConversions > 0 ? Number((totalCost / totalConversions).toFixed(2)) : 0.00;
  const overallRoas = totalCost > 0 ? Number((totalConvValue / totalCost).toFixed(2)) : 0.00;

  // Diagnostics
  let lowQsCount = 0;
  for (let k = 0; k < qualityScores.length; k++) {
    const q = qualityScores[k].qualityScore;
    if (typeof q === 'number' && q <= config.THRESHOLDS.LOW_QUALITY_SCORE) {
      lowQsCount++;
    }
  }

  let wasteSearchTermSpend = 0;
  let wasteSearchTermCount = 0;
  for (let s = 0; s < searchTerms.length; s++) {
    const st = searchTerms[s];
    if (st.conversions === 0 && st.cost >= config.THRESHOLDS.HIGH_WASTE_SEARCH_TERM) {
      wasteSearchTermSpend += st.cost;
      wasteSearchTermCount++;
    }
  }
  wasteSearchTermSpend = Number(wasteSearchTermSpend.toFixed(2));

  return {
    accountMetadata,
    totals: {
      cost: totalCost,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: overallCtr,
      avgCpc: overallAvgCpc,
      conversions: totalConversions,
      conversionsValue: totalConvValue,
      cpa: overallCpa,
      roas: overallRoas
    },
    inventoryCounts: {
      totalCampaigns: campaigns.length,
      activeCampaigns: activeCampaigns,
      pausedCampaigns: pausedCampaigns,
      totalAdGroups: adGroups.length,
      totalKeywords: keywords.length,
      totalNegatives: negatives.length,
      totalAds: ads.filter(a => a.recordType === 'AD_OVERVIEW').length,
      totalAssets: assets.length,
      totalAudiences: audiences.length
    },
    channelBreakdown,
    diagnostics: {
      lowQsCount: lowQsCount,
      wasteSearchTermCount: wasteSearchTermCount,
      wasteSearchTermSpend: wasteSearchTermSpend
    }
  };
}

/**
 * High-level orchestration function to fetch all 10 entity categories.
 *
 * @param {Object} config Configuration settings
 * @returns {Object} Extracted data map
 */
function fetchAllAccountInventory(config) {
  const dateRange = config.DATE_RANGE || 'LAST_30_DAYS';

  if (typeof Logger !== 'undefined' && Logger.log) {
    Logger.log(`[GAQL Extraction] Fetching universal account inventory for range: ${dateRange}...`);
  }

  const campaigns = extractCampaigns(dateRange);
  const adGroups = extractAdGroups(dateRange);
  const keywords = extractKeywords(dateRange);
  const qualityScores = extractQualityScore();
  const searchTerms = extractSearchTerms(dateRange);
  const ads = extractAdsAndRSA(dateRange);
  const assets = extractAssetsAndExtensions(dateRange);
  const negatives = extractNegativeLists();
  const demographicsGender = extractDemographicsGender(dateRange);
  const demographicsAge = extractDemographicsAge(dateRange);
  const audiences = extractAudiences();
  const scheduleAndDevice = extractScheduleAndDevice(dateRange);

  return {
    campaigns,
    adGroups,
    keywords,
    qualityScores,
    searchTerms,
    ads,
    assets,
    negatives,
    demographicsGender,
    demographicsAge,
    audiences,
    scheduleAndDevice
  };
}

// ==============================================================================
// 5. GOOGLE SHEETS 13-TAB MATRIX EXPORTER
// ==============================================================================

/**
 * Chunked 2D array exporter writing matrices to Google Sheets via setValues()
 * chunked at 5,000 rows to guarantee completion well within the 30-minute limit.
 * Mandated by Project High-Performance Spreadsheet Exporter contract (F12).
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
    const targetRange = sheet.getRange(startRow + i, startCol, chunk.length, numCols);
    targetRange.setValues(chunk);
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
 * Applies professional Navy header styling, white bold text, and frozen top row.
 *
 * @param {Object} sheet Sheet object
 * @param {number} numCols Column width
 */
function applyHeaderStyle(sheet, numCols) {
  if (!sheet) return;
  try {
    const headerRange = sheet.getRange(1, 1, 1, numCols);
    if (typeof headerRange.setBackground === 'function') {
      headerRange.setBackground(CONFIG.PALETTE.HEADER_BG);
    }
    if (typeof headerRange.setFontColor === 'function') {
      headerRange.setFontColor(CONFIG.PALETTE.HEADER_TEXT);
    }
    if (typeof headerRange.setFontWeight === 'function') {
      headerRange.setFontWeight('bold');
    }
    if (typeof sheet.setFrozenRows === 'function') {
      sheet.setFrozenRows(1);
    }
  } catch (e) {
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log(`Warning: Failed to apply header styling: ${e.message}`);
    }
  }
}

/**
 * Tab 1: SUMMARY — Renders executive overview, KPI cards, and diagnostics.
 */
function renderSummaryTab(sheet, summary, config, timestamp) {
  sheet.clear();
  const sym = config.CURRENCY_SYMBOL || '₺';
  const meta = summary.accountMetadata || {};
  const tot = summary.totals || {};
  const inv = summary.inventoryCounts || {};
  const diag = summary.diagnostics || {};

  const matrix = [];
  const numCols = 8;
  const blankRow = new Array(numCols).fill('');

  // Title Card
  matrix.push([`ATLI MEDIKAL — COMPREHENSIVE ACCOUNT INVENTORY & DIAGNOSTICS SUITE`, ...new Array(numCols - 1).fill('')]);
  matrix.push([`Account: ${meta.name} (${meta.id}) | Currency: ${meta.currency} | Timezone: ${meta.timezone} | Evaluation Window: ${config.DATE_RANGE} | Generated: ${timestamp}`, ...new Array(numCols - 1).fill('')]);
  matrix.push(blankRow);

  // Executive High-Level KPIs
  matrix.push(['EXECUTIVE PERFORMANCE METRICS (30-DAY WINDOW)', ...new Array(numCols - 1).fill('')]);
  matrix.push(['Total Cost', 'Total Impressions', 'Total Clicks', 'Avg CTR', 'Avg CPC', 'Conversions', 'Cost / Conv (CPA)', 'ROAS']);
  matrix.push([
    `${tot.cost.toFixed(2)} ${sym}`,
    tot.impressions.toLocaleString('en-US'),
    tot.clicks.toLocaleString('en-US'),
    `${(tot.ctr * 100).toFixed(2)}%`,
    `${tot.avgCpc.toFixed(2)} ${sym}`,
    tot.conversions.toFixed(2),
    `${tot.cpa.toFixed(2)} ${sym}`,
    `${tot.roas.toFixed(2)}x`
  ]);
  matrix.push(blankRow);

  // Inventory Topology Breakdown
  matrix.push(['ACCOUNT INVENTORY TOPOLOGY & ASSET BREAKDOWN', ...new Array(numCols - 1).fill('')]);
  matrix.push(['Active Campaigns', 'Paused Campaigns', 'Total Ad Groups', 'Total Keywords', 'Negative Keywords', 'Active RSA Ads', 'Extensions / Assets', 'Audience Lists']);
  matrix.push([
    inv.activeCampaigns,
    inv.pausedCampaigns,
    inv.totalAdGroups,
    inv.totalKeywords,
    inv.totalNegatives,
    inv.totalAds,
    inv.totalAssets,
    inv.totalAudiences
  ]);
  matrix.push(blankRow);

  // Diagnostics & Risk Flags
  matrix.push(['DIAGNOSTICS & EFFICIENCY HEALTH FLAGS', ...new Array(numCols - 1).fill('')]);
  matrix.push(['Diagnostic Area', 'Observed Value', 'Benchmark / Target', 'Severity Status', 'Action Directive', '', '', '']);
  matrix.push([
    'Low Quality Score Keywords (QS <= 4)',
    `${diag.lowQsCount} Keywords`,
    '0 Keywords',
    diag.lowQsCount > 0 ? 'CRITICAL DEFICIT' : 'OPTIMAL',
    diag.lowQsCount > 0 ? 'Audit Landing Page Exp & Expected CTR in QUALITY_SCORE tab' : 'No low QS keywords detected',
    '', '', ''
  ]);
  matrix.push([
    'High-Spend Zero-Conv Search Terms',
    `${diag.wasteSearchTermCount} Queries (${diag.wasteSearchTermSpend.toFixed(2)} ${sym})`,
    '0 Spend Waste',
    diag.wasteSearchTermCount > 0 ? 'ACTIVE BLEED' : 'CLEAN',
    diag.wasteSearchTermCount > 0 ? 'Review SEARCH_TERMS tab and inject exact negatives' : 'No wasteful queries detected',
    '', '', ''
  ]);
  matrix.push(blankRow);

  // Channel Distribution Table
  matrix.push(['PERFORMANCE BY ADVERTISING CHANNEL TYPE', ...new Array(numCols - 1).fill('')]);
  matrix.push(['Channel Type', 'Campaign Count', 'Impressions', 'Clicks', `Spend (${sym})`, 'Conversions', 'CPA', 'ROAS']);

  const channels = Object.keys(summary.channelBreakdown || {});
  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    const data = summary.channelBreakdown[ch];
    const chCpa = data.conversions > 0 ? (data.cost / data.conversions).toFixed(2) : '--';
    const chRoas = data.cost > 0 ? (data.conversionsValue / data.cost).toFixed(2) : '0.00';

    matrix.push([
      ch,
      data.count,
      data.impressions.toLocaleString('en-US'),
      data.clicks.toLocaleString('en-US'),
      data.cost.toFixed(2),
      data.conversions.toFixed(2),
      chCpa !== '--' ? `${chCpa} ${sym}` : '--',
      `${chRoas}x`
    ]);
  }

  writeMatrixToSheet(sheet, 1, 1, matrix, config.CHUNK_SIZE);

  // Apply Styling
  try {
    const titleRange = sheet.getRange(1, 1, 1, numCols);
    if (typeof titleRange.setBackground === 'function') {
      titleRange.setBackground(CONFIG.PALETTE.HEADER_BG);
      titleRange.setFontColor(CONFIG.PALETTE.HEADER_TEXT);
      titleRange.setFontWeight('bold');
    }
    if (typeof sheet.setFrozenRows === 'function') {
      sheet.setFrozenRows(2);
    }
  } catch (e) {}
}

/**
 * Tab 2: CAMPAIGNS — Exports all campaign details.
 */
function renderCampaignsTab(sheet, campaigns, config) {
  sheet.clear();
  const headers = [
    'Campaign ID', 'Campaign Name', 'Status', 'Channel Type', 'Sub Type',
    'Bidding Strategy', 'Budget ID', 'Budget Name', 'Daily Budget', 'Shared Budget?',
    'Target CPA', 'Target ROAS', 'Start Date', 'End Date',
    'Impressions', 'Clicks', 'Cost', 'Conversions', 'Conv Value', 'CTR', 'Avg CPC', 'CPA', 'ROAS'
  ];

  const matrix = [headers];
  for (let i = 0; i < campaigns.length; i++) {
    const c = campaigns[i];
    matrix.push([
      c.id, c.name, c.status, c.channelType, c.subType,
      c.biddingStrategy, c.budgetId, c.budgetName, c.dailyBudget, c.isSharedBudget ? 'YES' : 'NO',
      c.targetCpa, c.targetRoas, c.startDate, c.endDate,
      c.impressions, c.clicks, c.cost, c.conversions, c.conversionsValue, c.ctr, c.avgCpc, c.cpa, c.roas
    ]);
  }

  writeMatrixToSheet(sheet, 1, 1, matrix, config.CHUNK_SIZE);
  applyHeaderStyle(sheet, headers.length);
}

/**
 * Tab 3: AD_GROUPS — Exports ad group topology and bids.
 */
function renderAdGroupsTab(sheet, adGroups, config) {
  sheet.clear();
  const headers = [
    'Campaign ID', 'Campaign Name', 'Campaign Status',
    'Ad Group ID', 'Ad Group Name', 'Status', 'Type',
    'Default CPC Bid', 'CPM Bid', 'Target CPA', 'Target ROAS',
    'Impressions', 'Clicks', 'Cost', 'Conversions', 'Conv Value', 'CTR', 'Avg CPC', 'CPA'
  ];

  const matrix = [headers];
  for (let i = 0; i < adGroups.length; i++) {
    const ag = adGroups[i];
    matrix.push([
      ag.campaignId, ag.campaignName, ag.campaignStatus,
      ag.adGroupId, ag.adGroupName, ag.status, ag.type,
      ag.defaultCpcBid, ag.cpmBid, ag.targetCpa, ag.targetRoas,
      ag.impressions, ag.clicks, ag.cost, ag.conversions, ag.conversionsValue, ag.ctr, ag.avgCpc, ag.cpa
    ]);
  }

  writeMatrixToSheet(sheet, 1, 1, matrix, config.CHUNK_SIZE);
  applyHeaderStyle(sheet, headers.length);
}

/**
 * Tab 4: KEYWORDS — Exports keywords, bids, status, and performance.
 */
function renderKeywordsTab(sheet, keywords, config) {
  sheet.clear();
  const headers = [
    'Campaign ID', 'Campaign Name', 'Ad Group ID', 'Ad Group Name',
    'Criterion ID', 'Keyword Text', 'Match Type', 'Status',
    'CPC Bid', 'Effective CPC Bid', 'Serving Status', 'Approval Status',
    'Impressions', 'Clicks', 'Cost', 'Conversions', 'Conv Value', 'CTR', 'Avg CPC', 'CPA'
  ];

  const matrix = [headers];
  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i];
    matrix.push([
      kw.campaignId, kw.campaignName, kw.adGroupId, kw.adGroupName,
      kw.criterionId, kw.keywordText, kw.matchType, kw.status,
      kw.cpcBid, kw.effectiveCpcBid, kw.servingStatus, kw.approvalStatus,
      kw.impressions, kw.clicks, kw.cost, kw.conversions, kw.conversionsValue, kw.ctr, kw.avgCpc, kw.cpa
    ]);
  }

  writeMatrixToSheet(sheet, 1, 1, matrix, config.CHUNK_SIZE);
  applyHeaderStyle(sheet, headers.length);
}

/**
 * Tab 5: QUALITY_SCORE — Exports 4-way Quality Score breakdown.
 */
function renderQualityScoreTab(sheet, qualityScores, config) {
  sheet.clear();
  const headers = [
    'Campaign ID', 'Campaign Name', 'Ad Group ID', 'Ad Group Name',
    'Criterion ID', 'Keyword Text', 'Match Type', 'Status',
    'Quality Score', 'Expected CTR', 'Ad Relevance', 'Landing Page Experience', 'Health Diagnostic'
  ];

  const matrix = [headers];
  for (let i = 0; i < qualityScores.length; i++) {
    const qs = qualityScores[i];
    matrix.push([
      qs.campaignId, qs.campaignName, qs.adGroupId, qs.adGroupName,
      qs.criterionId, qs.keywordText, qs.matchType, qs.status,
      qs.qualityScore, qs.expectedCtr, qs.adRelevance, qs.landingPageExp, qs.health
    ]);
  }

  writeMatrixToSheet(sheet, 1, 1, matrix, config.CHUNK_SIZE);
  applyHeaderStyle(sheet, headers.length);
}

/**
 * Tab 6: SEARCH_TERMS — Exports user queries and negative/expansion tags.
 */
function renderSearchTermsTab(sheet, searchTerms, config) {
  sheet.clear();
  const headers = [
    'Campaign ID', 'Campaign Name', 'Ad Group ID', 'Ad Group Name',
    'Search Term', 'Match Status', 'Impressions', 'Clicks', 'Cost',
    'Conversions', 'Conv Value', 'CTR', 'Avg CPC', 'CPA', 'Action Recommendation'
  ];

  const matrix = [headers];
  for (let i = 0; i < searchTerms.length; i++) {
    const st = searchTerms[i];
    matrix.push([
      st.campaignId, st.campaignName, st.adGroupId, st.adGroupName,
      st.searchTerm, st.status, st.impressions, st.clicks, st.cost,
      st.conversions, st.conversionsValue, st.ctr, st.avgCpc, st.cpa, st.recommendation
    ]);
  }

  writeMatrixToSheet(sheet, 1, 1, matrix, config.CHUNK_SIZE);
  applyHeaderStyle(sheet, headers.length);
}

/**
 * Tab 7: ADS_RSA — Exports Responsive Search Ads and Asset Performance Labels.
 */
function renderAdsRSATab(sheet, ads, config) {
  sheet.clear();
  const headers = [
    'Record Type', 'Campaign ID', 'Campaign Name', 'Ad Group ID', 'Ad Group Name',
    'Ad ID', 'Ad Type / Field Type', 'Status / Label', 'Ad Strength',
    'Headlines Count', 'Headlines (Formatted)', 'Descriptions Count', 'Descriptions (Formatted)',
    'Path 1', 'Path 2', 'Final URLs / Asset ID',
    'Impressions', 'Clicks', 'Cost', 'Conversions', 'Conv Value'
  ];

  const matrix = [headers];
  for (let i = 0; i < ads.length; i++) {
    const a = ads[i];
    matrix.push([
      a.recordType, a.campaignId, a.campaignName, a.adGroupId, a.adGroupName,
      a.adId, a.adTypeOrField, a.statusOrLabel, a.adStrength,
      a.headlineCount, a.headlinesText, a.descCount, a.descriptionsText,
      a.path1, a.path2, a.finalUrls,
      a.impressions, a.clicks, a.cost, a.conversions, a.conversionsValue
    ]);
  }

  writeMatrixToSheet(sheet, 1, 1, matrix, config.CHUNK_SIZE);
  applyHeaderStyle(sheet, headers.length);
}

/**
 * Tab 8: ASSETS_EXTENSIONS — Exports Sitelinks, Callouts, Calls, and Snippets.
 */
function renderAssetsExtensionsTab(sheet, assets, config) {
  sheet.clear();
  const headers = [
    'Scope', 'Campaign ID', 'Campaign Name', 'Asset ID', 'Asset Name',
    'Asset Type', 'Field Type', 'Status',
    'Primary Text / Sitelink', 'Detail Text / Description 1 / Header',
    'Sub-Detail / Description 2 / Snippet Values', 'Destination / Phone',
    'Impressions', 'Clicks', 'Cost'
  ];

  const matrix = [headers];
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    matrix.push([
      a.scope, a.campaignId, a.campaignName, a.assetId, a.assetName,
      a.assetType, a.fieldType, a.status,
      a.primaryText, a.detailText, a.subDetailText, a.destination,
      a.impressions, a.clicks, a.cost
    ]);
  }

  writeMatrixToSheet(sheet, 1, 1, matrix, config.CHUNK_SIZE);
  applyHeaderStyle(sheet, headers.length);
}

/**
 * Tab 9: NEGATIVE_LISTS — Exports campaign, ad group, and shared negative keywords.
 */
function renderNegativeListsTab(sheet, negatives, config) {
  sheet.clear();
  const headers = [
    'Negative Level', 'Campaign ID', 'Campaign Name', 'Ad Group ID', 'Ad Group Name',
    'Shared Set ID', 'Shared Set Name', 'Criterion ID', 'Negative Keyword Text', 'Match Type', 'Status'
  ];

  const matrix = [headers];
  for (let i = 0; i < negatives.length; i++) {
    const neg = negatives[i];
    matrix.push([
      neg.level, neg.campaignId, neg.campaignName, neg.adGroupId, neg.adGroupName,
      neg.sharedSetId, neg.sharedSetName, neg.criterionId, neg.keywordText, neg.matchType, neg.status
    ]);
  }

  writeMatrixToSheet(sheet, 1, 1, matrix, config.CHUNK_SIZE);
  applyHeaderStyle(sheet, headers.length);
}

/**
 * Tab 10: DEMOGRAPHICS_GENDER — Exports Gender performance breakdown.
 */
function renderDemographicsGenderTab(sheet, items, config) {
  sheet.clear();
  const headers = [
    'Campaign ID', 'Campaign Name', 'Ad Group ID', 'Ad Group Name',
    'Criterion ID', 'Gender', 'Status',
    'Impressions', 'Clicks', 'Cost', 'Conversions', 'Conv Value', 'CTR', 'Avg CPC', 'CPA'
  ];

  const matrix = [headers];
  for (let i = 0; i < items.length; i++) {
    const g = items[i];
    matrix.push([
      g.campaignId, g.campaignName, g.adGroupId, g.adGroupName,
      g.criterionId, g.gender, g.status,
      g.impressions, g.clicks, g.cost, g.conversions, g.conversionsValue, g.ctr, g.avgCpc, g.cpa
    ]);
  }

  writeMatrixToSheet(sheet, 1, 1, matrix, config.CHUNK_SIZE);
  applyHeaderStyle(sheet, headers.length);
}

/**
 * Tab 11: DEMOGRAPHICS_AGE — Exports Age Range performance breakdown.
 */
function renderDemographicsAgeTab(sheet, items, config) {
  sheet.clear();
  const headers = [
    'Campaign ID', 'Campaign Name', 'Ad Group ID', 'Ad Group Name',
    'Criterion ID', 'Age Range', 'Status',
    'Impressions', 'Clicks', 'Cost', 'Conversions', 'Conv Value', 'CTR', 'Avg CPC', 'CPA'
  ];

  const matrix = [headers];
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    matrix.push([
      a.campaignId, a.campaignName, a.adGroupId, a.adGroupName,
      a.criterionId, a.ageRange, a.status,
      a.impressions, a.clicks, a.cost, a.conversions, a.conversionsValue, a.ctr, a.avgCpc, a.cpa
    ]);
  }

  writeMatrixToSheet(sheet, 1, 1, matrix, config.CHUNK_SIZE);
  applyHeaderStyle(sheet, headers.length);
}

/**
 * Tab 12: AUDIENCES — Exports user lists and targeting segments.
 */
function renderAudiencesTab(sheet, audiences, config) {
  sheet.clear();
  const headers = [
    'User List ID', 'User List Name', 'Type', 'Membership Status',
    'Size for Search', 'Size for Display', 'Eligible for Search?', 'Eligible for Display?'
  ];

  const matrix = [headers];
  for (let i = 0; i < audiences.length; i++) {
    const aud = audiences[i];
    matrix.push([
      aud.id, aud.name, aud.type, aud.membershipStatus,
      aud.sizeForSearch, aud.sizeForDisplay,
      aud.eligibleForSearch ? 'YES' : 'NO',
      aud.eligibleForDisplay ? 'YES' : 'NO'
    ]);
  }

  writeMatrixToSheet(sheet, 1, 1, matrix, config.CHUNK_SIZE);
  applyHeaderStyle(sheet, headers.length);
}

/**
 * Tab 13: SCHEDULE_DEVICE — Exports ad schedules and device segments.
 */
function renderScheduleDeviceTab(sheet, records, config) {
  sheet.clear();
  const headers = [
    'Record Type', 'Campaign ID', 'Campaign Name', 'Target / Segment',
    'Start Time', 'End Time', 'Bid Modifier',
    'Impressions', 'Clicks', 'Cost', 'Conversions', 'Conv Value', 'CTR', 'Avg CPC'
  ];

  const matrix = [headers];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    matrix.push([
      r.type, r.campaignId, r.campaignName, r.targetOrSegment,
      r.startTime, r.endTime, r.bidModifier,
      r.impressions, r.clicks, r.cost, r.conversions, r.conversionsValue, r.ctr, r.avgCpc
    ]);
  }

  writeMatrixToSheet(sheet, 1, 1, matrix, config.CHUNK_SIZE);
  applyHeaderStyle(sheet, headers.length);
}

/**
 * Master exporter coordinating writing across all 13 sheet tabs.
 *
 * @param {Object} spreadsheet Google Spreadsheet instance
 * @param {Object} inventoryData Map of all extracted data entities
 * @param {Object} config Configuration settings
 * @param {Object} accountMetadata Account metadata
 */
function exportAllTabsToSpreadsheet(spreadsheet, inventoryData, config, accountMetadata) {
  const tabs = config.TABS;
  const timestamp = formatDateIso(new Date(), config.TIMEZONE) + ' ' +
    new Date().toTimeString().split(' ')[0];

  const summary = generateSummaryMetrics(inventoryData, config, accountMetadata);

  // Tab 1: SUMMARY
  const summarySheet = getOrCreateSheet(spreadsheet, tabs.SUMMARY);
  renderSummaryTab(summarySheet, summary, config, timestamp);

  // Tab 2: CAMPAIGNS
  const campSheet = getOrCreateSheet(spreadsheet, tabs.CAMPAIGN_PERFORMANCE || tabs.CAMPAIGNS);
  renderCampaignsTab(campSheet, inventoryData.campaigns, config);

  // Tab 3: AD_GROUPS
  const agSheet = getOrCreateSheet(spreadsheet, tabs.AD_GROUPS);
  renderAdGroupsTab(agSheet, inventoryData.adGroups, config);

  // Tab 4: KEYWORDS
  const kwSheet = getOrCreateSheet(spreadsheet, tabs.KEYWORDS);
  renderKeywordsTab(kwSheet, inventoryData.keywords, config);

  // Tab 5: QUALITY_SCORE
  const qsSheet = getOrCreateSheet(spreadsheet, tabs.QUALITY_SCORE);
  renderQualityScoreTab(qsSheet, inventoryData.qualityScores, config);

  // Tab 6: SEARCH_TERMS
  const stSheet = getOrCreateSheet(spreadsheet, tabs.SEARCH_TERMS);
  renderSearchTermsTab(stSheet, inventoryData.searchTerms, config);

  // Tab 7: ADS_RSA
  const rsaSheet = getOrCreateSheet(spreadsheet, tabs.ADS_RSA);
  renderAdsRSATab(rsaSheet, inventoryData.ads, config);

  // Tab 8: ASSETS_EXTENSIONS
  const assetSheet = getOrCreateSheet(spreadsheet, tabs.ASSETS_EXTENSIONS);
  renderAssetsExtensionsTab(assetSheet, inventoryData.assets, config);

  // Tab 9: NEGATIVE_LISTS
  const negSheet = getOrCreateSheet(spreadsheet, tabs.NEGATIVE_LISTS);
  renderNegativeListsTab(negSheet, inventoryData.negatives, config);

  // Tab 10: DEMOGRAPHICS_GENDER
  const genderSheet = getOrCreateSheet(spreadsheet, tabs.DEMOGRAPHICS_GENDER);
  renderDemographicsGenderTab(genderSheet, inventoryData.demographicsGender, config);

  // Tab 11: DEMOGRAPHICS_AGE
  const ageSheet = getOrCreateSheet(spreadsheet, tabs.DEMOGRAPHICS_AGE);
  renderDemographicsAgeTab(ageSheet, inventoryData.demographicsAge, config);

  // Tab 12: AUDIENCES
  const audSheet = getOrCreateSheet(spreadsheet, tabs.AUDIENCES);
  renderAudiencesTab(audSheet, inventoryData.audiences, config);

  // Tab 13: SCHEDULE_DEVICE
  const schedSheet = getOrCreateSheet(spreadsheet, tabs.SCHEDULE_DEVICE);
  renderScheduleDeviceTab(schedSheet, inventoryData.scheduleAndDevice, config);
}

// ==============================================================================
// 6. MAIN EXECUTION ENTRYPOINT
// ==============================================================================

/**
 * Main execution function called by Google Ads Scripts scheduler.
 */
function main() {
  const executionStartTime = new Date();
  const timestamp = formatDateIso(executionStartTime, CONFIG.TIMEZONE) + ' ' +
    executionStartTime.toTimeString().split(' ')[0];

  if (typeof Logger !== 'undefined' && Logger.log) {
    Logger.log(`==============================================================================`);
    Logger.log(`[START] ATLI MEDIKAL — R1 COMPREHENSIVE ACCOUNT INVENTORY & DIAGNOSTICS`);
    Logger.log(`Execution Timestamp: ${timestamp} (Timezone: ${CONFIG.TIMEZONE})`);
    Logger.log(`Evaluation Window: ${CONFIG.DATE_RANGE}`);
    Logger.log(`==============================================================================`);
  }

  // Account Identification & Localisation
  let accountName = CONFIG.ACCOUNT_NAME;
  let customerId = CONFIG.CUSTOMER_ID;
  let currencyCode = 'TRY';
  let timezone = CONFIG.TIMEZONE;

  if (typeof AdsApp !== 'undefined' && AdsApp.currentAccount) {
    try {
      const acc = AdsApp.currentAccount();
      if (acc.getName && acc.getName()) accountName = acc.getName();
      if (acc.getCustomerId && acc.getCustomerId()) customerId = acc.getCustomerId();
      if (acc.getCurrencyCode && acc.getCurrencyCode()) currencyCode = acc.getCurrencyCode();
      if (acc.getTimeZone && acc.getTimeZone()) timezone = acc.getTimeZone();
    } catch (e) {
      if (typeof Logger !== 'undefined' && Logger.log) {
        Logger.log(`Notice: Could not read currentAccount properties: ${e.message}`);
      }
    }
  }

  const accountMetadata = {
    name: accountName,
    id: customerId,
    currency: currencyCode,
    timezone: timezone
  };

  // Step 1: Ingest universal account inventory across all 10 entity categories
  if (typeof Logger !== 'undefined' && Logger.log) {
    Logger.log(`[Step 1/3] Extracting complete account inventory via GAQL...`);
  }
  const inventoryData = fetchAllAccountInventory(CONFIG);

  if (typeof Logger !== 'undefined' && Logger.log) {
    Logger.log(`-> Campaigns extracted: ${inventoryData.campaigns.length}`);
    Logger.log(`-> Ad Groups extracted: ${inventoryData.adGroups.length}`);
    Logger.log(`-> Keywords extracted: ${inventoryData.keywords.length}`);
    Logger.log(`-> Quality Score records extracted: ${inventoryData.qualityScores.length}`);
    Logger.log(`-> Search Terms extracted: ${inventoryData.searchTerms.length}`);
    Logger.log(`-> Ads & RSA records extracted: ${inventoryData.ads.length}`);
    Logger.log(`-> Assets & Extensions extracted: ${inventoryData.assets.length}`);
    Logger.log(`-> Negative Keywords extracted: ${inventoryData.negatives.length}`);
    Logger.log(`-> Demographics (Gender): ${inventoryData.demographicsGender.length}`);
    Logger.log(`-> Demographics (Age): ${inventoryData.demographicsAge.length}`);
    Logger.log(`-> Audiences extracted: ${inventoryData.audiences.length}`);
    Logger.log(`-> Schedules & Devices extracted: ${inventoryData.scheduleAndDevice.length}`);
  }

  // Step 2: Synthesize Account Diagnostic Overview
  if (typeof Logger !== 'undefined' && Logger.log) {
    Logger.log(`[Step 2/3] Synthesizing diagnostic summary metrics...`);
  }
  const summary = generateSummaryMetrics(inventoryData, CONFIG, accountMetadata);

  if (typeof Logger !== 'undefined' && Logger.log) {
    Logger.log(`-> Total Cost: ${summary.totals.cost} ${currencyCode}`);
    Logger.log(`-> Total Conversions: ${summary.totals.conversions} (CPA: ${summary.totals.cpa} ${currencyCode})`);
    Logger.log(`-> Low Quality Score Keywords: ${summary.diagnostics.lowQsCount}`);
    Logger.log(`-> High-Spend Zero-Conv Search Terms: ${summary.diagnostics.wasteSearchTermCount} (${summary.diagnostics.wasteSearchTermSpend} ${currencyCode})`);
  }

  // Step 3: Google Sheets Multi-Tab Matrix Export
  if (typeof Logger !== 'undefined' && Logger.log) {
    Logger.log(`[Step 3/3] Exporting 13 tabs to Google Sheets via matrix setValues()...`);
  }

  if (typeof SpreadsheetApp !== 'undefined') {
    let spreadsheet = null;
    if (CONFIG.SPREADSHEET_URL && CONFIG.SPREADSHEET_URL.trim() !== '') {
      if (typeof SpreadsheetApp.openByUrl === 'function' && CONFIG.SPREADSHEET_URL.startsWith('https://')) {
        spreadsheet = SpreadsheetApp.openByUrl(CONFIG.SPREADSHEET_URL);
      } else if (typeof SpreadsheetApp.openById === 'function') {
        spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_URL);
      }
    } else if (typeof SpreadsheetApp.create === 'function') {
      const sheetTitle = `Atli Medikal — Account Inventory & Diagnostics (${timestamp.split(' ')[0]})`;
      spreadsheet = SpreadsheetApp.create(sheetTitle);
      if (typeof Logger !== 'undefined' && Logger.log) {
        const url = (spreadsheet && typeof spreadsheet.getUrl === 'function') ? spreadsheet.getUrl() : '';
        if (url) Logger.log(`-> Created new Google Spreadsheet: ${url}`);
      }
    } else if (typeof SpreadsheetApp.getActiveSpreadsheet === 'function') {
      spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    }

    if (spreadsheet) {
      exportAllTabsToSpreadsheet(spreadsheet, inventoryData, CONFIG, accountMetadata);

      if (typeof Logger !== 'undefined' && Logger.log) {
        const url = (typeof spreadsheet.getUrl === 'function') ? spreadsheet.getUrl() : '';
        Logger.log(`-> All 13 tabs successfully exported to Google Sheets:`);
        Logger.log(`   1. SUMMARY, 2. CAMPAIGNS, 3. AD_GROUPS, 4. KEYWORDS, 5. QUALITY_SCORE,`);
        Logger.log(`   6. SEARCH_TERMS, 7. ADS_RSA, 8. ASSETS_EXTENSIONS, 9. NEGATIVE_LISTS,`);
        Logger.log(`   10. DEMOGRAPHICS_GENDER, 11. DEMOGRAPHICS_AGE, 12. AUDIENCES, 13. SCHEDULE_DEVICE`);
        if (url) Logger.log(`-> Spreadsheet URL: ${url}`);
      }
    } else {
      if (typeof Logger !== 'undefined' && Logger.log) {
        Logger.log(`[Notice] No active spreadsheet handle could be created or opened. Skipping sheet write.`);
      }
    }
  } else {
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log(`[Notice] SpreadsheetApp runtime not detected (Node.js/CLI environment). Skipping spreadsheet write.`);
    }
  }

  const durationSec = ((new Date().getTime() - executionStartTime.getTime()) / 1000).toFixed(1);
  if (typeof Logger !== 'undefined' && Logger.log) {
    Logger.log(`==============================================================================`);
    Logger.log(`[COMPLETE] Account Inventory & Diagnostics completed in ${durationSec}s.`);
    Logger.log(`==============================================================================`);
  }
}

// ==============================================================================
// 7. MODULE EXPORTS (FOR UNIT TESTING, NODE HARNESS & TEST RUNNER)
// ==============================================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONFIG,
    main,
    validateGAQLSafety,
    microsToCurrency,
    getSafeValue,
    formatDateIso,
    executeGAQLQuery,
    extractCampaigns,
    extractAdGroups,
    extractKeywords,
    extractQualityScore,
    extractSearchTerms,
    extractAdsAndRSA,
    extractAssetsAndExtensions,
    extractNegativeLists,
    extractDemographicsGender,
    extractDemographicsAge,
    extractAudiences,
    extractScheduleAndDevice,
    generateSummaryMetrics,
    fetchAllAccountInventory,
    writeMatrixToSheet,
    getOrCreateSheet,
    applyHeaderStyle,
    renderSummaryTab,
    renderCampaignsTab,
    renderAdGroupsTab,
    renderKeywordsTab,
    renderQualityScoreTab,
    renderSearchTermsTab,
    renderAdsRSATab,
    renderAssetsExtensionsTab,
    renderNegativeListsTab,
    renderDemographicsGenderTab,
    renderDemographicsAgeTab,
    renderAudiencesTab,
    renderScheduleDeviceTab,
    exportAllTabsToSpreadsheet
  };
}
