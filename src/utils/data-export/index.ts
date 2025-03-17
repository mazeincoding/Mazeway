/**
 * Shared utilities for data export functionality
 * These functions are used by both client and server code
 */

/**
 * Get the storage path for a data export file
 * Format: exports/{userId}/{exportId}.json
 */
export function getDataExportStoragePath(
  userId: string,
  exportId: string
): string {
  return `exports/${userId}/${exportId}.json`;
}
