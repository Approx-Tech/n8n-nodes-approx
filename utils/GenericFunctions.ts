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

/**
 * Access to the Integrations API is gated by the `integrations:*` Auth0 permissions, which are
 * only ever granted to organization (Workplace) accounts — a free account that belongs to no
 * organization holds none of them. That denial happens in the API's authorization middleware,
 * which answers with a bare 403 and **no body**, so there is nothing for `buildErrorMessage`
 * to read. These fallbacks turn it into something actionable instead of n8n's generic
 * "Forbidden - perhaps check your credentials?".
 */
const FORBIDDEN_FALLBACK =
    'Approx denied this request (403). The Approx Integrations API is available to Workplace (organization) accounts only — a free account that does not belong to an Approx organization cannot use these nodes. Ask your Approx administrator to confirm the application is linked to your organization and has been granted the required integrations:* permissions.';

const UNAUTHORIZED_FALLBACK =
    'Approx could not authenticate this request (401). Check the Client ID, Client Secret, Auth0 Domain and Audience on the Approx credential.';

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
 * Approx's error envelope can arrive under a few different keys depending on which n8n helper
 * surfaced the failure (`response.body` from n8n's own http helper, `response.data` when a raw
 * axios error escapes, either of those nested under `cause`), so check them all.
 */
function responseBodyOf(error: unknown): unknown {
    const e = error as {
        response?: { body?: unknown; data?: unknown };
        cause?: { response?: { body?: unknown; data?: unknown } };
    };
    return e?.response?.body ?? e?.response?.data ?? e?.cause?.response?.body ?? e?.cause?.response?.data;
}

function statusCodeOf(error: unknown): number | undefined {
    const e = error as {
        httpCode?: string | number | null;
        statusCode?: number;
        status?: number;
        response?: { status?: number; statusCode?: number };
        cause?: { response?: { status?: number }; statusCode?: number };
    };
    const raw =
        e?.response?.status ??
        e?.response?.statusCode ??
        e?.cause?.response?.status ??
        e?.statusCode ??
        e?.cause?.statusCode ??
        e?.status ??
        e?.httpCode;
    const parsed = typeof raw === 'string' ? Number(raw) : raw;
    return typeof parsed === 'number' && !Number.isNaN(parsed) ? parsed : undefined;
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
    const credentials = (await this.getCredentials('approxOAuth2Api')) as unknown as ApproxCredentials;

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
        return await this.helpers.httpRequestWithAuthentication.call(this, 'approxOAuth2Api', options);
    } catch (error) {
        const status = statusCodeOf(error);
        const message =
            buildErrorMessage(responseBodyOf(error)) ??
            (status === 403 ? FORBIDDEN_FALLBACK : status === 401 ? UNAUTHORIZED_FALLBACK : undefined);

        if (message) {
            throw new NodeApiError(this.getNode(), error as JsonObject, {
                message,
                httpCode: status === undefined ? undefined : String(status),
            });
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

/** Maximum page size the Approx Integrations controllers accept. */
const MAX_TAKE = 200;

/**
 * Builds the single `dqb` query-string parameter the Approx API expects.
 *
 * The API resolves DynamicQueryBuilder options from one parameter named `dqb` holding a complete
 * expression, e.g.
 *
 *   ?dqb=offset%3D0%26count%3D50%26s%3DName%2Casc
 *
 * Earlier versions emitted `dqb.skip` / `dqb.take` / `dqb.orderBy` / `dqb.where` instead, which the
 * resolver never reads — so every list silently returned the default first page regardless of the
 * options set on the node. The format below matches what the Approx web app sends.
 */
export function buildDqbQuery(options: IDataObject = {}): IDataObject {
    const { skip, take, orderBy, where } = options as {
        skip?: number;
        take?: number;
        orderBy?: string;
        where?: string;
    };

    const parts: string[] = [];

    const filter = buildFilterExpression(where);
    if (filter) parts.push(filter);

    if (skip !== undefined && skip !== null) parts.push(`offset=${Math.max(0, Number(skip) || 0)}`);

    if (take !== undefined && take !== null) {
        parts.push(`count=${Math.min(MAX_TAKE, Math.max(1, Number(take) || 1))}`);
    }

    const sort = buildSortExpression(orderBy);
    if (sort) parts.push(sort);

    // Returned as a value, not a pre-encoded string: the HTTP layer percent-encodes the inner
    // `=` and `&` so they arrive as part of the `dqb` value rather than as sibling parameters.
    return parts.length > 0 ? { dqb: parts.join('&') } : {};
}

/**
 * Accepts `Name`, `Name asc` or `Name,desc` and emits `s=Name,asc`.
 * Anything unparseable is dropped, leaving the endpoint's own default ordering in place.
 */
function buildSortExpression(orderBy?: string): string | undefined {
    if (!orderBy) return undefined;

    const [property, direction] = orderBy.trim().split(/[\s,]+/);
    if (!property) return undefined;

    const descending = (direction ?? '').toLowerCase().startsWith('desc');

    return `s=${property},${descending ? 'desc' : 'asc'}`;
}

/**
 * Accepts `Property|Operation|Value`, several separated by `;`, and emits the repeated
 * `o=`/`p=`/`v=` triples DynamicQueryBuilder expects. Multiple filters are combined with `And`.
 *
 * A value already containing `o=` is passed through untouched, so a raw expression can be supplied
 * for cases this shorthand does not cover.
 */
function buildFilterExpression(where?: string): string | undefined {
    if (!where) return undefined;

    const trimmed = where.trim();
    if (trimmed.length === 0) return undefined;
    if (trimmed.includes('o=')) return trimmed;

    const clauses = trimmed
        .split(';')
        .map((clause) => clause.trim())
        .filter((clause) => clause.length > 0);

    const triples: string[] = [];

    clauses.forEach((clause, index) => {
        const [property, operation, ...rest] = clause.split('|');
        const value = rest.join('|');

        if (!property?.trim() || !operation?.trim()) {
            throw new Error(
                `Invalid Where expression "${clause}". Expected Property|Operation|Value, ` +
                'for example Name|Contains|foo.',
            );
        }

        // The logical operator joins this clause to the next, so the last one carries none.
        const logical = index < clauses.length - 1 ? '|And' : '';

        triples.push(`o=${operation.trim()}${logical}`, `p=${property.trim()}`, `v=${value}`);
    });

    return triples.length > 0 ? triples.join('&') : undefined;
}
