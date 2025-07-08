/**
 * Safe date parsing utilities for handling PostgreSQL TIMESTAMPTZ and other date formats
 * Prevents "Invalid time value" errors when calling Date methods like toISOString()
 */

/**
 * Safely parses a date value into a valid Date object
 * Handles edge cases where Date constructor succeeds but creates invalid Date objects
 * 
 * @param dateValue - The date value to parse (Date, string, number, null, undefined)
 * @param fallbackDate - Fallback date to use if parsing fails
 * @returns Valid Date object that supports all Date methods
 */
export function safeParseDate(dateValue: unknown, fallbackDate: Date): Date {
  try {
    // Handle null/undefined
    if (dateValue == null) {
      return fallbackDate
    }

    // If already a Date object, validate it
    if (dateValue instanceof Date) {
      if (isNaN(dateValue.getTime())) {
        return fallbackDate
      }
      // Test if toISOString() works (critical test for our use case)
      try {
        dateValue.toISOString()
        return dateValue
      } catch {
        return fallbackDate
      }
    }

    // Handle string dates
    if (typeof dateValue === 'string') {
      // Fix common PostgreSQL TIMESTAMPTZ format issues
      // Convert "+00" timezone to "Z" which JavaScript handles better
      let fixedDateString = dateValue.trim()
      if (fixedDateString.endsWith('+00')) {
        fixedDateString = fixedDateString.slice(0, -3) + 'Z'
      }
      
      const parsedDate = new Date(fixedDateString)
      
      // Validate the parsed date
      if (isNaN(parsedDate.getTime())) {
        return fallbackDate
      }
      
      // Critical test: ensure toISOString() works
      try {
        parsedDate.toISOString()
        return parsedDate
      } catch {
        return fallbackDate
      }
    }

    // Handle numeric dates (timestamps)
    if (typeof dateValue === 'number') {
      const parsedDate = new Date(dateValue)
      if (isNaN(parsedDate.getTime())) {
        return fallbackDate
      }
      try {
        parsedDate.toISOString()
        return parsedDate
      } catch {
        return fallbackDate
      }
    }

    // Unknown type, use fallback
    return fallbackDate

  } catch (error) {
    console.warn('Date parsing error:', error, 'Using fallback date')
    return fallbackDate
  }
}

/**
 * Safely parses a Webflow OAuth token expiration date
 * Uses 365-day default fallback appropriate for Webflow's long-lived tokens
 * 
 * @param expiresAt - The expiration date value from database
 * @returns Valid Date object representing when the token expires
 */
export function safeParseWebflowExpirationDate(expiresAt: unknown): Date {
  const fallbackDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 365 days from now
  return safeParseDate(expiresAt, fallbackDate)
}

/**
 * Safely parses a timestamp with a reasonable default fallback
 * 
 * @param timestamp - The timestamp value to parse
 * @returns Valid Date object
 */
export function safeParseTimestamp(timestamp: unknown): Date {
  const fallbackDate = new Date() // Current time as fallback
  return safeParseDate(timestamp, fallbackDate)
}