import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { showUnavailable, longRunning } from '../utils/host';
import { createOrUpdateConfigMapFrom, DeploymentInfo } from '../opa/deployment';

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
    const fileContent = textEditor.document.getText();
    const deploymentInfo = new DeploymentInfo(filePath, fileContent);

    const result = await longRunning(`Deploying ${filePath} as config map ${deploymentInfo.configmapName}...`, () =>
        createOrUpdateConfigMapFrom(deploymentInfo, kubectl.api)
    );

    if (result.succeeded) {
        await vscode.window.showInformationMessage(`Deployed ${filePath} as config map ${deploymentInfo.configmapName}`);
    } else {
        await vscode.window.showErrorMessage(`Error deploying ${filePath} as config map: ${result.error[0]}`);
    }
}
