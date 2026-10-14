type Env = Record<string, string | undefined>;

const normalize = (email: string) => email.trim().toLowerCase();

// The emails in ADMIN_EMAILS, separated by commas. Empty means no admins.
export function adminEmails(env: Env = process.env): string[] {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

// Admins are the emails listed in ADMIN_EMAILS.
export function isAdmin(email: string | undefined, admins: readonly string[] = adminEmails()) {
  if (!email?.trim()) return false;
  return admins.some((admin) => normalize(admin) === normalize(email));
}
