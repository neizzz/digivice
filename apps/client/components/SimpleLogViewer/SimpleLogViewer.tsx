import React, { useState, useRef, useEffect } from "react";
import "./SimpleLogViewer.css";

type LogLevel = "info" | "warning" | "error" | "success" | "debug";

interface LogEntry {
  id: string;
  message: string;
  timestamp: Date;
  level: LogLevel;
}

interface SimpleLogViewerProps {
  initialOpen?: boolean;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  maxHeight?: string;
  maxLogs?: number;
  title?: string;
}

// 싱글톤으로 로그 관리
class LogManager {
  private static instance: LogManager;
  private logs: LogEntry[] = [];
  private maxLogs: number = 100;
  private listeners: ((logs: LogEntry[]) => void)[] = [];

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

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  public addLog(message: string, level: LogLevel = "info"): void {
    const newLog: LogEntry = {
      id: this.generateId(),
      message,
      level,
      timestamp: new Date(),
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
  public info(message: string): void {
    this.addLog(message, "info");
  }

  public warn(message: string): void {
    this.addLog(message, "warning");
  }

  public error(message: string): void {
    this.addLog(message, "error");
  }

  public success(message: string): void {
    this.addLog(message, "success");
  }

  public debug(message: string): void {
    this.addLog(message, "debug");
  }
}

// 전역 로그 매니저 인스턴스
export const logManager = LogManager.getInstance();

// console 메서드 오버라이드 (단순화된 버전)
const overrideConsole = () => {
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  console.log = (...args) => {
    // 단순히 첫 번째 인자만 문자열로 취급
    const message = String(args[0] || "");
    logManager.info(message);
    originalConsoleLog.apply(console, args);
  };

  console.warn = (...args) => {
    const message = String(args[0] || "");
    logManager.warn(message);
    originalConsoleWarn.apply(console, args);
  };

  console.error = (...args) => {
    const message = String(args[0] || "");
    logManager.error(message);
    originalConsoleError.apply(console, args);
  };
};

// 실제 컴포넌트
const SimpleLogViewer: React.FC<SimpleLogViewerProps> = ({
  initialOpen = false,
  position = "top-right", // 기본값을 top-right로 변경
  maxHeight = "300px",
  maxLogs = 500,
  title = "로그 뷰어",
}) => {
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

export default SimpleLogViewer;
