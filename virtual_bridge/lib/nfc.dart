// ignore_for_file: avoid_print

import 'dart:async';
import 'dart:io';

import 'package:android_intent_plus/android_intent.dart';
import 'package:digivice_virtual_bridge/model/record.dart';
import 'package:digivice_virtual_bridge/nfc_hce.dart';
import 'package:nfc_manager/nfc_manager.dart';

typedef NdefReadCallback = void Function({required String readMessage});
typedef NdefWrittenCallback = void Function({required String writtenMessage});

class NfcController {
  NfcController();

  final NfcHceWritter _writter = NfcHceWritter();

  void startReading({required NdefReadCallback onRead}) async {
    try {
      bool isAvailable = await NfcManager.instance.isAvailable();

      if (!isAvailable) {
        if (Platform.isAndroid) {
          //android 일 경우 nfc 설정창으로 이동 시킴
          //ios는 nfc가 os단에서 감지하고 실행되기 때문에 안드로이드처럼 설정창으로 보낼 수 없다.
          const AndroidIntent intent = AndroidIntent(
            action: 'android.settings.NFC_SETTINGS',
          );
          await intent.launch();
        }
      }

      print('start session');
      await NfcManager.instance.startSession(
          pollingOptions: {NfcPollingOption.iso14443},
          onDiscovered: (NfcTag tag) async {
            final ndef = Ndef.from(tag);
            if (ndef == null) {
              NfcManager.instance.stopSession(errorMessage: 'Tag is null');
              return;
            }

            WellknownTextRecord firstRecord =
                WellknownTextRecord.fromNdefRecord(
                    ndef.cachedMessage!.records[0]);

            onRead(readMessage: firstRecord.toString());

            // NOTE: [workaround]
            // 바로 세션을 종료하게 되면, android에서 'New tag scanned' 팝업이 뜨게됨
            // TODO: 좀 더 정교하게 통신할 수 있는 자체 프로토콜 정의 및 구현 필요
            Timer(const Duration(seconds: 1), () {
              NfcManager.instance.stopSession();
              print('[NfcController::startReading] stop session');
            });
          });
    } catch (e) {
      // TODO:
    }
  }

  void startWriting(
      {required String message, NdefWrittenCallback? onWritten}) async {
    try {
      await _writter.startWriting(message);
      onWritten!(writtenMessage: message);
      // await _writter.stopWriting();

      // await NfcManager.instance.startSession(onDiscovered: (NfcTag tag) async {
      //   final ndef = Ndef.from(tag);
      //   print(1);
      //   if (ndef == null || !ndef.isWritable) {
      //     NfcManager.instance.stopSession(errorMessage: 'Tag not writable');
      //     return;
      //   }

      //   print(2);
      //   final ndefMessage = NdefMessage([
      //     NdefRecord.createText(message),
      //   ]);

      //   try {
      //     print(3);
      //     await ndef.write(ndefMessage);
      //     // _writter.startWriting(message);

      //     print(4);
      //     WellknownTextRecord firstRecord = WellknownTextRecord.fromNdefRecord(
      //         ndef.cachedMessage!.records[0]);
      //     onWritten!(writtenMessage: firstRecord.toString());
      //     NfcManager.instance.stopSession();

      //     // NOTE: [workaround]
      //     // Timer(const Duration(seconds: 1), () {
      //     //   NfcManager.instance.stopSession();
      //     //   print('[NfcController::startWriting] stop session');
      //     // });
      //   } catch (e) {
      //     NfcManager.instance.stopSession(errorMessage: 'Write failed');
      //   }
      // });
    } catch (e) {
      print('[NfcController::startWriting] error: $e');
    }
  }

  void stop({void Function()? onStop}) async {
    await _writter.stopWriting();
    await NfcManager.instance.stopSession();
    onStop!();
  }
}
