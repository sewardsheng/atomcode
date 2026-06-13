import { resolve, relative } from "path";
import { readFile } from "fs/promises";
import { tool } from "ai";
import { z } from "zod";

const MAX_FILE_SIZE = 10_000;

export function createReadFileTool(cwd: string) {
    return tool({
        description:
            "读取项目中的文件内容。如果文件很大，返回的内容会被截断。",
        inputSchema: z.object({
            path: z.string().describe("要读取的文件的相对路径"),
        }),
        execute: async ({ path }) => {
            const resolved = resolve(cwd, path);
            const rel = relative(cwd, resolved);

            if (
                rel.startsWith("..") ||
                (resolve(resolved) !== resolved && rel.startsWith(".."))
            ) {
                return { error: "路径在项目目录外部" };
            }

            // Ensure resolved path is still within cwd
            if (!resolved.startsWith(cwd)) {
                return { error: "路径在项目目录外部" };
            }

            try {
                const content = await readFile(resolved, "utf-8");
                if (content.length > MAX_FILE_SIZE) {
                    return {
                        content: content.slice(0, MAX_FILE_SIZE),
                        truncated: true,
                        totalLength: content.length,
                    };
                }
                return { content };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { error: `读取文件失败: ${message}` };
            }
        },
    })
};