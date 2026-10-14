import { projectConfig } from "project.config";
import { Link } from "@/i18n/navigation";
import { LogoMark } from "./logo-mark";

export function Brand({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 font-display font-semibold ${className}`}>
      <LogoMark />
      {projectConfig.name}
    </Link>
  );
}
