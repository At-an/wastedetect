/**
 * Safely converts a raw backend UTC timestamp string into a localized, 
 * human-readable format matching the active device operating system locale.
 */
export const formatToLocalTime = (utcString) => {
  if (!utcString) return "";

  // 1. If backend forgot a 'Z' or offset token, explicitly declare it as UTC 
  // to avoid the browser parsing it relative to local time prematurely.
  const standardizedStr = utcString.endsWith('Z') || utcString.includes('+')
    ? utcString
    : `${utcString}Z`;

  const dateObj = new Date(standardizedStr);

  // 2. Fallback check for parsing corrupt or missing strings safely
  if (isNaN(dateObj.getTime())) return utcString;

  // 3. Format beautifully using the current client browser preferences
  return dateObj.toLocaleString(navigator.language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true // Formats as 05:01 PM instead of 17:01
  });
};