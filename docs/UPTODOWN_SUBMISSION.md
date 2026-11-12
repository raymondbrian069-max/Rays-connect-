# Rays Connect — Uptodown submission pack

## Verified project details
- App name: Rays Connect
- Android application ID: com.raysconnect.app
- Website: https://rays-connect-six.vercel.app
- Source repository: https://github.com/raymondbrian069-max/Rays-connect-
- Category suggestion: Social
- Distribution model: Free
- Ads / in-app purchases: none are present in the current app code reviewed for this submission draft.
- App features visible in the current code: email/password registration and sign-in, member profiles, feed posts, photo uploads, likes, comments and replies, notifications, direct messages, photo messages and recorded voice messages.
- Current CI build: Android debug APK and unsigned release AAB built successfully on 2026-11-12. The debug APK is for testing only; the AAB is not yet signed for production.

## Store listing copy
Short description (under Uptodown's 70-character limit):
Connect with people, share updates, photos and private messages.

Full description:
Rays Connect is a social app for sharing updates and keeping in touch with a community. Create an account, set up a profile, publish text and photo posts, and interact with other members through likes, comments and replies. Find members by name or username and start private conversations. You can also share photos and recorded voice messages in chats, and receive notifications about activity on your posts.

Rays Connect is designed to bring community sharing and conversations together in one place. Use a respectful tone, share only content you have the right to post, and keep your sign-in details private.

## Submission fields to confirm with the rights-holding app owner
- Developer / organization name and verified contact email.
- Confirmation that the submitting account holds the right to distribute Rays Connect.
- Country availability and app author nationality, if requested.
- Final PEGI / age guidance based on an actual content and moderation review.
- Confirm the app's distribution license. The repository currently has no LICENSE file; do not claim an open-source license. Uptodown's default proprietary classification may be appropriate only if the rights holder confirms it.
- Confirm whether any third-party analytics, advertising, crash reporting, or other SDKs have been added since this code review.

## Required before public submission
1. Generate and retain a production Android signing keystore under the rights holder's control. Never commit it or send it in chat.
2. The rights holder must add these GitHub Actions secrets in the repository settings:
   - ANDROID_KEYSTORE_BASE64
   - ANDROID_KEYSTORE_PASSWORD
   - ANDROID_KEY_ALIAS
   - ANDROID_KEY_PASSWORD
   Existing build secrets VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are also required.
3. Run the workflow `.github/workflows/android-release.yml` and verify the APK signature and install/test the release on supported Android devices.
4. Publish a real privacy policy with a working contact address. The app handles account email, username, optional full name and bio, profile photos, posts, comments, likes, messages, photo/audio attachments, and notification records using Supabase. The exact retention, deletion procedure, hosting region, backup practices, and support contact must be confirmed by the service owner before the policy is published.
5. Review and test account deletion, content reporting, blocking, and moderation processes. These are not fully implemented in the current app UI.
6. Capture genuine screenshots from the finished app. Uptodown recommends a square PNG icon at least 256×256 and a 1024×500 featured image.
7. Submit through the rights holder's Uptodown Developers Console account and wait for editorial approval.

## Official submission references
- Developer registration: https://www.uptodown.dev/sign-up
- Publishing guide: https://support.uptodown.com/hc/en-us/articles/360053260491-How-to-publish-an-app-on-Uptodown
- Publication criteria: https://support.uptodown.com/hc/en-us/articles/360052792972-Uptodown-s-app-publication-criteria
