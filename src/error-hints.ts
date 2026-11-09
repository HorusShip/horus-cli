/** A one-line "what do I do about this" for the API errors sellers hit most, appended to the human (stderr) error message. `--json` stays a stable `{ error }` shape without hints — scripts and agents branch on `code`/`type`. */
import { AuthenticationError, DesktopOfflineError, NotFoundError, PermissionError, RateLimitError } from "@horusship/sdk";

function requiredScope(details: unknown): string | undefined {
    if (typeof details !== "object" || details === null) return undefined;
    const required = (details as { required?: unknown }).required;
    return typeof required === "string" ? required : Array.isArray(required) ? required.join(", ") : undefined;
}

export function errorHint(e: unknown): string | undefined {
    if (e instanceof DesktopOfflineError) return "Start Horus Desktop and try again.";
    if (e instanceof AuthenticationError) return "Run `horus login`.";
    if (e instanceof PermissionError) {
        const scope = requiredScope(e.details);
        return scope ? `Your credential is missing the "${scope}" scope — run \`horus login\` to grant it.` : "Your credential doesn't have permission for this.";
    }
    if (e instanceof RateLimitError) return e.retryAfter !== undefined ? `Retry in ${e.retryAfter}s.` : "You're being rate limited; slow down and retry.";
    if (e instanceof NotFoundError) return undefined;
    return undefined;
}
