import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

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
}
