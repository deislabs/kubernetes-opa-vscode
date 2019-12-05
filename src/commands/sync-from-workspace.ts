import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { showUnavailable } from '../utils/host';
import { listPolicies, ConfigMap } from '../opa';
import { failed } from '../utils/errorable';
import { partition } from '../utils/array';

export async function syncFromWorkspace() {
    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        await showUnavailable(kubectl.reason);
        return;
    }

    await trySyncFromWorkspace(kubectl.api);
}

async function trySyncFromWorkspace(kubectl: k8s.KubectlV1): Promise<void> {
    // Strategy:
    // * Find all the .rego files in the workspace
    // * Look at all the configmaps in the cluster (except system ones)
    // * Deploy all the .rego files EXCEPT those that would overwrite a NON-MANAGED configmap
    //   * OPTIMISATION: Skip .rego files where the data already matches the .rego file content
    // * Delete all the MANAGED configmaps that do NOT correspond to any .rego file
    // TO CONSIDER: List what we are going to do first...

    const regoUris = await vscode.workspace.findFiles('**/*.rego');
    const clusterPolicies = await listPolicies(kubectl);

    const nonFileRegoUris = regoUris.filter((u) => u.scheme !== 'file');
    if (nonFileRegoUris.length > 0) {
        const message = nonFileRegoUris.map((u) => u.toString()).join(', ');
        await vscode.window.showErrorMessage(`Workspace contains .rego documents that aren't files. Save all .rego documents to the file system and try again. (${message})`);
        return;
    }

    if (failed(clusterPolicies)) {
        await vscode.window.showErrorMessage(`Failed to get current policies: ${clusterPolicies.error[0]}`);
        return;
    }

    const localRegoFiles = regoUris.map((u) => vscode.workspace.asRelativePath(u));

    const { matches: filesToDeploy, nonMatches: filesToConfirm } = partition(localRegoFiles, (f) => matchesUnmanagedPolicy(clusterPolicies.result, f));
    const policiesToDelete = clusterPolicies.result.filter((p) => !hasMatchingRegoFile(localRegoFiles, p));

    const message = `SHIP IT: ${filesToDeploy} | WARN IT: ${filesToConfirm} | DELETE IT: ${policiesToDelete}`;

    await vscode.window.showInformationMessage(message);
}

function matchesUnmanagedPolicy(policies: ReadonlyArray<ConfigMap>, regoFilePath: string): boolean {
    return true;
}

function hasMatchingRegoFile(regoFiles: ReadonlyArray<string>, policy: ConfigMap): boolean {
    return true;
}
