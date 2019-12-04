export const OPA_HELM_RELEASE_NAME = 'opa';
export const OPA_NAMESPACE = 'opa';
export const OPA_DEV_REGO_ANNOTATION = 'k8s-opa-vscode.hestia.cc/devrego';

const OPA_POLICY_STATUS_ANNOTATION = 'openpolicyagent.org/policy-status';

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
