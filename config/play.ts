// The Android app from Google Play is this site in a Trusted Web Activity.
// Google's payments policy does not let such an app sell a subscription,
// or point to paying for one, outside Google Play's billing. So inside it
// the app leaves out prices, the payment slip and plan requests; on the
// web everything stays. The app starts at /app?izvor=play (and Android
// sends an android-app:// referrer); the middleware then sets this cookie.
export const PLAY_COOKIE = 'poslar_play';
export const PLAY_START = '/app?izvor=play';
