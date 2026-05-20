import AVFAudio
import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    configureSharedAudioSession()
    application.isIdleTimerDisabled = true

    if let controller = window?.rootViewController as? FlutterViewController {
      let trustedTimeChannel = FlutterMethodChannel(
        name: "digivice/trusted_time",
        binaryMessenger: controller.binaryMessenger
      )
      trustedTimeChannel.setMethodCallHandler { call, result in
        switch call.method {
        case "getOsUptimeMs":
          result(Int64(ProcessInfo.processInfo.systemUptime * 1000))
        default:
          result(FlutterMethodNotImplemented)
        }
      }
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  private func configureSharedAudioSession() {
    do {
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setCategory(.playback, options: [.mixWithOthers])
      try audioSession.setActive(true)
    } catch {
      NSLog("[AudioSession] Failed to configure shared audio session: %@", String(describing: error))
    }
  }

}
