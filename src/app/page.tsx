import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ArchitectureTable } from "~/app/architecture-table";
import { getArchitectures } from "~/app/get-architectures";
import { Header } from "~/app/header";
import { Button } from "~/ui/button";
import { Skeleton } from "~/ui/skeleton";

async function ArchitectureList() {
  const architectures = await getArchitectures();

  return <ArchitectureTable architectures={architectures} />;
}

function ArchitectureListSkeleton() {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {["filter-search", "filter-source"].map((key) => (
          <Skeleton className="h-8 w-52 max-w-full" key={key} />
        ))}
      </div>
      <div className="overflow-hidden rounded-lg">
        <div className="space-y-2">
          {["row-1", "row-2", "row-3", "row-4", "row-5"].map((key) => (
            <div className="grid grid-cols-5 items-center gap-2 px-3 py-1 text-sm" key={key}>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16 justify-self-end" />
              <Skeleton className="h-4 w-16 justify-self-end" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <div className="flex h-screen w-full flex-col bg-background text-[12px]">
      <Header
        actions={
          <Button
            className="gap-1.5"
            nativeButton={false}
            render={
              <Link href="/new">
                <Plus className="size-3.5" />
                <span>New Project</span>
              </Link>
            }
          />
        }
        title="Projects"
      />
      <main className="flex-1 overflow-auto px-4 py-4">
        <div className="mx-auto max-w-5xl space-y-4">
          <Suspense fallback={<ArchitectureListSkeleton />}>
            <ArchitectureList />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
