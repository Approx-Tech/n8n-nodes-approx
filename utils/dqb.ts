import type { IDataObject } from 'n8n-workflow';

/**
 * Builds the single `dqb` query-string parameter the Approx API expects for paginated endpoints.
 *
 * The API resolves DynamicQueryBuilder options from one parameter named `dqb` holding a complete
 * expression, e.g.
 *
 *   ?dqb=o%3DContains%26p%3DName%26v%3DTest%26s%3DName%2Casc%26offset%3D0%26count%3D50
 *
 * Shape, in the order emitted: filter triplets, then sort, then pagination.
 *
 *   o=<Operation>[|<LogicalOperator>]&p=<Property>&v=<Value>
 *
 * Earlier versions emitted `dqb.skip` / `dqb.take` / `dqb.orderBy` / `dqb.where`, which the
 * resolver never reads — so every list silently returned the default first page whatever the node
 * was set to. The shape below matches what the Approx web app sends.
 */

/** Maximum page size the Approx Integrations controllers accept. */
export const MAX_TAKE = 200;

/** Page size used when the workflow does not set one. Mirrors the Approx MCP server. */
export const DEFAULT_TAKE = 50;

/** The literal the API recognises as "no value". Case matters: NULL is not it. */
export const NULL_VALUE = 'null';

/** Sort directions the API understands. */
const DIRECTIONS = ['asc', 'desc'] as const;

/**
 * Comparison operations DynamicQueryBuilder supports.
 *
 * The collection operations Any and All are deliberately absent: the API accepts only one sub-query
 * per request holding exactly one inner filter, and mis-reads any value beginning with an opening
 * parenthesis as the start of one.
 */
export const DQB_OPERATIONS = [
	'Equals',
	'NotEqual',
	'Contains',
	'StartsWith',
	'EndsWith',
	'GreaterThan',
	'GreaterThanOrEqual',
	'LessThan',
	'LessThanOrEqual',
	'In',
] as const;

/**
 * How consecutive conditions combine.
 *
 * DynamicQueryBuilder's `None` member is deliberately absent — it parses, then throws a
 * KeyNotFoundException as soon as there is more than one filter.
 */
export const DQB_LOGICAL_OPERATORS = ['AndAlso', 'OrElse', 'And', 'Or', 'Xor'] as const;

const DEFAULT_LOGICAL_OPERATOR = 'AndAlso';

/** One filter condition, as the node's Filters collection produces it. */
export interface DqbFilter {
	property?: string;
	operation?: string;
	value?: string;
	logicalOperator?: string;
}

export interface DqbQueryOptions {
	skip?: number;
	take?: number;
	orderBy?: string;
	where?: string;
}

/**
 * @param options  the node's Query Options collection (skip / take / orderBy / where)
 * @param filters  the node's Filters collection, `{ condition: [...] }`
 */
export function buildDqbQuery(
	options: IDataObject = {},
	filters: IDataObject = {},
): IDataObject {
	const { skip, take, orderBy, where } = options as DqbQueryOptions;

	const conditions = (filters?.condition as DqbFilter[] | undefined) ?? [];

	const parts: string[] = [];

	const filter = buildFilterExpression(where, conditions);
	if (filter) parts.push(filter);

	const sort = buildSortExpression(orderBy);
	if (sort) parts.push(sort);

	// Both are always emitted, never conditionally. If either is missing the API leaves its
	// PaginationOption null, applies neither Skip nor Take, and — the dangerous part — skips the
	// MaxPageSize clamp, returning the entire filtered set. A pricing library holds thousands of
	// rows, so an unpaged list is a slow request that looks like a hung workflow.
	parts.push(`offset=${Math.max(0, Number(skip) || 0)}`);
	parts.push(`count=${clampTake(take)}`);

	// Returned as a value, not a pre-encoded string: the HTTP layer percent-encodes the inner `=`
	// and `&` so they arrive as part of the `dqb` value rather than as sibling parameters.
	return { dqb: parts.join('&') };
}

function clampTake(take?: number): number {
	if (take === undefined || take === null) return DEFAULT_TAKE;

	const parsed = Number(take);
	if (!Number.isFinite(parsed)) return DEFAULT_TAKE;

	return Math.min(MAX_TAKE, Math.max(1, Math.trunc(parsed)));
}

