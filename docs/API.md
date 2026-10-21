# Pinpoint API

All request and response bodies use JSON unless the endpoint exports XML or redirects. Protected routes require the `linknest_token` HttpOnly cookie. Browser requests send credentials; clients must not store the JWT in local storage.

## Health and public routes

| Method | Path | Auth | Purpose |
|---|---|---:|---|
| GET | `/api/health` | No | Application and database health summary. |
| GET | `/api/public/profiles/:slug` | No | Published profile fields, social links, and enabled links only. |
| GET | `/api/redirect/:slug/:linkId` | No | Records a click for an enabled link on a published page, then responds with HTTP 302 to the stored validated destination. |
| GET | `/api/lab/linknest.dtd` | No | Download the teaching DTD. |
| GET | `/api/lab/linknest.xsd` | No | Download the import XSD. |
| GET | `/api/lab/sample.xml` | No | Download an educational XML sample. |

Public link clicks are counted only by the redirect endpoint; profile preview panels render non-clickable summaries.

## Authentication

| Method | Path | Body | Success |
|---|---|---|---|
| POST | `/api/auth/register` | `{ "email", "username", "password" }` | `201 { "success": true, "user": { "id", "email", "username", "createdAt" } }`; sets HttpOnly cookie. |
| POST | `/api/auth/login` | `{ "identifier", "password" }` using an email or username; legacy `{ "email", "password" }` remains supported. | `200` user object; sets cookie. |
| POST | `/api/auth/logout` | none | `200 { "success": true, "message": "Logged out successfully" }`; clears cookie. |
| GET | `/api/auth/me` | none | `200` current public user or `401`. |

Authentication requests are rate limited. Password hashes and tokens are not included in JSON responses.

## Profile and links (authenticated)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/profile` | Create one profile for the signed-in user. |
| GET | `/api/profile/me` | Get the signed-in user's profile. |
| PATCH | `/api/profile/me` | Update profile fields. |
| DELETE | `/api/profile/me` | Delete the profile, its links, and its click events. |
| GET | `/api/profile/me/links` | List owned links in display order. |
| POST | `/api/profile/me/links` | Create a link. |
| PATCH | `/api/profile/me/links/:linkId` | Update an owned link, including enabled status and order. |
| PATCH | `/api/profile/me/links/reorder` | Reorder the complete link list with `{ "linkIds": ["...", "..."] }`. |
| DELETE | `/api/profile/me/links/:linkId` | Delete an owned link. Historical click events retain the reference and title snapshot. |

Profile create/update fields: `slug`, `displayName`, `bio`, `avatarUrl`, `theme`, `socialLinks`, `enabled`. Themes are `soft`, `light`, `dark`, `midnight`, and `sunset`. Social links contain `platform`, `url`, and optional `label`.

Link fields: `title`, `destinationUrl`, optional `description`, `icon`, `platform`, `displayOrder`, and `enabled`. Destination URLs must use HTTP or HTTPS.

Typical errors are `400` invalid input, `401` missing/invalid session, `404` missing or non-owned resource, `409` duplicate slug/profile conflict, and `429` rate limit. Error responses use `{ "success": false, "message": "..." }`.

## Analytics (authenticated)

`GET /api/analytics?range=7d|30d|90d` returns database-derived counts for the caller's own profile:

```json
{
  "success": true,
  "range": "7d",
  "totalClicks": 3,
  "daily": [{ "date": "2026-10-21", "clicks": 3 }],
  "topLinks": [{ "_id": "<link-id>", "title": "Portfolio", "clicks": 3 }],
  "devices": [{ "_id": "mobile", "clicks": 2 }],
  "privacy": "No raw IP addresses or full user-agent strings are stored; device category is a coarse estimate."
}
```

The `daily` series includes zero-count days. Device category is derived from the request's user-agent and is only an estimate; the raw header is discarded.

## XML (authenticated)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/profile/me/export.xml` | Download the caller's profile and links as XML. |
| POST | `/api/profile/me/import/validate` | Body `{ "xml": "..." }`; validates and returns a safe preview, with no write. |
| POST | `/api/profile/me/import` | Body `{ "xml": "...", "confirm": true }`; revalidates and transactionally replaces the caller's profile and links. |

Imports have a 64 KB limit, prohibit DTD/entity declarations, enforce the fixed local XSD and application URL/field rules, and cannot modify account/authentication data. Schema failures return `400`; duplicate profile slugs return `409`.
