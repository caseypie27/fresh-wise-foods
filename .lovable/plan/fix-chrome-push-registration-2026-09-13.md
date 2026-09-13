# Fix Chrome push registration

## Changes
- Make notification permission checks distinguish blocked, dismissed, unsupported, and embedded-preview states instead of reporting every failure as “permission denied.”
- Register and activate the root service worker reliably before creating a push subscription.
- Validate or recreate stale subscriptions against FreshTrack’s current public push key, then save the active device subscription.
- Reuse the corrected flow from Home, Profile, onboarding, and supermarket reminders without changing their existing features.
- Improve the Enable and test actions so they report the exact recovery step when Chrome has blocked the current site.

## Verification
- Check the service worker scope and activation in Chrome.
- Exercise permission and subscription states in the preview and published origin.
- Run the relevant type checks and verify the existing notification UI remains functional.

## Technical details
- Keep the existing Web Push service worker and server delivery endpoints.
- Use the browser’s current permission state before prompting; `denied` cannot be re-prompted by JavaScript and must be changed for the exact origin.
- Compare existing subscription application-server keys and replace incompatible subscriptions safely.
