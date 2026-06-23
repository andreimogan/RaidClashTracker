// Server-only helpers for pulling a published Google Sheet as CSV.

// Accepts either a "Publish to web" CSV URL (used as-is) or a normal sheet URL
// like https://docs.google.com/spreadsheets/d/<ID>/edit#gid=<GID> and converts
// it to the CSV export endpoint.
export function toCsvExportUrl(input: string): string {
  const url = input.trim();
  if (!url) throw new Error("No Google Sheet URL provided.");
  if (/output=csv|format=csv/.test(url)) return url; // already a CSV url

  const idMatch = url.match(/\/spreadsheets\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
  if (!idMatch) {
    throw new Error(
      "Couldn't recognize that Google Sheets URL. Paste the sheet link, or a " +
        "'Publish to web' CSV link.",
    );
  }
  const id = idMatch[1];
  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

export async function fetchSheetCsv(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch the sheet (HTTP ${res.status}). Make sure it's shared ` +
        `"anyone with the link" or published to the web.`,
    );
  }
  const text = await res.text();
  // Google serves an HTML login/permission page (not CSV) for private sheets.
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/html") || text.trimStart().startsWith("<")) {
    throw new Error(
      "The sheet isn't publicly readable — Google returned a sign-in page. " +
        "Set sharing to 'Anyone with the link' or use Publish to web.",
    );
  }
  return text;
}
