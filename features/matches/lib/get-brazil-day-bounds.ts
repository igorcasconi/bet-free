const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
// Brazil has used a fixed UTC-3 offset (no DST) since 2019.
const BRAZIL_UTC_OFFSET = "-03:00";

function todayInBrazil(): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return { year: get("year"), month: get("month"), day: get("day") };
}

export function getBrazilDayBounds(): {
  startOfToday: string;
  endOfToday: string;
} {
  const { year, month, day } = todayInBrazil();

  const startOfToday = new Date(
    `${year}-${month}-${day}T00:00:00${BRAZIL_UTC_OFFSET}`,
  );
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  return {
    startOfToday: startOfToday.toISOString(),
    endOfToday: endOfToday.toISOString(),
  };
}
