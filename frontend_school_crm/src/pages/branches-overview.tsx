import { useEffect } from "react";
import { useRouter } from "next/router";

// This page's content moved into the "overview" tab on /branches (see
// BranchesOverviewPanel). Kept as a redirect so old bookmarks/links to
// /branches-overview still land somewhere useful.
export default function BranchesOverviewRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/branches?tab=overview");
  }, [router]);
  return null;
}
