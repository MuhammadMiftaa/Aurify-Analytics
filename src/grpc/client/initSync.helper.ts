//= Get week number from date (ISO 8601)
function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return weekNo;
}

//= Check if date is start of month
function isMonthStart(date: Date): boolean {
  return date.getDate() === 1;
}

//= Check if date is start of week (Monday)
function isWeekStart(date: Date): boolean {
  return date.getDay() === 1;
}

//= Get month name from month number
function getMonthName(month: number): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return months[month - 1] || "";
}

export default {
  getWeekNumber,
  isMonthStart,
  isWeekStart,
  getMonthName,
};
