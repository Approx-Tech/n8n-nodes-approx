# @approx-tech/n8n-nodes-approx

[![npm version](https://img.shields.io/npm/v/@approx-tech/n8n-nodes-approx.svg)](https://www.npmjs.com/package/@approx-tech/n8n-nodes-approx)

n8n community node for [Approx](https://approx.one) — automate construction
cost-estimation and quantity-takeoff workflows.

> **Heads-up — breaking change in 0.5.0:** the five previous nodes
> (`Approx Project`, `Approx Report`, `Approx Unit Price`, `Approx Authority`,
> `Approx Template`) have been consolidated into a **single `Approx` node**.
> Every former node is now a **Resource** inside that node. The credential has
> also been renamed (`approxApi` → `approxOAuth2Api`) and now uses n8n's
> built-in OAuth2 client-credentials flow. See [Migrating from 0.4.x](#migrating-from-04x).

---

## Contents

- [Install](#install)
- [Credentials](#credentials)
- [Resources and operations](#resources-and-operations)
- [Usage example: list projects, generate a report, download the ZIP](#usage-example-list-projects-generate-a-report-download-the-zip)
- [Sample success outputs](#sample-success-outputs)
- [Migrating from 0.4.x](#migrating-from-04x)
- [License](#license)
- [Support](#support)

---

## Install

### Self-hosted n8n

In the n8n UI go to **Settings → Community Nodes → Install**, enter:

```
@approx-tech/n8n-nodes-approx
```

…and click **Install**. Restart n8n if it doesn't reload automatically.

Or from the host shell:

```bash
npm install @approx-tech/n8n-nodes-approx
```

### n8n Cloud

The package will appear in the verified community catalogue once approved.

---

## Credentials

Approx authenticates with Auth0 **Machine-to-Machine** (client-credentials)
tokens. Ask your Approx contact for a `client_id`/`client_secret` issued by the
Approx Auth0 tenant.

In n8n: **Credentials → New → Approx OAuth2 API**.

| Field | Required | Default | Description |
| --- | :---: | --- | --- |
| Client ID | ✅ | — | Auth0 M2M application client id (inherited from OAuth2 API). |
| Client Secret | ✅ | — | Auth0 M2M application client secret (inherited from OAuth2 API). |
| Auth0 Domain | ✅ | `auth.approx.cloud` | Approx Auth0 tenant domain (no protocol). |
| Audience | ✅ | `https://approx.azurewebsites.net` | API audience configured in Auth0. Sent as `audience` in the token request body. |
| Base URL | ✅ | `https://approx.azurewebsites.net` | Approx API base URL (no trailing slash). |

n8n handles fetching, caching and refreshing the bearer token — there is no
custom token code in this package. Click **Save**: n8n will issue a test
request to `GET /api/integrations/projects?dqb.take=1` and confirm the
credential works.

---

## Resources and operations

Every former node is now a **Resource** on the single `Approx` node. Choose the
resource, then the operation, then fill in the parameters.

| Resource | Operations | Approx API endpoint(s) |
| --- | --- | --- |
| **Authority** | Get Many, Get, Create, Update Name, Update Logo, Delete | `/api/integrations/authorities[/{id}[/name\|logo]]` |
| **File** | Download | `GET /api/integrations/files/{blobId}/download` |
| **Original File** | Get Many, Upload Many, Delete | `/api/integrations/projects/{projectId}/original-files[:bulk\|/{id}]` |
| **Pricing** | Get Many | `GET /api/integrations/pricing/libraries/{libraryId}/pricings` |
| **Pricing Library** | Get Many | `GET /api/integrations/pricing/libraries` |
| **Project** | Get Many, Get, Create, Update, Delete | `/api/integrations/projects[/{id}]` |
| **Property** | Get Many, Get, Create, Create Many, Update Name, Update Multiplier, Delete | `/api/integrations/projects/{projectId}/properties[…]` |
| **Property Type** | Get by Takeoff Template, Get by Project | `/api/integrations/templates/{takeoff/{id}\|projects/{id}}/property-types` |
| **Report** | Create, Get, Download | `/api/integrations/reports[/{id}[/download]]` |
| **Report Template** | Get Many | `GET /api/integrations/templates/takeoff/{id}/report-templates` |
| **Static File** | Get Many, Upload Many, Delete | `/api/integrations/projects/{projectId}/static-files[:bulk\|/{id}]` |
| **Takeoff Template** | Get Many, Get | `/api/integrations/templates/takeoff[/{id}]` |
| **Work Group Type** | Get Many | `GET /api/integrations/projects/{projectId}/work-group-types` |

List endpoints accept the optional **Query Options** collection
(`Skip`, `Take`, `Order By`, `Where`) which is mapped to the standard Approx
DQB query string (`dqb.skip`, `dqb.take`, `dqb.orderBy`, `dqb.where`).

---

## Usage example: list projects, generate a report, download the ZIP

The workflow below walks the three most common Approx operations end-to-end:

1. **Approx (Project: Get Many)** — fetch the first 5 projects.
2. **Approx (Report: Create)** — queue a report for the first returned project.
3. **Wait** — give the report queue ~30 s to finish.
4. **Approx (Report: Download)** — download the generated ZIP into a binary
   field called `report`.

### Step-by-step (manual setup)

1. Add a **Manual Trigger**.
2. Add an **Approx** node:
   - Credential: select your **Approx OAuth2 API** credential
   - Resource: `Project`
   - Operation: `Get Many`
   - Query Options → Take: `5`
3. Add another **Approx** node:
   - Resource: `Report`
   - Operation: `Create`
   - Project ID: `={{ $json.id }}` (expression — picks the id from the first node)
4. Add a **Wait** node — `30 seconds` (Approx reports usually finish in
   seconds; for big projects use the Report → `Get` operation in a loop with
   `If status === "Completed"` instead).
5. Add a third **Approx** node:
   - Resource: `Report`
   - Operation: `Download`
   - Report ID: `={{ $json.id }}`
   - Put Output File in Field: `report`

Execute the workflow. The last node's output will contain `binary.report`
holding the report ZIP, ready to be written to disk, uploaded to S3, sent over
email, etc.

### Importable workflow JSON

Copy the snippet below and in n8n press **Ctrl/Cmd + V** on an empty canvas
(or use **Import from Clipboard**). Replace `REPLACE_WITH_CREDENTIAL_ID` with
the id n8n assigns to your saved Approx OAuth2 API credential.

```json
{
  "name": "Approx — generate and download a report",
  "nodes": [
    {
      "parameters": {},
      "id": "1",
      "name": "When clicking 'Test workflow'",
      "type": "n8n-nodes-base.manualTrigger",
      "typeVersion": 1,
      "position": [240, 300]
    },
    {
      "parameters": {
        "resource": "project",
        "operation": "getMany",
        "queryOptions": { "take": 5 }
      },
      "id": "2",
      "name": "List 5 projects",
      "type": "@approx-tech/n8n-nodes-approx.approx",
      "typeVersion": 1,
      "position": [480, 300],
      "credentials": {
        "approxOAuth2Api": {
          "id": "REPLACE_WITH_CREDENTIAL_ID",
          "name": "Approx OAuth2 API"
        }
      }
    },
    {
      "parameters": {
        "resource": "report",
        "operation": "create",
        "projectId": "={{ $json.id }}"
      },
      "id": "3",
      "name": "Queue report",
      "type": "@approx-tech/n8n-nodes-approx.approx",
      "typeVersion": 1,
      "position": [720, 300],
      "credentials": {
        "approxOAuth2Api": {
          "id": "REPLACE_WITH_CREDENTIAL_ID",
          "name": "Approx OAuth2 API"
        }
      }
    },
    {
      "parameters": { "amount": 30, "unit": "seconds" },
      "id": "4",
      "name": "Wait 30s",
      "type": "n8n-nodes-base.wait",
      "typeVersion": 1,
      "position": [960, 300]
    },
    {
      "parameters": {
        "resource": "report",
        "operation": "download",
        "reportId": "={{ $json.id }}",
        "binaryPropertyName": "report"
      },
      "id": "5",
      "name": "Download report ZIP",
      "type": "@approx-tech/n8n-nodes-approx.approx",
      "typeVersion": 1,
      "position": [1200, 300],
      "credentials": {
        "approxOAuth2Api": {
          "id": "REPLACE_WITH_CREDENTIAL_ID",
          "name": "Approx OAuth2 API"
        }
      }
    }
  ],
  "connections": {
    "When clicking 'Test workflow'": {
      "main": [[{ "node": "List 5 projects", "type": "main", "index": 0 }]]
    },
    "List 5 projects": {
      "main": [[{ "node": "Queue report", "type": "main", "index": 0 }]]
    },
    "Queue report": {
      "main": [[{ "node": "Wait 30s", "type": "main", "index": 0 }]]
    },
    "Wait 30s": {
      "main": [[{ "node": "Download report ZIP", "type": "main", "index": 0 }]]
    }
  }
}
```

---

## Sample success outputs

### `Project: Get Many` (trimmed to one item)

```json
{
  "id": "6d3a1f7e-1c2b-4f4c-9a7d-2b8d9d2f8a3e",
  "name": "Demo Villa — Antalya",
  "authorityId": "0b8e5d59-3f72-4d4a-9e0d-4f7e6f1c2a91",
  "takeoffTemplateId": "b3d20b6c-7d6f-4f02-9c54-3c1c1c5a4e22",
  "reportTemplateId": "f1b9c8e0-aa11-4af0-9c5d-5a2f3b4c6d70",
  "carriagePercentage": 0.04,
  "expandCustomPricings": false,
  "createdAt": "2026-05-21T08:14:33Z",
  "updatedAt": "2026-05-30T14:02:11Z"
}
```

### `Project: Create`

```json
{
  "id": "8f9a2b1c-aa00-4bbb-8e9c-1234567890ab",
  "name": "New Office Block — Istanbul",
  "authorityId": "0b8e5d59-3f72-4d4a-9e0d-4f7e6f1c2a91",
  "takeoffTemplateId": "b3d20b6c-7d6f-4f02-9c54-3c1c1c5a4e22",
  "reportTemplateId": "f1b9c8e0-aa11-4af0-9c5d-5a2f3b4c6d70",
  "carriagePercentage": 0.04,
  "expandCustomPricings": false
}
```

### `Report: Create`

```json
{
  "id": "c7a4b6d2-9e1f-4c83-bd6e-7a8d9f0b1c23",
  "projectId": "6d3a1f7e-1c2b-4f4c-9a7d-2b8d9d2f8a3e",
  "status": "Queued",
  "createdAt": "2026-06-02T16:18:00Z"
}
```

### `Report: Get` (polled later)

```json
{
  "id": "c7a4b6d2-9e1f-4c83-bd6e-7a8d9f0b1c23",
  "projectId": "6d3a1f7e-1c2b-4f4c-9a7d-2b8d9d2f8a3e",
  "status": "Completed",
  "createdAt": "2026-06-02T16:18:00Z",
  "completedAt": "2026-06-02T16:18:22Z"
}
```

### `Report: Download`

```json
{
  "reportId": "c7a4b6d2-9e1f-4c83-bd6e-7a8d9f0b1c23",
  "filename": "report-c7a4b6d2-9e1f-4c83-bd6e-7a8d9f0b1c23.zip",
  "mimeType": "application/zip"
}
```

…plus a `binary.report` field containing the actual ZIP bytes (default field
name; configurable via **Put Output File in Field**).

### `Pricing Library: Get Many` (one item)

```json
{
  "id": "lib-2025-istanbul",
  "name": "İBB 2025 Birim Fiyat Listesi",
  "authorityId": "0b8e5d59-3f72-4d4a-9e0d-4f7e6f1c2a91",
  "culture": "tr-TR"
}
```

### `Authority: Get Many` (one item)

```json
{
  "id": "0b8e5d59-3f72-4d4a-9e0d-4f7e6f1c2a91",
  "name": "Çevre, Şehircilik ve İklim Değişikliği Bakanlığı",
  "createdAt": "2025-01-12T10:00:00Z"
}
```

### `Takeoff Template: Get Many` (one item)

```json
{
  "id": "b3d20b6c-7d6f-4f02-9c54-3c1c1c5a4e22",
  "name": "Konut — Standart Şablon",
  "culture": "tr-TR",
  "version": 3
}
```

---

## Migrating from 0.4.x

Two breaking changes ship in 0.5.0; both are required to pass n8n community
verification.

### 1. One node instead of five

The previous five nodes are gone:

| Old node | New resource (on the single `Approx` node) |
| --- | --- |
| Approx Project | `Project`, `Property`, `Work Group Type`, `Original File`, `Static File`, `File` |
| Approx Report | `Report` |
| Approx Unit Price | `Pricing`, `Pricing Library` |
| Approx Authority | `Authority` |
| Approx Template | `Takeoff Template`, `Report Template`, `Property Type` |

In existing workflows, **delete the old node and add the new `Approx` node** in
its place — the operation names and parameter names are unchanged, so you can
copy values straight across.

### 2. Credential renamed and rewired to built-in OAuth2

The credential class is now `ApproxOAuth2Api` (internal name
`approxOAuth2Api`). n8n's built-in OAuth2 client-credentials grant is used —
no custom token code lives in this package any more.

**You must recreate the credential** (n8n cannot migrate between credential
types). Create a new **Approx OAuth2 API** credential with the same
`Client ID`, `Client Secret`, `Auth0 Domain`, `Audience` and `Base URL`
values, then re-pick it on each `Approx` node.

---

## License

[MIT](LICENSE).

## Support

- Issues: <https://github.com/Approx-Tech/n8n-nodes-approx/issues>
- Approx product: <https://approx.one>
