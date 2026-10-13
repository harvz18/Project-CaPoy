# MULTIVENT Website

The official marketing site for MULTIVENT. Its standard entry point is `index.html`; it introduces the client and service-provider experiences and provides the current Android preview build.

## Run locally

From `Capstone/Website`:

```powershell
npm run dev
```

Open `http://127.0.0.1:5500`.

## Android download

The website's Android button downloads the verified public build from:

```text
https://downloads.multivent.org/MULTIVENT-1.0.0-preview-fcm.apk
```

The local `GET /download/android` helper continues to serve `Capstone/builds/MULTIVENT-1.0.0-preview-fcm.apk` while developing on this computer.

Upload future Android release APKs to the R2 downloads bucket, update the URL in `index.html`, then deploy the website. Add final Google Play or Apple App Store URLs only after those listings exist.

## Verification

```powershell
npm run check
```
