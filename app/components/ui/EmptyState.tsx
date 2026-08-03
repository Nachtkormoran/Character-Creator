import type { ReactNode } from "react";

/**
 * Leerzustand als **Einladung zum Handeln**, nicht als Sackgasse: eine kurze
 * Aussage plus optional eine Aktion. Ersetzt die verstreuten „Noch keine …"-
 * gestrichelten Kästen.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <p className="font-display text-lg text-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
