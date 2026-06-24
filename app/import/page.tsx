import { redirect } from "next/navigation";

// Import moved into Clan Settings → "Import data" tab. Keep this path working.
export default function ImportRedirect() {
  redirect("/settings");
}
