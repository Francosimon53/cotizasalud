# Gotchas

Project-specific snags hit during work. Read this before starting a task here.

## Vercel CLI: `vercel env add <NAME> preview --yes` is not enough

The CLI still asks for a git branch and refuses to proceed even with `--value <v> --yes` flags. The fix is to pass an empty string as the third **positional** argument so it applies to all Preview branches:

```sh
vercel env add MY_VAR preview "" --value "$VAL" --yes
```

The CLI's own hint (`vercel env add NAME preview --value <v> --yes`) is wrong — that command loops back to the same prompt. Verified on Vercel CLI 51.8.0.

## zsh doesn't support `${!VAR}` indirect expansion

Loops that need indirect variable lookup (`for VAR in A B; do echo "${!VAR}"; done`) fail with `bad substitution` in zsh. Wrap the loop in an explicit `bash -c '...'` when you need this pattern. The default shell on macOS is zsh, so this trips up env-var scripts.

## Next.js `current_period_*` lives on the SubscriptionItem in Stripe API ≥ dahlia

In Stripe API version `2026-04-22.dahlia` (the default in `stripe ^22`), `current_period_start` and `current_period_end` are no longer top-level on `Stripe.Subscription` — they're on `subscription.items.data[0]`. Older snippets that read `subscription.current_period_end` directly will TS-error. Read from the item.
