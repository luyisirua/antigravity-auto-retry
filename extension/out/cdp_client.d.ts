export declare class CDPClient {
    private socket;
    private messageId;
    private pendingRequests;
    private receiveBuffer;
    targetWsUrl: string | undefined;
    constructor(wsUrl?: string);
    connect(debugPort: number): Promise<void>;
    connectToTarget(wsUrl: string): Promise<void>;
    static getTargets(debugPort: number): Promise<Array<{
        id: string;
        type: string;
        webSocketDebuggerUrl: string;
        title: string;
        url: string;
    }>>;
    evaluate(expression: string): Promise<unknown>;
    disconnect(): void;
    get isConnected(): boolean;
    private wsConnect;
    private wsSend;
    private handleSocketData;
    private handleTextMessage;
    private sendPong;
    private parseFrame;
}
