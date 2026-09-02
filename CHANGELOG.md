# Changelog

All notable changes to `@approx-tech/n8n-nodes-approx` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.0] - 2026-09-02

Brings the node's filtering up to what the Approx MCP server already does, so the same query can be
expressed in either.

### Added

- **Filters collection** on Project, Property, Pricing Library and Pricing — Get Many. Each
  condition is a Property (picked from the properties that endpoint actually exposes), an Operation,
  a Value and a Logical Operator, instead of the `Name|Contains|foo` text form.
  - All ten operations are selectable: `Equals`, `Not Equal`, `Contains`, `Starts With`,
    `Ends With`, `Greater Than`, `Greater Than Or Equal`, `Less Than`, `Less Than Or Equal`, `In`.
  - Conditions can be joined with `And Also`, `Or Else`, `And`, `Or` or `Xor`. Previously every
    condition was joined with `And` and there was no way to say otherwise. They combine left to
    right with no grouping, so `A Or Else`, `B And Also`, `C` means `(A or B) and C`; the operator
    on the last condition is ignored. (DynamicQueryBuilder's `None` is deliberately not offered — it
    parses, then throws server-side as soon as there is more than one condition.)
  - The literal `null` is passed through unencoded so it keeps testing for no value.

### Fixed

- **Values containing parentheses no longer break the query.** `encodeURIComponent` leaves `(` and
  `)` alone, and the API reads a value starting with `(` as the beginning of an `Any`/`All`
  sub-query — so filtering on a name like `(eski) Blok A` silently matched nothing. They are now
  escaped explicitly.
- **`offset` and `count` are always sent.** Omitting either left the API applying neither Skip nor
  Take *and* skipping its own 200-row page cap, returning the entire filtered set — slow enough on a
  pricing library to look like a hung workflow. A list with no Take now asks for 50.

### Changed

- **A Get Many with no Take set now returns 50 rows rather than everything.** That is the fix above,
  and the reason this is a minor rather than a patch.
- **Where** is now documented as the older form of Filters. It still works unchanged, and its
  conditions are combined with any structured Filters on the same node. Pairing a raw `o=...`
  expression with Filters is refused rather than silently producing a malformed query, because
  joining them would mean rewriting the raw expression's final operation.

## [0.7.0] - 2026-09-01

### Fixed

- **Query Options now reach the API.** `Skip`, `Take`, `Order By` and `Where` were sent as `dqb.skip` / `dqb.take` / `dqb.orderBy` / `dqb.where`, but the Approx API resolves DynamicQueryBuilder options from a **single** parameter named `dqb` holding a complete expression. The four were therefore never read, and every list silently returned the default first page whatever the node was set to. They are now built into one `dqb` value matching what the Approx web app sends, e.g. `?dqb=offset%3D0%26count%3D50%26s%3DName%2Casc`.
  - `Order By` accepts `Property`, `Property asc` or `Property,desc`.
  - `Where` accepts `Property|Operation|Value`, several separated by `;` and combined with `And`; a value already containing `o=` is passed through as a raw DQB expression. An unparseable expression now fails with a message naming the clause instead of being dropped.
  - `Take` is clamped to the 200 the API accepts, and `Skip` to zero or more.
  - The credential test used `dqb.take=1` for the same reason and fetched a full page; it now asks for one item.

  - Property names and values are percent-encoded inside the expression before the whole thing is encoded again as the `dqb` parameter. Without that inner layer a value containing `&` or `=` is read as another DQB field: `Name|Equals|Test Project` sent unencoded arrives as `v=Test` and matches nothing. Verified against the API, where the encoded form matches and the unencoded form returns an empty list.
  - An `Order By` direction other than `asc` or `desc` is rejected instead of being silently treated as ascending, which is harder to notice than an error.
  - A raw DQB expression is now recognised by a leading `o=` rather than `o=` anywhere in the value, so ordinary shorthand such as `Name|Contains|foo=bar` is no longer mistaken for one.

### Changed

- **Workflows that set paging will behave differently**, because it previously had no effect. A workflow relying on always receiving the first page may now receive a different one. Minor rather than patch for that reason.
- The DQB builder moved to `utils/dqb.ts`; `utils/GenericFunctions.ts` re-exports it, so existing imports are unaffected.


## [0.6.2] - 2026-08-29

### Fixed

- **Readable access-denied errors.** The Integrations API is gated by the `integrations:*` Auth0 permissions, which only organization (Workplace) accounts hold — a free account with no organization is refused with a bare `403` and no response body, which n8n rendered as the generic "Forbidden - perhaps check your credentials?". The node now explains the real cause for both `403` and `401`.
  - The credential test declares `responseCode` rules, so an unusable credential fails at **connect** time instead of on the first workflow run.
  - `approxApiRequest` reads Approx's `Errors[].ErrorEN/ErrorTR` envelope from every shape n8n can surface it in (`response.body`, `response.data`, either nested under `cause`), and falls back to an explanatory message when the response carries no body.
  - Errors already resolved into a `NodeApiError` are no longer re-wrapped in the node's `execute` catch, which could replace the resolved message with n8n's generic status-code text.

### Documentation

- README states up front that these nodes require a Workplace (organization) account, and what a `403` on the credential test means.

## [0.6.1] - 2026-08-15

### Fixed (community-verification / lint compliance)

- **`pairedItem` on all outputs.** Every returned `INodeExecutionData` object now includes `pairedItem: { item: i }` so n8n can link output items to their source input items, keeping expression references working in downstream nodes.
- **Credential icon.** `ApproxOAuth2Api` now declares an `icon` (new `credentials/approx.svg`, copied to `dist` via gulp), satisfying the requirement that every credential class define an icon.
- **`usableAsTool`.** The `Approx` node now sets `usableAsTool: true`, enabling it for use as an AI tool.
- **Error wrapping.** Raw re-thrown errors are now wrapped in `NodeApiError` so n8n formats API errors correctly in the UI.
- **Themed icons.** Node and credential icons use the `{ light, dark }` form to render correctly on both themes.

