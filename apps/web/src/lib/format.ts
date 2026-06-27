const vndFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});

export function formatVnd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "—";
  }
  return vndFormatter.format(amount);
}

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit"
});

export function formatSessionTime(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return `${dateTimeFormatter.format(start)} – ${timeFormatter.format(end)}`;
}

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

// Converts a value from <input type="datetime-local"> into an ISO-8601 string.
export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}
