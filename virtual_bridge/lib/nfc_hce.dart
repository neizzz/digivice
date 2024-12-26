// ignore_for_file: avoid_print

import 'package:flutter_nfc_hce/flutter_nfc_hce.dart';

class NfcHceWritter {
  // plugin instance
  final _flutterNfcHcePlugin = FlutterNfcHce();

  Future<String?> startWriting(String message) async {
    String? platformVersion = await _flutterNfcHcePlugin.getPlatformVersion();
    await _flutterNfcHcePlugin.isNfcHceSupported();
    bool isSecureNfcEnabled = await _flutterNfcHcePlugin.isSecureNfcEnabled();
    bool isNfcEnabled = await _flutterNfcHcePlugin.isNfcEnabled();

    print(
        '[NfcHceWritter::startWriting] $platformVersion, $isSecureNfcEnabled, $isNfcEnabled');

    String? result =
        await _flutterNfcHcePlugin.startNfcHce(message, persistMessage: false);

    print('[NfcHceWritter::startWriting] result: $result');

    return result;
  }

  Future<void> stopWriting() async {
    print('[NfcHceWritter::stopWriting] try to stop');
    await _flutterNfcHcePlugin.stopNfcHce();
    print('[NfcHceWritter::stopWriting] success to stop');
  }
}
