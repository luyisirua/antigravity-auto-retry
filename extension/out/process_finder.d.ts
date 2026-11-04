import { ProcessInfo } from "./types";
export declare class ProcessFinder {
    private processName;
    constructor();
    findProcess(): Promise<ProcessInfo | null>;
    private getProcessInfo;
    private parseProcessOutput;
    private parseWindowsOutput;
    private parseUnixOutput;
    private getListeningPorts;
    /**
     * Fallback for Windows: parse netstat output to find listening ports for a PID.
     * netstat doesn't require admin privileges for basic usage.
     */
    private getListeningPortsNetstat;
    private parsePorts;
    private findWorkingPort;
    private testPort;
}
