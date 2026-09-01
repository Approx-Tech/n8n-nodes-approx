import {
    Icon,
    ICredentialTestRequest,
    ICredentialType,
    INodeProperties,
} from 'n8n-workflow';

/**
 * Approx API credential.
 *
 * Wraps n8n's built-in `oAuth2Api` credential with `grantType: clientCredentials`
 * pre-configured for the Approx Auth0 tenant. n8n handles the token request,
 * caching, and refresh; this file only contributes the Approx-specific fields
 * (Auth0 domain, audience, base URL) and hidden overrides that wire those
 * fields into the standard OAuth2 client-credentials flow.
 *
 * Auth0 requires `audience` in the token request body, which is injected via
 * the `additionalBodyProperties` hidden property (parsed by n8n core).
 */
export class ApproxOAuth2Api implements ICredentialType {
    name = 'approxOAuth2Api';

    extends = ['oAuth2Api'];

    displayName = 'Approx OAuth2 API';

    icon: Icon = { light: 'file:approx.svg', dark: 'file:approx.svg' };

    documentationUrl = 'https://github.com/Approx-Tech/n8n-nodes-approx/blob/main/README.md';

    properties: INodeProperties[] = [
        // ---- Approx-specific user inputs ----
        {
            displayName: 'Auth0 Domain',
            name: 'auth0Domain',
            type: 'string',
            default: 'auth.approx.cloud',
            placeholder: 'auth.approx.cloud',
            required: true,
            description: 'Approx Auth0 tenant domain (no protocol).',
        },
        {
            displayName: 'Audience',
            name: 'audience',
            type: 'string',
            default: 'https://approx.azurewebsites.net',
            required: true,
            description: 'Approx API audience configured in Auth0. Sent as `audience` in the token request body.',
        },
        {
            displayName: 'Base URL',
            name: 'baseUrl',
            type: 'string',
            default: 'https://approx.azurewebsites.net',
            required: true,
            description: 'Approx API base URL (no trailing slash).',
        },

        // ---- Hidden overrides for the inherited oAuth2Api credential ----
        // These are picked up by n8n's built-in OAuth2 client; we do not
        // implement token handling ourselves.
        {
            displayName: 'Grant Type',
            name: 'grantType',
            type: 'hidden',
            default: 'clientCredentials',
        },
        {
            displayName: 'Access Token URL',
            name: 'accessTokenUrl',
            type: 'hidden',
            default: '=https://{{$self["auth0Domain"]}}/oauth/token',
        },
        {
            displayName: 'Scope',
            name: 'scope',
            type: 'hidden',
            default: '',
        },
        {
            displayName: 'Auth URI Query Parameters',
            name: 'authQueryParameters',
            type: 'hidden',
            default: '',
        },
        {
            displayName: 'Authentication',
            name: 'authentication',
            type: 'hidden',
            default: 'body',
        },
        {
            displayName: 'Additional Body Properties',
            name: 'additionalBodyProperties',
            type: 'hidden',
            // Auth0 requires `audience` in the token-request body.
            default: '={"audience": "{{$self["audience"]}}"}',
        },
    ];

    test: ICredentialTestRequest = {
        request: {
            method: 'GET',
            baseURL: '={{$credentials.baseUrl}}',
            url: '/api/integrations/projects',
            // One item is enough to prove the credential works. Must be the single `dqb`
            // parameter the API resolves DQB from; `dqb.take` is ignored and silently returns a
            // full page.
            qs: { dqb: 'offset=0&count=1' },
        },
        // The endpoint above is gated by the `integrations:projects:read` permission, which
        // only organization (Workplace) accounts are granted. Without it the API answers 403
        // with no body, so n8n would otherwise show its generic status-code text. These rules
        // name the real cause, and do it while connecting rather than on the first run.
        rules: [
            {
                type: 'responseCode',
                properties: {
                    value: 403,
                    message:
                        'Access denied. This credential holds none of the required integrations:* permissions. The Approx Integrations API is available to Workplace (organization) accounts only — a free account that does not belong to an Approx organization cannot use these nodes. Ask your Approx administrator to link the application to your organization and grant the permissions.',
                },
            },
            {
                type: 'responseCode',
                properties: {
                    value: 401,
                    message:
                        'Authentication failed. Check the Client ID, Client Secret, Auth0 Domain and Audience on this credential.',
                },
            },
        ],
    };
}
