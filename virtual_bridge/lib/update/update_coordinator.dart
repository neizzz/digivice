import 'dart:async';
import 'dart:io' show Platform;

import 'package:android_intent_plus/android_intent.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:in_app_update/in_app_update.dart';

enum UpdateEnforcementPhase {
  idle,
  immediateInProgress,
  blocked,
}

class UpdateEnforcementState {
  final UpdateEnforcementPhase phase;
  final String title;
  final String message;
  final String? packageName;
  final bool canRetry;
  final bool canOpenStore;
  final bool canExit;

  const UpdateEnforcementState._({
    required this.phase,
    required this.title,
    required this.message,
    required this.packageName,
    required this.canRetry,
    required this.canOpenStore,
    required this.canExit,
  });

  const UpdateEnforcementState.idle()
      : this._(
          phase: UpdateEnforcementPhase.idle,
          title: '',
          message: '',
          packageName: null,
          canRetry: false,
          canOpenStore: false,
          canExit: false,
        );

  const UpdateEnforcementState.immediateInProgress({
    String? packageName,
    String title = '업데이트 준비 중',
    String message = '최신 버전을 적용하고 있습니다. 잠시만 기다려 주세요.',
  }) : this._(
         phase: UpdateEnforcementPhase.immediateInProgress,
         title: title,
         message: message,
         packageName: packageName,
         canRetry: false,
         canOpenStore: false,
         canExit: false,
       );

  const UpdateEnforcementState.blocked({
    required String title,
    required String message,
    String? packageName,
    bool canRetry = true,
    bool canOpenStore = true,
    bool canExit = true,
  }) : this._(
         phase: UpdateEnforcementPhase.blocked,
         title: title,
         message: message,
         packageName: packageName,
         canRetry: canRetry,
         canOpenStore: canOpenStore,
         canExit: canExit,
       );

  bool get isBlocking => phase != UpdateEnforcementPhase.idle;
}

class UpdateCoordinator extends ChangeNotifier {
  static const String _fallbackPackageName = 'com.ch00n9h09.montto';
  static const Duration _minimumCheckInterval = Duration(seconds: 3);

  final FutureOr<void> Function(String message) log;

  UpdateEnforcementState _state = const UpdateEnforcementState.idle();
  UpdateEnforcementState get state => _state;

  bool _disposed = false;
  bool _isChecking = false;
  bool _queuedRecheck = false;
  bool _mandatoryUpdateConfirmed = false;
  DateTime? _lastCheckAt;
  AppUpdateInfo? _lastUpdateInfo;
  Future<void>? _activeCheck;

  UpdateCoordinator({required this.log});

  Future<void> checkForMandatoryUpdate({
    required String reason,
    bool force = false,
  }) async {
    if (!Platform.isAndroid) {
      return;
    }

    final DateTime now = DateTime.now();
    if (!force &&
        _lastCheckAt != null &&
        now.difference(_lastCheckAt!) < _minimumCheckInterval) {
      _writeLog(
        '[UpdateCoordinator] Skip throttled update check: reason=$reason',
      );
      return;
    }

    if (_isChecking) {
      _queuedRecheck = true;
      _writeLog(
        '[UpdateCoordinator] Queue follow-up update check: reason=$reason',
      );
      return _activeCheck ?? Future<void>.value();
    }

    _lastCheckAt = now;
    _isChecking = true;

    final Future<void> checkFuture = _runCheck(reason);
    _activeCheck = checkFuture;

    try {
      await checkFuture;
    } finally {
      _activeCheck = null;
      _isChecking = false;

      if (_queuedRecheck && !_disposed) {
        _queuedRecheck = false;
        unawaited(
          checkForMandatoryUpdate(
            reason: 'queued_recheck',
            force: true,
          ),
        );
      }
    }
  }

  Future<void> retryImmediateUpdate() {
    return checkForMandatoryUpdate(reason: 'manual_retry', force: true);
  }

  Future<void> openPlayStoreListing() async {
    if (!Platform.isAndroid) {
      return;
    }

    final String packageName =
        _state.packageName ?? _lastUpdateInfo?.packageName ?? _fallbackPackageName;

    try {
      await AndroidIntent(
        action: 'action_view',
        data: 'market://details?id=$packageName',
        package: 'com.android.vending',
      ).launch();
      _writeLog(
        '[UpdateCoordinator] Opened Play Store listing: package=$packageName',
      );
      return;
    } catch (error) {
      _writeLog(
        '[UpdateCoordinator] Failed to open market:// listing: $error',
      );
    }

    try {
      await AndroidIntent(
        action: 'action_view',
        data: 'https://play.google.com/store/apps/details?id=$packageName',
      ).launch();
      _writeLog(
        '[UpdateCoordinator] Opened HTTPS Play Store listing: package=$packageName',
      );
    } catch (error) {
      _writeLog(
        '[UpdateCoordinator] Failed to open HTTPS Play Store listing: $error',
      );
    }
  }

