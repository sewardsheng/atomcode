import { resolve, relative, join } from "path";
import { readdir, stat } from "fs/promises";
import { tool } from "ai";
import { z } from "zod";

export function createListDirectoryTool(cwd: string) {
    return tool({
        description:
            "列出项目目录中的文件和目录。返回文件名和类型。",
        inputSchema: z.object({
            path: z
                .string()
                .describe("要列出的目录的相对路径（默认为项目根目录）")
                .default("."),
        }),
        execute: async ({ path }) => {
            const resolved = resolve(cwd, path);

            if (!resolved.startsWith(cwd)) {
                return { error: "路径在项目目录外部" };
            }

            try {
                const entries = await readdir(resolved);
                const results: { name: string; type: "file" | "directory" }[] = [];

                for (const entry of entries) {
                    // Skip hidden files and common large directories
                    if (entry.startsWith(".") || entry === "node_modules") continue;

                    try {
                        const entryPath = join(resolved, entry);
                        const info = await stat(entryPath);
                        results.push({
                            name: entry,
                            type: info.isDirectory() ? "directory" : "file",
                        });
                    } catch {
                        // Skip entries we can't stat
                    }
                }

                results.sort((a, b) => {
                    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
                    return a.name.localeCompare(b.name);
                });

                return {
                    path: relative(cwd, resolved) || ".",
                    entries: results,
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { error: `列出目录失败: ${message}` };
            }
        },
    });
}