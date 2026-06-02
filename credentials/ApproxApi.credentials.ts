import {
    IAuthenticateGeneric,
    ICredentialDataDecryptedObject,
    ICredentialTestRequest,
    ICredentialType,
    IHttpRequestHelper,
    INodeProperties,
} from 'n8n-workflow';

export class ApproxApi implements ICredentialType {
    name = 'approxApi';
    displayName = 'Approx API';
    documentationUrl = 'https://github.com/Approx-Tech/n8n-nodes-approx/blob/main/README.md';

    properties: INodeProperties[] = [
        {
            displayName: 'Auth0 Domain',
            name: 'auth0Domain',
            type: 'string',
            default: 'auth.approx.cloud',
            placeholder: 'auth.approx.cloud',
            description: 'Your Approx Auth0 tenant domain (no protocol).',
        },
        {
            displayName: 'Client ID',
            name: 'clientId',
            type: 'string',
            default: '',
            required: true,
            description: 'Auth0 Machine-to-Machine application client id.',
        },
        {
            displayName: 'Client Secret',
            name: 'clientSecret',
            type: 'string',
            typeOptions: { password: true },
            default: '',
            required: true,
            description: 'Auth0 Machine-to-Machine application client secret.',
        },
        {
            displayName: 'Audience',
            name: 'audience',
            type: 'string',
            default: 'https://approx.azurewebsites.net',
            description: 'Approx API audience configured in Auth0.',
        },
        {
            displayName: 'Base URL',
            name: 'baseUrl',
            type: 'string',
            default: 'https://approx.azurewebsites.net',
            description: 'Approx API base URL (no trailing slash).',
        },
        {
            displayName: 'Access Token',
            name: 'accessToken',
            type: 'hidden',
            typeOptions: { expirable: true },
            default: '',
        },
    ];

    async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject) {
        const response = (await this.helpers.httpRequest({
            method: 'POST',
            url: `https://${credentials.auth0Domain}/oauth/token`,
            body: {
                grant_type: 'client_credentials',
                client_id: credentials.clientId,
                client_secret: credentials.clientSecret,
                audience: credentials.audience,
            },
            json: true,
        })) as { access_token: string };

        return { accessToken: response.access_token };
    }

    authenticate: IAuthenticateGeneric = {
        type: 'generic',
        properties: {
            headers: {
                Authorization: '=Bearer {{$credentials.accessToken}}',
            },
        },
    };

    test: ICredentialTestRequest = {
        request: {
            method: 'GET',
            baseURL: '={{$credentials.baseUrl}}',
            url: '/api/integrations/projects',
            qs: { 'dqb.take': 1 },
        },
    };
}
