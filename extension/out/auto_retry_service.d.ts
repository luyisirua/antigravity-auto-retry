type StatusChangeCallback = (running: boolean, error?: string, shouldDisableConfig?: boolean) => void;
export declare class AutoRetryService {
    private injectedTargets;
    private running;
    private starting;
    private reconnectTimer;
    private connectionPoller;
    private onStatusChange;
    constructor(onStatusChange: StatusChangeCallback);
    get isRunning(): boolean;
    checkDebugPortAvailable(): Promise<number | null>;
    start(): Promise<boolean>;
    stop(): Promise<void>;
    dispose(): void;
    /**
     * Filter: only inject into Antigravity agent-related CDP targets.
     */
    private isAgentTarget;
    /**
     * Fire-and-forget injection: connect → evaluate → IMMEDIATELY disconnect.
     *
     * WHY: Keeping the CDP WebSocket open causes Electron/Antigravity to treat
     * the connected tab as "having an attached debugger" which can pull that tab
     * to the foreground. By disconnecting right after inject, the script keeps
     * running on its own (setInterval + MutationObserver survive in the page's
     * JS context) without holding the connection.
     *
     * Returns true if at least one new target was injected (or already tracked).
     */
    private tryInject;
    /**
     * Polls for targets when initial injection fails (e.g. IDE not yet ready).
     * Retries every 5s for up to 5 minutes.
     */
    private startConnectionPoller;
    private clearConnectionPoller;
    /**
     * Lightweight monitor: every 30s, check /json (HTTP only, no WebSocket)
     * for new agent tabs that haven't been injected yet and inject them.
     * No persistent connections are held.
     */
    private startNewTabMonitor;
    private clearReconnectTimer;
    private findDebugPort;
    private findPortFromProcessArgs;
    private testDebugPort;
}
export {};