  Future<void> _runCheck(String reason) async {
    _writeLog('[UpdateCoordinator] Check start: reason=$reason');

    AppUpdateInfo info;
    try {
      info = await InAppUpdate.checkForUpdate();
    } on PlatformException catch (error) {
      _handleCheckPlatformException(reason: reason, error: error);
      return;
    } catch (error) {
      _writeLog(
        '[UpdateCoordinator] Check failed unexpectedly: reason=$reason error=$error',
      );
      _handleCheckFailureFallback();
      return;
    }

    _lastUpdateInfo = info;
    _writeLog(
      '[UpdateCoordinator] Check result '
      'reason=$reason '
      'availability=${info.updateAvailability.name} '
      'immediateAllowed=${info.immediateUpdateAllowed} '
      'installStatus=${info.installStatus.name} '
      'availableVersionCode=${info.availableVersionCode} '
      'packageName=${info.packageName} '
      'stalenessDays=${info.clientVersionStalenessDays}',
    );

    final bool updateIsRequired =
        info.updateAvailability == UpdateAvailability.updateAvailable ||
        info.updateAvailability ==
            UpdateAvailability.developerTriggeredUpdateInProgress;

    if (!updateIsRequired) {
      _mandatoryUpdateConfirmed = false;
      _setState(const UpdateEnforcementState.idle());
      return;
    }

    _mandatoryUpdateConfirmed = true;

    if (info.updateAvailability == UpdateAvailability.updateAvailable &&
        !info.immediateUpdateAllowed) {
      _setBlockedState(
        title: '업데이트 필요',
        message:
            '새 버전이 게시되었지만 현재 기기에서는 인앱 업데이트를 바로 시작할 수 없습니다. Google Play에서 최신 버전으로 업데이트한 뒤 다시 열어 주세요.',
        packageName: info.packageName,
      );
      return;
    }

    await _performImmediateUpdate(info: info, reason: reason);
  }

  Future<void> _performImmediateUpdate({
    required AppUpdateInfo info,
    required String reason,
  }) async {
    _setState(
      UpdateEnforcementState.immediateInProgress(
        packageName: info.packageName,
      ),
    );

    try {
      final AppUpdateResult result = await InAppUpdate.performImmediateUpdate();
      _writeLog(
        '[UpdateCoordinator] Immediate update result '
        'reason=$reason '
        'result=$result',
      );

      switch (result) {
        case AppUpdateResult.success:
          _setState(
            UpdateEnforcementState.immediateInProgress(
              packageName: info.packageName,
              title: '업데이트 진행 중',
              message:
                  'Google Play 업데이트가 진행 중입니다. 설치가 끝날 때까지 잠시만 기다려 주세요.',
            ),
          );
          return;
        case AppUpdateResult.userDeniedUpdate:
          _setBlockedState(
            title: '업데이트 필요',
            message:
                '업데이트가 취소되었습니다. 계속 사용하려면 최신 버전으로 업데이트해야 합니다.',
            packageName: info.packageName,
          );
          return;
        case AppUpdateResult.inAppUpdateFailed:
          _setBlockedState(
            title: '업데이트 필요',
            message:
                '인앱 업데이트를 시작하지 못했습니다. 다시 시도하거나 Google Play에서 직접 업데이트해 주세요.',
            packageName: info.packageName,
          );
          return;
      }
    } on PlatformException catch (error) {
      _writeLog(
        '[UpdateCoordinator] Immediate update platform error '
        'code=${error.code} '
        'message=${error.message}',
      );
      _setBlockedState(
        title: '업데이트 필요',
        message:
            '인앱 업데이트를 시작하지 못했습니다. 다시 시도하거나 Google Play에서 직접 업데이트해 주세요.',
        packageName: info.packageName,
      );
    } catch (error) {
      _writeLog(
        '[UpdateCoordinator] Immediate update failed unexpectedly: $error',
      );
      _setBlockedState(
        title: '업데이트 필요',
        message:
            '업데이트를 이어서 진행하지 못했습니다. 다시 시도하거나 Google Play에서 직접 업데이트해 주세요.',
        packageName: info.packageName,
      );
    }
  }

  void _handleCheckPlatformException({
    required String reason,
    required PlatformException error,
  }) {
    _writeLog(
      '[UpdateCoordinator] Check platform error '
      'reason=$reason '
      'code=${error.code} '
      'message=${error.message}',
    );
    _handleCheckFailureFallback();
  }

  void _handleCheckFailureFallback() {
    if (_mandatoryUpdateConfirmed) {
      _setBlockedState(
        title: '업데이트 필요',
        message:
            '업데이트 상태를 다시 확인하지 못했습니다. 다시 시도하거나 Google Play에서 최신 버전을 설치해 주세요.',
        packageName: _lastUpdateInfo?.packageName,
      );
      return;
    }

    _setState(const UpdateEnforcementState.idle());
  }

  void _setBlockedState({
    required String title,
    required String message,
    String? packageName,
  }) {
    _setState(
      UpdateEnforcementState.blocked(
        title: title,
        message: message,
        packageName: packageName,
      ),
    );
  }

  void _setState(UpdateEnforcementState nextState) {
    if (_disposed) {
      return;
    }

    _state = nextState;
    notifyListeners();
  }

  void _writeLog(String message) {
    log(message);
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}