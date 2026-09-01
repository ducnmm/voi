/** Strip JWT query tokens so request logs never print `?token=<jwt>`. */
export function redactSensitiveUrl(url: string): string {
  return url.replace(/([?&]token=)[^&]*/gi, "$1[Redacted]");
}
