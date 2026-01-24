# macOS Code Signing Setup Guide

This guide explains how to set up code signing for your Hyper Connect macOS builds using GitHub Actions.

## Why Code Signing?

Without code signing, macOS users will see a "damaged app" error when trying to run your application. Code signing with an Apple Developer certificate eliminates this issue and allows users to run your app without workarounds.

---

## Prerequisites

### 1. Apple Developer Account

You need an **Apple Developer Program** membership ($99/year):

- Sign up at [developer.apple.com](https://developer.apple.com/programs/)
- Complete the enrollment process (may take 1-2 days)

### 2. Required Tools

- macOS computer (for certificate creation)
- Xcode installed (download from Mac App Store)
- Access to your GitHub repository settings

---

## Step 1: Create Developer ID Certificate

### On Your Mac

1. **Open Keychain Access**:
   - Applications → Utilities → Keychain Access

2. **Request a Certificate**:
   - Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority
   - Enter your email address (same as Apple ID)
   - Select "Saved to disk"
   - Click Continue and save the `.certSigningRequest` file

3. **Create Certificate on Apple Developer Portal**:
   - Go to [developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates)
   - Click the **+** button to create a new certificate
   - Select **Developer ID Application** (under "Software")
   - Upload your `.certSigningRequest` file
   - Download the certificate (`.cer` file)

4. **Install Certificate**:
   - Double-click the downloaded `.cer` file
   - It will be added to your Keychain Access

5. **Export Certificate as .p12**:
   - Open Keychain Access
   - Find your "Developer ID Application" certificate
   - Right-click → Export "Developer ID Application: Your Name"
   - Save as `.p12` format
   - **Set a strong password** (you'll need this for GitHub secrets)

---

## Step 2: Create App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com/)
2. Sign in with your Apple ID
3. Navigate to **Security** → **App-Specific Passwords**
4. Click **Generate an app-specific password**
5. Enter a label (e.g., "Hyper Connect Notarization")
6. **Save the generated password** (you'll need this for GitHub secrets)

---

## Step 3: Get Your Team ID

1. Go to [developer.apple.com/account](https://developer.apple.com/account)
2. Your **Team ID** is displayed at the top of the page
3. It's a 10-character alphanumeric string (e.g., `AB12CD34EF`)

---

## Step 4: Configure GitHub Secrets

### Convert Certificate to Base64

On your Mac, run:

```bash
base64 -i /path/to/your/certificate.p12 | pbcopy
```

This copies the base64-encoded certificate to your clipboard.

### Add Secrets to GitHub

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add the following:

| Secret Name                   | Value                  | Description                       |
| ----------------------------- | ---------------------- | --------------------------------- |
| `APPLE_CERTIFICATE`           | (paste from clipboard) | Base64-encoded .p12 certificate   |
| `APPLE_CERTIFICATE_PASSWORD`  | Your .p12 password     | Password you set when exporting   |
| `APPLE_ID`                    | <your@email.com>       | Your Apple ID email               |
| `APPLE_APP_SPECIFIC_PASSWORD` | xxxx-xxxx-xxxx-xxxx    | App-specific password from Step 2 |
| `APPLE_TEAM_ID`               | AB12CD34EF             | Your Team ID from Step 3          |

---

## Step 5: Test the Setup

1. **Trigger a Build**:
   - Go to **Actions** tab in your GitHub repository
   - Select **Build and Release** workflow
   - Click **Run workflow**

2. **Monitor the Build**:
   - Watch the macOS build job
   - The "Setup macOS Code Signing" step should now run
   - The build should complete successfully with a signed app

3. **Verify the Signed App**:
   - Download the `.dmg` from the release
   - Install and run the app on macOS
   - It should open without the "damaged app" error

---

## Troubleshooting

### "Setup macOS Code Signing" step is skipped

**Cause**: The workflow checks if `APPLE_CERTIFICATE` secret exists.

**Solution**: Verify all secrets are added correctly in GitHub Settings → Secrets.

### Certificate import fails

**Cause**: Incorrect base64 encoding or wrong password.

**Solution**:

- Re-export the certificate and ensure you use the correct password
- Re-encode to base64 and update the `APPLE_CERTIFICATE` secret

### Notarization fails

**Cause**: Incorrect Apple ID or app-specific password.

**Solution**:

- Verify your Apple ID is correct
- Generate a new app-specific password and update the secret
- Ensure your Team ID is correct

### Build succeeds but app still shows "damaged" error

**Cause**: The app might not be notarized yet, or Gatekeeper cache needs clearing.

**Solution**:

- Wait a few minutes for notarization to complete
- Run: `sudo spctl --master-disable` then `sudo spctl --master-enable`
- Try downloading the app again

---

## Maintenance

### Certificate Expiration

Developer ID certificates are valid for **5 years**. Before expiration:

1. Create a new certificate following Step 1
2. Export as .p12 with a new password
3. Update GitHub secrets with the new certificate and password

### Revoking Certificates

If your certificate is compromised:

1. Revoke it at [developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates)
2. Create a new certificate immediately
3. Update GitHub secrets

---

## Additional Resources

- [Apple Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [electron-builder Code Signing Docs](https://www.electron.build/code-signing)
- [Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

---

## Need Help?

If you encounter issues not covered here:

1. Check the [GitHub Actions logs](../../actions) for detailed error messages
2. Review the [electron-builder documentation](https://www.electron.build/)
3. Open an issue in this repository with the error details
