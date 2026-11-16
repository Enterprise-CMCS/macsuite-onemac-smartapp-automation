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

// Opens a date-picker calendar, navigates forward the right number of
// months, and clicks the day matching "monthsOut" months from today.
export async function pickFutureDate(page: Page, monthsOut: number) {
    const today = new Date();
    const target = futureDate(monthsOut, today);
    // number of calendar months between today's picker view and the target
    const monthsToAdvance =
        (target.getFullYear() - today.getFullYear()) * 12 +
        (target.getMonth() - today.getMonth());

    const nextMonthButton = page.getByRole('button', { name: 'Go to next month' });
    for (let i = 0; i < monthsToAdvance; i++) {
        await nextMonthButton.click();
    }

    const targetDay = String(target.getDate());
    await page.getByRole('gridcell', { name: targetDay, exact: true }).last().click();
}
