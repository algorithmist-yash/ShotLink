function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderUnavailablePage({ shortCode, destinations = [] }) {
  const destinationLinks = destinations.length
    ? destinations
        .map(
          (destination) => `
            <li>
              <a href="${escapeHtml(destination.url)}" rel="noreferrer">
                ${escapeHtml(destination.label)}
              </a>
              <span>${escapeHtml(destination.status)}</span>
            </li>`
        )
        .join("")
    : "<li>No healthy destination is available right now.</li>";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Link temporarily unavailable</title>
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: #07111f;
        color: #f8fafc;
      }
      main {
        max-width: 720px;
        margin: 48px auto;
        padding: 32px;
        background: rgba(15, 23, 42, 0.94);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 24px;
      }
      h1 {
        margin-top: 0;
        font-size: 2rem;
      }
      p {
        color: #cbd5e1;
      }
      ul {
        list-style: none;
        padding: 0;
        display: grid;
        gap: 12px;
      }
      li {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        padding: 14px 16px;
        border-radius: 14px;
        background: rgba(30, 41, 59, 0.8);
      }
      a {
        color: #7dd3fc;
        word-break: break-all;
      }
      span {
        color: #fbbf24;
        white-space: nowrap;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>We could not safely open this short link</h1>
      <p>
        The primary destination for <strong>${escapeHtml(shortCode)}</strong> appears to be having
        server-side trouble. If one of the alternatives below works for you, you can open it directly.
      </p>
      <ul>${destinationLinks}</ul>
    </main>
  </body>
</html>`;
}

module.exports = { renderUnavailablePage };
