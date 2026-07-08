# Aeonic Arts — Next Steps to Deploy
**Status:** Build Repair Complete | Ready for GitHub Push

---

## 🟢 READY NOW

### Commit & Push (5 minutes)

```bash
# Stage the repair files
git add .github/workflows/ci.yml functions/package.json

# Commit with clear message
git commit -m "fix: repair CI pipeline - correct directory paths and add missing test scripts

- Change working-directory from 'server' to 'functions' (backend actually lives in functions/)
- Update cache-dependency-path to functions/package-lock.json
- Add test script to functions/package.json (vitest run)
- Add vitest as devDependency
- Standardize Node version to 22 across all CI jobs"

# Push to main
git push origin main
```

### Monitor CI (2-5 minutes after push)
- Go to: https://github.com/tsgoddessfireaf-beep/AEVUM_2.0_HISTORICAL/actions
- Watch for the CI workflow to run
- Expected: ✅ All green (test-client, test-server, build jobs pass)

### After CI Passes
- Firebase Cloud Functions will be deployed automatically
- Check production: https://app.aeonicarts.com

---

## 🟡 SHOULD DO SOON

### Ephemeris Service Update (Last synced 6/27, now 7/7)
The pyswisseph library is 7 days behind. While it's working, newer versions may have precision improvements.

```bash
# Update ephemeris-service to latest main
cd ephemeris-service
git pull origin main

# Verify still works
cd ..
npm run dev

# Test ephemeris endpoint manually
curl http://localhost:3001/api/health
```

**If working:** No action needed (live rebuild will pick up new code)
**If broken:** Check the test output and ephemeris-service/main.py

---

## 🔵 OPTIONAL CLEANUP

### Remove Stale Branches

The `fix-broken-build-process` branch has been merged but still exists on remote:

```bash
# Delete locally
git branch -d fix-broken-build-process

# Delete on GitHub
git push origin --delete fix-broken-build-process
```

The `refactor-frontend-conversation-ui` branch:
- Status: Unknown (not in active branches list)
- Action: Decide if this feature is still wanted
- If not needed: `git push origin --delete refactor-frontend-conversation-ui`

---

## 📋 COMPLETE CHECKLIST

### Pre-Push
- [x] CI workflow paths fixed (server → functions)
- [x] Test script added to functions/package.json
- [x] Node version standardized to 22
- [x] Vitest dependency added
- [x] All source code verified unchanged

### Post-Push (Automated)
- [ ] GitHub Actions CI runs
- [ ] test-client job passes
- [ ] test-server job passes
- [ ] build job passes
- [ ] Firebase Cloud Functions auto-deploy

### Post-Deploy (Manual Verification)
- [ ] Landing page loads: https://www.aeonicarts.com
- [ ] App starts: https://app.aeonicarts.com
- [ ] Health check: `/api/health`
- [ ] Chat endpoint works: `/api/chat/house-signification`
- [ ] Ephemeris calculation works: `/api/ephemeris`

---

## 🚨 TROUBLESHOOTING

If CI still fails after push, check:

1. **Did npm dependencies install?**
   ```bash
   cd functions
   npm ci
   npm test
   ```

2. **Are test files discoverable?**
   ```bash
   npm test -- --list
   ```

3. **Is vitest installed?**
   ```bash
   npm ls vitest
   ```

4. **Check CI logs on GitHub:**
   - Actions tab → latest workflow run → see exact error

---

## 📊 BUILD ARTIFACT UPDATED

The file `aeonic_arts_build_tracker.html` has been updated to reflect:
- ✅ Root cause identified (wrong directory path)
- ✅ Repairs applied
- ✅ Status: Ready for next CI run

Open in browser to see live build status tracker.

---

## 🎯 SUCCESS CRITERIA

**Build is successful when:**
1. ✅ GitHub CI shows green checkmarks on all jobs
2. ✅ Firebase Cloud Functions deployment completes without errors
3. ✅ Production endpoints respond with 200 status
4. ✅ No errors in Firebase logs

**If all above pass:** You're back to a clean, working deployment with proper CI/CD pipeline.

---

*Repair completed: 7/7/2026 | Ready to ship*
