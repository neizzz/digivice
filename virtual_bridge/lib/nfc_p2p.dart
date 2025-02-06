import 'dart:io';
import 'dart:typed_data';

import 'package:android_intent_plus/android_intent.dart';
import 'package:flutter_custom_hce/flutter_custom_hce.dart';
import 'package:nfc_manager/nfc_manager.dart';
import 'package:nfc_manager/platform_tags.dart';

typedef MessageReadCallback = void Function({required String readMessage});
typedef MessageWrittenCallback = void Function(
    {required String writtenMessage});

class NfcP2pController {
  // Single instance of the class
  static final NfcP2pController _instance = NfcP2pController._internal();

  // Factory constructor that returns the single instance
  factory NfcP2pController() => _instance;

  // Private named constructor
  NfcP2pController._internal();

  final _customHce = FlutterCustomHce();

  // TODO: current session state

  Future<void> _log(String message) async {
    final platformVersion = await _customHce.getPlatformVersion();
    // ignore: avoid_print
    print('[NfcP2pController] $message ($platformVersion)');
  }

  Future<void> startRespondSession({required String message}) async {
    try {
      await _customHce.startHce(data: message);
    } catch (e) {
      _log(
        'Error starting respond session: $e ',
      );
      rethrow;
    }
  }

  Future<void> stopRespondSession() async {
    try {
      await _customHce.stopHce();
    } catch (e) {
      _log('Error stopping respond session: $e');
      rethrow;
    }
  }

  Future<void> startRequestSession({required String message}) async {
    try {
      bool isAvailable = await NfcManager.instance.isAvailable();

      if (!isAvailable) {
        if (Platform.isAndroid) {
          // android 일 경우 nfc 설정창으로 이동 시킴
          // ios는 nfc가 os단에서 감지하고 실행되기 때문에 안드로이드처럼 설정창으로 보낼 수 없다.
          const AndroidIntent intent = AndroidIntent(
            action: 'android.settings.NFC_SETTINGS',
          );
          await intent.launch();
        }
      }

      _log('start session');
      await NfcManager.instance.startSession(
          pollingOptions: {NfcPollingOption.iso14443},
          onDiscovered: (NfcTag tag) async {
            final handle = tag.handle;
            _log('read tag: $handle');

            final isoDep = IsoDep.from(tag);
            if (isoDep == null) {
              NfcManager.instance.stopSession(errorMessage: 'Tag is null');
              return;
            }

            _log(
                'read isoDep: \n\tidentifier:${isoDep.identifier},\n\tmaxTransceiveLength:${isoDep.maxTransceiveLength},\n\ttimeout:${isoDep.timeout},\n\thiLayerResponse:${isoDep.hiLayerResponse},\n\thistoricalBytes:${isoDep.historicalBytes},\n\tisExtendedLengthApduSupported:${isoDep.isExtendedLengthApduSupported}');

            Uint8List selectCommandApdu = Uint8List.fromList([
              0x00, // CLA	- Class - Class of instruction
              0xA4, // INS	- Instruction - Instruction code
              0x04, // P1	- Parameter 1 - Instruction parameter 1
              0x00, // P2	- Parameter 2 - Instruction parameter 2
              0x07, // Lc field	- Number of bytes present in the data field of the command
              0xD2, 0x76, 0x00, 0x00, 0x85, 0x01,
              0x01, // Application ID (AID) - Application ID value (TODO: 상수화)
              0x00, // Le field	- Maximum number of bytes expected in the data field of the response to the command
            ]);
            Uint8List responseApdu =
                await isoDep.transceive(data: selectCommandApdu);
            _log(
                'responseApdu of SELECT: $responseApdu,\n\thistoricalBytes:${isoDep.historicalBytes}');

            // // NOTE: [workaround]
            // // 바로 세션을 종료하게 되면, android에서 'New tag scanned' 팝업이 뜨게됨
            // // TODO: 좀 더 정교하게 통신할 수 있는 자체 프로토콜 정의 및 구현 필요
            // Timer(const Duration(seconds: 1), () {
            //   NfcManager.instance.stopSession();
            //   print('[NfcController::startReading] stop session');
            // });
          });
    } catch (e) {
      _log('Error starting request session: $e');
    }
  }

  Future<void> stopRequestSession(String message) async {
    try {
      await NfcManager.instance.stopSession();
    } catch (e) {
      _log('Error stopping request session: $e');
      rethrow;
    }
  }

  // Stream<String> get onMessageReceived => _nfcP2p.onMessageReceived;
  // Stream<bool> get onConnectionStateChanged => _nfcP2p.onConnectionStateChanged;
}
