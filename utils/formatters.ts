/**
 * Shared date and string formatting utilities.
 * Use these instead of defining formatting functions in individual components.
 */

/**
 * Format a date for display in event cards (e.g., "Dec 5, 10:30 AM")
 */
export const formatDateTime = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
};

/**
 * Format a full date for event details (e.g., "Thursday, December 5, 2025, 10:30 AM")
 */
export const formatFullDate = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
};

/**
 * Get date parts for calendar-style display
 */
export const getDateParts = (isoDate: string): { month: string; day: number; year: number } => {
  const d = new Date(isoDate);
  return {
    month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    day: d.getDate(),
    year: d.getFullYear(),
  };
};

/**
 * Normalize a string for comparison (lowercase, remove punctuation)
 */
export const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};
