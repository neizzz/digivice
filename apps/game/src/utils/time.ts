/**
 * Generates a timestamp in the format [yymmdd(오전or오후)(시간:분:초)]
 * Example: [230515오전10:30:45] for May 15, 2023, 10:30:45 AM
 * @param date Optional date object. If not provided, current date and time will be used.
 * @returns Formatted timestamp string
 */
export function formatKoreanTimestamp(date: Date = new Date()): string {
  // Get year, month, and day
  const year = date.getFullYear() % 100; // Get last 2 digits of the year
  const month = date.getMonth() + 1; // getMonth() returns 0-11
  const day = date.getDate();

  // Get hours and determine AM/PM
  const hours = date.getHours();
  const ampm = hours < 12 ? "오전" : "오후"; // 오전 = AM, 오후 = PM

  // Format hour (in 12-hour format)
  const hour12 = hours % 12 || 12; // Convert 0 to 12 for 12 AM

  // Get minutes and seconds
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  // Format the timestamp with zero-padding where needed
  const formattedYear = year.toString().padStart(2, "0");
  const formattedMonth = month.toString().padStart(2, "0");
  const formattedDay = day.toString().padStart(2, "0");
  const formattedMinutes = minutes.toString().padStart(2, "0");
  const formattedSeconds = seconds.toString().padStart(2, "0");

  return `[${formattedYear}${formattedMonth}${formattedDay}${ampm}${hour12}:${formattedMinutes}:${formattedSeconds}]`;
}
