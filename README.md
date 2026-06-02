# @approx-tech/n8n-nodes-approx

n8n community nodes for [Approx](https://approx.cloud) — automate construction cost-estimation and quantity-takeoff workflows.

## Install (self-hosted n8n)

```bash
npm install @approx-tech/n8n-nodes-approx
```

Then restart your n8n instance. For n8n Cloud, the package will appear in the community catalogue once verified.

## Credentials

Approx uses Auth0 Machine-to-Machine (M2M) tokens scoped to your Auth0 Organization. Contact Approx support for `client_id`, `client_secret`, and `org_id` (organization id).

The `ApproxApi` credential needs:

| Field | Description |
|---|---|
| `auth0Domain` | Your Auth0 tenant domain. Default: `auth.approx.cloud`. |
| `clientId` | M2M application client id. |
| `clientSecret` | M2M application client secret. |
| `audience` | API audience. Default: `https://approx.azurewebsites.net`. |
| `baseUrl` | Approx API base URL. Default: `https://approx.azurewebsites.net`. |

## Nodes

- **Approx Project** — projects, work-group types, properties, original/static files.
- **Approx Report** — generate, poll, and download project reports.
- **Approx Unit Price** — query pricing libraries and unit prices.
- **Approx Authority** — CRUD for pricing authorities (kurumlar).
- **Approx Template** — query takeoff templates, report templates, and property-type trees (lookup IDs needed by create operations).

## Data flow

- `client_id`, `client_secret`, `audience` → Auth0 token endpoint.
- Bearer token + request payload → `{baseUrl}/api/integrations/...`.

No data is sent anywhere else. Tokens are cached in process memory only.

## License

[MIT](LICENSE).

## Support

Open an issue at [github.com/Approx-Tech/n8n-nodes-approx/issues](https://github.com/Approx-Tech/n8n-nodes-approx/issues).
