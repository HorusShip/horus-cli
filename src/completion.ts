/**
 * `horus completion bash|zsh|fish|powershell`: static word-list completion
 * for the top-level commands and each resource's direct subcommands (one
 * level deep — enough for `horus list<TAB>` and `horus listings sh<TAB>`;
 * deeper paths like `accounts jobs create` fall back to file completion).
 */
import { TOP_LEVEL_ALIASES, type CommandNode } from "./commands.js";
import { UsageError } from "./params.js";

export const SHELLS = ["bash", "zsh", "fish", "powershell"] as const;
export type Shell = (typeof SHELLS)[number];

export interface WordTree {
    top: readonly string[];
    children: Readonly<Record<string, readonly string[]>>;
}

export function wordTree(root: CommandNode, builtins: readonly string[]): WordTree {
    const top = [...new Set([...builtins, ...root.children.keys(), ...Object.keys(TOP_LEVEL_ALIASES)])].sort();
    const children: Record<string, readonly string[]> = {};
    for (const [name, node] of root.children) {
        const words = [...node.children.keys()];
        if (name === "webhooks") words.push("verify");
        if (words.length) children[name] = words.sort();
    }
    return { top, children };
}

function bash({ top, children }: WordTree): string {
    const cases = Object.entries(children).map(([name, words]) => `        ${name}) COMPREPLY=($(compgen -W "${words.join(" ")}" -- "$cur")) ;;`).join("\n");
    return `# horus bash completion. Load with: eval "$(horus completion bash)"
_horus_complete() {
    local cur
    cur="\${COMP_WORDS[COMP_CWORD]}"
    COMPREPLY=()
    if [ "$COMP_CWORD" -eq 1 ]; then
        COMPREPLY=($(compgen -W "${top.join(" ")}" -- "$cur"))
        return 0
    fi
    case "\${COMP_WORDS[1]}" in
${cases}
        *) ;;
    esac
}
complete -F _horus_complete horus
`;
}

function zsh(tree: WordTree): string {
    return `#compdef horus
# horus zsh completion. Load with: eval "$(horus completion zsh)"
autoload -U +X bashcompinit && bashcompinit
${bash(tree)}`;
}

function fish({ top, children }: WordTree): string {
    const topLine = `complete -c horus -n "__fish_use_subcommand" -a "${top.join(" ")}"`;
    const subLines = Object.entries(children).map(([name, words]) => `complete -c horus -n "__fish_seen_subcommand_from ${name}" -a "${words.join(" ")}"`);
    return `# horus fish completion. Load with: horus completion fish | source\n${[topLine, ...subLines].join("\n")}\n`;
}

function powershell({ top, children }: WordTree): string {
    const cases = Object.entries(children).map(([name, words]) => `            "${name}" { @(${words.map((w) => `"${w}"`).join(", ")}) }`).join("\n");
    return `# horus PowerShell completion. Load with: horus completion powershell | Out-String | Invoke-Expression
Register-ArgumentCompleter -Native -CommandName horus -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)
    $tokens = $commandAst.CommandElements | ForEach-Object { $_.ToString() } | Select-Object -Skip 1
    $words = if ($tokens.Count -le 1) {
        @(${top.map((w) => `"${w}"`).join(", ")})
    } else {
        switch ($tokens[0]) {
${cases}
            default { @() }
        }
    }
    $words | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
}
`;
}

const GENERATORS: Record<Shell, (tree: WordTree) => string> = { bash, zsh, fish, powershell };

export function isShell(s: string): s is Shell {
    return (SHELLS as readonly string[]).includes(s);
}

export function completionScript(shell: string, tree: WordTree): string {
    if (!isShell(shell)) throw new UsageError(`Unknown shell "${shell}". Pick one of: ${SHELLS.join(", ")}.`);
    return GENERATORS[shell](tree);
}
