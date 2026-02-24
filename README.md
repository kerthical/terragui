# TerraGUI

A browser-based visual editor for Terraform (HCL) configurations. Provides lossless bidirectional synchronization between HCL source text and an interactive node graph, without destroying comments, formatting, or existing Git-based workflows. This software was developed as undergraduate research at Kindai University, Faculty of Informatics, under the supervision of Prof. Nobukazu Iguchi.

## Problem

Infrastructure as Code with Terraform scales poorly for human comprehension. Large HCL codebases make resource topology difficult to grasp from text alone. Existing visualization tools are read-only, or destroy comments and formatting on round-trip, making them incompatible with code review workflows. TerraGUI addresses this by treating the `.tf` file as the single source of truth and representing the graph as derived, regeneratable data.

## Design Principles

**Lossless editing.**
HCL is parsed into a Concrete Syntax Tree (CST) using typescript-parsec,
preserving every token including comments and whitespace. GUI edits are
applied as minimal diffs to the CST; unmodified tokens are never touched.

**Semantic hierarchization.**
Resources that are flat in HCL (VPC, Subnet, Instance, etc.) are grouped into
a visual hierarchy by inspecting resource attributes such as `vpc_id`,
`subnet_id`, and `availability_zone`. Real groups (VPC, Subnet) and virtual
groups (Region, Availability Zone) are visually distinguished.

**Local-first.**
No cloud account is required to use the editor. State is stored in a local
SQLite database. The tool runs entirely on the developer's machine via Docker.

**Schema-driven property editing.**
Resource attributes are rendered dynamically from Terraform provider schemas
(`terraform providers schema -json`), so the property editor stays current
without hardcoded field definitions.

## Features

- Bidirectional sync: edit in the graph view or in the Monaco code editor; both sides update without losing formatting or comments
- Automatic hierarchical layout via ELK.js (layered algorithm)
- Dependency edge extraction from explicit `depends_on` and implicit attribute references
- Project creation from templates, local `.tf` files, or scratch
- Cloud import via terracognita (AWS, GCP, Azure)
- Streaming Terraform plan/apply with credential input dialog
- Provider schema cache in SQLite for fast property editor loading
- Automatic icon mapping for AWS, GCP, and Azure resources

## Requirements

- Docker and Docker Compose, or a Dev Containers-compatible environment
- Node.js 22 or later (for local development without Docker)
- Terraform CLI (for plan/apply and schema fetching)
- terracognita (for cloud import; optional)

## Installation

### Dev Container (recommended)

Open the repository in VS Code with the Dev Containers extension. The environment is configured automatically.

### Local

```sh
npm install
npm run db:reset
npm run db:migrate
npm run db:seed   # optional: load built-in templates
npm run dev
```

Open `http://localhost:3000` in a browser.

## Usage

**From scratch:** click "New" -> "From Scratch", enter a name, and start adding resources in the graph editor.

**From a template:** click "New" -> "From Templates", select a template, fill in parameters (region, CIDR, etc.), and create.

**From existing HCL:** click "New" -> "From Existing Infra" -> "Local", upload one or more `.tf` files.

**From a live cloud environment:** click "New" -> "From Existing Infra" -> "Cloud", enter credentials, and import via terracognita.

**Editing:** the editor shows a graph on the left and a property editor or code editor on the right. Selecting a node in the graph scrolls the code editor to the corresponding block, and vice versa. Property changes are written back to HCL as minimal diffs.

**Deploying:** open the apply panel, enter cloud credentials, run Plan to preview changes, then Apply to execute.

## Architecture

```
Browser (React / Next.js)
  Graph View (React Flow / ELK.js)
  Code Editor (Monaco)
  Property Editor (schema-driven form)
        |  JSON / Server Actions
        v
Server (Next.js App Router)
  HCL Engine    -- tokenize -> CST -> diff apply -> HCL text
  Graph Engine  -- CST -> nodes/edges -> ELK layout -> React Flow JSON
  Import        -- terracognita + terraform CLI
  Schema        -- terraform providers schema -json (cached in SQLite)
        |  Read/Write
        v
SQLite (terragui.db)
  architectures, architecture_files
  architecture_imports, architecture_import_logs
  templates, template_parameters, template_tags
  provider_schemas
```

The HCL Engine (implemented with typescript-parsec) builds a CST that retains every token. The Graph Engine derives the visual graph from the CST and stores the layout in `graph_json` as a cache. On save, only the modified tokens in the CST are replaced; `graph_json` is regenerated from the updated HCL text.

## Development

```sh
npm run dev          # start Next.js dev server with Turbopack
npm run build        # production build
npm run lint:check   # TypeScript + Biome check
npm run lint:fix     # auto-fix
npm run db:migrate   # apply schema changes to terragui.db
npm run db:reset     # drop and recreate all tables
npm run db:seed      # insert built-in template data
```

Commit messages follow the Conventional Commits specification enforced by commitlint and Lefthook.

## Related Work

This project is described in the following publications:

- 平田麟太朗, 井口信和.
  "HCLと意味的に階層化されたUIの相互変換によるクラウド構成の視覚的編集."
  情報処理学会第88回全国大会, 2026.
  (`src/works/paper/paper.pdf`)

- 平田麟太朗.
  "HCLと意味的に階層化されたUIの相互変換によるクラウド構成の視覚的編集."
  近畿大学情報学部卒業研究報告書, 2025.
  (`src/works/thesis/thesis.pdf`)

## License

WTFPL - Do What The Fuck You Want To Public License, Version 2. See LICENSE for the full text.
