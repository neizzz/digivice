import type React from "react";
import { useState, useRef, useEffect } from "react";
import "./SimpleLogViewer.css";

type LogLevel = "info" | "warning" | "error" | "success" | "debug";

interface LogEntry {
  id: string;
  message: string;
  timestamp: Date;
  level: LogLevel;
  source?: string; // 로그 출처 정보 추가
}

interface SimpleLogViewerProps {
  initialOpen?: boolean;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  maxHeight?: string;
  maxLogs?: number;
  title?: string;
}

// Vite 빌드타임에 환경 변수 값을 정적으로 대체
const IS_LOG_VIEWER_ENABLED = import.meta.env.ENABLE_LOG_VIEWER === true;

// 싱글톤으로 로그 관리
class LogManager {
  private static instance: LogManager;
  private logs: LogEntry[] = [];
  private maxLogs = 100;
  private listeners: ((logs: LogEntry[]) => void)[] = [];
  private enabled: boolean = IS_LOG_VIEWER_ENABLED;

  private constructor() {}

  public static getInstance(): LogManager {
    if (!LogManager.instance) {
      LogManager.instance = new LogManager();
    }
    return LogManager.instance;
  }

  public setMaxLogs(max: number): void {
    this.maxLogs = max;
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  public addLog(
    message: string,
    level: LogLevel = "info",
    source?: string
  ): void {
    // 빌드 타임에 결정되는 상수를 사용하여 조건부 컴파일
    if (!IS_LOG_VIEWER_ENABLED) return;

    const newLog: LogEntry = {
      id: this.generateId(),
      message,
      level,
      timestamp: new Date(),
      source,
    };

    this.logs.push(newLog);

    // 최대 로그 수 유지
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(this.logs.length - this.maxLogs);
    }

    // 리스너들에게 알림
    this.notifyListeners();
  }

  public clearLogs(): void {
    this.logs = [];
    this.notifyListeners();
  }

  public addListener(listener: (logs: LogEntry[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener([...this.logs]));
  }

  // 편의성 메서드들
  public info(message: string, source?: string): void {
    this.addLog(message, "info", source);
  }

  public warn(message: string, source?: string): void {
    this.addLog(message, "warning", source);
  }

  public error(message: string, source?: string): void {
    this.addLog(message, "error", source);
  }

  public success(message: string, source?: string): void {
    this.addLog(message, "success", source);
  }

  public debug(message: string, source?: string): void {
    this.addLog(message, "debug", source);
  }
}

// 전역 로그 매니저 인스턴스
export const logManager = LogManager.getInstance();

// 호출 위치를 파악하는 유틸리티 함수
// Vite는 빌드 시점에 IS_LOG_VIEWER_ENABLED가 false인 경우 데드 코드로 간주하고 제거
const getCallerInfo = IS_LOG_VIEWER_ENABLED
  ? () => {
      try {
        const stackLines = new Error().stack?.split("\n");
        if (stackLines && stackLines.length >= 4) {
          // 0: Error, 1: getCallerInfo, 2: 오버라이드된 콘솔 메서드, 3: 실제 호출자
          const callerLine = stackLines[3].trim();
          // "at 함수명 (파일:행:열)" 형식에서 정보 추출
          const match = callerLine.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/);
          if (match) {
            const [, , filePath, line] = match;
            // 파일 경로에서 파일명만 추출
            const fileName = filePath.split("/").pop() || filePath;
            return `${fileName}:${line}`;
          }

          // 기타 형식의 스택 트레이스 처리 ("at 파일:행:열" 형식)
          const altMatch = callerLine.match(/at\s+(.*):(\d+):(\d+)/);
          if (altMatch) {
            const [, filePath, line] = altMatch;
            const fileName = filePath.split("/").pop() || filePath;
            return `${fileName}:${line}`;
          }
        }
      } catch (err) {
        // 에러 발생 시 무시
      }
      return "unknown";
    }
  : () => "unknown";

