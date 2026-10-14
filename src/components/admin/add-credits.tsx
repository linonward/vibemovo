"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";

// Row action on the admin user list. One request ID per opened dialog, so
// a double click or a retry adds the credits once.
export function AddCredits({ userId, email }: { userId: string; email: string }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [failed, setFailed] = useState(false);
  // Pending until the refreshed page has rendered: the dialog closes with
  // the new balance already shown.
  const [saving, startTransition] = useTransition();
  const [requestId, setRequestId] = useState("");

  const value = Number(amount);
  const valid = /^\d+$/.test(amount) && value >= 1 && value <= 1_000_000;

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setAmount("");
      setFailed(false);
      setRequestId(crypto.randomUUID());
    }
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || saving) return;
    setFailed(false);
    startTransition(async () => {
      const response = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, amount: value, requestId }),
      }).catch(() => null);
      // Updates after an await join the transition only inside startTransition.
      startTransition(() => {
        if (!response?.ok) return setFailed(true);
        setOpen(false);
        router.refresh();
      });
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="icon" />}
        aria-label={t("addCredits", { email })}
        title={t("addCredits", { email })}
      >
        <Plus />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={add} className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("addTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">
              {t.rich("addDescription", {
                email: () => <span className="font-medium break-all text-foreground">{email}</span>,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`add-credits-${userId}`}>{t("amountLabel")}</Label>
            <Input
              id={`add-credits-${userId}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={1_000_000}
              step={1}
              required
              autoFocus
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {t("addError")}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <Button type="submit" disabled={!valid || saving}>
              {t("add")}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
