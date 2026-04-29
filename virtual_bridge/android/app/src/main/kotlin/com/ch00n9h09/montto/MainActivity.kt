package com.ch00n9h09.montto

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.util.ArrayList
import java.io.File

class MainActivity : FlutterActivity() {
    companion object {
        private const val BROWSER_MAIL_CHANNEL = "digivice/browser_mail"
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

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