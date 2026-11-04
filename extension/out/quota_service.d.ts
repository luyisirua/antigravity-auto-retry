import { QuotaData } from "./types";
export declare class QuotaService {
    private processFinder;
    private processInfo;
    constructor();
    connect(): Promise<boolean>;
    fetchQuota(): Promise<QuotaData | null>;
    private request;
    private parseResponse;
}
