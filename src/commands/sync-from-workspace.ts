import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { showUnavailable, longRunning } from '../utils/host';
import { listPolicies, ConfigMap, policyIsDevRego, OPA_NAMESPACE } from '../opa';
import { failed, Errorable, Failed, succeeded } from '../utils/errorable';
import { partition } from '../utils/array';
import { basename } from 'path';
import { DeploymentInfo, createOrUpdateConfigMapFrom, updateConfigMapFrom } from '../opa/deployment';

export async function syncFromWorkspace() {
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    const kubectl = await k8s.extension.kubectl.v1;
    if (!clusterExplorer.available) {
        await showUnavailable(clusterExplorer.reason);
        return;
    } else if (!kubectl.available) {
        await showUnavailable(kubectl.reason);
        return;
    }

    await trySyncFromWorkspace(clusterExplorer.api, kubectl.api);
}

async function trySyncFromWorkspace(clusterExplorer: k8s.ClusterExplorerV1, kubectl: k8s.KubectlV1): Promise<void> {
    // Strategy:
    // * Compare the files and the cluster and work out what needs to be done.
    // * Render the list of actions needed to sync as a multi-select quick picker.
    // * If the user confirms any sync actions, go ahead and perform them.
    // * Display the outcome.

    // TODO: We need to make sure all .rego files are saved (per the Deploy command)

    const plan = await longRunning('Working out sync actions...', () => syncActions(kubectl));
    if (failed(plan)) {
        await vscode.window.showErrorMessage(plan.error[0]);
        return;
    }

    const actions = plan.result;

    const actionQuickPicks = createQuickPicks(actions);
    if (actionQuickPicks.length === 0) {
        await vscode.window.showInformationMessage('Cluster and workspace are already in sync');
        return;
    }

    const selectedActionQuickPicks = await vscode.window.showQuickPick(actionQuickPicks, { canPickMany: true });
    if (!selectedActionQuickPicks || selectedActionQuickPicks.length === 0) {
        return;
    }

    const selectedActionPromises = selectedActionQuickPicks.map((a) => runAction(kubectl, a));
    const actionResults = await longRunning('Syncing the cluster from the workspace...', () =>
        Promise.all(selectedActionPromises)
    );

    await displaySyncResult(actionResults, clusterExplorer);
}

interface RegoFile {
    readonly uri: vscode.Uri;
    readonly content: string;
}

interface SyncActions {
    readonly deploy: ReadonlyArray<RegoFile>;
    readonly overwriteDevRego: ReadonlyArray<RegoFile>;
    readonly overwriteNonDevRego: ReadonlyArray<RegoFile>;
    readonly delete: ReadonlyArray<string>;
}

type ActionQuickPickItem = vscode.QuickPickItem & ({
    readonly value: RegoFile;
    readonly action: 'deploy';
    readonly isCreate: boolean;
} | {
    readonly value: string;
    readonly action: 'delete';
});

async function syncActions(kubectl: k8s.KubectlV1): Promise<Errorable<SyncActions>> {
    // Strategy:
    // * Find all the .rego files in the workspace
    // * Look at all the configmaps in the cluster (except system ones)
    // * Sort the .rego files into buckets:
    //   * No matching policy. We can deploy these fearlessly.
    //   * Matching policy that the extension didn't deploy. We can deploy these with caution.
    //   * Matching policy whose content is the same as the file. We can skip these.
    //   * Matching policy whose content is out of sync with the file. We can deploy these fearlessly, too.
    // * Pick out all the MANAGED configmaps in the cluster which DON'T have matching files.
    //   We propose to delete these.

    const regoUris = await vscode.workspace.findFiles('**/*.rego');
    const regoFiles = await Promise.all(regoUris.map(async (u) => ({ uri: u, content: (await vscode.workspace.openTextDocument(u)).getText() })));
    const clusterPolicies = await listPolicies(kubectl);

    const nonFileRegoUris = regoUris.filter((u) => u.scheme !== 'file');
    if (nonFileRegoUris.length > 0) {
        const message = nonFileRegoUris.map((u) => u.toString()).join(', ');
        return { succeeded: false, error: [`Workspace contains .rego documents that aren't files. Save all .rego documents to the file system and try again. (${message})`] };
    }

    if (failed(clusterPolicies)) {
        return { succeeded: false, error: [`Failed to get current policies: ${clusterPolicies.error[0]}`] };
    }

    const localRegoFiles = regoUris.map((u) => vscode.workspace.asRelativePath(u));

    const fileActions = partition(regoFiles, (f) => deploymentAction(clusterPolicies.result, f));
    const filesToDeploy = fileActions.get('no-overwrite') || [];
    const filesOverwritingDevRego = fileActions.get('overwrite-dev') || [];
    const filesOverwritingNonDevRego = fileActions.get('overwrite-nondev') || [];
    const policiesToDelete = clusterPolicies.result
                                            .filter((p) => policyIsDevRego(p) && !hasMatchingRegoFile(localRegoFiles, p))
                                            .map((p) => p.metadata.name);

    return {
        succeeded: true,
        result: {
            deploy: filesToDeploy,
            overwriteDevRego: filesOverwritingDevRego,
            overwriteNonDevRego: filesOverwritingNonDevRego,
            delete: policiesToDelete
        }
    };
}

