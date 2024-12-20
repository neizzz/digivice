import 'dart:convert' show ascii, utf8;
import 'dart:typed_data';

import 'package:nfc_manager/nfc_manager.dart';

abstract class Record {
  NdefRecord toNdefRecord();

  static Record fromNdefRecord(NdefRecord record) {
    if (record.typeNameFormat == NdefTypeNameFormat.nfcWellknown &&
        record.type.length == 1 &&
        record.type.first == 0x54) {
      return WellknownTextRecord.fromNdefRecord(record);
    }
    return UnsupportedRecord(record);
  }
}

class WellknownTextRecord implements Record {
  WellknownTextRecord(
      {this.identifier, required this.languageCode, required this.text});

  final Uint8List? identifier;
  final String languageCode;
  final String text;

  static WellknownTextRecord fromNdefRecord(NdefRecord record) {
    final languageCodeLength = record.payload.first;
    final languageCodeBytes = record.payload.sublist(1, 1 + languageCodeLength);
    final textBytes = record.payload.sublist(1 + languageCodeLength);
    return WellknownTextRecord(
      identifier: record.identifier,
      languageCode: ascii.decode(languageCodeBytes),
      text: utf8.decode(textBytes),
    );
  }

  @override
  String toString() {
    return 'WellknownTextRecord: {\n\tid: $identifier,\n\tlanguageCode: $languageCode,\n\ttext: $text}';
  }

  @override
  NdefRecord toNdefRecord() {
    return NdefRecord(
      typeNameFormat: NdefTypeNameFormat.nfcWellknown,
      type: Uint8List.fromList([0x54]),
      identifier: identifier ?? Uint8List(0),
      payload: Uint8List.fromList([
        languageCode.length,
        ...ascii.encode(languageCode),
        ...utf8.encode(text),
      ]),
    );
  }
}

class UnsupportedRecord implements Record {
  UnsupportedRecord(this.record);

  final NdefRecord record;

  static UnsupportedRecord fromNdefRecord(NdefRecord record) {
    return UnsupportedRecord(record);
  }

  @override
  NdefRecord toNdefRecord() => record;
}
