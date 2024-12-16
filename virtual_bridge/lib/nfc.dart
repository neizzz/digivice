import 'package:nfc_manager/nfc_manager.dart';

// typedef NdefReadCallback = void Function(
//     {required NdefMessage readNdefMessage});
// typedef NdefWrittenCallback = void Function(
//     {required NdefMessage writtenNdefMessage});

class NfcController {
  // Map<String, dynamic> _latestReceived = {};

  // void startReading({required NdefReadCallback onRead}) async {
  //   try {
  //     await NfcManager.instance.startSession(onDiscovered: (NfcTag tag) async {
  //       // _latestReceived = tag.data;

  //       final ndef = Ndef.from(tag);
  //       if (ndef == null) {
  //         NfcManager.instance.stopSession(errorMessage: 'Tag is null');
  //         return;
  //       }

  //       onRead(readNdefMessage: ndef.cachedMessage!);
  //       NfcManager.instance.stopSession();
  //     });
  //   } catch (e) {
  //     // TODO:
  //   }
  // }

  // void startWriting(
  //     {required String message, NdefWrittenCallback? onWritten}) async {
  //   try {
  //     await NfcManager.instance.startSession(onDiscovered: (NfcTag tag) async {
  //       final ndef = Ndef.from(tag);
  //       if (ndef == null || !ndef.isWritable) {
  //         NfcManager.instance.stopSession(errorMessage: 'Tag not writable');
  //         return;
  //       }

  //       final ndefMessage = NdefMessage([
  //         NdefRecord.createText(message),
  //       ]);

  //       try {
  //         await ndef.write(ndefMessage);
  //         onWritten!(writtenNdefMessage: ndefMessage);
  //         NfcManager.instance.stopSession();
  //       } catch (e) {
  //         NfcManager.instance.stopSession(errorMessage: 'Write failed');
  //       }
  //     });
  //   } catch (e) {
  //     // TODO:
  //   }
  // }
}
