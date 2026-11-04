import * as vscode from "vscode";
import { QuotaData } from "./types";
export declare class SidebarProvider implements vscode.WebviewViewProvider {
    private readonly _extensionUri;
    static readonly viewType = "agq.quotaView";
    private _view?;
    private _quotaData?;
    private _autoRetryEnabled;
    private _autoRetryError?;
    private _debugModeActive;
    private _onToggleAutoRetry?;
    private _onRestartWithDebug?;
    constructor(_extensionUri: vscode.Uri);
    private escapeHtml;
    setAutoRetryToggleHandler(handler: (enabled: boolean) => void): void;
    setRestartWithDebugHandler(handler: () => void): void;
    resolveWebviewView(webviewView: vscode.WebviewView, _context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken): void;
    updateQuota(data: QuotaData): void;
    showError(message: string): void;
    showLoading(): void;
    updateAutoRetryState(enabled: boolean, error?: string): void;
    updateDebugModeState(active: boolean): void;
    private _getHtmlContent;
    private _getLoadingHtml;
    private _getErrorHtml;
}
