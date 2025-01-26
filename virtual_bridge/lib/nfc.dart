// ignore_for_file: avoid_print

import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:android_intent_plus/android_intent.dart';
import 'package:digivice_virtual_bridge/model/record.dart';
import 'package:digivice_virtual_bridge/nfc_hce.dart';
import 'package:nfc_manager/nfc_manager.dart';
import 'package:nfc_manager/platform_tags.dart';

typedef NdefReadCallback = void Function({required String readMessage});
typedef NdefWrittenCallback = void Function({required String writtenMessage});

class NfcController {
  NfcController();

  final NfcHceController _hceController = NfcHceController();

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
            final handle = tag.handle;
            print('[NfcController::startReading] read tag: $handle');

            final isoDep = IsoDep.from(tag);
            if (isoDep == null) {
              NfcManager.instance.stopSession(errorMessage: 'Tag is null');
              return;
            }

            print(
                '[NfcController::startReading] read isoDep: \n\tidentifier:${isoDep.identifier},\n\tmaxTransceiveLength:${isoDep.maxTransceiveLength},\n\ttimeout:${isoDep.timeout},\n\thiLayerResponse:${isoDep.hiLayerResponse},\n\thistoricalBytes:${isoDep.historicalBytes},\n\tisExtendedLengthApduSupported:${isoDep.isExtendedLengthApduSupported}');

            Uint8List selectCommandApdu = Uint8List.fromList([
              0x00, // CLA	- Class - Class of instruction
              0xA4, // INS	- Instruction - Instruction code
              0x04, // P1	- Parameter 1 - Instruction parameter 1
              0x00, // P2	- Parameter 2 - Instruction parameter 2
              0x07, // Lc field	- Number of bytes present in the data field of the command
              0xD2, 0x76, 0x00, 0x00, 0x85, 0x01,
              0x01, // NDEF Tag Application name
              0x00, // Le field	- Maximum number of bytes expected in the data field of the response to the command
            ]);
            Uint8List responseApdu =
                await isoDep.transceive(data: selectCommandApdu);
            print(
                '[NfcController::startReading] responseApdu of select: $responseApdu,\n\thistoricalBytes:${isoDep.historicalBytes}');

            // final ndef = Ndef.from(tag);
            // if (ndef == null) {
            //   NfcManager.instance.stopSession(errorMessage: 'Tag is null');
            //   return;
            // }

            // WellknownTextRecord firstRecord =
            //     WellknownTextRecord.fromNdefRecord(
            //         ndef.cachedMessage!.records[0]);

            // onRead(readMessage: firstRecord.toString());

            // // NOTE: [workaround]
            // // 바로 세션을 종료하게 되면, android에서 'New tag scanned' 팝업이 뜨게됨
            // // TODO: 좀 더 정교하게 통신할 수 있는 자체 프로토콜 정의 및 구현 필요
            // Timer(const Duration(seconds: 1), () {
            //   NfcManager.instance.stopSession();
            //   print('[NfcController::startReading] stop session');
            // });
          });
    } catch (e) {
      // TODO:
    }
  }

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
