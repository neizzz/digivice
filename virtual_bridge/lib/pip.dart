import 'dart:io';

import 'package:flutter_overlay_window/flutter_overlay_window.dart';

class AndroidOverlayController {
  AndroidOverlayController() {
    if (Platform.isAndroid) {
      FlutterOverlayWindow.isPermissionGranted().then((granted) {
        if (!granted) {
          FlutterOverlayWindow.requestPermission();
        }
      });
    }
  }

  /// `startPosition` the overlay start position and default is null
  Future<void> showOverlay() async {
    FlutterOverlayWindow.showOverlay(
      height: 200,
      width: 200,
      alignment: OverlayAlignment.centerRight,
      enableDrag: true,
      positionGravity: PositionGravity.auto,
    );
  }

  Future<void> closeOverlay() async {
    await FlutterOverlayWindow.closeOverlay();
  }

  /// broadcast data to and from overlay app
  // await FlutterOverlayWindow.shareData("Hello from the other side");

  /// streams message shared between overlay and main app
  // FlutterOverlayWindow.overlayListener.listen((event) {
  //   log("Current Event: $event");
  // });
}
