import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:android_intent_plus/android_intent.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_custom_hce/flutter_custom_hce.dart';
import 'package:nfc_manager/nfc_manager.dart';
import 'package:nfc_manager/platform_tags.dart';

typedef MessageReadCallback = void Function({required String readMessage});
typedef MessageWrittenCallback = void Function(
    {required String writtenMessage});

// aos: android/app/main/res/xml/apduservice.xml에 정의된 aid
// ios: (TODO)
const CUSTOM_HCE_AID = [0xF1, 0x6D, 0x61, 0x6D, 0x6F, 0x6E];

// NOTE: 수정 시, native단 APDU_SELECT_COMMAND 상수값과 싱크 맞춰야함.
const APDU_SELECT_COMMAND = [
  0x00, // CLA	- Class - Class of instruction
  0xA4, // INS	- Instruction - Instruction code
  0x04, // P1	- Parameter 1 - Instruction parameter 1
  0x00, // P2	- Parameter 2 - Instruction parameter 2
  0x06, // Lc field	- Number of bytes present in the data field of the command (여기서는 length of 'CUSTOM_HCE_AID')
  ...CUSTOM_HCE_AID,
  // 0x00, // Le field	- Maximum number of bytes expected in the data field of the response to the command
];
const APDU_OKAY = [0x90, 0x00];
const APDU_ERROR = [0x6F, 0x00];

// NOTE: digivice proprietary
const APDU_REQUEST_VERSUS_COMMAND_HEADER = [
  0x80, // CLS
  0x01, // INS
];
const APDU_OKAY_WITH_DATA_HEADER = [0x91, 0x00];

Uint8List createApduRequestVersusCommand({required String data}) {
  Uint8List dataBytes = utf8.encode(data);

  // NOTE: data의 길이 계산이 현재로선 필요 없음
  // // 데이터 길이를 2바이트로 제한 (최대 65535)
  // int length = dataBytes.length;
  // if (length > 0xFFFF) {
  //   throw Exception(
  //       'REQUEST_VERSUS command\'s data length exceeds maximum size of 65535 bytes');
  // }
  // // 길이를 2바이트 Uint8List로 변환
  // Uint8List lengthBytes = Uint8List(2);
  // lengthBytes[0] = (length >> 8) & 0xFF; // 상위 바이트
  // lengthBytes[1] = length & 0xFF;

  return Uint8List.fromList([
    ...APDU_REQUEST_VERSUS_COMMAND_HEADER,
    // ...lengthBytes, // 2바이트 길이 추가
    ...dataBytes
  ]);
}

class NfcP2pController {
  final _methodChannel = const MethodChannel('flutter_custom_hce');

  // Single instance of the class
  static final NfcP2pController _instance = NfcP2pController._internal();

  // Factory constructor that returns the single instance
  factory NfcP2pController() => _instance;

  // Private named constructor
  NfcP2pController._internal();

  final _customHce = FlutterCustomHce();
  var _initialized = false;

  Future<void> _log(String message) async {
    final platformVersion = await _customHce.getPlatformVersion();
    // ignore: avoid_print
    print('[NfcP2pController] $message ($platformVersion)');
  }

  Future<void> startRespondSession(
      {required String message,
      required Function(String) onReceived,
      Function(String)? onError}) async {
    try {
      if (!_initialized) {
        _customHce.setMethodChannel(_methodChannel);
        _customHce.initialize(aid: Uint8List.fromList(CUSTOM_HCE_AID));
        _initialized = true;
      }

      // NOTE: 일회용
      _methodChannel.setMethodCallHandler((call) async {
        debugPrint("call.method: ${call.method}(${call.arguments})");
        if (call.method == 'receiveData') {
          onReceived.call(call.arguments);
          _methodChannel.setMethodCallHandler(null);
          return "success";
        }
      });

      await _customHce.startHce(data: message);
    } catch (e) {
      _log(
        'Error starting respond session: $e ',
      );
      onError?.call('Error starting respond session: $e');
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

  Future<void> startRequestSession(
      {required String message,
      required Function(String) onReceived,
      Function(String)? onError}) async {
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

            Uint8List apduSelectCommand =
                Uint8List.fromList(APDU_SELECT_COMMAND);
            Uint8List apduSelectCommandResponse =
                await isoDep.transceive(data: apduSelectCommand);
            _log("Apdu SELECT's response: $apduSelectCommandResponse");

            Uint8List apduRequestVersusCommand =
                createApduRequestVersusCommand(data: message);
            Uint8List apduRequestVersusCommandResponse =
                await isoDep.transceive(data: apduRequestVersusCommand);
            _log(
                "REQUEST_VERSUS's raw response: $apduRequestVersusCommandResponse");

            Uint8List apduRequestVersusCommandResponseHeader =
                apduRequestVersusCommandResponse.sublist(0, 2);
            if (apduRequestVersusCommandResponseHeader.join() ==
                APDU_OKAY_WITH_DATA_HEADER.join()) {
              onReceived.call(
                  utf8.decode(apduRequestVersusCommandResponse.sublist(2)));
            } else {
              throw Exception('Error from REQUEST_VERSUS command');
            }
          });
    } catch (e) {
      _log('Error starting request session: $e');
      onError?.call('Error starting request session: $e');
    }
  }

  Future<void> stopRequestSession() async {
    try {
      await NfcManager.instance.stopSession();
    } catch (e) {
      _log('Error stopping request session: $e');
      rethrow;
    }
  }
}
