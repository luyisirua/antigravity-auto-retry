export interface ProcessInfo {
    pid: number;
    port: number;
    csrfToken: string;
}
export interface ModelQuota {
    label: string;
    modelId: string;
    remainingPercent: number;
    isExhausted: boolean;
    resetTime: Date | null;
    resetTimeFormatted: string;
}
export interface QuotaData {
    user: {
        name: string;
        email: string;
        plan: string;
    };
    models: ModelQuota[];
    fetchedAt: Date;
}
export interface ServerResponse {
    userStatus: {
        name: string;
        email: string;
        planStatus?: {
            planInfo: {
                planName: string;
            };
        };
        cascadeModelConfigData?: {
            clientModelConfigs: Array<{
                label: string;
                modelOrAlias?: {
                    model: string;
                };
                quotaInfo?: {
                    remainingFraction?: number;
                    resetTime?: string;
                };
            }>;
        };
    };
}
export declare const MODEL_ORDER: string[];