// console 메서드 오버라이드 (조건부 컴파일 적용)
const overrideConsole = IS_LOG_VIEWER_ENABLED
  ? () => {
      const originalConsoleLog = console.log;
      const originalConsoleWarn = console.warn;
      const originalConsoleError = console.error;

      console.log = (...args) => {
        const source = getCallerInfo();
        const message = String(args[0] || "");
        logManager.info(message, source);
        originalConsoleLog.apply(console, args);
      };

      console.warn = (...args) => {
        const source = getCallerInfo();
        const message = String(args[0] || "");
        logManager.warn(message, source);
        originalConsoleWarn.apply(console, args);
      };

      console.error = (...args) => {
        const source = getCallerInfo();
        const message = String(args[0] || "");
        logManager.error(message, source);
        originalConsoleError.apply(console, args);
      };
    }
  : () => {};

// 실제 컴포넌트 (조건부 컴파일 적용)
const SimpleLogViewer: React.FC<SimpleLogViewerProps> = (props) => {
  // 환경 변수가 false인 경우 빌드타임에 제거됨
  if (!IS_LOG_VIEWER_ENABLED) return null;

  const {
    initialOpen = false,
    position = "top-right",
    maxHeight = "300px",
    maxLogs = 500,
    title = "로그 뷰어",
  } = props;

  const [isOpen, setIsOpen] = useState(initialOpen);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const consoleOverrideRef = useRef(false);

  // 로그 매니저 설정 및 콘솔 오버라이드
  useEffect(() => {
    logManager.setMaxLogs(maxLogs);

    // 콘솔 오버라이드는 한 번만 수행
    if (!consoleOverrideRef.current) {
      overrideConsole();
      consoleOverrideRef.current = true;

      // 초기화 로그 추가 (로그 뷰어가 작동하는지 확인하기 위한 테스트 로그)
      setTimeout(() => {
        logManager.success("로그 뷰어가 초기화되었습니다.");
        logManager.info("로그 메시지는 문자열만 지원합니다.");
      }, 500);
    }

    // 로그 변경 리스너 등록
    const removeListener = logManager.addListener((updatedLogs) => {
      setLogs(updatedLogs);
    });

    return () => {
      removeListener();
    };
  }, [maxLogs]);

  // 로그가 추가될 때마다 스크롤 맨 아래로
  useEffect(() => {
    if (logContainerRef.current && logs.length > 0) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs.length]);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  return (
    <div
      className={`simple-log-viewer ${position} ${isOpen ? "open" : "closed"}`}
    >
      {/* 외부 토글 버튼은 닫혀있을 때만 표시 */}
      {!isOpen && (
        <button
          className="simple-log-viewer-toggle"
          onClick={() => setIsOpen(true)}
        >
          로그 보기
        </button>
      )}

      {isOpen && (
        <div className="simple-log-viewer-container">
          <div className="simple-log-viewer-header">
            <h3>
              {title} ({logs.length}개)
            </h3>
            <div className="log-header-buttons">
              <button
                onClick={() => logManager.clearLogs()}
                className="clear-logs-button"
              >
                로그 지우기
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="close-logs-button"
              >
                로그 닫기
              </button>
            </div>
          </div>

          <div
            className="simple-log-entries-container"
            ref={logContainerRef}
            style={{ maxHeight }}
          >
            {logs.length === 0 ? (
              <div className="simple-log-empty-message">로그가 없습니다.</div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`simple-log-entry simple-log-level-${log.level}`}
                >
                  <span className="simple-log-timestamp">
                    [{formatTime(log.timestamp)}]
                  </span>
                  {log.source && (
                    <span className="simple-log-source">[{log.source}]</span>
                  )}
                  <span className="simple-log-message">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// 빌드 시점에 환경 변수 값에 따른 조건부 내보내기
export default SimpleLogViewer;

// 유틸리티 함수: 로그 관리자가 활성화되어 있는지 확인
export const isLogViewerEnabled = () => IS_LOG_VIEWER_ENABLED;