function deploymentAction(policies: ReadonlyArray<ConfigMap>, regoFile: RegoFile): 'no-overwrite' | 'overwrite-dev' | 'overwrite-nondev' | 'skip' {
    const policyName = basename(regoFile.uri.fsPath, '.rego');  // TODO: deduplicate - seems like DeploymentInfo might do this for us?
    const matchingPolicy = policies.find((p) => p.metadata.name === policyName);
    if (!matchingPolicy) {
        return 'no-overwrite';
    }
    if (!policyIsDevRego(matchingPolicy)) {
        return 'overwrite-nondev';  // it's kind of opaque to us so let's not try to sniff content
    }
    const policyKeys = Object.keys(matchingPolicy.data);
    if (policyKeys.length !== 1) {
        return 'overwrite-nondev';  // shouldn't happen so something fishy is going on - claims to be managed but has been fiddled with
    }
    const policyContent = matchingPolicy.data[policyKeys[0]];
    return policyContent === regoFile.content ? 'skip' : 'overwrite-dev';
}

function hasMatchingRegoFile(regoFiles: ReadonlyArray<string>, policy: ConfigMap): boolean {
    return regoFiles.some((f) => basename(f, '.rego') === policy.metadata.name);
}

function createQuickPicks(actions: SyncActions) {
    const deployQuickPicks = actions.deploy.map((f) => deployQuickPick(f, 'deploy to cluster', true, true));
    const overwriteDevRegoQuickPicks = actions.overwriteDevRego.map((f) => deployQuickPick(f, 'deploy to cluster (overwriting existing)', true, false));
    const overwriteNonDevRegoQuickPicks = actions.overwriteNonDevRego.map((f) => deployQuickPick(f, 'deploy to cluster (overwriting existing not deployed by VS Code)', false, false));
    const deleteQuickPicks: ActionQuickPickItem[] = actions.delete.map((p) => ({ label: `${p}: delete from cluster`, picked: true, value: p, action: 'delete' }));
    const actionQuickPicks = deployQuickPicks.concat(overwriteDevRegoQuickPicks).concat(overwriteNonDevRegoQuickPicks).concat(deleteQuickPicks);
    return actionQuickPicks;
}

function deployQuickPick(file: RegoFile, actionDescription: string, picked: boolean, isCreate: boolean): ActionQuickPickItem {
    const displayFileName = vscode.workspace.asRelativePath(file.uri);
    return {label: `${displayFileName}: ${actionDescription}`, picked: picked, value: file, action: 'deploy', isCreate: isCreate };
}

function runAction(kubectl: k8s.KubectlV1, action: ActionQuickPickItem): Promise<Errorable<null>> {
    switch (action.action) {
        case 'deploy': return runDeployAction(kubectl, action.value, action.isCreate);
        case 'delete': return runDeleteAction(kubectl, action.value);
    }
}

async function runDeployAction(kubectl: k8s.KubectlV1, regoFile: RegoFile, isCreate: boolean): Promise<Errorable<null>> {
    const regoFilePath = regoFile.uri.fsPath;
    const regoFileContent = regoFile.content;
    const deploymentInfo = new DeploymentInfo(regoFilePath, regoFileContent);
    const deployResult = isCreate ?
                            await createOrUpdateConfigMapFrom(deploymentInfo, kubectl) :
                            await updateConfigMapFrom(deploymentInfo, kubectl);
    if (failed(deployResult)) {
        return { succeeded: false, error: [`deploying ${vscode.workspace.asRelativePath(regoFile.uri)} (${deployResult.error[0]})`] };
    }
    return deployResult;
}

async function runDeleteAction(kubectl: k8s.KubectlV1, policyName: string): Promise<Errorable<null>> {
    const sr = await kubectl.invokeCommand(`delete configmap ${policyName} --namespace=${OPA_NAMESPACE}`);

    if (sr && sr.code === 0) {
        return { succeeded: true, result: null };
    } else {
        const reason = sr ? sr.stderr : 'unable to run kubectl';
        return { succeeded: false, error: [`deleting config map ${policyName} (${reason})`] };
    }

}

async function displaySyncResult(actionResults: Errorable<null>[], clusterExplorer: k8s.ClusterExplorerV1): Promise<void> {
    const failures = actionResults.filter((r) => failed(r)) as Failed[];
    const successCount = actionResults.filter((r) => succeeded(r)).length;
    if (failures.length > 0) {
        const successCountInfo = successCount > 0 ? `.  (${successCount} other update(s) succeeded.)` : '';
        await vscode.window.showErrorMessage(`${failures.length} update(s) failed: ${failures.map((f) => f.error[0]).join(', ')}${successCountInfo}`);
        return;
    }

    if (successCount > 0) {
        clusterExplorer.refresh();
    }

    await vscode.window.showInformationMessage(`Synced the cluster from the workspace`);
}
