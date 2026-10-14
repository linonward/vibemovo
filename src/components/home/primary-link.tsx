import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonVariants({ size: "lg" })}>
      {children}
      <ArrowRight className="icon-nudge" />
    </Link>
  );
}
