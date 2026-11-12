import { authenticator } from 'otplib';

const PERIOD_MS = 30_000;

export async function getTotpCode(secret: string): Promise<string> {
    const msIntoPeriod = Date.now() % PERIOD_MS;
    const msRemaining = PERIOD_MS - msIntoPeriod;
    if (msRemaining < 5_000) {
        await new Promise((resolve) => setTimeout(resolve, msRemaining + 500));
    }
    return authenticator.generate(secret);
}