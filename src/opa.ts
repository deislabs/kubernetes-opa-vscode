import { KubectlV1 } from "vscode-kubernetes-tools-api";
import { Errorable } from "./utils/errorable";

export const OPA_HELM_RELEASE_NAME = 'opa';
export const OPA_NAMESPACE = 'opa';
export const OPA_DEV_REGO_ANNOTATION = 'k8s-opa-vscode.hestia.cc/devrego';

const OPA_POLICY_STATUS_ANNOTATION = 'openpolicyagent.org/policy-status';

export async function listPolicies(kubectl: KubectlV1): Promise<Errorable<ReadonlyArray<ConfigMap>>> {
    const sr = await kubectl.invokeCommand(`get configmap --namespace ${OPA_NAMESPACE} -o json`);
    if (!sr || sr.code !== 0) {
        const message = sr ? sr.stderr : 'Unable to run kubectl';
        return { succeeded: false, error: [message] };
    }

    const configmaps: GetConfigMapsResponse = JSON.parse(sr.stdout);
    if (configmaps.items) {
        const policies = configmaps.items.filter((cm) => !isSystemConfigMap(cm));
        return { succeeded: true, result: policies };
    }

    return { succeeded: true, result: [] };

}

export function isSystemConfigMap(configmap: ConfigMap): boolean {
    return configmap.metadata.name === 'opa-default-system-main';
}

export function policyStatus(configmap: ConfigMap): PolicyStatus {
    const annotations = configmap.metadata.annotations;
    if (!annotations) {
        return PolicyStatus.Unevaluated;
    }

    const statusText = annotations[OPA_POLICY_STATUS_ANNOTATION];
    if (!statusText) {
        return PolicyStatus.Unevaluated;
    }

    const status = JSON.parse(statusText);
    if (status.status === 'ok') {
        return PolicyStatus.Valid;
    }

    return PolicyStatus.Error;
}

export function policyIsDevRego(configmap: ConfigMap): boolean {
    const annotations = configmap.metadata.annotations;
    if (!annotations) {
        return false;
    }

    return !!annotations[OPA_DEV_REGO_ANNOTATION];
}

export function policyError(configmap: ConfigMap): PolicyError | undefined {
    const annotations = configmap.metadata.annotations;
    if (!annotations) {
        return undefined;
    }

    const statusText = annotations[OPA_POLICY_STATUS_ANNOTATION];
    if (!statusText) {
        return undefined;
    }

    const status = JSON.parse(statusText);
    if (status.status !== 'error') {
        return undefined;
    }

    return status.error;
}

export enum PolicyStatus {
    Unevaluated,
    Valid,
    Error,
}

export interface GetConfigMapsResponse {
    readonly items?: ReadonlyArray<ConfigMap>;
}

export interface ConfigMap {
    readonly data: { [key: string]: string };  // maps file names to policy text
    readonly metadata: {
        readonly name: string;
        readonly annotations?: { [key: string]: string }
    };
}

export interface PolicyError {
    readonly code: string;
    readonly message: string;
    readonly errors?: ReadonlyArray<PolicyErrorDetail>;
}

export interface PolicyErrorDetail {
    readonly code: string;
    readonly message: string;
    readonly location: {
        readonly file: string;
        readonly row: number;
        readonly col: number;
    };
}
