import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";

const INTERVAL = 3000;
const TRIES = 20;

// The webhook credits a paid checkout within a minute. Until the balance
// rises, refresh the page every few seconds, so nobody has to reload.
// Returns true once the credits are here.
export function useAwaitCredits(active: boolean, balance: number) {
  const router = useRouter();
  const [start] = useState(balance);
  const arrived = active && balance > start;

  useEffect(() => {
    if (!active || arrived) return;
    let tries = 0;
    const timer = setInterval(() => {
      router.refresh();
      if (++tries === TRIES) clearInterval(timer);
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [active, arrived, router]);

  return arrived;
}
