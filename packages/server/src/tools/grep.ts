import { resolve, relative } from "path";
import { tool } from "ai";
import { z } from "zod";

const MAX_MATCHES = 50;

export function createGrepTool(cwd: string) {
    return tool({
        description:
            "根据正则表达式模式搜索文件内容。返回匹配的行，排除隐藏目录、node_modules目录。",
        inputSchema: z.object({
            pattern: z.string().describe("要搜索的正则表达式模式"),
            path: z
                .string()
                .describe("要搜索的相对目录（默认：项目根目录）")
                .default("."),
            include: z
                .string()
                .describe("要搜索的文件的Glob模式（例如：*.ts、*.tsx）")
                .optional(),
        }),
        execute: async ({ pattern, path, include }) => {
            const resolved = resolve(cwd, path);

            if (!resolved.startsWith(cwd)) {
                return { error: "路径在项目目录外部" };
            }

            try {
                const args = [
                    "-rn",
                    "--color=never",
                    "--exclude-dir=node_modules",
                    "--exclude-dir=.git",
                    "-E",
                ];

                if (include) {
                    args.push(`--include=${include}`);
                }

                args.push(pattern, resolved);

                const proc = Bun.spawn(["grep", ...args], {
                    stdout: "pipe",
                    stderr: "pipe",
                    cwd,
                });

                const stdout = await new Response(proc.stdout).text();
                const stderr = await new Response(proc.stderr).text();

                await proc.exited;

                // grep exits with 1 when no matches found — not an error
                if (proc.exitCode !== 0 && proc.exitCode !== 1) {
                    return { error: `grep搜索失败: ${stderr.trim()}` };
                }

                if (!stdout.trim()) {
                    return { matches: [], message: "未找到匹配项" };
                }

                const lines = stdout.trim().split("\n");
                const matches: { file: string; line: number; content: string }[] = [];
                let truncated = false;

                for (const line of lines) {
                    if (matches.length >= MAX_MATCHES) {
                        truncated = true;
                        break;
                    }

                    // grep output format: /absolute/path:linenum:content
                    const match = line.match(/^(.+?):(\d+):(.*)$/);
                    if (match) {
                        matches.push({
                            file: relative(cwd, match[1]!),
                            line: parseInt(match[2]!, 10),
                            content: match[3]!,
                        });
                    }
                }

                return {
                    matches,
                    ...(truncated ? { truncated: true, totalMatches: lines.length } : {}),
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { error: `grep命令执行失败: ${message}` };
            }
        },
    });
};