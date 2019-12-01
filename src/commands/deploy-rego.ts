import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { showUnavailable } from '../utils/host';

export async function deployRego(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        await showUnavailable(kubectl.reason);
        return;
    }

    vscode.window.showInformationMessage("quick everybody look like you're deploying");
}
