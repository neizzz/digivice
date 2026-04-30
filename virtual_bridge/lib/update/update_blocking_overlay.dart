import 'package:flutter/material.dart';

import 'update_coordinator.dart';

class UpdateBlockingOverlay extends StatelessWidget {
  final UpdateEnforcementState state;
  final Future<void> Function() onRetry;
  final Future<void> Function() onOpenStore;
  final Future<void> Function() onExitApp;

  const UpdateBlockingOverlay({
    super.key,
    required this.state,
    required this.onRetry,
    required this.onOpenStore,
    required this.onExitApp,
  });

  @override
  Widget build(BuildContext context) {
    final bool isBusy =
        state.phase == UpdateEnforcementPhase.immediateInProgress;

    return Material(
      color: const Color(0xE6101217),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: const Color(0xFF171A21),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFF30384A)),
                boxShadow: const <BoxShadow>[
                  BoxShadow(
                    color: Color(0x66000000),
                    blurRadius: 28,
                    offset: Offset(0, 14),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    if (isBusy) ...<Widget>[
                      const Center(
                        child: SizedBox(
                          width: 36,
                          height: 36,
                          child: CircularProgressIndicator(strokeWidth: 3),
                        ),
                      ),
                      const SizedBox(height: 18),
                    ],
                    Text(
                      state.title,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      state.message,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(0xFFD5DAE6),
                        fontSize: 15,
                        height: 1.45,
                      ),
                    ),
                    if (state.packageName != null && !isBusy) ...<Widget>[
                      const SizedBox(height: 10),
                      Text(
                        state.packageName!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Color(0xFF8E97AA),
                          fontSize: 12,
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
                    if (isBusy)
                      const Text(
                        '업데이트 화면이 표시되면 설치를 완료해 주세요.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Color(0xFF8E97AA),
                          fontSize: 13,
                          height: 1.4,
                        ),
                      )
                    else
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          if (state.canRetry)
                            ElevatedButton(
                              onPressed: () {
                                onRetry();
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF6BD6FF),
                                foregroundColor: const Color(0xFF06222D),
                                padding:
                                    const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                              child: const Text('다시 시도'),
                            ),
                          if (state.canOpenStore) ...<Widget>[
                            const SizedBox(height: 12),
                            OutlinedButton(
                              onPressed: () {
                                onOpenStore();
                              },
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.white,
                                side:
                                    const BorderSide(color: Color(0xFF4B566E)),
                                padding:
                                    const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                              child: const Text('Google Play 열기'),
                            ),
                          ],
                          if (state.canExit) ...<Widget>[
                            const SizedBox(height: 10),
                            TextButton(
                              onPressed: () {
                                onExitApp();
                              },
                              style: TextButton.styleFrom(
                                foregroundColor: const Color(0xFFB4BBCB),
                                padding:
                                    const EdgeInsets.symmetric(vertical: 12),
                              ),
                              child: const Text('앱 종료'),
                            ),
                          ],
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}