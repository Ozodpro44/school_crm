import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, tf } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";

/** Client-side paging: resets to page 1 when `resetKey` changes and never leaves an empty last page. */
export function usePaging<T>(rows: T[], pageSize: number, resetKey: unknown) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => { setPage(1); }, [resetKey, pageSize]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  const slice = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize]);
  return { page, pages, setPage, slice };
}

interface PagerProps {
  page: number;
  pages: number;
  total: number;
  onPage: (p: number) => void;
}

export function Pager({ page, pages, total, onPage }: PagerProps) {
  const { language } = useLanguage();
  const t = (k: string) => getTranslation(k, language);
  return (
    <>
      <span className="tnum">{tf(t("showing"), { n: total })}</span>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <span className="tnum hidden sm:inline">{tf(t("pageOf"), { page, pages })}</span>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t("previous")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={t("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
}
