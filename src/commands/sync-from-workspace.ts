import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { showUnavailable } from '../utils/host';

export async function syncFromWorkspace() {
    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        await showUnavailable(kubectl.reason);
        return;
    }

    await trySyncFromWorkspace(kubectl.api);
}

async function trySyncFromWorkspace(kubectl: k8s.KubectlV1): Promise<void> {
    await vscode.window.showInformationMessage('syncing');
}
