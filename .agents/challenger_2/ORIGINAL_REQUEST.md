## 2026-06-29T07:35:00Z
You are a Challenger Agent (Challenger 2).
Your task is to empirically verify the audio upload path and the Firebase Storage security rules.

Please:
1. Run the build and start the Firebase emulators (`firebase emulators:start`).
2. Write a verification script or test to simulate an audio upload to the path:
   `users/{userId}/readings/{readingId}/slide-{slideIndex}.{ext}`
3. Verify that:
   - An authenticated user whose email is `tsgoddessfireaf@gmail.com` can successfully upload to their own path.
   - An unauthenticated user, or an authenticated user with a different email, or a user uploading to a different `userId` path is blocked by the security rules in `storage.rules`.
   - The uploaded audio files are publicly readable (allowing anyone to listen).
4. Document the results of these security and pathing tests.
5. Write your challenge report `challenge_2.md` in your working directory (under `.agents/challenger_2/`) and report back when done.
When done, send a message to the orchestrator (conversation ID: 980d0fe0-5bf0-49de-a03d-3d83ee90bbd8).
