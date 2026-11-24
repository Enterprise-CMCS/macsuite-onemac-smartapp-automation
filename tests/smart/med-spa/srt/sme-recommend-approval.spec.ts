import { test } from '../../../../support/fixtures/smart.fixture';
import type { Page } from '@playwright/test';
import type { SmartReview } from '../../../../support/ui/smart/sections/review';

test.use({ smartRole: 'SRT_SME' });

// The SME is the "SRT5 JohnSRT" row assigned at intake with Designate as Consulting SME. It is the only row with this name.
const smeName = 'SRT5 JohnSRT';

// The second clock has its own "Second Clock Review" grid. The first clock grid is "Submission Review Team".
async function currentClock(review: SmartReview, page: Page): Promise<'first' | 'second'> {
    await review.openReviewTab();
    const second = page.getByRole('heading', { name: 'Second Clock Review', exact: true }).filter({ visible: true });
    const isSecond = await second.first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    return isSecond ? 'second' : 'first';
}

test('SRT (SME) recommends approval', async ({ navigation, page, recordSearch, spaId, spaRecord }) => {
    await navigation.openSmartHome();
    await recordSearch.openSpa(spaId);
    const clock = await currentClock(spaRecord.review, page);
    await test.step(`Set SRT (SME) Review Progress to Recommending Approval in ${clock} clock`, async () => {
        await spaRecord.review.setReviewTeamProgress(smeName, 'Recommending Approval', spaId, clock);
    });
});
