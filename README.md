# @horusship/cli

`horus`: the [Horus](https://horusship.com) API from a terminal, a script or an
AI agent. It has a command for every API operation, generated from the OpenAPI
document — plus friendlier shortcuts for the jobs you do every day.

```sh
npm install -g @horusship/cli
horus login                 # browser sign-in (OAuth device flow)
horus stats                 # today's sales, profit, listings, issues
horus listings list --status LISTED
```

## Sign in

```sh
horus login                         # shows a code + URL; approve in the browser (works over SSH)
horus login --api-key ak_…          # or an API key from Settings → API
echo "$KEY" | horus login --api-key -
horus login --profile work          # several accounts side by side
horus whoami
horus logout                        # revokes the refresh token and forgets the profile
```

Credentials are stored per profile in `credentials.json` (file mode 0600) in the OS config directory:
`%APPDATA%\horus` on Windows, `~/Library/Application Support/horus` on macOS, and `$XDG_CONFIG_HOME/horus` or
`~/.config/horus` on Linux. `HORUS_CONFIG_DIR` overrides the location.

`HORUS_API_KEY=ak_…` overrides any stored credential. Other environment variables:
`HORUS_PROFILE`, `HORUS_BASE_URL`, `HORUS_ISSUER` / `HORUS_CLIENT_ID` (OAuth overrides),
`HORUS_WEBHOOK_SECRET`, `NO_COLOR`.

## Quick start

```sh
horus stats                              # today: revenue, profit, units, active listings, issues
horus stats --watch                      # same, refreshed every 5s until Ctrl+C

horus listings list --status LISTED      # a colored table on a terminal; plain text piped or scripted
horus listings search "bluetooth speaker"
horus listings show <id>
horus listings end <id> --reason out_of_stock

horus orders list                        # "orders" reads the same as "sales" — whichever you call them
horus orders show <id>                   # costs, profit, fulfilment, tracking, return state
horus orders ship <id> --tracking-number 1Z999AA10123456784 --carrier UPS

horus leads list                         # sourcing leads assigned to you
horus leads claim <id>

horus ebay accounts list                 # connected eBay accounts, with a health column
horus ebay accounts get <id>

horus webhooks list
horus webhooks test <id>                 # sends a webhook.test event now
horus webhooks verify --secret whsec_… --payload @body.json \
  --id evt_… --timestamp 1762516800 --signature "v1,…"   # checked locally, no API call

horus studio templates list              # Studio image templates
horus studio templates preview <id> --product-images https://example.com/a.jpg
```

## Commands

`horus <resource> [<sub>] <verb> [path args] [--flags]`, mirroring the operationIds
(`accounts.jobs.create` → `horus accounts jobs create`, camelCase → kebab-case):

```sh
horus listings list --status LISTED --limit 50
horus listings list --all --json > listings.json   # every page, one JSON list
horus sales get <id>
horus sales ship <id> --tracking-number 1Z999AA10123456784 --carrier UPS
horus accounts jobs create <id> --kind VERIFY_SESSION --wait
horus listings create --data @batch.json            # body from a file (or - for stdin)
horus webhooks deliveries list <webhook_id> --status failed
```

A few friendlier words work everywhere they make sense, alongside the generated ones:

- `horus orders …` is read as `horus sales …`.
- `<resource> show <id>` is `get` (e.g. `horus listings show l_1`).
- `<resource> recent` is `list`.
- `<resource> search <text>` is `list --search <text>` (or `--q`, whichever field that
  resource's `list` actually has — e.g. `horus listings search lamp`, `horus sales search "1Z999"`).

Other notes:

- Flags are the query params (reads) or the top-level body fields (writes),
  in `--kebab-case` (`--tracking_number` also works). Values are type-checked
  against the spec: numbers, enums, `true`/`false`, arrays (`--items a,b` or
  repeat the flag) and JSON objects.
- `--data <json|@file|->` supplies the whole params/body; individual flags override fields.
- `--wait` polls a 202 desktop job until it finishes (`--wait-timeout`, `--wait-interval`).
  The exit code is 1 if the job fails.
- `--watch` re-runs any read (list or get) command on an interval and reprints it, like the
  Unix `watch` command — `horus stats --watch`, `horus orders list --watch --watch-interval 30`.
  Stops on Ctrl+C (`--watch-count` bounds it instead, mostly for scripts).
- A typo'd command or flag gets a "Did you mean …?" instead of a bare error.
- `horus <resource> --help` and `horus <resource> <verb> --help` show the spec's
  summaries, descriptions, flags, scopes and whether the command needs Horus Desktop.
  Every built-in (`login`, `stats`, `api`, `completion`, …) has its own `--help` too.

### Output

Tables are colored on a terminal (status words, profit) and plain otherwise — piped,
redirected, with `--json`, with `--no-color`, or with `NO_COLOR` set. Slow calls show a
spinner on stderr, only on a TTY. Reads show a spinner while the request is in flight.

```sh
horus listings list                 # colored table on a terminal
horus listings list | cat           # plain text once piped
horus listings list --json | jq .   # raw JSON
```

### Shell completion

```sh
eval "$(horus completion bash)"       # add to ~/.bashrc
eval "$(horus completion zsh)"        # add to ~/.zshrc
horus completion fish | source        # add to ~/.config/fish/config.fish
horus completion powershell | Out-String | Invoke-Expression   # add to your profile
```

Completes top-level commands and each resource's direct subcommands (e.g. `horus listings <TAB>`).

### Escape hatch

Raw passthrough for anything not (yet) built in:

```sh
horus api GET /listings --query status=LISTED --query limit=5
horus api POST /listings/validate --data '{"items":["B07ABC1234"]}'
```

## For agents and scripts

- `--json` prints the API response exactly as returned (pretty-printed). Lists keep the
  `{ object, data, has_more, next_cursor }` shape, also with `--all`. Never colored.
- Errors with `--json` go to stdout as
  `{ "error": { status, type, code, message, details, request_id } }`.
  The CLI's own errors use `type: "usage"`. Human (stderr) errors get an extra line when
  there's something to do about it — `401` says to run `horus login`, a `desktop_offline`
  `503` says to start Horus Desktop, and so on.
- Exit codes: `0` ok, `1` API or runtime error (or a failed `--wait` job), `2` usage error.
- Writes send an `Idempotency-Key`. Pass `--idempotency-key <key>` to make a retried command safe across runs.

MIT licensed.
