import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Called on form submit */
  onSubmit: (e: React.FormEvent) => void;
  /** Label shown on the submit button */
  submitLabel?: string;
  /** Label shown while submitting */
  submittingLabel?: string;
  isPending?: boolean;
  /** Extra width class, defaults to max-w-lg */
  maxWidth?: string;
  children: React.ReactNode;
  /** Extra buttons to render before Cancel (e.g., a Delete button) */
  extraActions?: React.ReactNode;
};

/**
 * FormDialog — a Dialog with:
 *   - a sticky header (DialogTitle)
 *   - a scrollable body for form fields
 *   - a sticky footer with Cancel + Submit
 *
 * Usage:
 *   <FormDialog open={open} onOpenChange={setOpen} title="Add Teacher"
 *               onSubmit={handleSubmit} isPending={mutation.isPending}>
 *     <Field id="name" label="Name" ... />
 *   </FormDialog>
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  onSubmit,
  submitLabel = "Save",
  submittingLabel = "Saving…",
  isPending = false,
  maxWidth = "max-w-lg",
  children,
  extraActions,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("flex flex-col gap-0 p-0 overflow-hidden", maxWidth)}
      >
        {/* Sticky header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <form
          onSubmit={onSubmit}
          className="flex flex-col flex-1 min-h-0"
          noValidate
        >
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-h-[70vh]">
            {children}
          </div>

          {/* Sticky footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div>{extraActions}</div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {submittingLabel}
                  </>
                ) : (
                  submitLabel
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
