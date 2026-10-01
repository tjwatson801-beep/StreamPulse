# StreamPulse Core Alpha 37

- Adds an Actions tab with gift-specific rules and minimum combo quantities.
- Supports Lucky Wheel webhooks, sounds, TTS, and image/GIF overlays.
- Includes the Lucky Wheel wheel 0 preset and URL-encoded sender-name substitution.
- Includes offline action tests. Webhook tests send a real request even when the rule is disabled.
- Rules run once per matching completed combo alongside existing Gift Reactions.
- Webhook failures are logged without automatic retries.

Build, TypeScript, gift-rule, webhook delivery, and reaction regression checks passed. A real Lucky Wheel spin remains unverified because the local webhook service was unavailable during testing.
