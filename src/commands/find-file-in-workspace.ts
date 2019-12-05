import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { unavailableMessage, selectQuickPickOf } from '../utils/host';
import { PolicyBrowser } from '../ui/policy-browser';
import { ConfigMap } from '../opa';
import { Errorable, failed } from '../utils/errorable';

export async function findFileInWorkspace(target: any) {
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    if (!clusterExplorer.available) {
        await vscode.window.showWarningMessage(`Can't run command: ${unavailableMessage(clusterExplorer.reason)}`);
        return;
    }

    const node = PolicyBrowser.resolve(target, clusterExplorer.api);
    if (node && node.nodeType === 'policy') {
        const policy = node.configmap;
        await tryOpenWorkspaceFile(policy);
    }
}

async function tryOpenWorkspaceFile(policy: ConfigMap): Promise<void> {
    const sourceFile = await tryFindSourceFile(policy);
    if (failed(sourceFile)) {
        await vscode.window.showErrorMessage(`Can't find source file for ${policy.metadata.name} in the current workspace: ${sourceFile.error[0]}`);
        return;
    }

    if (!sourceFile.result) {
        return;  // cancelled
    }

    const document = await vscode.workspace.openTextDocument(sourceFile.result);
    await vscode.window.showTextDocument(document);
}

async function tryFindSourceFile(policy: ConfigMap): Promise<Errorable<vscode.Uri | undefined /* TODO: Cancellable<T> */>> {
    const policyRegoKeys = Object.keys(policy.data).filter((f) => f.toLowerCase().endsWith('.rego'));  // TODO: is it legit to have this filter?
    if (policyRegoKeys.length === 0) {
        return { succeeded: false, error: ["Policy configmap doesn't list any .rego files"] };
    }

    const sourceFileName = await selectQuickPickOf(policyRegoKeys, (s) => s, { placeHolder: 'Policy contains multiple files - choose one to find' });

    if (!sourceFileName) {
        return { succeeded: true, result: undefined };  // cancelled
    }
    const matches = await vscode.workspace.findFiles(`**/${sourceFileName}`);

    if (matches.length === 0) {
        return { succeeded: false, error: [`No files named ${sourceFileName} found in current workspace`] };
    }
    if (matches.length === 1) {
        return { succeeded: true, result: matches[0] };
    }

    const selectedMatch = await selectQuickPickOf(matches, (uri) => vscode.workspace.asRelativePath(uri), { placeHolder: 'Choose the desired source file' });

    return { succeeded: true, result: selectedMatch };
}
