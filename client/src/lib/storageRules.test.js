import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  getStorage,
  connectStorageEmulator,
  ref,
  uploadBytes,
  getBytes,
} from 'firebase/storage';

const emulatorsRunning = await (async () => {
  if (typeof fetch === 'undefined') return false;
  try {
    await fetch('http://127.0.0.1:9099');
    return true;
  } catch {
    return false;
  }
})();

const describeSuite = emulatorsRunning ? describe : describe.skip;

describeSuite('Firebase Storage Security Rules', () => {
  let app;
  let auth;
  let storage;
  let doloresUid;
  let otherUid;

  beforeAll(async () => {
    // Initialize a dedicated Firebase App for testing
    app = initializeApp({
      apiKey: "fake-api-key-for-testing",
      authDomain: "localhost:9099",
      projectId: "flutter-ai-playground-f880c",
      storageBucket: "flutter-ai-playground-f880c.appspot.com",
    }, "StorageRulesTestApp");

    auth = getAuth(app);
    storage = getStorage(app);

    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
    connectStorageEmulator(storage, "localhost", 9199);

    // Create or sign in as Dolores (tsgoddessfireaf@gmail.com)
    try {
      const cred = await createUserWithEmailAndPassword(auth, 'tsgoddessfireaf@gmail.com', 'password123');
      doloresUid = cred.user.uid;
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        const cred = await signInWithEmailAndPassword(auth, 'tsgoddessfireaf@gmail.com', 'password123');
        doloresUid = cred.user.uid;
      } else {
        throw err;
      }
    }

    // Create or sign in as Other User (other@gmail.com)
    try {
      const cred = await createUserWithEmailAndPassword(auth, 'other@gmail.com', 'password123');
      otherUid = cred.user.uid;
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        const cred = await signInWithEmailAndPassword(auth, 'other@gmail.com', 'password123');
        otherUid = cred.user.uid;
      } else {
        throw err;
      }
    }

    // Sign out to start tests in clean state
    await signOut(auth);
  });

  afterAll(async () => {
    if (app) {
      await deleteApp(app);
    }
  });

  // Helper to simulate audio file
  const mockAudioBlob = new Blob(['mock audio data'], { type: 'audio/webm' });

  it('1. Blocks unauthenticated uploads', async () => {
    await signOut(auth);
    const path = `users/${doloresUid}/readings/reading-123/slide-0.webm`;
    const fileRef = ref(storage, path);

    await expect(uploadBytes(fileRef, mockAudioBlob, { contentType: 'audio/webm' }))
      .rejects.toThrow(/unauthorized|permission-denied/i);
  });

  it('2. Blocks authenticated user with incorrect email uploading to their own path', async () => {
    await signInWithEmailAndPassword(auth, 'other@gmail.com', 'password123');
    const path = `users/${otherUid}/readings/reading-123/slide-0.webm`;
    const fileRef = ref(storage, path);

    await expect(uploadBytes(fileRef, mockAudioBlob, { contentType: 'audio/webm' }))
      .rejects.toThrow(/unauthorized|permission-denied/i);
  });

  it('3. Blocks authenticated user (Dolores) uploading to another user\'s path', async () => {
    await signInWithEmailAndPassword(auth, 'tsgoddessfireaf@gmail.com', 'password123');
    // Attempting to upload to otherUid's path
    const path = `users/${otherUid}/readings/reading-123/slide-0.webm`;
    const fileRef = ref(storage, path);

    await expect(uploadBytes(fileRef, mockAudioBlob, { contentType: 'audio/webm' }))
      .rejects.toThrow(/unauthorized|permission-denied/i);
  });

  it('4. Allows authenticated user (Dolores: tsgoddessfireaf@gmail.com) uploading to their own path', async () => {
    await signInWithEmailAndPassword(auth, 'tsgoddessfireaf@gmail.com', 'password123');
    const path = `users/${doloresUid}/readings/reading-123/slide-0.webm`;
    const fileRef = ref(storage, path);

    const result = await uploadBytes(fileRef, mockAudioBlob, { contentType: 'audio/webm' });
    expect(result.metadata.fullPath).toBe(path);
  });

  it('5. Allows unauthenticated users to read (download) the uploaded audio files publicly', async () => {
    // Sign out to be unauthenticated
    await signOut(auth);
    const path = `users/${doloresUid}/readings/reading-123/slide-0.webm`;
    const fileRef = ref(storage, path);

    // Unauthenticated user downloads the bytes of the file
    const bytes = await getBytes(fileRef);
    const text = new TextDecoder().decode(bytes);
    expect(text).toBe('mock audio data');
  });
});
