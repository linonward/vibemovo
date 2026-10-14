import { projectConfig } from "project.config";
import { Link } from "@/i18n/navigation";

export function Brand({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 font-display font-semibold ${className}`}>
      <span aria-hidden className="size-2.5 rounded-full bg-primary" />
      {projectConfig.name}
    </Link>
  );
}
