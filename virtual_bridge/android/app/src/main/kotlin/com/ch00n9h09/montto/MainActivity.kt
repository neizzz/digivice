package com.ch00n9h09.montto

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.WindowManager
import android.view.KeyEvent
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import androidx.activity.OnBackPressedCallback
import androidx.activity.OnBackPressedDispatcherOwner
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.util.ArrayList
import java.io.File
import kotlin.math.abs

class MainActivity : FlutterActivity() {
    companion object {
        private const val TAG = "MainActivity"
        private const val BACK_NAVIGATION_CHANNEL = "digivice/back_navigation"
        private const val BROWSER_MAIL_CHANNEL = "digivice/browser_mail"
        private const val TRUSTED_TIME_CHANNEL = "digivice/trusted_time"
        private const val TARGET_REFRESH_RATE_HZ = 60f
        private const val TARGET_REFRESH_RATE_TOLERANCE_HZ = 1f
    }

    private var nativeBackCallback: OnBackInvokedCallback? = null
    private var dispatcherBackCallback: OnBackPressedCallback? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        updateKeepScreenOn()
        applyPreferredDisplayRefreshRate()
        installOnBackPressedDispatcherDiagnostics()
        installNativeBackDiagnostics()
    }

    override fun onResume() {
        super.onResume()
        updateKeepScreenOn()
        applyPreferredDisplayRefreshRate()
    }

    override fun onDestroy() {
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        uninstallOnBackPressedDispatcherDiagnostics()
        uninstallNativeBackDiagnostics()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        Log.w(
            TAG,
            "[BackNavigation][Native] onBackPressed invoked. " +
                "flutterEngineAttached=${flutterEngine != null}",
        )
        super.onBackPressed()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            Log.w(
                TAG,
                "[BackNavigation][Native] onKeyDown KEYCODE_BACK " +
                    "action=${event?.action} repeat=${event?.repeatCount}",
            )
        }

        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            Log.w(
                TAG,
                "[BackNavigation][Native] onKeyUp KEYCODE_BACK " +
                    "action=${event?.action} repeat=${event?.repeatCount}",
            )
        }

        return super.onKeyUp(keyCode, event)
    }

    private fun updateKeepScreenOn() {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            TRUSTED_TIME_CHANNEL,
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "getOsUptimeMs" -> result.success(SystemClock.elapsedRealtime())
                else -> result.notImplemented()
            }
        }

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            BROWSER_MAIL_CHANNEL,
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "openGmailDraft" -> {
                    try {
                        val to = call.argument<String>("to")
                        val subject = call.argument<String>("subject").orEmpty()
                        val body = call.argument<String>("body").orEmpty()
                        val attachments =
                            call.argument<List<Map<String, Any?>>>("attachments").orEmpty()

                        if (to.isNullOrBlank()) {
                            result.error(
                                "invalid_args",
                                "Recipient email is required.",
                                null,
                            )
                            return@setMethodCallHandler
                        }

                        openGmailDraft(
                            to = to,
                            subject = subject,
                            body = body,
                            attachments = attachments,
                        )
                        result.success("success")
                    } catch (error: Exception) {
                        result.error(
                            "gmail_open_failed",
                            error.message,
                            null,
                        )
                    }
                }

                else -> result.notImplemented()
            }
        }
    }

    private fun installOnBackPressedDispatcherDiagnostics() {
        if (dispatcherBackCallback != null) {
            return
        }

        val dispatcherOwner = this as? OnBackPressedDispatcherOwner

        if (dispatcherOwner == null) {
            Log.w(
                TAG,
                "[BackNavigation][Native] OnBackPressedDispatcher unavailable.",
            )
            return
        }

        dispatcherBackCallback = object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val engine = flutterEngine
                Log.w(
                    TAG,
                    "[BackNavigation][Native] OnBackPressedDispatcher invoked. " +
                        "flutterEngineAttached=${engine != null}",
                )

                if (engine == null) {
                    isEnabled = false
                    @Suppress("DEPRECATION")
                    onBackPressed()
                    isEnabled = true
                    return
                }

                dispatchBackNavigationToFlutter(engine)
            }
        }

        dispatcherOwner.onBackPressedDispatcher.addCallback(dispatcherBackCallback!!)
        Log.w(TAG, "[BackNavigation][Native] Registered OnBackPressedDispatcher callback.")
    }

    private fun uninstallOnBackPressedDispatcherDiagnostics() {
        val callback = dispatcherBackCallback ?: return
        callback.remove()
        dispatcherBackCallback = null
        Log.w(TAG, "[BackNavigation][Native] Removed OnBackPressedDispatcher callback.")
    }

    private fun installNativeBackDiagnostics() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            Log.w(
                TAG,
                "[BackNavigation][Native] Using legacy onBackPressed path: API < 33.",
            )
            return
        }

        if (nativeBackCallback != null) {
            return
        }

        nativeBackCallback = OnBackInvokedCallback {
            val engine = flutterEngine
            Log.w(
                TAG,
                "[BackNavigation][Native] OnBackInvokedCallback invoked. " +
                    "flutterEngineAttached=${engine != null}",
            )

            if (engine == null) {
                @Suppress("DEPRECATION")
                super.onBackPressed()
                return@OnBackInvokedCallback
            }

            dispatchBackNavigationToFlutter(engine)
        }

        onBackInvokedDispatcher.registerOnBackInvokedCallback(
            OnBackInvokedDispatcher.PRIORITY_OVERLAY,
            nativeBackCallback!!,
        )
        Log.w(
            TAG,
            "[BackNavigation][Native] Registered OnBackInvokedCallback " +
                "priority=${OnBackInvokedDispatcher.PRIORITY_OVERLAY}.",
        )
    }

    private fun uninstallNativeBackDiagnostics() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return
        }

        val callback = nativeBackCallback ?: return
        onBackInvokedDispatcher.unregisterOnBackInvokedCallback(callback)
        nativeBackCallback = null
        Log.w(TAG, "[BackNavigation][Native] Unregistered OnBackInvokedCallback.")
    }

    private fun dispatchBackNavigationToFlutter(engine: FlutterEngine) {
        MethodChannel(
            engine.dartExecutor.binaryMessenger,
            BACK_NAVIGATION_CHANNEL,
        ).invokeMethod(
            "handleBackNavigation",
            null,
            object : MethodChannel.Result {
                override fun success(result: Any?) {
                    Log.w(
                        TAG,
                        "[BackNavigation][Native] Flutter back handler completed: $result",
                    )
                }

                override fun error(
                    errorCode: String,
                    errorMessage: String?,
                    errorDetails: Any?,
                ) {
                    Log.w(
                        TAG,
                        "[BackNavigation][Native] Flutter back handler failed: " +
                            "$errorCode $errorMessage",
                    )
                }

                override fun notImplemented() {
                    Log.w(
                        TAG,
                        "[BackNavigation][Native] Flutter back handler not implemented.",
                    )
                    engine.navigationChannel.popRoute()
                }
            },
        )
    }

    private fun applyPreferredDisplayRefreshRate() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            Log.d(TAG, "Skipping preferred display mode: API < 23.")
            return
        }

        try {
            applyPreferredDisplayRefreshRateApi23()
        } catch (error: Exception) {
            Log.w(TAG, "Failed to apply preferred display mode.", error)
        }
    }

    @Suppress("DEPRECATION")
    private fun applyPreferredDisplayRefreshRateApi23() {
        val display = windowManager.defaultDisplay
        val currentMode = display.mode
        val supportedModes = display.supportedModes
        val targetMode = supportedModes
            .filter { mode ->
                mode.physicalWidth == currentMode.physicalWidth &&
                    mode.physicalHeight == currentMode.physicalHeight &&
                    abs(mode.refreshRate - TARGET_REFRESH_RATE_HZ) <= TARGET_REFRESH_RATE_TOLERANCE_HZ
            }
            .minByOrNull { mode -> abs(mode.refreshRate - TARGET_REFRESH_RATE_HZ) }

        if (targetMode == null) {
            Log.d(
                TAG,
                "Skipping preferred display mode: no 60Hz mode for " +
                    "${currentMode.physicalWidth}x${currentMode.physicalHeight}.",
            )
            return
        }

        val attributes = window.attributes
        if (attributes.preferredDisplayModeId == targetMode.modeId) {
            Log.d(
                TAG,
                "Preferred display mode already set: " +
                    "modeId=${targetMode.modeId}, refreshRate=${targetMode.refreshRate}Hz.",
            )
            return
        }

        attributes.preferredDisplayModeId = targetMode.modeId
        window.attributes = attributes
        Log.d(
            TAG,
            "Applied preferred display mode: " +
                "modeId=${targetMode.modeId}, refreshRate=${targetMode.refreshRate}Hz, " +
                "size=${targetMode.physicalWidth}x${targetMode.physicalHeight}.",
        )
    }

    private fun openGmailDraft(
        to: String,
        subject: String,
        body: String,
        attachments: List<Map<String, Any?>>,
    ) {
        val attachmentUris = attachments.mapNotNull { attachment ->
            createDiagnosticsAttachment(
                attachmentFileName = attachment["fileName"] as? String ?: "",
                attachmentText = attachment["text"] as? String ?: "",
            )
        }
        val hasAttachments = attachmentUris.isNotEmpty()

        val intent = Intent(
            if (attachmentUris.size > 1) Intent.ACTION_SEND_MULTIPLE else Intent.ACTION_SEND,
        ).apply {
            setPackage("com.google.android.gm")
            type = if (hasAttachments) "*/*" else "message/rfc822"
            putExtra(Intent.EXTRA_EMAIL, arrayOf(to))
            putExtra(Intent.EXTRA_SUBJECT, subject)
            putExtra(Intent.EXTRA_TEXT, body)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        if (hasAttachments) {
            if (attachmentUris.size == 1) {
                val attachmentUri = attachmentUris.first()
                intent.putExtra(Intent.EXTRA_STREAM, attachmentUri)
                intent.clipData = ClipData.newUri(
                    contentResolver,
                    "montto-diagnostics",
                    attachmentUri,
                )
            } else {
                intent.putParcelableArrayListExtra(
                    Intent.EXTRA_STREAM,
                    ArrayList(attachmentUris),
                )
                val firstUri = attachmentUris.first()
                val clipData = ClipData.newUri(
                    contentResolver,
                    "montto-diagnostics",
                    firstUri,
                )
                attachmentUris.drop(1).forEach { uri ->
                    clipData.addItem(ClipData.Item(uri))
                }
                intent.clipData = clipData
            }
        }

        startActivity(intent)
    }

    private fun createDiagnosticsAttachment(
        attachmentFileName: String,
        attachmentText: String,
    ): Uri {
        val safeFileName = attachmentFileName
            .ifBlank { "montto-diagnostics.txt" }
            .replace(Regex("[^A-Za-z0-9._-]"), "_")

        val diagnosticsDir = File(cacheDir, "diagnostics").apply {
            if (!exists()) {
                mkdirs()
            }
        }
        val attachmentFile = File(diagnosticsDir, safeFileName)
        attachmentFile.writeText(attachmentText)

        return FileProvider.getUriForFile(
            this,
            "$packageName.fileprovider",
            attachmentFile,
        )
    }
}
