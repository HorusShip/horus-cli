# Changelog: @horusship/cli

## 0.2.0 (unreleased)

Makes the CLI nicer to use day to day, on top of 0.1.0's generated commands.

- Colored, aligned tables on a terminal (status words, profit) — plain text when piped,
  scripted, with `--json`, with `--no-color`, or with `NO_COLOR` set.
- Friendlier aliases alongside the generated commands: `horus orders` (= `sales`),
  `<resource> show <id>` (= `get`), `<resource> recent` (= `list`), and
  `<resource> search <text>` (= `list --search`/`--q`, whichever that resource has).
- `horus stats`: a one-screen dashboard (revenue, profit, units sold, active listings,
  and anything that needs attention — an offline desktop, eBay accounts with issues).
- `--watch` (and `--watch-interval`, `--watch-count`) to re-run any read command on an
  interval, like the Unix `watch` command — works on `horus stats` and every list/get.
- A sale's profit and an eBay account's health (previously nested, so invisible in a
  table) now show as a plain column.
- "Did you mean …?" for a mistyped command or flag.
- `horus completion bash|zsh|fish|powershell`.
- A spinner on stderr for slow calls, only on a TTY (never with `--json`).
- Clearer error messages: a `401` points at `horus login`, a `desktop_offline` `503`
  points at starting Horus Desktop, a `429` shows the retry delay, and so on. `--json`
  error output is unchanged (still just `{ status, type, code, message, details, request_id }`).
- Every built-in command (`login`, `logout`, `whoami`, `stats`, `api`, `completion`,
  `webhooks verify`) has its own `--help` with examples, instead of the whole root help.

## 0.1.0 (unreleased)

First release.

- `horus <resource> <verb>` for every API operation, with help generated from the spec.
- `horus login` (OAuth device flow with issuer discovery, or `--api-key`), `logout` (revokes the refresh token), `whoami`, `--profile`, `HORUS_API_KEY`.
- Output: tables by default, `--json` for machines, `--all` to follow every page, `--wait` for desktop jobs.
- `horus api <METHOD> <path>` passthrough and `horus webhooks verify`.
- Exit codes: 0 ok, 1 API/runtime error, 2 usage error.
