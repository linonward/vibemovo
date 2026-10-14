"use client";

import { Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

type DeleteState = "idle" | "confirming" | "deleting" | "error" | "stale" | "subscribed";

// Account details and deletion. The balance and sign-out live in the account
// menu, so they aren't repeated here.
export function Profile() {
  const t = useTranslations("Profile");
  const format = useFormatter();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [deleteState, setDeleteState] = useState<DeleteState>("idle");
  // Set when this page deletes the account. It then picks the next page
  // itself, so a session that clears doesn't also send the user to sign-in.
  const leaving = useRef(false);

  useEffect(() => {
    if (!isPending && !session && !leaving.current) router.replace("/sign-in");
  }, [isPending, session, router]);

  if (!session) return <PageSkeleton />;
  const { user } = session;

  async function deleteAccount() {
    setDeleteState("deleting");
    leaving.current = true;
    const { error } = await authClient.deleteUser();
    if (!error) return router.push("/");
    leaving.current = false;
    setDeleteState(
      error.code === "SESSION_EXPIRED"
        ? "stale"
        : error.code === "ACTIVE_SUBSCRIPTION"
          ? "subscribed"
          : "error",
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <dl className="divide-y rounded-xl border bg-card">
        {[
          [t("name"), user.name || "—"],
          [t("email"), user.email],
          [t("emailVerified"), user.emailVerified ? t("yes") : t("no")],
          [
            t("memberSince"),
            format.dateTime(new Date(user.createdAt), { dateStyle: "medium" }),
          ],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-6">
            <dt className="text-sm text-muted-foreground sm:w-36 sm:shrink-0">{label}</dt>
            <dd className="min-w-0 break-all">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">{t("deleteTitle")}</h2>
        <p className="text-pretty text-muted-foreground">{t("deleteDescription")}</p>
        <AlertDialog
          open={deleteState !== "idle"}
          onOpenChange={(open) => setDeleteState(open ? "confirming" : "idle")}
        >
          <AlertDialogTrigger render={<Button variant="destructive" />}>
            <Trash2 />
            {t("delete")}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription className="text-pretty">
                {t.rich("confirmDescription", {
                  email: () => (
                    <span className="font-medium break-all text-foreground">{user.email}</span>
                  ),
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteState === "stale" && (
              <p role="alert" className="text-sm text-destructive">
                {t("staleSession")}
              </p>
            )}
            {deleteState === "subscribed" && (
              <p role="alert" className="text-sm text-destructive">
                {t.rich("activeSubscription", {
                  link: (chunks) => (
                    <Link href="/billing" className="underline underline-offset-4">
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            )}
            {deleteState === "error" && (
              <p role="alert" className="text-sm text-destructive">
                {t("deleteError")}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                className="bg-destructive text-white [@media(hover:hover)]:hover:bg-destructive/90"
                disabled={deleteState === "deleting"}
                onClick={deleteAccount}
              >
                {t("confirmDelete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
