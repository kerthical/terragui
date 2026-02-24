import { Cloudy, FolderOpen } from "lucide-react";
import { Header } from "~/app/header";
import { getImportAvailability } from "~/app/new/import/get-import-availability";
import { SelectionCards } from "~/app/new/selection-cards";

export default async function InfrastructureImportPage() {
  const availability = await getImportAvailability();

  const options = [
    {
      id: "local",
      title: "From local files",
      description: "Upload Terraform files from your machine",
      href: "/new/import/local",
      icon: FolderOpen,
    },
    ...(availability.cloud
      ? [
          {
            id: "cloud",
            title: "From cloud provider",
            description: "Import from AWS / GCP / Azure environments",
            href: "/new/import/cloud",
            icon: Cloudy,
          },
        ]
      : []),
  ];

  return (
    <div className="flex h-screen w-full flex-col bg-background text-[12px]">
      <Header backHref="/new" title="Import Infrastructure" />
      <main className="flex flex-1 items-start justify-center overflow-auto p-4 sm:pt-16">
        <div className="w-full max-w-lg space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Select import source</h2>
            <p className="text-muted-foreground">Choose where to import your existing configuration from.</p>
          </div>
          <div className="rounded-md border bg-card p-2 shadow-sm">
            <SelectionCards options={options} />
          </div>
        </div>
      </main>
    </div>
  );
}
