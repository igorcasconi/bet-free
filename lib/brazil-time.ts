const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

// Brazil has used a fixed UTC-3 offset (no DST) since 2019.
export function getBrazilCalendarDay(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}
