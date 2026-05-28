import type { Command } from "../types";
import { COMMANDS } from "../commands/command";

/**
 * Return commands whose name or description starts with the given query, or all commands when the query is empty.
 *
 * @param query - The search prefix used for case-insensitive matching against command `name` and `description`. An empty string returns all commands.
 * @returns An array of `Command` objects whose `name` or `description` starts with `query`; when `query` is empty, the full `COMMANDS` array.
 */
export function getFilteredCommands(query: string): Command[] {
    if (query.length === 0) return COMMANDS;
    return COMMANDS
        .filter((cmd) => cmd.name.toLowerCase().startsWith(query.toLowerCase()) || cmd.description.toLowerCase().startsWith(query.toLowerCase()));
};