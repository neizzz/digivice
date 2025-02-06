// ignore_for_file: avoid_print

// import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:android_intent_plus/android_intent.dart';
// import 'package:digivice_virtual_bridge/model/record.dart';
import 'package:digivice_virtual_bridge/nfc_hce.dart';
import 'package:nfc_manager/nfc_manager.dart';
import 'package:nfc_manager/platform_tags.dart';

typedef NdefReadCallback = void Function({required String readMessage});
typedef NdefWrittenCallback = void Function({required String writtenMessage});

class NfcController {
  NfcController();

  final NfcHceController _hceController = NfcHceController();

  void startReading({required NdefReadCallback onRead}) async {}

  void startWriting(
      {required String message, NdefWrittenCallback? onWritten}) async {
    try {
      await _hceController.startWriting(message);
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
    await _hceController.stopWriting();
    await NfcManager.instance.stopSession();
    onStop!();
  }
}
