import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

const site =
  process.env.PUBLIC_SITE_URL ?? "https://k-dot-greyz.github.io/rolodex";

export default defineConfig({
  output: "static",
  site,
  trailingSlash: "never",
  vite: {
    resolve: {
      alias: {
        "@lib": fileURLToPath(new URL("./src/lib", import.meta.url)),
        "@data": fileURLToPath(new URL("./src/data", import.meta.url)),
        "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
      },
    },
    ssr: {
      external: ["@resvg/resvg-js"],
    },
  },
});
