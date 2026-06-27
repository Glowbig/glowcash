package com.glowbig.glowcash

import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class NotificationInterceptorService : NotificationListenerService() {

    companion object {
        private val BANK_PACKAGES = setOf(
            "com.nu.production",
            "com.nequi.mobile",
            "com.bancolombia.bancolombia",
            "com.bancolombia.servicios"
        )

        @JvmStatic
        var reactContext: ReactApplicationContext? = null
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val sbn = sbn ?: return
        val packageName = sbn.packageName ?: return
        if (!BANK_PACKAGES.contains(packageName)) return

        val extras: Bundle = sbn.notification?.extras ?: return
        val title = extras.getCharSequence("android.title")?.toString() ?: ""
        val text = extras.getCharSequence("android.text")?.toString() ?: ""

        if (text.isBlank()) return

        val ctx = reactContext ?: return

        try {
            val params = WritableNativeMap().apply {
                putString("title", title)
                putString("text", text)
                putString("packageName", packageName)
            }
            ctx
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("GlowcashNotification", params)
        } catch (_: Exception) {
            // React context may not be ready — discard silently
        }
    }
}
