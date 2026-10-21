# LinkNest manual test and presentation checklist

## Run

1. Configure `server/.env` locally using the names in `server/.env.example` (do not share it).
2. Start the API with `cd server; npm run dev`.
3. Start Vite with `cd client; npm run dev` and open the printed local URL.

## Demo flow

1. Register a throwaway account or sign in; reload once to demonstrate cookie session restoration; sign out and confirm the sign-in screen returns.
2. Create a profile with a unique slug, bio, avatar URL, social links and each available theme. Toggle publish off/on and observe the public page behavior.
3. Create two links, edit one, disable one, reorder them, and reload to show database persistence.
4. Copy the public URL, open `/u/<slug>`, and confirm only enabled links are public. Click a public link and confirm it redirects through the API.
5. Return to the dashboard and change the analytics date range. Confirm click totals, daily chart, top links, and coarse device estimates reflect actual events. Profile views and click-through rate remain labeled unavailable because they are not collected.
6. Open the profile QR dialog and download the SVG. Scan it to open the public profile.
7. Open **Syllabus Lab**. Run DOM/SAX, XMLHttpRequest, jQuery/AJAX, and Web Crypto demos. Download the DTD/XSD; validate the sample XML.
8. Export XML; preview it without applying; test malformed XML and a `DOCTYPE` input; confirm valid import explicitly and verify the profile/links reload. Do not use sensitive user data in a classroom demonstration.
9. From the project root, run `java server/labs/ValidateDtd.java`, then run the documented Java XSLT command and open the generated HTML file.

## Expected boundaries

- Disabled links and unpublished profiles return not found from public pages and redirect endpoints and do not increment click analytics.
- The public profile API omits email, owner IDs, credentials and disabled links.
- Private analytics and XML endpoints require the signed-in account's cookie.
- XML imports are capped at 64 KB and cannot update users or auth data.
- Device category is an estimate; no raw IP or full user-agent is saved.
