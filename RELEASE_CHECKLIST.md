# Release checklist

1. Run `npm run release:check`. It builds the app, checks both TypeScript projects, and runs regression tests. Stop if any check fails.
2. Run `node_modules/.bin/electron tests/overlay-library-smoke.cjs` for hidden-browser rendering, queues, and transport fallback. Review the generated preview images.
3. Bump package.json and package-lock.json together. Build into a new release-alphaN folder with `npm run dist:win -- --config.directories.output=release-alphaN --publish never`.
4. Confirm packaged version, app-update.yml GitHub repository, installer size, and generated latest.yml SHA-512 against the exact installer.
5. Upload source and installer, .blockmap and latest.yml to a draft GitHub prerelease. Publish only when all assets are present. Never rename the installer without regenerating metadata.
6. Test from the previous installed version: check, download, cancel installation, confirm LIVE guard, then install while offline. Verify restart into the expected version, settings/rules preservation, and local/public overlay health. Record untested items explicitly.
7. Confirm duplicate launch focuses the running app. Test a backup, a changed setting, and restore. Confirm the prior state remains available as a backup.

## Windows signing setup

The current installer is unsigned. No usable code-signing certificate was found in the current user's Windows certificate store during inspection. Do not describe electron-builder's signing log lines as proof of a signature.

Supported setup for electron-builder 26: https://www.electron.build/v26/docs/features/code-signing/code-signing-win/

Obtain a code-signing certificate or configure a supported cloud-signing account with publisher identity verification. Keep private keys and signing credentials outside the repository. After credentials are configured, use `forceCodeSigning: true` in the release build configuration and verify the installer with Get-AuthenticodeSignature (Status must be Valid, expected publisher). Test updates from the unsigned alpha before switching the public channel. Do not enable a required publisher name until a matching signed release is available.

Signing account enrollment, identity verification, and any purchase require the owner's participation. No signing credentials or accounts have been created automatically.
