# PayPal Mobile Test

This folder contains a minimal native Android test app for the PayPal Mobile SDK.

## What it tests

- Native Android integration only
- PayPal Web Payments launch flow
- Return intent handling through a custom scheme
- Sandbox and Live environment switching

## Why native, not Flutter

Flutter and native Android do not share the same SDK package directly.
If PayPal provides a Flutter plugin, that plugin wraps the native SDK.
Otherwise, Flutter needs a custom platform channel or plugin layer.

## Current app shape

- Single `ComponentActivity`
- Programmatic UI with inputs for client ID, order ID, environment, and return scheme
- Launches `PayPalWebCheckoutClient`
- Handles `finishStart(intent)` when the app is reopened through the return scheme

## Setup notes

- The app is configured for Kotlin DSL Gradle and Android API 35.
- `minSdk` is set to 23 to match the current SDK baseline used by PayPal's Android repo.
- The PayPal dependency currently targets `com.paypal.android:paypal-web-payments:2.3.0`.

## What is still needed to run it

- A local Android SDK / Android Studio installation
- A Gradle wrapper, if you want to run builds from the command line in this workspace
- A backend-generated PayPal order ID for real checkout testing
