import { tool } from "ai";
import { z } from "zod";

const MAX_OUTPUT = 20_000;
const DEFAULT_TIMEOUT = 30_000;

export function createBashTool(cwd: string) {
    return tool({
        description:
            "在项目目录中执行 shell 命令。用于运行测试、构建、git 操作、包安装以及任何其他 shell 命令。",
        inputSchema: z.object({
            command: z.string().describe("要执行的 shell 命令"),
            timeout: z
                .number()
                .describe("超时时间（默认：30000ms）")
                .default(DEFAULT_TIMEOUT),
        }),
        execute: async ({ command, timeout }) => {
            try {
                const proc = Bun.spawn(["bash", "-c", command], {
                    cwd,
                    stdout: "pipe",
                    stderr: "pipe",
                    env: { ...process.env, TERM: "dumb" },
                });

                const timer = setTimeout(() => {
                    proc.kill();
                }, timeout);

                const [stdout, stderr] = await Promise.all([
                    new Response(proc.stdout).text(),
                    new Response(proc.stderr).text(),
                ]);

                const exitCode = await proc.exited;
                clearTimeout(timer);

                const truncate = (s: string) =>
                    s.length > MAX_OUTPUT
                        ? s.slice(0, MAX_OUTPUT) + `\n... （已截断，共 ${s.length} 个字符）`
                        : s;

                return {
                    stdout: truncate(stdout),
                    stderr: truncate(stderr),
                    exitCode,
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { error: `执行命令失败： ${message}` };
            }
        },
    });
};