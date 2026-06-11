# PayPal Mobile Test

A minimal native Android test app for the PayPal Mobile SDK
(`com.paypal.android:paypal-web-payments:2.3.0` + `com.paypal.android:payment-buttons:2.3.0`).
Single Activity, programmatic UI built with `MaterialCardView`, wired end-to-end to the
deployed backend so a checkout round-trip needs zero manual setup.

## End-to-end flow

1. User taps either the **official `PayPalButton`** widget or the hand-drawn comparison
   button.
2. App calls `POST {BACKEND}/api/checkout/orders/create-with-sample-data` and gets back a
   PayPal sandbox `orderId` (a $100 USD sample order).
3. App launches `PayPalWebCheckoutClient.start(...)` with that `orderId`. The PayPal SDK
   opens a Chrome Custom Tab against `sandbox.paypal.com`.
4. After the user completes / cancels in the browser, PayPal redirects back to the app via
   the configured URL scheme (`paypalmobiletest://`, declared in `AndroidManifest.xml`).
5. `onNewIntent` → `client.finishStart(intent)` resolves the result.
6. On `Success`, the app calls `POST {BACKEND}/api/checkout/orders/{orderId}/capture` and
   logs the capture response.

The backend lives at `../../paypal-backend-api/` (Next.js Edge Runtime, deployed to
`https://ppgms-test-github-io.pages.dev/`). Both endpoints have `Access-Control-Allow-Origin: *`.

## UI layout

The screen stacks five card sections (top → bottom):

| Card               | What's inside                                                                |
|--------------------|------------------------------------------------------------------------------|
| **Header**         | App title + `SANDBOX` / `LIVE` pill badge (color flips with the spinner)     |
| **Configuration**  | Client ID, Order ID (optional), return URL scheme, environment spinner       |
| **Sandbox Buyer**  | Hint card explaining `sb-xxx@personal.example.com` format + dashboard link   |
| **Checkout**       | Official `PayPalButton` (gold/CHECKOUT) + hand-drawn comparison + spinner    |
| **Activity Log**   | Tagged, timestamped log with a `Clear` button                                |

## Defaults

`Defaults.kt` carries the sandbox client ID that matches the deployed backend's merchant.
The backend already owns the client secret, so the Android app does **not** need it for the
SDK flow. The secret is kept as a constant only because this is a throwaway test app —
**never embed a real client secret in a production APK**.

| Field           | Default                                                              |
|-----------------|----------------------------------------------------------------------|
| Client ID       | `Aa9Fj_yJs0Ylv2ZxdwWd-5ATa8vNqnn8ykMXksfwk5TRR0zvu1XoTZRhrAvI5YtnyaIJrFSanfQUq-9O` |
| Backend         | `https://ppgms-test-github-io.pages.dev`                             |
| Return scheme   | `paypalmobiletest`                                                   |
| Environment     | Sandbox (Live selectable in the spinner)                             |

To complete checkout in sandbox you'll need a **PayPal sandbox personal account**, not a
real PayPal login. Format `sb-xxxxxx@personal.example.com`. Manage them at
`developer.paypal.com/dashboard/accounts`.

## Buttons — official SDK widget vs. hand-drawn

| Source                | Artifact                                       | Class                                              |
|-----------------------|------------------------------------------------|----------------------------------------------------|
| Official widget       | `com.paypal.android:payment-buttons:2.3.0`     | `com.paypal.android.paymentbuttons.PayPalButton`   |
| Hand-drawn (this app) | n/a — `TextView` + `bg_paypal_button.xml`      | `MainActivity.buildCustomButton()`                 |

The hand-drawn one is deliberately styled to look *different* from the official one (navy
fill, dashed yellow outline, square corners) so the visual contrast is obvious. Don't ship
a custom button in real integrations — use `PayPalButton`.

Official `PayPalButton` configurable attrs:
- `color` — `GOLD` (default), `BLUE`, `WHITE`, `BLACK`, `SILVER`
- `label` — `PAYPAL` (default), `CHECKOUT`, `BUY_NOW`, `PAY`, `PAY_LATER` (use the
  separate `PayLaterButton` class for `PAY_LATER`)
- `shape`, `size` — via XML attrs `payment_button_shape`, `payment_button_size`

## Activity log

`Logger.kt` writes timestamped lines into the Activity Log card with a colored tag:

| Tag    | Color  | Source                                                                 |
|--------|--------|------------------------------------------------------------------------|
| `UI`   | green  | Button taps, environment spinner changes, "Clear" tap                  |
| `API`  | blue   | Backend HTTP calls — URL on `→`, status code + duration on `←`         |
| `SDK`  | yellow | PayPal SDK lifecycle: client built, `start` invoked, return intent, `finishStart` outcome |
| `ERR`  | red    | Validation errors, backend exceptions, SDK Failure results             |
| `INF`  | gray   | Generic info (app ready, manual order ID, capture body dump)           |

Auto-scrolls to the bottom on every new line. Tap **Clear** to reset.

## Code layout

```
app/src/main/java/com/ppgms/paypalmobiletest/
├── Defaults.kt           ← client ID / secret / backend URL constants
├── BackendClient.kt      ← suspend createOrder() / captureOrder() with timing info
├── Logger.kt             ← tagged + colored + auto-scrolling Spannable logger
└── MainActivity.kt       ← single-Activity programmatic UI + SDK launch + return handling
app/src/main/res/
├── drawable/bg_paypal_button.xml  ← navy + dashed-outline bg for the hand-drawn button
├── values/strings.xml             ← app_name + paypal_return_scheme
├── values/colors.xml              ← Material3 theme colors
└── values/themes.xml              ← Theme.PayPalMobileTest (Material3 NoActionBar)
```

## Build

```bash
./gradlew :app:assembleDebug
```

Open the project in Android Studio if you don't have a local Android SDK on the CLI; both
work. `compileSdk = 35`, `minSdk = 23`, Kotlin DSL Gradle, JVM 17.

## Why native, not Flutter

Flutter and native Android don't share the same SDK package directly. If PayPal ships a
Flutter plugin it wraps the native SDK; otherwise you need your own platform channel layer.
