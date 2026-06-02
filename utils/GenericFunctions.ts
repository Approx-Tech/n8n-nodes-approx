import {
    IDataObject,
    IExecuteFunctions,
    IHttpRequestMethods,
    IHttpRequestOptions,
    ILoadOptionsFunctions,
    JsonObject,
    NodeApiError,
} from 'n8n-workflow';

interface ApproxCredentials {
    baseUrl: string;
}

interface ErrorEnvelope {
    Errors?: Array<{ ErrorEN?: string; ErrorTR?: string }>;
    errors?: Array<{ ErrorEN?: string; ErrorTR?: string }>;
}

function buildErrorMessage(body: unknown): string | undefined {
    const env = body as ErrorEnvelope | undefined;
    const list = env?.Errors ?? env?.errors;
    if (!list?.length) return undefined;
    return list
        .map((e) => e.ErrorEN ?? e.ErrorTR)
        .filter((v): v is string => Boolean(v))
        .join('; ');
}

/**
 * Approx Integrations API request helper. Use for every call against /api/integrations/*.
 */
export async function approxApiRequest(
    this: IExecuteFunctions | ILoadOptionsFunctions,
    method: IHttpRequestMethods,
    endpoint: string,
    body: IDataObject | Buffer | undefined = undefined,
    qs: IDataObject = {},
    extraOptions: Partial<IHttpRequestOptions> = {},
): Promise<any> {
    const credentials = (await this.getCredentials('approxApi')) as unknown as ApproxCredentials;

    const options: IHttpRequestOptions = {
        method,
        url: `${credentials.baseUrl.replace(/\/$/, '')}${endpoint}`,
        qs,
        json: true,
        ...extraOptions,
    };

    if (body !== undefined) {
        options.body = body as IDataObject;
    }

    try {
        return await this.helpers.httpRequestWithAuthentication.call(this, 'approxApi', options);
    } catch (error) {
        const message = buildErrorMessage((error as { response?: { body?: unknown } }).response?.body);
        if (message) {
            throw new NodeApiError(this.getNode(), error as JsonObject, { message });
        }
        throw error;
    }
}

/**
 * Maps Approx DQB envelope `{ data, count }` to `{ items, totalCount }` if needed,
 * but most controllers already return `{ items, totalCount }`.
 */
export function unwrapList(payload: any): { items: any[]; totalCount: number } {
    if (Array.isArray(payload)) return { items: payload, totalCount: payload.length };
    const items = payload.items ?? payload.Data ?? payload.data ?? [];
    const totalCount = payload.totalCount ?? payload.Count ?? payload.count ?? items.length;
    return { items, totalCount };
}

/**
 * Builds the dqb.* query-string fragment from a flat options object.
 */
export function buildDqbQuery(options: IDataObject = {}): IDataObject {
    const qs: IDataObject = {};
    const { skip, take, orderBy, where } = options as {
        skip?: number;
        take?: number;
        orderBy?: string;
        where?: string;
    };
    if (skip !== undefined && skip !== null) qs['dqb.skip'] = skip;
    if (take !== undefined && take !== null) qs['dqb.take'] = take;
    if (orderBy) qs['dqb.orderBy'] = orderBy;
    if (where) qs['dqb.where'] = where;
    return qs;
}
