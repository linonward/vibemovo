import { AdminPagination } from "./pagination";

export function UserPagination({
  page,
  pageCount,
  query,
}: {
  page: number;
  pageCount: number;
  query: string;
}) {
  return (
    <AdminPagination pathname="/admin/users" params={{ q: query }} page={page} pageCount={pageCount} />
  );
}
