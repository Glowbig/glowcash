package com.glowbig.glowcash

import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NotificationListenerBridge(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    init {
        NotificationInterceptorService.reactContext = reactContext
    }

    override fun getName(): String = "GlowcashNotificationListener"

    @ReactMethod
    fun isEnabled(promise: Promise) {
        try {
            val packages = NotificationManagerCompat.getEnabledListenerPackages(reactContext)
            promise.resolve(packages.contains(reactContext.packageName))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openSettings() {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
        } catch (_: Exception) {}
    }

    // Required stubs for RCTEventEmitter when used with NativeEventEmitter on JS side
    @ReactMethod
    fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {}

    @ReactMethod
    fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Int) {}
}
