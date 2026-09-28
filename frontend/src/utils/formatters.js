/**
 * Standardized Formatting Utilities for digiQA
 * Ensures 2 decimal places precision across percentages and metric scores.
 */

/**
 * Formats a value as a standardized percentage string with 2 decimal places.
 * Example: 99.6 -> "99.60%", 100 -> "100.00%", 0 -> "0.00%"
 *
 * @param {number|string|null|undefined} val
 * @param {number} decimals
 * @returns {string}
 */
export const formatPct = (val, decimals = 2) => {
  if (val === null || val === undefined || val === '') return (0).toFixed(decimals) + '%';
  const num = Number(val);
  if (isNaN(num)) return (0).toFixed(decimals) + '%';
  return num.toFixed(decimals) + '%';
};

/**
 * Formats a metric variance difference against target.
 * Example: 14.6 -> "+14.60% vs Target", -3.25 -> "-3.25% vs Target", 0 -> "+0.00% vs Target"
 *
 * @param {number|string|null|undefined} diff
 * @param {number} decimals
 * @returns {string}
 */
export const formatDiffPct = (diff, decimals = 2) => {
  if (diff === null || diff === undefined || diff === '') return '+0.00% vs Target';
  const num = Number(diff);
  if (isNaN(num)) return '+0.00% vs Target';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}% vs Target`;
};

/**
 * Formats a number with standard 2 decimal places.
 * Example: 85 -> "85.00", 99.6 -> "99.60"
 *
 * @param {number|string|null|undefined} val
 * @param {number} decimals
 * @returns {string}
 */
export const formatNum = (val, decimals = 2) => {
  if (val === null || val === undefined || val === '') return (0).toFixed(decimals);
  const num = Number(val);
  if (isNaN(num)) return (0).toFixed(decimals);
  return num.toFixed(decimals);
};
