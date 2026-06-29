import { describe, it, expect, vi, beforeEach } from 'vitest';

const { firebaseMockDb, firebaseMockAuth } = vi.hoisted(() => ({
  firebaseMockDb: { type: 'firestore' },
  firebaseMockAuth: {
    type: 'auth',
    currentUser: { uid: 'test-uid', getIdToken: vi.fn() }
  }
}));

// Mock Firebase modules
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/firestore', () => {
  const actual = vi.importActual('firebase/firestore');
  return {
    ...actual,
    getFirestore: vi.fn(() => firebaseMockDb),
    collection: vi.fn(),
    addDoc: vi.fn(),
    doc: vi.fn(),
    updateDoc: vi.fn(),
    setDoc: vi.fn(),
    arrayUnion: vi.fn((val) => ({ arrayUnion: val })),
    serverTimestamp: vi.fn(() => 'server-timestamp'),
    getDoc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    getDocs: vi.fn(),
  };
});

vi.mock('firebase/auth', () => {
  const GoogleAuthProvider = vi.fn();
  GoogleAuthProvider.credentialFromError = vi.fn();
  return {
    getAuth: vi.fn(() => firebaseMockAuth),
    onAuthStateChanged: vi.fn(),
    GoogleAuthProvider,
    signInWithPopup: vi.fn(),
    signInWithCredential: vi.fn(),
    signOut: vi.fn(),
  };
});

vi.mock('firebase/storage', () => {
  const uploadBytes = vi.fn(() => Promise.resolve());
  const getDownloadURL = vi.fn(() => Promise.resolve('https://mock-storage-url.com/file'));
  const ref = vi.fn(() => ({}));
  const getStorage = vi.fn(() => ({}));
  return {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
    connectStorageEmulator: vi.fn(),
  };
});


