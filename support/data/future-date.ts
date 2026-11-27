import { Page } from '@playwright/test';

export function futureDate(monthsOut: number, today = new Date()): Date {
    const target = new Date(today);
    const day = target.getDate();
    target.setDate(1);
    target.setMonth(target.getMonth() + monthsOut);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, lastDay));
    return target;
}

export function daysAgo(days: number, today = new Date()): Date {
    const target = new Date(today);
    target.setDate(target.getDate() - days);
    return target;
}

// Opens a date-picker calendar, moves to the target's month, and clicks the target day.
export async function pickDate(page: Page, target: Date, today = new Date()) {
    // number of calendar months between today's picker view and the target; negative means earlier
    const monthsToMove =
        (target.getFullYear() - today.getFullYear()) * 12 +
        (target.getMonth() - today.getMonth());

    const monthButton = page.getByRole('button', { name: monthsToMove < 0 ? 'Go to previous month' : 'Go to next month' });
    for (let i = 0; i < Math.abs(monthsToMove); i++) {
        await monthButton.click();
    }

    const targetDay = String(target.getDate());
    await page.getByRole('gridcell', { name: targetDay, exact: true }).last().click();
}
