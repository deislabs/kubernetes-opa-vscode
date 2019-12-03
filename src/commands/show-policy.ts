import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { unavailableMessage } from '../utils/host';
import { PolicyBrowser } from '../ui/policy-browser';
import { ConfigMap } from '../opa';

export async function showPolicy(target: any) {
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    if (!clusterExplorer.available) {
        await vscode.window.showWarningMessage(`Can't run command: ${unavailableMessage(clusterExplorer.reason)}`);
        return;
    }

    const node = PolicyBrowser.resolve(target, clusterExplorer.api);
    if (node && node.nodeType === 'policy') {
        const policy = node.configmap;
        await tryShowPolicy(policy);
    }
}

async function tryShowPolicy(policy: ConfigMap): Promise<void> {
    await vscode.window.showInformationMessage(`imagine all the useful info about ${policy.metadata.name}`);
}
