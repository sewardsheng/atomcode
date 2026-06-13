import { resolve, relative, dirname } from "path";
import { writeFile, mkdir } from "fs/promises";
import { tool } from "ai";
import { z } from "zod";

export function createWriteFileTool(cwd: string) {
    return tool({
        description:
            "创建或覆盖项目中的文件。如果父目录不存在，则创建父目录。",
        inputSchema: z.object({
            path: z.string().describe("要写入的文件的相对路径"),
            content: z.string().describe("要写入文件的完整内容"),
        }),
        execute: async ({ path, content }) => {
            const resolved = resolve(cwd, path);

            if (!resolved.startsWith(cwd)) {
                return { error: "路径在项目目录外部" };
            }

            try {
                await mkdir(dirname(resolved), { recursive: true });
                await writeFile(resolved, content, "utf-8");

                return {
                    success: true as const,
                    path: relative(cwd, resolved),
                    bytesWritten: Buffer.byteLength(content, "utf-8"),
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { error: `写入文件失败: ${message}` };
            }
        },
    })
};