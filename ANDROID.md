# Android-app (Capacitor + FCM) — setup

De Android-app is een Capacitor-shell die `https://www.nlsplanning.nl` laadt. Native push gaat via Firebase Cloud Messaging (FCM).

- App ID: `nl.nlsplanning.app`
- App naam: `NLS Planning`
- Productie-URL: `https://www.nlsplanning.nl`

## 1. Dependencies installeren

```powershell
npm install
```

Dit installeert Capacitor, `@capacitor/push-notifications` en `firebase-admin`.

## 2. Android-platform toevoegen

Eenmalig:

```powershell
npx cap add android
```

Dit maakt een `android/` map aan met een Gradle-project.

## 3. Firebase project + google-services.json

1. Ga naar https://console.firebase.google.com → **Add project** (gratis).
2. In het project: **Add app → Android**.
   - Package name: **`nl.nlsplanning.app`** (exact, anders weigert FCM).
   - App nickname: vrij te kiezen.
3. Download **`google-services.json`** en plaats in `android/app/google-services.json`.
4. Volg Firebase's instructies om de Gradle-plugin toe te voegen:
   - **`android/build.gradle`** (project-level), in `buildscript { dependencies { ... } }`:
     ```
     classpath 'com.google.gms:google-services:4.4.2'
     ```
   - **`android/app/build.gradle`** (module-level), onderaan:
     ```
     apply plugin: 'com.google.gms.google-services'
     ```

## 4. Server credentials voor FCM

1. In Firebase Console → **Project Settings → Service accounts → Generate new private key**.
2. Download de JSON.
3. Zet de **inhoud** van die JSON als één env var:

   ```
   FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...",...}
   ```

   Op je productie-host (Vercel of waar `nlsplanning.nl` draait): voeg dit toe als environment variable.

   **Niet committen.** Voeg toe aan `.gitignore` als je hem lokaal in `.env.local` zet.

## 5. Database migratie

Het FCM-token model is toegevoegd. Run:

```powershell
npx prisma generate
npx prisma db push
```

## 6. Sync en open in Android Studio

```powershell
npx cap sync android
npx cap open android
```

Android Studio opent. De eerste sync duurt even (Gradle download).

## 7. Builden en testen

- **Op fysiek toestel via USB**: zet USB-debugging aan op de telefoon (Ontwikkelaarsopties), sluit aan via USB, en in Android Studio: groene play-knop → kies je toestel.
- **Emulator**: Tools → Device Manager → Create Device.

De app opent `https://www.nlsplanning.nl` in een webview. Inloggen werkt zoals in de browser; cookies/sessions blijven bewaard.

## 8. Push testen

1. Log in op het Android-toestel.
2. De app vraagt notificatie-permissie (Android 13+).
3. Het FCM-token wordt automatisch naar `/api/fcm-token` gestuurd.
4. Stuur een bericht naar deze user (bv. via een admin-account in de browser).
5. Het toestel moet een notificatie krijgen.

Debug: in **Firebase Console → Cloud Messaging** kun je test-berichten naar een specifiek token sturen.

## 9. APK voor distributie

In Android Studio: **Build → Generate Signed Bundle / APK**. Volg de wizard om een keystore te maken (bewaar deze op een veilige plek — zonder is updaten onmogelijk).

Voor Play Store distributie: $25 eenmalige Google Play Developer fee.

## Wijzigingen aan de webapp

Wijzigingen aan `nlsplanning.nl` zijn **direct** zichtbaar in de Android-app (geen rebuild nodig), behalve:
- Wijzigingen aan native dependencies of `capacitor.config.ts` → `npx cap sync android` + nieuwe APK.
- Wijzigingen aan permissions → nieuwe APK.
