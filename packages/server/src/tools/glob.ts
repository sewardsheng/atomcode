import { resolve, relative } from "path";
import { tool } from "ai";
import { z } from "zod";

const MAX_RESULTS = 200;

export function createGlobTool(cwd: string) {
    return tool({
        description:
            "根据Glob模式查找文件。返回相对于项目根目录的文件路径。跳过node_modules和隐藏目录。",
        inputSchema: z.object({
            pattern: z.string().describe("要匹配的Glob模式（例如：'**/*.ts'，'src/**/*.tsx'）"),
            path: z
                .string()
                .describe("要搜索的相对目录（默认：项目根目录）")
                .default("."),
        }),
        execute: async ({ pattern, path }) => {
            const resolved = resolve(cwd, path);

            if (!resolved.startsWith(cwd)) {
                return { error: "路径在项目目录外部" };
            }

            try {
                const glob = new Bun.Glob(pattern);
                const files: string[] = [];
                let truncated = false;

                for await (const match of glob.scan({
                    cwd: resolved,
                    dot: false,
                    onlyFiles: true,
                })) {
                    // Skip node_modules matches
                    if (match.includes("node_modules")) continue;

                    if (files.length >= MAX_RESULTS) {
                        truncated = true;
                        break;
                    }

                    // Return paths relative to project root
                    const absoluteMatch = resolve(resolved, match);
                    files.push(relative(cwd, absoluteMatch));
                }

                files.sort();

                return {
                    files,
                    ...(truncated ? { truncated: true } : {}),
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { error: `查找文件失败，错误信息: ${message}` };
            }
        },
    });
};