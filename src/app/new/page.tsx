import { FileText, Layers, Upload } from "lucide-react";
import { Header } from "~/app/header";
import { SelectionCards } from "~/app/new/selection-cards";

export default async function NewArchitecturePage() {
  const options = [
    {
      id: "templates",
      title: "From templates",
      description: "Create from predefined architectures",
      href: "/new/templates",
      icon: FileText,
    },
    {
      id: "import",
      title: "From existing infra",
      description: "Import existing resources",
      href: "/new/import",
      icon: Upload,
    },
    {
      id: "scratch",
      title: "From scratch",
      description: "Start from a blank canvas",
      href: "/new/scratch",
      icon: Layers,
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col bg-background text-[12px]">
      <Header backHref="/" title="New Project" />
      <main className="flex flex-1 items-start justify-center overflow-auto p-4 sm:pt-16">
        <div className="w-full max-w-lg space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Choose a starting point</h2>
            <p className="text-muted-foreground">Select how you want to initialize your infrastructure.</p>
          </div>
          <div className="rounded-md border bg-card p-2 shadow-sm">
            <SelectionCards options={options} />
          </div>
        </div>
      </main>{" "}
    </div>
  );
}
