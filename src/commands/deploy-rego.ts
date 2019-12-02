import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import * as path from 'path';
import { showUnavailable, longRunning } from '../utils/host';
import { Errorable } from '../utils/errorable';
import { OPA_NAMESPACE, OPA_DEV_REGO_ANNOTATION } from '../opa';

export async function deployRego(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        await showUnavailable(kubectl.reason);
        return;
    }

    const uri = textEditor.document.uri;
    if (uri.scheme === 'file') {
        await textEditor.document.save();
    } else {
        // NOTE: we don't need to handle the 'untitled' case because the language ID
        // won't be set until the document is saved
        vscode.window.showErrorMessage('This command requires the document to be a file. Save your document to the file system and try again.');
        return;
    }

    const filePath = uri.fsPath;
    const result = await longRunning(`Deploying ${filePath} as config map...`, () =>
        createOrUpdateConfigMapFrom(filePath, kubectl.api)
    );

    if (result.succeeded) {
        await vscode.window.showInformationMessage(`Deployed ${filePath} as config map`);
    } else {
        await vscode.window.showErrorMessage(`Error deploying ${filePath} as config map: ${result.error[0]}`);
    }
}

async function createOrUpdateConfigMapFrom(filePath: string, kubectl: k8s.KubectlV1): Promise<Errorable<null>> {
    const configmapName = path.basename(filePath, '.rego');

    const createResult = await kubectl.invokeCommand(`create configmap ${configmapName} --namespace=${OPA_NAMESPACE} --from-file=${filePath}`);
    if (createResult && createResult.code === 0) {
        const annotateResult = await kubectl.invokeCommand(`annotate configmap ${configmapName} ${OPA_DEV_REGO_ANNOTATION}=true`);
        if (!annotateResult || annotateResult.code !== 0) {
            return { succeeded: false, error: ['The policy was deployed successfully but you may not be able to update it'] };
        }
        return { succeeded: true, result: null };
    }

    if (createResult && createResult.stderr.includes('(AlreadyExists)')) {
        return await updateConfigMapFrom(configmapName, filePath, kubectl);
    }

    const reason = createResult ? createResult.stderr : 'Unable to run kubectl';
    return { succeeded: false, error: [reason] };
}

async function updateConfigMapFrom(configmapName: string, filePath: string, kubectl: k8s.KubectlV1): Promise<Errorable<null>> {
    return { succeeded: false, error: ['NOT DONE YET'] };
    // get the existing resource
    // check it has the dev flag
    // modify it
    // do a replace

    // Per Brendan:
    // const dataHolderJson = await kubectl.asJson<DataHolder>(`get ${obj.kind.abbreviation} ${obj.name} --namespace=${currentNS} -o json`);
    // dataHolder.data[fileName] = buff.toString();
    // const out = JSON.stringify(dataHolder);
    // await kubectl.invokeAsync(`replace -f - --namespace=${currentNS}`, out);
}
