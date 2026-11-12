const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// OneMAC shows submission timestamps in Eastern time, e.g. "Mon, Oct 26 2026, 09:23:09 AM EDT".
export function onemacDisplayDate(date: Date): string {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    }).formatToParts(date).map(({ type, value }) => [type, value]));
    return `${parts.weekday}, ${parts.month} ${parts.day} ${parts.year}`;
}

// Converts OneMAC dates ("January 15, 2027" or "Mon, Oct 26 2026, 09:23:09 AM EDT") to SMART's "1/15/2027".
export function toSmartDate(onemacDate: string): string {
    const match = onemacDate.match(/\b([A-Za-z]{3,9}) (\d{1,2}),? (\d{4})\b/);
    const month = match ? months.indexOf(match[1].slice(0, 3).toLowerCase()) + 1 : 0;
    const day = Number(match?.[2]);
    if (!match || month === 0 || day < 1 || day > 31) {
        throw new Error(`Unrecognized OneMAC date: ${onemacDate}`);
    }
    return `${month}/${day}/${match[3]}`;
}
