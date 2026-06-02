# Changelog

All notable changes to `@approx-tech/n8n-nodes-approx` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
