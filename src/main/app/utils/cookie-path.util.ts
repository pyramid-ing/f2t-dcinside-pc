export function getCookieJsonName(username?: string): string {
  const safeUser = (username || 'default').replace(/[^\w\-]/g, '_')
  return `${safeUser}.json`
}
