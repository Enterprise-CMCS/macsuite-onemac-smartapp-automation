import 'dotenv/config';

export const smartRoles = ['INTAKE', 'CPOC', 'SRT', 'DIVDIR', 'GROUPDIR', 'SUPERUSR'] as const;
export type SmartRole = typeof smartRoles[number];

export function selectedSmartRole(): SmartRole {
    const role = (process.env.SF_ROLE ?? 'INTAKE').trim().toUpperCase();
    const selectedRole = smartRoles.find((candidate) => candidate === role);
    if (!selectedRole) {
        throw new Error(`Invalid SF_ROLE. Choose one of: ${smartRoles.join(', ')}`);
    }
    return selectedRole;
}

function requiredEnvValues(names: readonly string[]): string[] {
    const missing = names.filter((name) => !process.env[name]?.trim());
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    return names.map((name) => process.env[name] as string);
}

export function smartCredentials(role: SmartRole) {
    const [username, password, totpSecret] = requiredEnvValues([
        `SF_${role}_USERNAME`,
        `SF_${role}_PASSWORD`,
        `SF_${role}_TOTP_SECRET`,
    ]);
    return { username, password, totpSecret };
}

export function onemacCredentials() {
    const [username, password] = requiredEnvValues(['ONEMAC_USERNAME', 'ONEMAC_PASSWORD']);
    return { username, password };
}