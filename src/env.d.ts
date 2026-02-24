declare module "*.svg" {
  import type React from "react";
  const SVG: React.VFC<React.SVGProps<SVGSVGElement>>;
  export default SVG;
}

declare module "*.svg?url" {
  const content: unknown;
  export default content;
}

declare module "*.css" {
  const content: unknown;
  export default content;
}
