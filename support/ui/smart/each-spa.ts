import { test } from '@playwright/test';

// Runs one step per SPA in workflow order. The first failure stops the work, and each later SPA is reported as not run so it shows as failed.
export async function eachSpa(spaIds: string[], stepTitle: (spaId: string) => string, work: (spaId: string) => Promise<void>): Promise<void> {
    let failedSpaId: string | undefined;
    let firstError: unknown;
    for (const spaId of spaIds) {
        try {
            await test.step(stepTitle(spaId), async () => {
                if (failedSpaId) throw new Error(`Not run: ${failedSpaId} failed, so ${spaId} was not worked. Fix ${failedSpaId} and rerun.`);
                await work(spaId);
            });
        } catch (error) {
            failedSpaId ??= spaId;
            firstError ??= error;
        }
    }
    if (firstError) throw firstError;
}
