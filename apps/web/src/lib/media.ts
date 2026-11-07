/** Local API upload URLs must resolve through the web origin on other devices. */
export function mediaSource(value: string): string {
  try {
    const url = new URL(value);
    if (
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      /^\/uploads\/[a-zA-Z0-9._-]+$/.test(url.pathname)
    )
      return `/api/media/${url.pathname.slice("/uploads/".length)}`;
  } catch {
    /* already relative */
  }
  return value;
}
