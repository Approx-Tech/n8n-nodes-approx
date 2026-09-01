import type { IDataObject } from 'n8n-workflow';

/**
 * Builds the single `dqb` query-string parameter the Approx API expects for paginated endpoints.
 *
 * The API resolves DynamicQueryBuilder options from one parameter named `dqb` holding a complete
 * expression, e.g.
 *
 *   ?dqb=offset%3D0%26count%3D50%26s%3DName%2Casc
 *
 * Earlier versions emitted `dqb.skip` / `dqb.take` / `dqb.orderBy` / `dqb.where`, which the
 * resolver never reads — so every list silently returned the default first page whatever the node
 * was set to. The shape below matches what the Approx web app sends.
 */

/** Maximum page size the Approx Integrations controllers accept. */
export const MAX_TAKE = 200;

/** Sort directions the API understands. */
const DIRECTIONS = ['asc', 'desc'] as const;

/**
 * Operations DynamicQueryBuilder supports, for error messages. Not used to reject unknown values —
 * the API is the authority on what it accepts, and a hard-coded list here would age badly.
 */
const KNOWN_OPERATIONS = [
	'Equals',
	'NotEqual',
	'Contains',
	'StartsWith',
	'EndsWith',
	'In',
	'GreaterThan',
	'GreaterThanOrEqual',
	'LessThan',
	'LessThanOrEqual',
];

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

	// Returned as a value, not a pre-encoded string: the HTTP layer percent-encodes the inner `=`
	// and `&` so they arrive as part of the `dqb` value rather than as sibling parameters.
	return parts.length > 0 ? { dqb: parts.join('&') } : {};
}

/**
 * Accepts `Name`, `Name asc` or `Name,desc` and emits `s=Name,asc`.
 *
 * An unrecognised direction is rejected rather than quietly treated as ascending: silently sorting
 * the wrong way is harder to notice than an error, and the workflow author gets no hint that the
 * value was ignored.
 */
function buildSortExpression(orderBy?: string): string | undefined {
	if (!orderBy?.trim()) return undefined;

	const tokens = orderBy.trim().split(/[\s,]+/).filter(Boolean);

	if (tokens.length > 2) {
		throw new Error(
			`Invalid Order By expression "${orderBy}". Expected a property optionally followed by asc or desc, for example "Name desc".`,
		);
	}

	const property = tokens[0];
	if (!property) return undefined;

	const direction = tokens[1];
	const resolved = (direction ?? 'asc').toLowerCase();

	if (!DIRECTIONS.includes(resolved as (typeof DIRECTIONS)[number])) {
		throw new Error(
			`Invalid sort direction "${direction}" in Order By expression "${orderBy}". Use asc or desc.`,
		);
	}

	return `s=${encodeDqb(property)},${resolved}`;
}

/**
 * Accepts `Property|Operation|Value`, several separated by `;`, and emits the repeated
 * `o=`/`p=`/`v=` triples DynamicQueryBuilder expects. Multiple filters are combined with `And`.
 *
 * An expression that *starts with* `o=` is passed through untouched, for cases this shorthand does
 * not cover. Matching on a leading `o=` rather than anywhere in the string matters: a perfectly
 * ordinary shorthand value such as `Name|Contains|foo=bar` contains `o=` inside `foo=bar`.
 */
function buildFilterExpression(where?: string): string | undefined {
	const trimmed = where?.trim();
	if (!trimmed) return undefined;

	if (trimmed.startsWith('o=')) return trimmed;

	const clauses = trimmed
		.split(';')
		.map((clause) => clause.trim())
		.filter(Boolean);

	const triples: string[] = [];

	clauses.forEach((clause, index) => {
		const [property, operation, ...rest] = clause.split('|');
		const value = rest.join('|');

		if (!property?.trim() || !operation?.trim()) {
			throw new Error(
				`Invalid Where expression "${clause}". Expected Property|Operation|Value, for example Name|Contains|foo. ` +
					`Operations include ${KNOWN_OPERATIONS.join(', ')}.`,
			);
		}

		// The logical operator joins this clause to the next, so the last one carries none.
		const logical = index < clauses.length - 1 ? '|And' : '';

		triples.push(
			`o=${operation.trim()}${logical}`,
			`p=${encodeDqb(property.trim())}`,
			`v=${encodeDqb(value)}`,
		);
	});

	return triples.length > 0 ? triples.join('&') : undefined;
}

/**
 * Percent-encodes a property name or value for the *inner* expression.
 *
 * The API decodes these after decoding the outer `dqb` parameter, so a value containing `&` or `=`
 * would otherwise be read as another DQB field: `R&D` arrives as `v=R` plus a stray `D`. Confirmed
 * against the deployed API, where a value sent as `%2520` matched a record containing a space.
 */
function encodeDqb(value: string): string {
	return encodeURIComponent(value);
}
