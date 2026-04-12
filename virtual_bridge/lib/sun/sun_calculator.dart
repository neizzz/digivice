import 'dart:math';

const double _zenithDegrees = 90.833;

class SunTimesResult {
  final DateTime sunriseUtc;
  final DateTime sunsetUtc;

  const SunTimesResult({
    required this.sunriseUtc,
    required this.sunsetUtc,
  });
}

class SunCalculator {
  const SunCalculator();

  SunTimesResult calculate({
    required DateTime localDate,
    required double latitude,
    required double longitude,
  }) {
    final DateTime sunriseUtc = _calculateEventUtc(
          localDate: localDate,
          latitude: latitude,
          longitude: longitude,
          isSunrise: true,
        ) ??
        DateTime.utc(localDate.year, localDate.month, localDate.day, 6);

    final DateTime sunsetUtc = _calculateEventUtc(
          localDate: localDate,
          latitude: latitude,
          longitude: longitude,
          isSunrise: false,
        ) ??
        DateTime.utc(localDate.year, localDate.month, localDate.day, 18);

    return SunTimesResult(
      sunriseUtc: sunriseUtc,
      sunsetUtc: sunsetUtc,
    );
  }

  DateTime? _calculateEventUtc({
    required DateTime localDate,
    required double latitude,
    required double longitude,
    required bool isSunrise,
  }) {
    final int dayOfYear = int.parse(
          DateTime.utc(localDate.year, localDate.month, localDate.day)
              .difference(DateTime.utc(localDate.year, 1, 1))
              .inDays
              .toString(),
        ) +
        1;
    final double lngHour = longitude / 15.0;
    final double approximateTime = isSunrise
        ? dayOfYear + ((6 - lngHour) / 24)
        : dayOfYear + ((18 - lngHour) / 24);

    final double meanAnomaly = (0.9856 * approximateTime) - 3.289;
    final double trueLongitude = _normalizeDegrees(
      meanAnomaly +
          (1.916 * sin(_toRadians(meanAnomaly))) +
          (0.020 * sin(_toRadians(2 * meanAnomaly))) +
          282.634,
    );

    double rightAscension = _normalizeDegrees(
      _toDegrees(atan(0.91764 * tan(_toRadians(trueLongitude)))),
    );

    final double trueLongitudeQuadrant = (trueLongitude / 90).floor() * 90.0;
    final double rightAscensionQuadrant = (rightAscension / 90).floor() * 90.0;
    rightAscension =
        (rightAscension + (trueLongitudeQuadrant - rightAscensionQuadrant)) /
            15.0;

    final double sinDeclination = 0.39782 * sin(_toRadians(trueLongitude));
    final double cosDeclination = cos(asin(sinDeclination));

    final double cosLocalHourAngle = (cos(_toRadians(_zenithDegrees)) -
            (sinDeclination * sin(_toRadians(latitude)))) /
        (cosDeclination * cos(_toRadians(latitude)));

    if (cosLocalHourAngle > 1 || cosLocalHourAngle < -1) {
      return null;
    }

    double localHourAngle = isSunrise
        ? 360 - _toDegrees(acos(cosLocalHourAngle))
        : _toDegrees(acos(cosLocalHourAngle));
    localHourAngle /= 15.0;

    final double localMeanTime =
        localHourAngle + rightAscension - (0.06571 * approximateTime) - 6.622;
    final double universalTime = _normalizeHours(localMeanTime - lngHour);

    final int totalSeconds = (universalTime * 3600).round();
    return DateTime.utc(localDate.year, localDate.month, localDate.day)
        .add(Duration(seconds: totalSeconds));
  }

  double _normalizeDegrees(double degrees) {
    double normalized = degrees % 360;
    if (normalized < 0) {
      normalized += 360;
    }
    return normalized;
  }

  double _normalizeHours(double hours) {
    double normalized = hours % 24;
    if (normalized < 0) {
      normalized += 24;
    }
    return normalized;
  }

  double _toRadians(double degrees) => degrees * pi / 180;

  double _toDegrees(double radians) => radians * 180 / pi;
}