describe('firebase.js', () => {
  let firebase;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'mock-key');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'mock-id');

    firebase = await import('./firebase.js');

    vi.restoreAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  describe('initialization', () => {
    it('FIREBASE_ENABLED should be true', () => {
      expect(firebase.FIREBASE_ENABLED).toBe(true);
    });

    it('handles initialization failure', async () => {
      vi.resetModules();
      vi.stubEnv('VITE_FIREBASE_API_KEY', 'mock-key');
      vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'mock-id');

      const { initializeApp } = await import('firebase/app');
      vi.mocked(initializeApp).mockImplementationOnce(() => {
        throw new Error('Init failed');
      });

      await import('./firebase.js');
      expect(console.warn).toHaveBeenCalledWith('[firebase] init failed:', 'Init failed');
    });

    it('handles disabled state', async () => {
      vi.resetModules();
      vi.stubEnv('VITE_FIREBASE_API_KEY', '');
      vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '');

      const fb = await import('./firebase.js');
      expect(fb.FIREBASE_ENABLED).toBe(false);
      expect(console.info).toHaveBeenCalledWith(expect.stringContaining('[firebase] disabled'));
    });
  });

  describe('Auth functions', () => {
    it('getIdToken returns null on error', async () => {
      firebaseMockAuth.currentUser.getIdToken.mockRejectedValueOnce(new Error('Token error'));
      const token = await firebase.getIdToken();
      expect(token).toBeNull();
    });

    it('signInWithGoogle handles popup closed by user', async () => {
      const { signInWithPopup } = await import('firebase/auth');
      vi.mocked(signInWithPopup).mockRejectedValue({ code: 'auth/popup-closed-by-user' });
      const result = await firebase.signInWithGoogle();
      expect(result).toEqual({ cancelled: true });
    });

    it('signInWithGoogle handles credential already in use', async () => {
      const { signInWithPopup, signInWithCredential, GoogleAuthProvider } = await import('firebase/auth');
      vi.mocked(signInWithPopup).mockRejectedValue({ code: 'auth/credential-already-in-use' });
      vi.mocked(GoogleAuthProvider.credentialFromError).mockReturnValue('mock-credential');
      vi.mocked(signInWithCredential).mockResolvedValue({ user: { uid: 'other-uid' } });

      const result = await firebase.signInWithGoogle();
      expect(result.user.uid).toBe('other-uid');
      expect(signInWithCredential).toHaveBeenCalledWith(expect.anything(), 'mock-credential');
    });

    it('signInWithGoogle handles unexpected errors', async () => {
      const { signInWithPopup } = await import('firebase/auth');
      vi.mocked(signInWithPopup).mockRejectedValue(new Error('Auth failed'));
      const result = await firebase.signInWithGoogle();
      expect(result).toEqual({ error: 'Auth failed' });
    });

    it('signInWithGoogle handles failure in recovery path', async () => {
      const { signInWithPopup, signInWithCredential } = await import('firebase/auth');
      vi.mocked(signInWithPopup).mockRejectedValue({ code: 'auth/credential-already-in-use' });
      vi.mocked(signInWithCredential).mockRejectedValue(new Error('Recovery failed'));

      const result = await firebase.signInWithGoogle();
      expect(result).toEqual({ error: 'Recovery failed' });
    });

    it('signOutUser handles errors', async () => {
      const { signOut } = await import('firebase/auth');
      vi.mocked(signOut).mockRejectedValue(new Error('Sign out failed'));
      await firebase.signOutUser();
      expect(console.warn).toHaveBeenCalledWith('[firebase] signOutUser failed:', 'Sign out failed');
    });
  });

  describe('Firestore Write functions', () => {
    it('saveReading handles errors', async () => {
      const { addDoc } = await import('firebase/firestore');
      vi.mocked(addDoc).mockRejectedValue(new Error('Add failed'));
      const result = await firebase.saveReading({ question: 'Test' });
      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith('[firebase] saveReading failed:', 'Add failed');
    });

    it('appendFollowUp handles errors', async () => {
      const { updateDoc } = await import('firebase/firestore');
      vi.mocked(updateDoc).mockRejectedValue(new Error('Update failed'));
      await firebase.appendFollowUp('id', { role: 'user', content: 'hi' });
      expect(console.warn).toHaveBeenCalledWith('[firebase] appendFollowUp failed:', 'Update failed');
    });

    it('updateJournal handles errors', async () => {
      const { updateDoc } = await import('firebase/firestore');
      vi.mocked(updateDoc).mockRejectedValue(new Error('Update failed'));
      await firebase.updateJournal('id', { notes: 'test' });
      expect(console.warn).toHaveBeenCalledWith('[firebase] updateJournal failed:', 'Update failed');
    });

    it('shareReading handles errors', async () => {
      const { updateDoc } = await import('firebase/firestore');
      vi.mocked(updateDoc).mockRejectedValue(new Error('Update failed'));
      const result = await firebase.shareReading('id');
      expect(result).toBe(false);
      expect(console.warn).toHaveBeenCalledWith('[firebase] shareReading failed:', 'Update failed');
    });

    it('updateUserPreferences handles errors', async () => {
      const { updateDoc } = await import('firebase/firestore');
      vi.mocked(updateDoc).mockRejectedValue(new Error('Update failed'));
      await firebase.updateUserPreferences({ theme: 'dark' });
      expect(console.warn).toHaveBeenCalledWith('[firebase] updateUserPreferences failed:', 'Update failed');
    });

    it('saveUserConsent handles errors', async () => {
      const { setDoc } = await import('firebase/firestore');
      vi.mocked(setDoc).mockRejectedValue(new Error('Set failed'));
      await firebase.saveUserConsent({ allow_training_data: true });
      expect(console.warn).toHaveBeenCalledWith('[firebase] saveUserConsent failed:', 'Set failed');
    });
  });

  describe('Firestore Read functions', () => {
    it('loadUserReadings handles errors', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockRejectedValue(new Error('Fetch failed'));
      const result = await firebase.loadUserReadings();
      expect(result).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith('[firebase] loadUserReadings failed:', 'Fetch failed');
    });

    it('loadUserProfile handles errors', async () => {
      const { getDoc } = await import('firebase/firestore');
      vi.mocked(getDoc).mockRejectedValue(new Error('Fetch failed'));
      const result = await firebase.loadUserProfile();
      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith('[firebase] loadUserProfile failed:', 'Fetch failed');
    });

    it('loadPublicReading handles errors', async () => {
      const { getDoc } = await import('firebase/firestore');
      vi.mocked(getDoc).mockRejectedValue(new Error('Fetch failed'));
      const result = await firebase.loadPublicReading('id');
      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith('[firebase] loadPublicReading failed:', 'Fetch failed');
    });

    it('loadReading handles errors', async () => {
      const { getDoc } = await import('firebase/firestore');
      vi.mocked(getDoc).mockRejectedValue(new Error('Fetch failed'));
      const result = await firebase.loadReading('id');
      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith('[firebase] loadReading failed:', 'Fetch failed');
    });
  });

  describe('Storage functions', () => {
    it('uploadSlideAudio uploads audio blob to correct path and returns URL', async () => {
      const { uploadBytes, getDownloadURL, ref } = await import('firebase/storage');
      const blob = new Blob(['audio data'], { type: 'audio/webm' });
      
      const url = await firebase.uploadSlideAudio('reading-123', 0, blob);
      
      expect(ref).toHaveBeenCalledWith(expect.anything(), 'users/test-uid/readings/reading-123/slide-0.webm');
      expect(uploadBytes).toHaveBeenCalled();
      expect(url).toBe('https://mock-storage-url.com/file');
    });

    it('uploadSlideAudio returns null if user is not authenticated', async () => {
      // Temporarily mock currentUser to null
      const originalUser = firebaseMockAuth.currentUser;
      firebaseMockAuth.currentUser = null;
      
      const blob = new Blob(['audio data'], { type: 'audio/webm' });
      const url = await firebase.uploadSlideAudio('reading-123', 0, blob);
      
      expect(url).toBeNull();
      
      firebaseMockAuth.currentUser = originalUser;
    });

    it('fetchLibraryText fetches file from storage', async () => {
      const { getDownloadURL, ref } = await import('firebase/storage');
      
      // Mock fetch response
      const globalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        text: () => Promise.resolve('Mocked library text content')
      });

      const text = await firebase.fetchLibraryText('alchabitius-english.txt');
      
      expect(ref).toHaveBeenCalledWith(expect.anything(), 'library/alchabitius-english.txt');
      expect(getDownloadURL).toHaveBeenCalled();
      expect(text).toBe('Mocked library text content');

      global.fetch = globalFetch;
    });
  });
});
