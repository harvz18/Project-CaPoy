# MULTIVENT Website

The official marketing site for MULTIVENT. Its standard entry point is `index.html`; it introduces the client and service-provider experiences and provides the current Android preview build.

## Run locally

From `Capstone/Website`:

```powershell
npm run dev
```

Open `http://127.0.0.1:5500`.

## Android download

`GET /download/android` serves `Capstone/builds/MULTIVENT-1.0.0-preview-fcm.apk`. The website does not duplicate the 88 MB APK; it streams the one already maintained with the mobile application.

For a hosted deployment, set `MULTIVENT_ANDROID_APK_PATH` to the absolute path of the APK available on that host. Add the final Google Play or Apple App Store URLs only after those listings exist.

## Verification

```powershell
npm run check
```
