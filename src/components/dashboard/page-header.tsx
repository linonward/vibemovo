// Dashboard page header: heavy sans title, muted description, optional
// action on the right (docs/DESIGN.md, Page header).
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-3xl leading-tight font-black tracking-[-0.025em] text-balance [overflow-wrap:anywhere] sm:text-4xl">
          {title}
        </h1>
        {description && <p className="text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {action}
    </header>
  );
}
