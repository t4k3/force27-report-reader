# Force27 Report Reader

Static reader for interactive Jump HTML reports exported by Force27.

The recipient saves their attachment, opens this website, and selects the HTML file.
The report is parsed and displayed in the browser without sending its contents to a server.
The reader has no accounts, analytics, cookies, or report storage.

Only the five reader assets are published here. No athlete reports, personal data, native app source, or acquisition code are included.
GitHub serves the static assets and may process normal connection metadata; it does not receive the selected report from this reader.

## Privacy design

- Local File API reading; no report upload endpoint.
- Validate the report JSON instead of executing the imported HTML.
- Sandboxed player with a Content Security Policy that blocks network connections.
- Close the report to clear the player and its in-memory data.

Reader version: 1.1.
