# Get the Android app (APK)

The app is this website packed into an Android app with its own icon and splash screen. You don't need Android Studio: GitHub builds the APK for you.

## 1. Upload everything to your GitHub repository
You need these at the top level: `index.html`, `manifest.webmanifest`, `sw.js`, `css`, `js`, `icons`, `apps-script`, `app`, `.github`, `.gitignore`.
- **Easiest: GitHub Desktop** (https://desktop.github.com). Add the folder as a repository and press **Push**.
- **In the browser:** upload at most 100 files at a time. First the website files, then the `app` folder, then `.github`.

If the **Actions** tab only shows "Get started with GitHub Actions", the hidden `.github` folder didn't upload. Click **set up a workflow yourself**, name the file `build-apk.yml`, paste in the contents of `.github/workflows/build-apk.yml` from this folder, and press **Commit changes**.

## 2. Build the APK (about 5 to 8 minutes)
1. Open the **Actions** tab, click **Build Android APK**, then **Run workflow > Run workflow**. (It also runs every time you push.)
2. When it shows a green tick, open the run, press **Summary** (top of the left sidebar) and scroll to **Artifacts**.
3. Download **purchase-planner-apk**. Unzip it to get `app-debug.apk`.

## 3. Install it on your phone
1. Send `app-debug.apk` to the phone (Google Drive, Telegram, USB cable).
2. Open it, allow installs from that app when Android asks, and press **Install**. If Play Protect warns that the app is unrecognised, choose **Install anyway**.

## Good to know
- If you use the Google Sheet option, items you add on the phone show up on the website and the other way round, without a new APK.
- Without the Google Sheet, the phone app keeps its own list on that phone, separate from the website.
- You only need a new APK when the website files themselves change (design or new features). Push the change, wait for the run, then install the new APK over the old one. Your items are kept.
- This is a "debug" build signed with a standard test key. It's fine for personal use; a Play Store release would need your own signing key.
- The phone's back button closes an open window first, then returns to the Board, then leaves the app.
- Rename the app in `app/capacitor.config.json` (`appName`) and `app/android/app/src/main/res/values/strings.xml`. Replace the icons in `icons/` and `app/android/app/src/main/res/mipmap-*`.
