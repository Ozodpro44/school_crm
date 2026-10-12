import { useEffect } from "react";
import { useRouter } from "next/router";

// This page's content moved into the "trash" tab on /audit-log (see
// TrashPanel). Kept as a redirect so old bookmarks/links to /trash still
// land somewhere useful.
export default function TrashRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/audit-log?tab=trash");
  }, [router]);
  return null;
}
