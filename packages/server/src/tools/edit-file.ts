import { resolve, relative } from "path";
import { readFile, writeFile } from "fs/promises";
import { tool } from "ai";
import { z } from "zod";

export function createEditFileTool(cwd: string) {
    return tool({
        description:
            "通过精确匹配字符串来对文件进行定向编辑。出于安全考虑，oldString 必须在文件中只出现一次。请使用此方法进行精准修改，而不是重写整个文件。",
        inputSchema: z.object({
            path: z.string().describe("要编辑的文件的相对路径"),
            oldString: z
                .string()
                .describe("要查找并替换的精确文本"),
            newString: z.string().describe("替换它的文本"),
        }),
        execute: async ({ path, oldString, newString }) => {
            const resolved = resolve(cwd, path);

            if (!resolved.startsWith(cwd)) {
                return { error: "路径在项目目录外部" };
            }

            try {
                const content = await readFile(resolved, "utf-8");

                const occurrences = content.split(oldString).length - 1;

                if (occurrences === 0) {
                    return { error: "oldString 在文件中未找到" };
                }

                if (occurrences > 1) {
                    return {
                        error: `oldString 在文件中不唯一 — 在文件中中出现 ${occurrences} 次。请提供更多上下文以使其唯一。`,
                    };
                }

                const updated = content.replace(oldString, newString);

                await writeFile(resolved, updated, "utf-8");

                return {
                    success: true as const,
                    path: relative(cwd, resolved),
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { error: `编辑文件失败：${message}` };
            }
        },
    });
};