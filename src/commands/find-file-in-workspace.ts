import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { unavailableMessage } from '../utils/host';
import { PolicyBrowser } from '../ui/policy-browser';
import { ConfigMap } from '../opa';

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
    await vscode.window.showInformationMessage(`pretending to open source file of ${policy.metadata.name}`);
}