/**
 * Accepts `Name`, `Name asc` or `Name,desc` and emits `s=Name,asc`.
 *
 * An unrecognised direction is rejected rather than quietly treated as ascending: silently sorting
 * the wrong way is harder to notice than an error, and the workflow author gets no hint that the
 * value was ignored.
 *
 * The three-token form the API also accepts (`Name,desc,cs`) is never emitted: it silently discards
 * the direction and sorts ascending.
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
 * Emits one `o=`/`p=`/`v=` triplet per condition.
 *
 * The logical operator attaches to the operation of the condition it joins *from*, and the API
 * folds strictly left to right with no precedence: the operator on condition i joins the
 * accumulated expression to condition i+1. So `A|OrElse, B|AndAlso, C` evaluates as `(A or B) and
 * C`. The last condition's operator is never read, so it is not emitted — and emitting `|None`
 * there would throw a KeyNotFoundException server-side.
 *
 * Conditions from the structured Filters collection are appended after any from the legacy Where
 * string, so a workflow migrating from one to the other keeps working while it does so.
 */
function buildFilterExpression(where: string | undefined, conditions: DqbFilter[]): string | undefined {
	const trimmed = where?.trim();

	// An expression that *starts with* `o=` is passed through untouched, for cases the shorthand
	// does not cover. Matching on a leading `o=` rather than anywhere in the string matters: an
	// ordinary shorthand value such as `Name|Contains|foo=bar` contains `o=` inside `foo=bar`.
	if (trimmed?.startsWith('o=')) {
		if (conditions.length > 0) {
			// Joining them would mean rewriting the raw expression's final operation, which we
			// cannot do without parsing a grammar this node deliberately does not implement.
			throw new Error(
				'Where holds a raw DQB expression and Filters also has conditions. Use one or the other: ' +
					'move the raw expression into Filters, or clear Filters.',
			);
		}

		return trimmed;
	}

	const all = [...parseWhere(trimmed), ...conditions.map(normalise)];
	if (all.length === 0) return undefined;

	return all
		.flatMap((condition, index) => {
			// The logical operator joins this condition to the next, so the last one carries none.
			const logical =
				index < all.length - 1 ? `|${condition.logicalOperator ?? DEFAULT_LOGICAL_OPERATOR}` : '';

			return [
				`o=${condition.operation}${logical}`,
				`p=${encodeDqb(condition.property)}`,
				`v=${encodeValue(condition.value)}`,
			];
		})
		.join('&');
}

interface ResolvedFilter {
	property: string;
	operation: string;
	value: string;
	logicalOperator?: string;
}

function normalise(condition: DqbFilter, index: number): ResolvedFilter {
	const property = condition.property?.trim();
	const operation = condition.operation?.trim();

	if (!property || !operation) {
		throw new Error(
			`Filter ${index + 1} is missing its property or operation. ` +
				`Operations are ${DQB_OPERATIONS.join(', ')}.`,
		);
	}

	return {
		property,
		operation,
		value: condition.value ?? '',
		logicalOperator: condition.logicalOperator?.trim() || undefined,
	};
}

/**
 * Parses the legacy Where shorthand: `Property|Operation|Value`, several separated by `;`.
 *
 * Kept for workflows built before the structured Filters collection existed. It cannot express a
 * logical operator, so its conditions always combine with the default.
 */
function parseWhere(where?: string): ResolvedFilter[] {
	if (!where) return [];

	return where
		.split(';')
		.map((clause) => clause.trim())
		.filter(Boolean)
		.map((clause) => {
			const [property, operation, ...rest] = clause.split('|');

			if (!property?.trim() || !operation?.trim()) {
				throw new Error(
					`Invalid Where expression "${clause}". Expected Property|Operation|Value, for example Name|Contains|foo. ` +
						`Operations include ${DQB_OPERATIONS.join(', ')}.`,
				);
			}

			return {
				property: property.trim(),
				operation: operation.trim(),
				value: rest.join('|'),
			};
		});
}

/** Percent-encodes a value, leaving the `null` sentinel alone so it stays recognisable. */
function encodeValue(value: string): string {
	return value === NULL_VALUE ? NULL_VALUE : encodeDqb(value);
}

/**
 * Percent-encodes a property name or value for the *inner* expression.
 *
 * The API decodes these after decoding the outer `dqb` parameter, so a value containing `&` or `=`
 * would otherwise be read as another DQB field: `R&D` arrives as `v=R` plus a stray `D`. Confirmed
 * against the deployed API, where a value sent as `%2520` matched a record containing a space.
 *
 * encodeURIComponent covers that but leaves parentheses alone, and the API scans for `v=(` and
 * treats everything to the last `)` as an Any/All sub-query — so a value that merely starts with
 * one is mis-parsed. They are escaped explicitly.
 */
function encodeDqb(value: string): string {
	return encodeURIComponent(value).replace(/\(/g, '%28').replace(/\)/g, '%29');
}
