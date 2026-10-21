# BWP Web Technology syllabus mapping

| Syllabus topic | LinkNest feature that demonstrates it |
|---|---|
| HTML5 forms, inputs, tables, links, images | Accessible registration/profile/link forms, dashboard link rows, public link anchors and avatar images with alternative text. |
| CSS3 and responsive design | Premium dashboard and public profiles use CSS Grid/Flexbox, focus styles, small-screen layouts, theme palettes, and reduced-motion support. |
| JavaScript, DOM and events | React state/events drive forms and CRUD; the Lab parses the same XML with browser `DOMParser`; the isolated jQuery example owns a separate DOM sandbox. |
| JSON | Normal API requests use JSON; health and REST examples display JSON responses. XML is a separate explicit import/export format. |
| HTTP methods and status codes | API docs and application flows use GET, POST, PATCH, DELETE, 302 redirects, validation errors, unauthorized errors, conflicts, and rate limits. |
| AJAX and XMLHttpRequest | Lab button issues a real XMLHttpRequest GET to `/api/health`, with loading, JSON parsing, and error states. |
| jQuery | Lab sandbox uses jQuery to handle a form submit and perform a jQuery AJAX health request; it does not mutate React dashboard nodes. |
| React | Dashboard, auth flow, QR dialog, public profile, analytics, and syllabus lab are React components and state. |
| REST APIs and web services | Express routes expose authenticated CRUD, public profiles/redirects, analytics, XML import/export, and health. |
| XML | Authenticated profile export/import produces a defined `linknest` document containing profile, social links, and ordered links. |
| DTD | `server/schemas/linknest.dtd` documents the permitted element tree; `java server/labs/ValidateDtd.java` validates a bundled sample using a resolver restricted to that local DTD. Production imports intentionally reject DTD declarations to avoid external entity risks. |
| XML Schema / XSD | `server/schemas/linknest.xsd` is compiled and applied by libxml2 through `libxmljs2`; application validators additionally enforce safe HTTP(S) destinations and current model constraints. |
| DOM parsing | Lab's `DOMParser` creates a complete tree and selects link nodes. |
| SAX parsing | Lab's `saxes` example reports equivalent link fields from parser events without building a DOM tree. |
| XSLT | `server/labs/linknest.xsl` transforms the sample/export document to HTML using the secure Java `TransformXml.java` runner. External DTD and stylesheet access are disabled. |
| Security | HttpOnly JWT cookie, bcrypt hashes, ownership checks, CORS allowlist, Helmet, JSON/XML size limits, URL scheme validation, safe stored-target redirects, rate limits, and XXE/DTD rejection. |
| Performance | Vite production build, database indexes for profile/link order and profile/date analytics, bounded click-range queries, fixed-size response series, and a 100-link profile limit. |
| SSL/TLS and certificates | README documents HTTPS and trusted certificate requirements for production. Localhost HTTP is explicitly not represented as TLS. |
| Digital signatures | Lab uses Web Crypto ECDSA P-256 with SHA-256 to sign and verify a message. The generated key is ephemeral and self-trusted within the demo; it is not account identity proof. |

## Practical lab commands

Run the XSLT example from the project root (Java 11+):

```powershell
java server/labs/TransformXml.java server/labs/sample-linknest.xml output.html
```

Validate the sample against the fixed DTD:

```powershell
java server/labs/ValidateDtd.java
```

The React Lab has live DOM/SAX, XMLHttpRequest, jQuery, Web Crypto and authenticated XML transfer demonstrations. The sample DTD, XSD, and XML are available from the API's read-only `/api/lab/` routes.
