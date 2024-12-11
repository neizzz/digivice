import 'package:nfc_manager/nfc_manager.dart';

class NfcController {
  Map<String, dynamic> _latestReceived = {};

  void startReading() async {
    try {
      await NfcManager.instance.startSession(onDiscovered: (NfcTag tag) async {
        _latestReceived = tag.data;
        NfcManager.instance.stopSession();
      });
    } catch (e) {
      // TODO:
    }
  }

  void startWriting(String message) async {
    try {
      await NfcManager.instance.startSession(onDiscovered: (NfcTag tag) async {
        final ndef = Ndef.from(tag);
        if (ndef == null || !ndef.isWritable) {
          NfcManager.instance.stopSession(errorMessage: 'Tag not writable');
          return;
        }

        final ndefMessage = NdefMessage([
          NdefRecord.createText(message),
        ]);

        try {
          await ndef.write(ndefMessage);
          NfcManager.instance.stopSession();
        } catch (e) {
          NfcManager.instance.stopSession(errorMessage: 'Write failed');
        }
      });
    } catch (e) {
      // TODO:
    }
  }
}
