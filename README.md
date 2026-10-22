# Pinpoint

Pinpoint is a MERN link-in-bio builder for a BWP Semester 5 project. It combines a responsive React dashboard with an Express/Mongoose API, cookie-based authentication, public profile pages, link redirects, analytics, and a practical Web Technology Lab.

## Architecture and Features

- `client/`: React 19 + Vite 8 single-page application with a dashboard, profile and link management, analytics, QR codes, and public profiles at `/u/:slug`.
- `server/`: Express 5 + Mongoose 9 API with authentication, profile and link management, click tracking, analytics, and XML lab endpoints.
- Authentication uses an HttpOnly cookie. JWTs are not stored in browser localStorage or sessionStorage.
- Public link redirects record click events for enabled links on published profiles. Analytics include real recorded clicks and coarse device estimates.
- Web Technology Lab demonstrates XML import/export, DTD, XSD validation, DOM/SAX parsing, XSLT, XMLHttpRequest, jQuery AJAX, REST APIs, and Web Crypto signatures.

## Requirements

- Node.js 22 or newer and npm.
- MongoDB Atlas or another MongoDB deployment supporting transactions for operations that require them.
- Java 11 or newer for the standalone Java XML/XSLT demonstrations.

## Environment Setup

Copy `server/.env.example` to `server/.env` and configure the required values locally.

- `PORT`: API port; defaults to `5000`.
- `MONGODB_URI`: MongoDB connection string.
- `JWT_SECRET`: private random secret of at least 32 bytes.
- `CLIENT_ORIGIN` or `CLIENT_ORIGINS`: permitted frontend origin(s) for production.
- `NODE_ENV`: set to `production` for production deployment.
- `VITE_API_BASE_URL`: optional frontend API base URL; defaults to `http://localhost:5000`.

Never commit `.env` files or share database credentials and JWT secrets.

## Install and Run

Open two terminals from the project root.

Backend:

```powershell
cd server
npm install
npm run dev
```

Frontend:

```powershell
cd client
npm install
npm run dev
```

Open the frontend URL printed by Vite. The backend health endpoint is `http://localhost:5000/api/health`.

## Testing

Backend:

```powershell
cd server
npm test
npm ls --depth=0
```

Frontend:

```powershell
cd client
npm test
npm run lint
npm run build
npm ls --depth=0
```

Integration tests require a reachable test MongoDB configured in the local server environment. Tests should use unique temporary records and clean up only their own data.

## XML Import Safety

XML uploads are size-limited, reject unsafe document type/entity declarations, and undergo schema and field validation. Confirmed imports revalidate the data and use a database transaction where supported. Imported content cannot set account credentials, roles, or ownership fields.

The DTD, XSD, sample XML, and XSLT teaching resources are stored under `server/schemas/` and `server/labs/`.

Run the XSLT example from the project root:

```powershell
java server/labs/TransformXml.java server/labs/sample-linknest.xml output.html
```

Run the DTD demonstration:

```powershell
java server/labs/ValidateDtd.java
```

These standalone demonstrations require Java 11 or newer.

## Production Security

Deploy behind HTTPS using a trusted TLS certificate. Configure the exact frontend origins, secure production cookies, a strong private JWT secret, and least-privilege database credentials. Local development on `http://localhost` does not use TLS.

## Documentation

- [API documentation](docs/API.md)
- [Syllabus mapping](docs/SYLLABUS.md)
- [Manual testing checklist](docs/MANUAL-TESTING.md)


### AI analytics assistant

The authenticated dashboard includes a floating Pinpoint AI chat assistant. It answers questions using only the signed-in user's real link-click analytics for the selected 7-, 30-, or 90-day period.

Configure the OpenAI-compatible provider in `server/.env` using `server/.env.example` as a template:

- `OPENAI_BASE_URL`: provider API base URL (for OpenAI, `https://api.openai.com/v1`).
- `OPENAI_API_KEY`: provider-issued secret. The example key is a non-working placeholder, not a usable credential.
- `OPENAI_MODEL`: model name supported by that provider.

The API key stays on the server. The chat endpoint requires the same authenticated session as the analytics API, scopes data to the signed-in user's profile, limits message length/history, and rate-limits requests. The assistant is explicit that Pinpoint records link clicks, not profile views.