### Tooling

- Added a `scan` script (`npx @n8n/node-cli lint`) and wired it into `prepublishOnly` to catch the newer `@n8n/community-nodes` lint rules before publishing.

## [0.6.0] - 2026-08-13

### ⚠ Breaking changes

- **Report endpoints renamed on the Approx backend.** The `Report` resource now calls `/api/integrations/takeoff-reports` (create / get / download), and the `Report Template` resource now calls `/api/integrations/templates/takeoff/{id}/takeoff-report-templates`. This matches the backend renaming its report domain to `TakeoffReport*`. Node `Resource`/`Operation` values are unchanged, so existing workflows continue to work after upgrading — **but this version requires the updated Approx backend** (older backends still expose the old `/reports` paths).

## [0.5.0] - 2026-06-02

### ⚠ Breaking changes (community-verification fixes)

- **Consolidated 5 nodes into a single `Approx` node**. The previous `Approx Project`, `Approx Report`, `Approx Unit Price`, `Approx Authority` and `Approx Template` nodes are removed. Every former node is now a `Resource` on the new node (`Project`, `Property`, `Work Group Type`, `Original File`, `Static File`, `File`, `Report`, `Pricing`, `Pricing Library`, `Authority`, `Takeoff Template`, `Report Template`, `Property Type`). Operation and parameter names are unchanged, so values can be copied straight across — but you must replace each old node with the new `Approx` node in existing workflows. This satisfies the n8n community guideline of one regular node per package.
- **Credential rewritten on top of n8n's built-in OAuth2.** The custom `ApproxApi` credential (which manually POSTed to `/oauth/token` from `preAuthentication` and stored an `accessToken` in a hidden field) has been replaced by `ApproxOAuth2Api` (internal name `approxOAuth2Api`) which `extends ['oAuth2Api']` with `grantType: 'clientCredentials'`. The Auth0 `audience` is injected into the token-request body via the standard `additionalBodyProperties` hidden field. n8n now handles fetching, caching and refreshing the bearer token — there is no token code in this package. **Recreate the credential** with the same `Client ID`, `Client Secret`, `Auth0 Domain`, `Audience` and `Base URL` values, then re-pick it on each `Approx` node.

### Documentation

- **README**: rewritten with a Resources/Operations table, a complete usage example (Manual Trigger → list projects → queue report → wait → download ZIP), an importable workflow JSON snippet, sample success outputs for the most common operations, and a "Migrating from 0.4.x" section.

## [0.4.1] - 2026-06-02

- **README**: drop stale "scaffold (pre-0.1.0)" banner and broken link to the internal planning doc; document the `Approx Authority` and `Approx Template` nodes added in 0.4.0; remove the obsolete `organizationId` credential field.

## [0.4.0] - 2026-06-03

- **New node — Approx Authority**: full CRUD for pricing authorities (`Get Many`, `Get`, `Create`, `Update Name`, `Update Logo`, `Delete`). Backed by new `/api/integrations/authorities` endpoints gated by `integrations:authorities:read` / `integrations:authorities:write` permissions.
- **New node — Approx Template**: query-only access to takeoff templates, report templates, and property-type trees. Resources: `Takeoff Template` (`Get Many`, `Get`), `Report Template` (`Get Many` by takeoff-template ID), `Property Type` (`Get By Takeoff Template`, `Get By Project`). Backed by new `/api/integrations/templates/*` endpoints gated by `integrations:templates:read`.
- These nodes unblock create/update flows by letting workflows discover the GUIDs they need (Authority, Takeoff Template, Report Template, Property Type) without hand-copying them from the Approx UI.

## [0.3.0] - 2026-06-02

- **Project → Create**: surface `Report Template ID`, `Carriage Percentage`, and `Expand Custom Pricings` as top-level required/standard fields instead of hiding them in “Additional Fields” (backend rejected creates without `ReportTemplateID`).
- **Project → Update**: replace the “Additional Fields” collection with explicit fields (`Project Name`, `Report Template ID`, `Carriage Percentage` are required; `Expand Custom Pricings` optional) to match `UpdateProjectCommandValidator`.
- **Property → Create**: take a `Property (JSON)` body that maps to the project’s takeoff-template Excel schema; fixes the request body shape (`{ property: { ... } }`) the backend expects.
- **Property → Create Many**: corrected the JSON template hint (`propertyTypeId` required; optional `name`, `code`; removed obsolete `parentPropertyId`).
- **Property → Update Multiplier**: enforce `minValue: 1` in the UI.
- **Unit Price → Pricing → Get Many**: promote `Valid From` and `Valid To` (YYYY-MM-DD) to required top-level fields (the backend route binds them as non-nullable `DateOnly`).

## [0.2.0] - 2026-06-02

- Move package to its own dedicated repository: `Approx-Tech/n8n-nodes-approx`.
- Update `repository`, `homepage`, `bugs`, and credential `documentationUrl` to the new repo.
- Switch release workflow tag scheme to `v*.*.*`.

## [0.1.4] - 2026-06-02

- Ship source `credentials/`, `nodes/`, `utils/` folders in the npm tarball alongside compiled `dist/` (helps Creator Portal locate the credential source file).

## [0.1.3] - 2026-06-02

- Update author URL to https://approx.one.

## [0.1.2] - 2026-06-02

- Add author email to package metadata (required by n8n Creator Portal).

## [0.1.1]

- Initial scaffold: repo structure, CI/release workflows, credential and node placeholders.
