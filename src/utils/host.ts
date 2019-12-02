import * as vscode from 'vscode';

export async function selectWorkspaceFolder(placeHolder?: string): Promise<vscode.WorkspaceFolder | undefined> {
    const folders = vscode.workspace.workspaceFolders;

    if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage("This command requires an open folder");
        return undefined;
    }

    if (folders.length === 1) {
        return folders[0];
    }

    return await vscode.window.showWorkspaceFolderPick({ placeHolder: placeHolder });
}

export async function selectQuickPick<T extends vscode.QuickPickItem>(items: T[], options?: vscode.QuickPickOptions): Promise<T | undefined> {
    if (items.length === 1) {
        return items[0];
    }
    return await vscode.window.showQuickPick(items, options);
}

export async function longRunning<T>(title: string, action: () => Promise<T>): Promise<T> {
    const options = {
        location: vscode.ProgressLocation.Notification,
        title: title
    };
    return await vscode.window.withProgress(options, (_) => action());
}

export async function confirm(text: string, confirmLabel: string): Promise<boolean> {
    const choice = await vscode.window.showWarningMessage(text, confirmLabel, 'Cancel');
    return choice === confirmLabel;
}

export async function showUnavailable(reason: "version-unknown" | "version-removed" | "extension-not-available") {
    await vscode.window.showErrorMessage(`Cannot run command: ${unavailableMessage(reason)}`);
}

export function unavailableMessage(reason: "version-unknown" | "version-removed" | "extension-not-available"): string {
    switch (reason) {
        case "extension-not-available": return "please check the 'Kubernetes' extension is installed";
        case "version-removed": return "please check for updates to the 'Open Policy Agent for Kubernetes' extension";
        case "version-unknown": return "please check for updates to the 'Kubernetes' extension";
    }
}
