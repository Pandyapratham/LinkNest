# LinkNest

LinkNest is a MERN link-in-bio builder for a BWP Semester 5 project. It combines a responsive React dashboard with an Express/Mongoose API, private cookie-based authentication, public profile pages, link redirects, analytics, and a practical Web Technology Lab.

## Architecture and features

- `client/`: React 19 + Vite 8 single-page app. The dashboard keeps authentication in an HttpOnly cookie, edits profiles and links through a centralized API client, displays real click analytics, and serves public profiles at `/u/:slug`.
- `server/`: Express 5 + Mongoose 9 API. User profiles are one-per-account; links and click events belong to a profile. Private profile, link, analytics, and XML routes use the shared authentication middleware.
- The API records a click only when a published profile's enabled link is opened through `/api/redirect/:slug/:linkId`. Events include a timestamp, profile/link references, a title snapshot, a coarse device category, and an optional referrer hostname. Raw IP addresses and full user-agent strings are not stored.
- The Web Technology Lab demonstrates XML import/export with XSD validation, a DTD and XSD, browser DOM parsing, the `saxes` streaming parser, XMLHttpRequest, isolated jQuery AJAX, Web Crypto signing/verification, and the XSLT command-line example.

## Requirements

- Node.js 22 or newer and npm.
- MongoDB Atlas or another MongoDB deployment supporting transactions (replica set) for profile deletion and confirmed XML import.
- Java 11 or newer only to run the standalone XSLT teaching example.

## Environment variables

Copy `server/.env.example` to `server/.env` and configure these names locally. Do not commit `.env`.

- `PORT`: API port (defaults to `5000`).
- `MONGODB_URI`: database connection string.
- `JWT_SECRET`: at least 32 bytes of random secret material.
- `CLIENT_ORIGINS` or `CLIENT_ORIGIN`: comma-separated production frontend origins. Development also allows Vite at `localhost:5173` and `127.0.0.1:5173`.
- `NODE_ENV`: set to `production` for deployment.
- `VITE_API_BASE_URL`: optional frontend API origin; defaults to `http://localhost:5000`.

The React client never receives the JWT secret or database URI. Authentication tokens are HttpOnly cookies, not browser storage.

## Install and run locally

In separate terminals from the project root:

```powershell
cd server
npm install
npm run dev
```

```powershell
cd client
npm install
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). The API health endpoint is `http://localhost:5000/api/health`. If the API uses a different origin, set `VITE_API_BASE_URL` in the client environment and restart Vite.

## Checks

```powershell
cd server
npm test
npm ls --depth=0
```

```powershell
cd client
npm test
npm run lint
npm run build
npm ls --depth=0
```

Integration tests use uniquely generated accounts and remove only their own records. They need a reachable test MongoDB configured through the server environment.

## XML import safety

XML upload is limited to 64 KB. The server rejects `DOCTYPE` and entity declarations, parses with network and entity loading disabled, validates against `server/schemas/linknest.xsd`, then independently checks URL schemes and field constraints. Validation is a separate preview request; the confirmed import revalidates and uses a MongoDB transaction to replace the authenticated account's profile and links. Imports cannot set owner IDs, account credentials, roles, or click events. DTD, XSD, sample XML, and XSLT resources live in `server/schemas/` and `server/labs/`.

To run the XSLT demonstration from the project root:

```powershell
java server/labs/TransformXml.java server/labs/sample-linknest.xml output.html
```

The Java helper uses the fixed project stylesheet, enables secure processing, rejects DTD/entity declarations, and disables external DTD and stylesheet access. The input and output paths are command-line choices for this local teaching example. Run the isolated DTD validation example with `java server/labs/ValidateDtd.java`; its resolver serves only the bundled DTD and rejects other external resources.

## Production and transport security

Deploy the API behind HTTPS with a certificate issued by a trusted certificate authority; keep certificate and hostname validation enabled for clients. Serve the frontend over HTTPS as well, set `NODE_ENV=production`, use a strong `JWT_SECRET`, set the exact frontend origin(s) in `CLIENT_ORIGINS`, and configure Atlas network access and least-privilege database credentials. Local development on `http://localhost` is not TLS. If a reverse proxy is used, configure Express proxy trust only for the known proxy hops before relying on client IP rate limits.

See [API documentation](docs/API.md), [syllabus mapping](docs/SYLLABUS.md), and [manual demo checklist](docs/MANUAL-TESTING.md).
