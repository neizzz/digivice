export const SUPPORTED_LOCALES = [
  "en",
  "ko",
  "ja",
  "zh-TW",
  "zh-HK",
  "hi",
  "th",
  "vi",
  "pt-BR",
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: LocaleCode = "en";

export type LocaleMeta = {
  code: LocaleCode;
  nativeName: string;
  englishName: string;
};

export const LOCALE_METADATA: Record<LocaleCode, LocaleMeta> = {
  en: { code: "en", nativeName: "English", englishName: "English" },
  ko: { code: "ko", nativeName: "한국어", englishName: "Korean" },
  ja: { code: "ja", nativeName: "日本語", englishName: "Japanese" },
  "zh-TW": {
    code: "zh-TW",
    nativeName: "繁體中文（台灣）",
    englishName: "Chinese (Taiwan)",
  },
  "zh-HK": {
    code: "zh-HK",
    nativeName: "繁體中文（香港）",
    englishName: "Chinese (Hong Kong)",
  },
  hi: { code: "hi", nativeName: "हिन्दी", englishName: "Hindi" },
  th: { code: "th", nativeName: "ไทย", englishName: "Thai" },
  vi: { code: "vi", nativeName: "Tiếng Việt", englishName: "Vietnamese" },
  "pt-BR": {
    code: "pt-BR",
    nativeName: "Português (Brasil)",
    englishName: "Portuguese (Brazil)",
  },
};

const en = {
  "common.on": "ON",
  "common.off": "OFF",
  "common.confirm": "Confirm",
  "common.confirmUpper": "CONFIRM",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.reset": "Reset",
  "common.okay": "Okay",
  "common.notice": "Notice",
  "common.view": "View",
  "common.error": "Error",

  "alert.title": "Alert",

  "setup.title": "Spawn Monster!",
  "setup.placeholder.name": "monster name",
  "setup.nameWidth": "name length: {width}/{maxWidth}px",
  "setup.error.emptyName": "Please enter a name.",
  "setup.error.minLength": "Name must be at least {minLength} characters long.",
  "setup.error.maxWidth": "Name must fit within {maxWidth}px on the in-game label.",
  "setup.start": "Start",

  "settings.title": "Settings",
  "settings.vibration": "Vibration",
  "settings.sfx": "SFX",
  "settings.reportBug": "Report Bug",
  "settings.send": "Send",
  "settings.sending": "Sending...",
  "settings.language": "Language",
  "settings.homeWidget": "Home Widget",
  "settings.homeWidgetDescription":
    "Add MonTTo to your Android home screen.",
  "settings.homeWidgetAdd": "Add",
  "settings.homeWidgetAdd1x1": "Add 1x1",
  "settings.homeWidgetAdd2x1": "Add 2x1",
  "settings.homeWidgetAdding": "Adding...",
  "settings.homeWidgetUnavailable":
    "Home Widget is only available in the Android app.",
  "settings.homeWidgetRequested":
    "Launcher widget add popup opened. Please confirm on your home screen.",
  "settings.homeWidgetUnsupportedApi":
    "This Android version does not support adding pinned widgets.",
  "settings.homeWidgetUnsupportedLauncher":
    "Your current launcher does not support adding pinned widgets.",
  "settings.homeWidgetRequestFailed":
    "Failed to open the widget add popup.",
  "settings.raiseNewMonster": "Raise a New Monster",
  "settings.resetConfirmCodeLabel": "Reset code",
  "settings.resetTitle": "❗️Reset?",
  "settings.resetMessage":
    "This will permanently delete your current monster and all progress. You'll return to the setup screen to hatch a new one.",

  "loading.label": "Loading...",
  "loading.errorTitle": "Loading Error",
  "loading.timeoutTitle": "Loading Timeout",
  "loading.timeoutMessage":
    "The game is taking too long to load. Tap Okay to dismiss this popup or Send Log to share diagnostics.",
  "loading.finishFailed":
    "The game could not finish loading. Tap Okay to dismiss this popup or Send Log to share diagnostics.",

  "viewport.portraitOnly": "Portrait Only",
  "viewport.rotateDevice": "Please rotate your device",
  "viewport.backToPortrait": "back to portrait mode.",
  "viewport.unsupportedRatio": "This screen ratio is not supported.",
  "viewport.useTallerPortrait": "Please use a taller portrait screen.",

  "offlineAd.title": "Connecting Ad...",
  "offlineAd.message":
    "Repeated ad connection failures may negatively affect monster growth.",
  "offlineAd.returningIn": "Returning in {seconds}s",

  "diagnostics.prepareFailed": "Failed to prepare diagnostics payload.",
  "diagnostics.flappyPrepareFailed": "Failed to prepare FlappyBird logs.",
  "diagnostics.gmailNotice":
    "The mail compose screen was opened outside the app. File attachment support is only guaranteed when the Gmail app opens directly.",
  "diagnostics.gmailOpenFailed":
    "Failed to open the Gmail draft. Please make sure Gmail is installed.",
  "diagnostics.resetFailed": "Failed to reset game data.",
  "diagnostics.sendLog": "Send Log",
  "diagnostics.sendLogs": "Send Logs",
  "diagnostics.openGmail": "Open Gmail",
  "diagnostics.gmailWillOpen": "The Gmail app will open next.",
  "diagnostics.gmailAttachments":
    "The diagnostics files will be attached to the draft email.",

  "dataRecovery.title": "Data Recovery",
  "dataRecovery.corruptedReset":
    "Existing game data is corrupted and cannot be recovered. Press Confirm to reset the data and return to the initial setup screen.",
  "dataRecovery.readFailedReset":
    "There was a problem reading the existing game data. Press Confirm to reset the data and return to the initial setup screen.",

  "flappy.gameOver": "Game Over",
  "flappy.exit": "Exit",
  "flappy.retry": "Retry",
  "flappy.bgm": "BGM",
  "flappy.sfx": "SFX",
  "flappy.preparing": "Preparing...",
  "flappy.skyDev": "Sky Dev",
  "flappy.resume": "Resume",
  "flappy.best": "Best: {score}",
  "flappy.score": "Score: {score}",
  "flappy.nearMissGood": "Good!",
  "flappy.nearMissGreat": "Great!",
  "flappy.restartInstruction": "Retry",
  "flappy.openSource": "Open Source",

  "timeOfDay.day": "Day",
  "timeOfDay.sunrise": "Sunrise",
  "timeOfDay.sunset": "Sunset",
  "timeOfDay.night": "Night",

  "main.eggUnavailable": "not available in egg state.",
  "main.objectLimitReached": "Maximum object count reached.",
  "main.cleanObjectsPrompt": "Please clean up and try again.",
  "monsterInfo.title": "About {name}",
  "monsterInfo.level": "Level",
  "monsterInfo.stamina": "Stamina",
  "monsterInfo.evolution": "Evolution",
  "monsterInfo.levelEgg": "Egg",
  "monsterInfo.levelPhase": "Lv.{phase}",
  "monsterInfo.evolutionEstimate": "Expected evolution time",
  "monsterInfo.evolutionEstimateRange": "{average} avg ({min} - {max})",
  "monsterInfo.evolutionEstimateTerminal": "No further evolution",
} as const;

export type TranslationKey = keyof typeof en;
export type TranslationParams = Record<string, string | number | boolean | null | undefined>;
export type TranslationDictionary = Record<TranslationKey, string>;

const ko: TranslationDictionary = {
  "common.on": "켜짐",
  "common.off": "꺼짐",
  "common.confirm": "확인",
  "common.confirmUpper": "확인",
  "common.cancel": "취소",
  "common.close": "닫기",
  "common.reset": "초기화",
  "common.okay": "확인",
  "common.notice": "알림",
  "common.view": "보기",
  "common.error": "오류",
  "alert.title": "알림",
  "setup.title": "몬스터 탄생!",
  "setup.placeholder.name": "몬스터 이름",
  "setup.nameWidth": "이름 길이: {width}/{maxWidth}px",
  "setup.error.emptyName": "이름을 입력해 주세요.",
  "setup.error.minLength": "이름은 최소 {minLength}자 이상이어야 합니다.",
  "setup.error.maxWidth": "게임 이름표의 {maxWidth}px 안에 들어가야 합니다.",
  "setup.start": "시작",
  "settings.title": "설정",
  "settings.vibration": "진동",
  "settings.sfx": "효과음",
  "settings.reportBug": "버그 신고",
  "settings.send": "보내기",
  "settings.sending": "보내는 중...",
  "settings.language": "언어",
  "settings.homeWidget": "홈 위젯",
  "settings.homeWidgetDescription":
    "Android 홈 화면에 MonTTo 위젯을 추가합니다.",
  "settings.homeWidgetAdd": "추가",
  "settings.homeWidgetAdd1x1": "1x1 추가",
  "settings.homeWidgetAdd2x1": "2x1 추가",
  "settings.homeWidgetAdding": "추가 중...",
  "settings.homeWidgetUnavailable":
    "홈 위젯은 Android 앱에서만 사용할 수 있습니다.",
  "settings.homeWidgetRequested":
    "런처의 위젯 추가 팝업이 열렸습니다. 홈 화면에서 확인해 주세요.",
  "settings.homeWidgetUnsupportedApi":
    "현재 Android 버전에서는 고정 위젯 추가를 지원하지 않습니다.",
  "settings.homeWidgetUnsupportedLauncher":
    "현재 런처에서는 고정 위젯 추가를 지원하지 않습니다.",
  "settings.homeWidgetRequestFailed":
    "위젯 추가 팝업을 열지 못했습니다.",
  "settings.raiseNewMonster": "새 몬스터 키우기",
  "settings.resetConfirmCodeLabel": "초기화 코드",
  "settings.resetTitle": "❗️초기화?",
  "settings.resetMessage": "현재 몬스터와 모든 진행 상황이 영구 삭제됩니다. 초기 설정 화면으로 돌아가 새 몬스터를 부화합니다.",
  "loading.label": "로딩 중...",
  "loading.errorTitle": "로딩 오류",
  "loading.timeoutTitle": "로딩 시간 초과",
  "loading.timeoutMessage": "게임 로딩이 너무 오래 걸리고 있습니다. 확인을 눌러 닫거나 로그 보내기로 진단 정보를 공유해 주세요.",
  "loading.finishFailed": "게임 로딩을 완료하지 못했습니다. 확인을 눌러 닫거나 로그 보내기로 진단 정보를 공유해 주세요.",
  "viewport.portraitOnly": "세로 모드 전용",
  "viewport.rotateDevice": "기기를 다시",
  "viewport.backToPortrait": "세로 모드로 돌려 주세요.",
  "viewport.unsupportedRatio": "지원하지 않는 화면 비율입니다.",
  "viewport.useTallerPortrait": "더 긴 세로 화면을 사용해 주세요.",
  "offlineAd.title": "광고 연결 중...",
  "offlineAd.message": "지속적인 광고 연결 실패 시, 몬스터 육성에 불이익이 있을 수 있습니다.",
  "offlineAd.returningIn": "{seconds}초 후 복귀",
  "diagnostics.prepareFailed": "진단 정보를 준비하지 못했습니다.",
  "diagnostics.flappyPrepareFailed": "FlappyBird 로그를 준비하지 못했습니다.",
  "diagnostics.gmailNotice": "메일 작성 화면이 앱 밖에서 열렸습니다. 파일 첨부는 Gmail 앱이 직접 열릴 때만 보장됩니다.",
  "diagnostics.gmailOpenFailed": "Gmail 초안을 열지 못했습니다. Gmail이 설치되어 있는지 확인해 주세요.",
  "diagnostics.resetFailed": "게임 데이터를 초기화하지 못했습니다.",
  "diagnostics.sendLog": "로그 보내기",
  "diagnostics.sendLogs": "로그 보내기",
  "diagnostics.openGmail": "Gmail 열기",
  "diagnostics.gmailWillOpen": "다음에 Gmail 앱이 열립니다.",
  "diagnostics.gmailAttachments": "진단 파일이 초안 메일에 첨부됩니다.",
  "dataRecovery.title": "데이터 복구",
  "dataRecovery.corruptedReset": "기존 게임 데이터가 손상되어 복구할 수 없습니다. 확인을 누르면 데이터를 초기화하고 초기 설정 화면으로 돌아갑니다.",
  "dataRecovery.readFailedReset": "기존 게임 데이터를 읽는 중 문제가 발생했습니다. 확인을 누르면 데이터를 초기화하고 초기 설정 화면으로 돌아갑니다.",
  "flappy.gameOver": "게임 오버",
  "flappy.exit": "나가기",
  "flappy.retry": "다시하기",
  "flappy.bgm": "BGM",
  "flappy.sfx": "효과음",
  "flappy.preparing": "준비 중...",
  "flappy.skyDev": "하늘 개발",
  "flappy.resume": "계속하기",
  "flappy.best": "최고: {score}",
  "flappy.score": "점수: {score}",
  "flappy.nearMissGood": "좋아요!",
  "flappy.nearMissGreat": "훌륭해요!",
  "flappy.restartInstruction": "다시",
  "flappy.openSource": "오픈소스",
  "timeOfDay.day": "낮",
  "timeOfDay.sunrise": "일출",
  "timeOfDay.sunset": "일몰",
  "timeOfDay.night": "밤",
  "main.eggUnavailable": "알 상태에서는 사용할 수 없습니다.",
  "main.objectLimitReached": "최대 객체 개수에 도달했습니다.",
  "main.cleanObjectsPrompt": "청소 후 다시 시도해 주세요.",
  "monsterInfo.title": "{name} 정보",
  "monsterInfo.level": "레벨",
  "monsterInfo.stamina": "체력",
  "monsterInfo.evolution": "진화",
  "monsterInfo.levelEgg": "알",
  "monsterInfo.levelPhase": "Lv.{phase}",
  "monsterInfo.evolutionEstimate": "예상 진화 시간",
  "monsterInfo.evolutionEstimateRange": "평균 {average} ({min} ~ {max})",
  "monsterInfo.evolutionEstimateTerminal": "다음 진화 없음",
};

const ja: TranslationDictionary = {
  "common.on": "オン",
  "common.off": "オフ",
  "common.confirm": "確認",
  "common.confirmUpper": "確認",
  "common.cancel": "キャンセル",
  "common.close": "閉じる",
  "common.reset": "リセット",
  "common.okay": "OK",
  "common.notice": "お知らせ",
  "common.view": "見る",
  "common.error": "エラー",
  "alert.title": "アラート",
  "setup.title": "モンスター誕生!",
  "setup.placeholder.name": "モンスター名",
  "setup.nameWidth": "名前の長さ: {width}/{maxWidth}px",
  "setup.error.emptyName": "名前を入力してください。",
  "setup.error.minLength": "名前は{minLength}文字以上にしてください。",
  "setup.error.maxWidth": "ゲーム内ラベルの{maxWidth}px以内に収めてください。",
  "setup.start": "開始",
  "settings.title": "設定",
  "settings.vibration": "バイブ",
  "settings.sfx": "効果音",
  "settings.reportBug": "バグ報告",
  "settings.send": "送信",
  "settings.sending": "送信中...",
  "settings.language": "言語",
  "settings.homeWidget": "ホームウィジェット",
  "settings.homeWidgetDescription":
    "Android のホーム画面に MonTTo ウィジェットを追加します。",
  "settings.homeWidgetAdd": "追加",
  "settings.homeWidgetAdd1x1": "1x1追加",
  "settings.homeWidgetAdd2x1": "2x1追加",
  "settings.homeWidgetAdding": "追加中...",
  "settings.homeWidgetUnavailable":
    "ホームウィジェットは Android アプリでのみ利用できます。",
  "settings.homeWidgetRequested":
    "ランチャーのウィジェット追加ポップアップが開きました。ホーム画面で確認してください。",
  "settings.homeWidgetUnsupportedApi":
    "この Android バージョンでは固定ウィジェットの追加に対応していません。",
  "settings.homeWidgetUnsupportedLauncher":
    "現在のランチャーは固定ウィジェットの追加に対応していません。",
  "settings.homeWidgetRequestFailed":
    "ウィジェット追加ポップアップを開けませんでした。",
  "settings.raiseNewMonster": "新しいモンスターを育てる",
  "settings.resetConfirmCodeLabel": "リセットコード",
  "settings.resetTitle": "❗️リセット?",
  "settings.resetMessage": "現在のモンスターと進行状況は完全に削除されます。初期設定画面に戻り、新しいモンスターを孵化します。",
  "loading.label": "読み込み中...",
  "loading.errorTitle": "読み込みエラー",
  "loading.timeoutTitle": "読み込みタイムアウト",
  "loading.timeoutMessage": "ゲームの読み込みに時間がかかっています。OKで閉じるか、ログ送信で診断情報を共有してください。",
  "loading.finishFailed": "ゲームの読み込みを完了できませんでした。OKで閉じるか、ログ送信で診断情報を共有してください。",
  "viewport.portraitOnly": "縦向き専用",
  "viewport.rotateDevice": "端末を",
  "viewport.backToPortrait": "縦向きに戻してください。",
  "viewport.unsupportedRatio": "この画面比率は対応していません。",
  "viewport.useTallerPortrait": "より縦長の画面を使用してください。",
  "offlineAd.title": "広告に接続中...",
  "offlineAd.message": "広告接続の失敗が続くと、モンスター育成に不利な影響が出る場合があります。",
  "offlineAd.returningIn": "{seconds}秒後に戻ります",
  "diagnostics.prepareFailed": "診断データを準備できませんでした。",
  "diagnostics.flappyPrepareFailed": "FlappyBirdログを準備できませんでした。",
  "diagnostics.gmailNotice": "メール作成画面がアプリ外で開かれました。添付ファイルはGmailアプリが直接開いた場合のみ保証されます。",
  "diagnostics.gmailOpenFailed": "Gmail下書きを開けませんでした。Gmailがインストールされているか確認してください。",
  "diagnostics.resetFailed": "ゲームデータをリセットできませんでした。",
  "diagnostics.sendLog": "ログ送信",
  "diagnostics.sendLogs": "ログ送信",
  "diagnostics.openGmail": "Gmailを開く",
  "diagnostics.gmailWillOpen": "次にGmailアプリが開きます。",
  "diagnostics.gmailAttachments": "診断ファイルが下書きメールに添付されます。",
  "dataRecovery.title": "データ復旧",
  "dataRecovery.corruptedReset": "既存のゲームデータが破損しており復旧できません。確認を押すとデータをリセットし、初期設定画面に戻ります。",
  "dataRecovery.readFailedReset": "既存のゲームデータの読み込み中に問題が発生しました。確認を押すとデータをリセットし、初期設定画面に戻ります。",
  "flappy.gameOver": "ゲームオーバー",
  "flappy.exit": "終了",
  "flappy.retry": "再開",
  "flappy.bgm": "BGM",
  "flappy.sfx": "効果音",
  "flappy.preparing": "準備中...",
  "flappy.skyDev": "空 Dev",
  "flappy.resume": "再開",
  "flappy.best": "ベスト: {score}",
  "flappy.score": "スコア: {score}",
  "flappy.nearMissGood": "Good!",
  "flappy.nearMissGreat": "Great!",
  "flappy.restartInstruction": "再開",
  "flappy.openSource": "OSS",
  "timeOfDay.day": "昼",
  "timeOfDay.sunrise": "日の出",
  "timeOfDay.sunset": "夕日",
  "timeOfDay.night": "夜",
  "main.eggUnavailable": "卵の状態では使用できません。",
  "main.objectLimitReached": "最大オブジェクト数に達しました。",
  "main.cleanObjectsPrompt": "掃除してからもう一度お試しください。",
  "monsterInfo.title": "{name}の情報",
  "monsterInfo.level": "レベル",
  "monsterInfo.stamina": "スタミナ",
  "monsterInfo.evolution": "進化",
  "monsterInfo.levelEgg": "タマゴ",
  "monsterInfo.levelPhase": "Lv.{phase}",
  "monsterInfo.evolutionEstimate": "予想進化時間",
  "monsterInfo.evolutionEstimateRange": "平均{average} ({min}〜{max})",
  "monsterInfo.evolutionEstimateTerminal": "次の進化なし",
};

const zhTW: TranslationDictionary = {
  "common.on": "開",
  "common.off": "關",
  "common.confirm": "確認",
  "common.confirmUpper": "確認",
  "common.cancel": "取消",
  "common.close": "關閉",
  "common.reset": "重設",
  "common.okay": "好",
  "common.notice": "通知",
  "common.view": "查看",
  "common.error": "錯誤",
  "alert.title": "提醒",
  "setup.title": "召喚怪獸！",
  "setup.placeholder.name": "怪獸名稱",
  "setup.nameWidth": "名稱長度：{width}/{maxWidth}px",
  "setup.error.emptyName": "請輸入名稱。",
  "setup.error.minLength": "名稱至少需要 {minLength} 個字元。",
  "setup.error.maxWidth": "名稱必須符合遊戲標籤的 {maxWidth}px 長度。",
  "setup.start": "開始",
  "settings.title": "設定",
  "settings.vibration": "震動",
  "settings.sfx": "音效",
  "settings.reportBug": "回報錯誤",
  "settings.send": "傳送",
  "settings.sending": "傳送中...",
  "settings.language": "語言",
  "settings.homeWidget": "主畫面小工具",
  "settings.homeWidgetDescription": "將 MonTTo 小工具加入 Android 主畫面。",
  "settings.homeWidgetAdd": "加入",
  "settings.homeWidgetAdd1x1": "加入 1x1",
  "settings.homeWidgetAdd2x1": "加入 2x1",
  "settings.homeWidgetAdding": "加入中...",
  "settings.homeWidgetUnavailable":
    "主畫面小工具僅可在 Android App 中使用。",
  "settings.homeWidgetRequested":
    "已開啟啟動器的小工具加入視窗。請在主畫面確認。",
  "settings.homeWidgetUnsupportedApi":
    "目前的 Android 版本不支援釘選小工具。",
  "settings.homeWidgetUnsupportedLauncher":
    "目前的啟動器不支援釘選小工具。",
  "settings.homeWidgetRequestFailed": "無法開啟小工具加入視窗。",
  "settings.raiseNewMonster": "培育新怪獸",
  "settings.resetConfirmCodeLabel": "重設代碼",
  "settings.resetTitle": "❗️要重設嗎？",
  "settings.resetMessage": "目前的怪獸與所有進度將永久刪除。你會回到初始設定畫面來孵化新怪獸。",
  "loading.label": "載入中...",
  "loading.errorTitle": "載入錯誤",
  "loading.timeoutTitle": "載入逾時",
  "loading.timeoutMessage": "遊戲載入時間過長。點選好關閉，或傳送記錄分享診斷資訊。",
  "loading.finishFailed": "遊戲無法完成載入。點選好關閉，或傳送記錄分享診斷資訊。",
  "viewport.portraitOnly": "僅支援直向",
  "viewport.rotateDevice": "請將裝置",
  "viewport.backToPortrait": "轉回直向模式。",
  "viewport.unsupportedRatio": "不支援此螢幕比例。",
  "viewport.useTallerPortrait": "請使用較高的直向螢幕。",
  "offlineAd.title": "正在連接廣告...",
  "offlineAd.message": "如果廣告連線持續失敗，怪獸培育可能會受到不利影響。",
  "offlineAd.returningIn": "{seconds} 秒後返回",
  "diagnostics.prepareFailed": "無法準備診斷資料。",
  "diagnostics.flappyPrepareFailed": "無法準備 FlappyBird 記錄。",
  "diagnostics.gmailNotice": "郵件撰寫畫面已在 App 外開啟。只有直接開啟 Gmail App 時才保證支援附件。",
  "diagnostics.gmailOpenFailed": "無法開啟 Gmail 草稿。請確認已安裝 Gmail。",
  "diagnostics.resetFailed": "無法重設遊戲資料。",
  "diagnostics.sendLog": "傳送記錄",
  "diagnostics.sendLogs": "傳送記錄",
  "diagnostics.openGmail": "開啟 Gmail",
  "diagnostics.gmailWillOpen": "接下來會開啟 Gmail App。",
  "diagnostics.gmailAttachments": "診斷檔案會附加到草稿郵件。",
  "dataRecovery.title": "資料復原",
  "dataRecovery.corruptedReset": "現有遊戲資料已損毀且無法復原。按確認會重設資料並回到初始設定畫面。",
  "dataRecovery.readFailedReset": "讀取現有遊戲資料時發生問題。按確認會重設資料並回到初始設定畫面。",
  "flappy.gameOver": "遊戲結束",
  "flappy.exit": "離開",
  "flappy.retry": "重試",
  "flappy.bgm": "BGM",
  "flappy.sfx": "音效",
  "flappy.preparing": "準備中...",
  "flappy.skyDev": "天空 Dev",
  "flappy.resume": "繼續",
  "flappy.best": "最佳：{score}",
  "flappy.score": "分數：{score}",
  "flappy.nearMissGood": "不錯！",
  "flappy.nearMissGreat": "太棒了！",
  "flappy.restartInstruction": "重開",
  "flappy.openSource": "開源",
  "timeOfDay.day": "白天",
  "timeOfDay.sunrise": "日出",
  "timeOfDay.sunset": "日落",
  "timeOfDay.night": "夜晚",
  "main.eggUnavailable": "蛋狀態無法使用。",
  "main.objectLimitReached": "已達到最大物件數量。",
  "main.cleanObjectsPrompt": "請先清理後再試一次。",
  "monsterInfo.title": "{name}資訊",
  "monsterInfo.level": "等級",
  "monsterInfo.stamina": "體力",
  "monsterInfo.evolution": "進化",
  "monsterInfo.levelEgg": "蛋",
  "monsterInfo.levelPhase": "Lv.{phase}",
  "monsterInfo.evolutionEstimate": "預計進化時間",
  "monsterInfo.evolutionEstimateRange": "平均 {average} ({min}～{max})",
  "monsterInfo.evolutionEstimateTerminal": "沒有下一次進化",
};

const zhHK: TranslationDictionary = {
  ...zhTW,
  "setup.title": "召喚怪獸！",
  "settings.title": "設定",
  "settings.vibration": "震動",
  "settings.sfx": "音效",
  "settings.reportBug": "回報問題",
  "settings.raiseNewMonster": "培育新怪獸",
  "loading.label": "載入中...",
  "viewport.portraitOnly": "只支援直向",
  "flappy.retry": "再試",
  "main.objectLimitReached": "已達到最大物件數量。",
  "main.cleanObjectsPrompt": "請先清理後再試一次。",
  "monsterInfo.title": "{name}資訊",
  "monsterInfo.level": "等級",
  "monsterInfo.stamina": "體力",
  "monsterInfo.evolution": "進化",
  "monsterInfo.levelEgg": "蛋",
  "monsterInfo.levelPhase": "Lv.{phase}",
  "monsterInfo.evolutionEstimate": "預計進化時間",
  "monsterInfo.evolutionEstimateRange": "平均 {average} ({min}～{max})",
  "monsterInfo.evolutionEstimateTerminal": "沒有下一次進化",
};

const hi: TranslationDictionary = {
  "common.on": "चालू",
  "common.off": "बंद",
  "common.confirm": "पुष्टि करें",
  "common.confirmUpper": "पुष्टि",
  "common.cancel": "रद्द करें",
  "common.close": "बंद करें",
  "common.reset": "रीसेट",
  "common.okay": "ठीक है",
  "common.notice": "सूचना",
  "common.view": "देखें",
  "common.error": "त्रुटि",
  "alert.title": "चेतावनी",
  "setup.title": "मॉन्स्टर जन्म!",
  "setup.placeholder.name": "मॉन्स्टर नाम",
  "setup.nameWidth": "नाम लंबाई: {width}/{maxWidth}px",
  "setup.error.emptyName": "कृपया नाम दर्ज करें।",
  "setup.error.minLength": "नाम कम से कम {minLength} अक्षरों का होना चाहिए।",
  "setup.error.maxWidth": "नाम गेम लेबल के {maxWidth}px में फिट होना चाहिए।",
  "setup.start": "शुरू करें",
  "settings.title": "सेटिंग्स",
  "settings.vibration": "वाइब्रेशन",
  "settings.sfx": "SFX",
  "settings.reportBug": "बग रिपोर्ट",
  "settings.send": "भेजें",
  "settings.sending": "भेज रहा है...",
  "settings.language": "भाषा",
  "settings.homeWidget": "होम विजेट",
  "settings.homeWidgetDescription":
    "MonTTo विजेट को अपने Android होम स्क्रीन पर जोड़ें।",
  "settings.homeWidgetAdd": "जोड़ें",
  "settings.homeWidgetAdd1x1": "1x1 जोड़ें",
  "settings.homeWidgetAdd2x1": "2x1 जोड़ें",
  "settings.homeWidgetAdding": "जोड़ा जा रहा है...",
  "settings.homeWidgetUnavailable":
    "होम विजेट केवल Android ऐप में उपलब्ध है।",
  "settings.homeWidgetRequested":
    "लॉन्चर विजेट जोड़ने का पॉपअप खुल गया है। कृपया होम स्क्रीन पर पुष्टि करें।",
  "settings.homeWidgetUnsupportedApi":
    "यह Android संस्करण pinned widget जोड़ने को सपोर्ट नहीं करता।",
  "settings.homeWidgetUnsupportedLauncher":
    "आपका वर्तमान launcher pinned widget जोड़ने को सपोर्ट नहीं करता।",
  "settings.homeWidgetRequestFailed":
    "विजेट जोड़ने का पॉपअप नहीं खुल सका।",
  "settings.raiseNewMonster": "नया मॉन्स्टर पालें",
  "settings.resetConfirmCodeLabel": "रीसेट कोड",
  "settings.resetTitle": "❗️रीसेट?",
  "settings.resetMessage": "आपका वर्तमान मॉन्स्टर और सारी प्रगति स्थायी रूप से हट जाएगी। नया मॉन्स्टर हैच करने के लिए सेटअप स्क्रीन पर लौटेंगे।",
  "loading.label": "लोड हो रहा है...",
  "loading.errorTitle": "लोडिंग त्रुटि",
  "loading.timeoutTitle": "लोडिंग टाइमआउट",
  "loading.timeoutMessage": "गेम लोड होने में बहुत समय लग रहा है। पॉपअप बंद करने के लिए ठीक है दबाएँ या डायग्नोस्टिक्स भेजने के लिए लॉग भेजें।",
  "loading.finishFailed": "गेम लोड पूरा नहीं कर सका। पॉपअप बंद करने के लिए ठीक है दबाएँ या डायग्नोस्टिक्स भेजने के लिए लॉग भेजें।",
  "viewport.portraitOnly": "केवल पोर्ट्रेट",
  "viewport.rotateDevice": "कृपया डिवाइस को",
  "viewport.backToPortrait": "वापस पोर्ट्रेट मोड में घुमाएँ।",
  "viewport.unsupportedRatio": "यह स्क्रीन अनुपात समर्थित नहीं है।",
  "viewport.useTallerPortrait": "कृपया लंबी पोर्ट्रेट स्क्रीन का उपयोग करें।",
  "offlineAd.title": "विज्ञापन कनेक्ट हो रहा है...",
  "offlineAd.message": "लगातार विज्ञापन कनेक्शन विफल होने पर मॉन्स्टर पालने में नुकसान हो सकता है।",
  "offlineAd.returningIn": "{seconds}s में वापसी",
  "diagnostics.prepareFailed": "डायग्नोस्टिक्स पेलोड तैयार नहीं हो सका।",
  "diagnostics.flappyPrepareFailed": "FlappyBird लॉग तैयार नहीं हो सके।",
  "diagnostics.gmailNotice": "मेल कंपोज़ स्क्रीन ऐप के बाहर खुली। अटैचमेंट सपोर्ट केवल Gmail ऐप सीधे खुलने पर गारंटी है।",
  "diagnostics.gmailOpenFailed": "Gmail ड्राफ्ट नहीं खुल सका। कृपया सुनिश्चित करें कि Gmail इंस्टॉल है।",
  "diagnostics.resetFailed": "गेम डेटा रीसेट नहीं हो सका।",
  "diagnostics.sendLog": "लॉग भेजें",
  "diagnostics.sendLogs": "लॉग भेजें",
  "diagnostics.openGmail": "Gmail खोलें",
  "diagnostics.gmailWillOpen": "अब Gmail ऐप खुलेगा।",
  "diagnostics.gmailAttachments": "डायग्नोस्टिक्स फाइलें ड्राफ्ट ईमेल में जुड़ेंगी।",
  "dataRecovery.title": "डेटा रिकवरी",
  "dataRecovery.corruptedReset": "मौजूदा गेम डेटा खराब है और रिकवर नहीं किया जा सकता। पुष्टि दबाने पर डेटा रीसेट होगा और प्रारंभिक सेटअप स्क्रीन खुलेगी।",
  "dataRecovery.readFailedReset": "मौजूदा गेम डेटा पढ़ने में समस्या हुई। पुष्टि दबाने पर डेटा रीसेट होगा और प्रारंभिक सेटअप स्क्रीन खुलेगी।",
  "flappy.gameOver": "गेम ओवर",
  "flappy.exit": "बाहर जाएँ",
  "flappy.retry": "रीट्राई",
  "flappy.bgm": "BGM",
  "flappy.sfx": "SFX",
  "flappy.preparing": "तैयार हो रहा है...",
  "flappy.skyDev": "Sky Dev",
  "flappy.resume": "जारी रखें",
  "flappy.best": "सर्वश्रेष्ठ: {score}",
  "flappy.score": "स्कोर: {score}",
  "flappy.nearMissGood": "अच्छा!",
  "flappy.nearMissGreat": "बहुत बढ़िया!",
  "flappy.restartInstruction": "रीट्राई",
  "flappy.openSource": "ओपन सोर्स",
  "timeOfDay.day": "दिन",
  "timeOfDay.sunrise": "सूर्योदय",
  "timeOfDay.sunset": "सूर्यास्त",
  "timeOfDay.night": "रात",
  "main.eggUnavailable": "अंडे की अवस्था में उपलब्ध नहीं।",
  "main.objectLimitReached": "अधिकतम ऑब्जेक्ट संख्या तक पहुँच गए।",
  "main.cleanObjectsPrompt": "साफ़ करके फिर से प्रयास करें।",
  "monsterInfo.title": "{name} के बारे में",
  "monsterInfo.level": "लेवल",
  "monsterInfo.stamina": "स्टैमिना",
  "monsterInfo.evolution": "विकास",
  "monsterInfo.levelEgg": "अंडा",
  "monsterInfo.levelPhase": "Lv.{phase}",
  "monsterInfo.evolutionEstimate": "अनुमानित विकास समय",
  "monsterInfo.evolutionEstimateRange": "औसत {average} ({min} - {max})",
  "monsterInfo.evolutionEstimateTerminal": "आगे विकास नहीं",
};

const th: TranslationDictionary = {
  "common.on": "เปิด",
  "common.off": "ปิด",
  "common.confirm": "ยืนยัน",
  "common.confirmUpper": "ยืนยัน",
  "common.cancel": "ยกเลิก",
  "common.close": "ปิด",
  "common.reset": "รีเซ็ต",
  "common.okay": "ตกลง",
  "common.notice": "แจ้งเตือน",
  "common.view": "ดู",
  "common.error": "ข้อผิดพลาด",
  "alert.title": "แจ้งเตือน",
  "setup.title": "สร้างมอนสเตอร์!",
  "setup.placeholder.name": "ชื่อมอนสเตอร์",
  "setup.nameWidth": "ความยาวชื่อ: {width}/{maxWidth}px",
  "setup.error.emptyName": "กรุณาใส่ชื่อ",
  "setup.error.minLength": "ชื่อต้องมีอย่างน้อย {minLength} ตัวอักษร",
  "setup.error.maxWidth": "ชื่อต้องพอดีกับป้ายในเกมขนาด {maxWidth}px",
  "setup.start": "เริ่ม",
  "settings.title": "ตั้งค่า",
  "settings.vibration": "สั่น",
  "settings.sfx": "SFX",
  "settings.reportBug": "รายงานบั๊ก",
  "settings.send": "ส่ง",
  "settings.sending": "กำลังส่ง...",
  "settings.language": "ภาษา",
  "settings.homeWidget": "โฮมวิดเจ็ต",
  "settings.homeWidgetDescription":
    "เพิ่มวิดเจ็ต MonTTo ไปยังหน้าจอหลัก Android ของคุณ",
  "settings.homeWidgetAdd": "เพิ่ม",
  "settings.homeWidgetAdd1x1": "เพิ่ม 1x1",
  "settings.homeWidgetAdd2x1": "เพิ่ม 2x1",
  "settings.homeWidgetAdding": "กำลังเพิ่ม...",
  "settings.homeWidgetUnavailable":
    "โฮมวิดเจ็ตใช้ได้เฉพาะในแอป Android เท่านั้น",
  "settings.homeWidgetRequested":
    "เปิดหน้าต่างเพิ่มวิดเจ็ตของ launcher แล้ว โปรดยืนยันบนหน้าจอหลัก",
  "settings.homeWidgetUnsupportedApi":
    "Android เวอร์ชันนี้ไม่รองรับการเพิ่ม pinned widget",
  "settings.homeWidgetUnsupportedLauncher":
    "launcher ปัจจุบันไม่รองรับการเพิ่ม pinned widget",
  "settings.homeWidgetRequestFailed":
    "ไม่สามารถเปิดหน้าต่างเพิ่มวิดเจ็ตได้",
  "settings.raiseNewMonster": "เลี้ยงมอนสเตอร์ใหม่",
  "settings.resetConfirmCodeLabel": "รหัสรีเซ็ต",
  "settings.resetTitle": "❗️รีเซ็ต?",
  "settings.resetMessage": "มอนสเตอร์ปัจจุบันและความคืบหน้าทั้งหมดจะถูกลบถาวร คุณจะกลับไปหน้าตั้งค่าเพื่อฟักมอนสเตอร์ใหม่",
  "loading.label": "กำลังโหลด...",
  "loading.errorTitle": "โหลดผิดพลาด",
  "loading.timeoutTitle": "โหลดหมดเวลา",
  "loading.timeoutMessage": "เกมใช้เวลาโหลดนานเกินไป แตะตกลงเพื่อปิด หรือส่งล็อกเพื่อแชร์ข้อมูลวินิจฉัย",
  "loading.finishFailed": "เกมโหลดไม่สำเร็จ แตะตกลงเพื่อปิด หรือส่งล็อกเพื่อแชร์ข้อมูลวินิจฉัย",
  "viewport.portraitOnly": "แนวตั้งเท่านั้น",
  "viewport.rotateDevice": "กรุณาหมุนอุปกรณ์",
  "viewport.backToPortrait": "กลับเป็นแนวตั้ง",
  "viewport.unsupportedRatio": "ไม่รองรับอัตราส่วนหน้าจอนี้",
  "viewport.useTallerPortrait": "กรุณาใช้หน้าจอแนวตั้งที่สูงกว่า",
  "offlineAd.title": "กำลังเชื่อมต่อโฆษณา...",
  "offlineAd.message": "หากเชื่อมต่อโฆษณาล้มเหลวต่อเนื่อง การเลี้ยงมอนสเตอร์อาจได้รับผลเสีย",
  "offlineAd.returningIn": "กลับใน {seconds} วินาที",
  "diagnostics.prepareFailed": "เตรียมข้อมูลวินิจฉัยไม่สำเร็จ",
  "diagnostics.flappyPrepareFailed": "เตรียมล็อก FlappyBird ไม่สำเร็จ",
  "diagnostics.gmailNotice": "หน้าร่างอีเมลเปิดนอกแอป การแนบไฟล์รับประกันเฉพาะเมื่อเปิด Gmail โดยตรง",
  "diagnostics.gmailOpenFailed": "เปิดร่าง Gmail ไม่สำเร็จ โปรดตรวจสอบว่าติดตั้ง Gmail แล้ว",
  "diagnostics.resetFailed": "รีเซ็ตข้อมูลเกมไม่สำเร็จ",
  "diagnostics.sendLog": "ส่งล็อก",
  "diagnostics.sendLogs": "ส่งล็อก",
  "diagnostics.openGmail": "เปิด Gmail",
  "diagnostics.gmailWillOpen": "แอป Gmail จะเปิดถัดไป",
  "diagnostics.gmailAttachments": "ไฟล์วินิจฉัยจะแนบไปกับอีเมลร่าง",
  "dataRecovery.title": "กู้คืนข้อมูล",
  "dataRecovery.corruptedReset": "ข้อมูลเกมเดิมเสียหายและกู้คืนไม่ได้ กดยืนยันเพื่อรีเซ็ตข้อมูลและกลับไปหน้าตั้งค่าเริ่มต้น",
  "dataRecovery.readFailedReset": "มีปัญหาในการอ่านข้อมูลเกมเดิม กดยืนยันเพื่อรีเซ็ตข้อมูลและกลับไปหน้าตั้งค่าเริ่มต้น",
  "flappy.gameOver": "เกมจบแล้ว",
  "flappy.exit": "ออก",
  "flappy.retry": "ลองใหม่",
  "flappy.bgm": "BGM",
  "flappy.sfx": "SFX",
  "flappy.preparing": "กำลังเตรียม...",
  "flappy.skyDev": "Sky Dev",
  "flappy.resume": "เล่นต่อ",
  "flappy.best": "สูงสุด: {score}",
  "flappy.score": "คะแนน: {score}",
  "flappy.nearMissGood": "ดี!",
  "flappy.nearMissGreat": "เยี่ยม!",
  "flappy.restartInstruction": "ลองใหม่",
  "flappy.openSource": "โอเพนซอร์ส",
  "timeOfDay.day": "กลางวัน",
  "timeOfDay.sunrise": "พระอาทิตย์ขึ้น",
  "timeOfDay.sunset": "พระอาทิตย์ตก",
  "timeOfDay.night": "กลางคืน",
  "main.eggUnavailable": "ใช้ไม่ได้ตอนเป็นไข่",
  "main.objectLimitReached": "ถึงจำนวนวัตถุสูงสุดแล้ว",
  "main.cleanObjectsPrompt": "กรุณาทำความสะอาดแล้วลองอีกครั้ง",
  "monsterInfo.title": "เกี่ยวกับ {name}",
  "monsterInfo.level": "เลเวล",
  "monsterInfo.stamina": "สตามินา",
  "monsterInfo.evolution": "วิวัฒนาการ",
  "monsterInfo.levelEgg": "ไข่",
  "monsterInfo.levelPhase": "Lv.{phase}",
  "monsterInfo.evolutionEstimate": "เวลาวิวัฒนาการโดยประมาณ",
  "monsterInfo.evolutionEstimateRange": "เฉลี่ย {average} ({min} - {max})",
  "monsterInfo.evolutionEstimateTerminal": "ไม่มีการวิวัฒนาการถัดไป",
};

const vi: TranslationDictionary = {
  "common.on": "BẬT",
  "common.off": "TẮT",
  "common.confirm": "Xác nhận",
  "common.confirmUpper": "XÁC NHẬN",
  "common.cancel": "Hủy",
  "common.close": "Đóng",
  "common.reset": "Đặt lại",
  "common.okay": "OK",
  "common.notice": "Thông báo",
  "common.view": "Xem",
  "common.error": "Lỗi",
  "alert.title": "Cảnh báo",
  "setup.title": "Tạo quái vật!",
  "setup.placeholder.name": "tên quái vật",
  "setup.nameWidth": "độ dài tên: {width}/{maxWidth}px",
  "setup.error.emptyName": "Vui lòng nhập tên.",
  "setup.error.minLength": "Tên phải có ít nhất {minLength} ký tự.",
  "setup.error.maxWidth": "Tên phải vừa trong nhãn game {maxWidth}px.",
  "setup.start": "Bắt đầu",
  "settings.title": "Cài đặt",
  "settings.vibration": "Rung",
  "settings.sfx": "SFX",
  "settings.reportBug": "Báo lỗi",
  "settings.send": "Gửi",
  "settings.sending": "Đang gửi...",
  "settings.language": "Ngôn ngữ",
  "settings.homeWidget": "Tiện ích màn hình chính",
  "settings.homeWidgetDescription":
    "Thêm tiện ích MonTTo vào màn hình chính Android của bạn.",
  "settings.homeWidgetAdd": "Thêm",
  "settings.homeWidgetAdd1x1": "Thêm 1x1",
  "settings.homeWidgetAdd2x1": "Thêm 2x1",
  "settings.homeWidgetAdding": "Đang thêm...",
  "settings.homeWidgetUnavailable":
    "Tiện ích màn hình chính chỉ khả dụng trong ứng dụng Android.",
  "settings.homeWidgetRequested":
    "Đã mở cửa sổ thêm tiện ích của launcher. Vui lòng xác nhận trên màn hình chính.",
  "settings.homeWidgetUnsupportedApi":
    "Phiên bản Android này không hỗ trợ thêm pinned widget.",
  "settings.homeWidgetUnsupportedLauncher":
    "Launcher hiện tại không hỗ trợ thêm pinned widget.",
  "settings.homeWidgetRequestFailed":
    "Không thể mở cửa sổ thêm tiện ích.",
  "settings.raiseNewMonster": "Nuôi quái vật mới",
  "settings.resetConfirmCodeLabel": "Mã đặt lại",
  "settings.resetTitle": "❗️Đặt lại?",
  "settings.resetMessage": "Quái vật hiện tại và toàn bộ tiến trình sẽ bị xóa vĩnh viễn. Bạn sẽ quay lại màn hình thiết lập để ấp quái vật mới.",
  "loading.label": "Đang tải...",
  "loading.errorTitle": "Lỗi tải",
  "loading.timeoutTitle": "Tải quá lâu",
  "loading.timeoutMessage": "Game tải quá lâu. Nhấn OK để đóng hoặc Gửi nhật ký để chia sẻ chẩn đoán.",
  "loading.finishFailed": "Game không thể tải xong. Nhấn OK để đóng hoặc Gửi nhật ký để chia sẻ chẩn đoán.",
  "viewport.portraitOnly": "Chỉ chế độ dọc",
  "viewport.rotateDevice": "Vui lòng xoay thiết bị",
  "viewport.backToPortrait": "về chế độ dọc.",
  "viewport.unsupportedRatio": "Tỷ lệ màn hình này không được hỗ trợ.",
  "viewport.useTallerPortrait": "Vui lòng dùng màn hình dọc cao hơn.",
  "offlineAd.title": "Đang kết nối quảng cáo...",
  "offlineAd.message": "Nếu kết nối quảng cáo liên tục thất bại, việc nuôi quái vật có thể bị bất lợi.",
  "offlineAd.returningIn": "Quay lại sau {seconds}s",
  "diagnostics.prepareFailed": "Không thể chuẩn bị dữ liệu chẩn đoán.",
  "diagnostics.flappyPrepareFailed": "Không thể chuẩn bị nhật ký FlappyBird.",
  "diagnostics.gmailNotice": "Màn hình soạn thư đã mở ngoài ứng dụng. Tệp đính kèm chỉ được đảm bảo khi Gmail mở trực tiếp.",
  "diagnostics.gmailOpenFailed": "Không thể mở bản nháp Gmail. Vui lòng kiểm tra Gmail đã được cài đặt.",
  "diagnostics.resetFailed": "Không thể đặt lại dữ liệu game.",
  "diagnostics.sendLog": "Gửi nhật ký",
  "diagnostics.sendLogs": "Gửi nhật ký",
  "diagnostics.openGmail": "Mở Gmail",
  "diagnostics.gmailWillOpen": "Ứng dụng Gmail sẽ mở tiếp theo.",
  "diagnostics.gmailAttachments": "Các tệp chẩn đoán sẽ được đính kèm vào email nháp.",
  "dataRecovery.title": "Khôi phục dữ liệu",
  "dataRecovery.corruptedReset": "Dữ liệu game hiện có bị hỏng và không thể khôi phục. Nhấn Xác nhận để đặt lại dữ liệu và quay lại màn hình thiết lập ban đầu.",
  "dataRecovery.readFailedReset": "Đã xảy ra sự cố khi đọc dữ liệu game hiện có. Nhấn Xác nhận để đặt lại dữ liệu và quay lại màn hình thiết lập ban đầu.",
  "flappy.gameOver": "Game Over",
  "flappy.exit": "Thoát",
  "flappy.retry": "Chơi lại",
  "flappy.bgm": "BGM",
  "flappy.sfx": "SFX",
  "flappy.preparing": "Đang chuẩn bị...",
  "flappy.skyDev": "Sky Dev",
  "flappy.resume": "Tiếp tục",
  "flappy.best": "Kỷ lục: {score}",
  "flappy.score": "Điểm: {score}",
  "flappy.nearMissGood": "Tốt!",
  "flappy.nearMissGreat": "Tuyệt!",
  "flappy.restartInstruction": "Chơi lại",
  "flappy.openSource": "Mã nguồn mở",
  "timeOfDay.day": "Ngày",
  "timeOfDay.sunrise": "Bình minh",
  "timeOfDay.sunset": "Hoàng hôn",
  "timeOfDay.night": "Đêm",
  "main.eggUnavailable": "không khả dụng khi ở trạng thái trứng.",
  "main.objectLimitReached": "Đã đạt đến số lượng đối tượng tối đa.",
  "main.cleanObjectsPrompt": "Hãy dọn dẹp rồi thử lại.",
  "monsterInfo.title": "Về {name}",
  "monsterInfo.level": "Cấp độ",
  "monsterInfo.stamina": "Thể lực",
  "monsterInfo.evolution": "Tiến hóa",
  "monsterInfo.levelEgg": "Trứng",
  "monsterInfo.levelPhase": "Lv.{phase}",
  "monsterInfo.evolutionEstimate": "Thời gian tiến hóa dự kiến",
  "monsterInfo.evolutionEstimateRange": "Trung bình {average} ({min} - {max})",
  "monsterInfo.evolutionEstimateTerminal": "Không có tiến hóa tiếp theo",
};

const ptBR: TranslationDictionary = {
  "common.on": "LIG",
  "common.off": "DESL",
  "common.confirm": "Confirmar",
  "common.confirmUpper": "CONFIRMAR",
  "common.cancel": "Cancelar",
  "common.close": "Fechar",
  "common.reset": "Redefinir",
  "common.okay": "OK",
  "common.notice": "Aviso",
  "common.view": "Ver",
  "common.error": "Erro",
  "alert.title": "Alerta",
  "setup.title": "Criar Monstro!",
  "setup.placeholder.name": "nome do monstro",
  "setup.nameWidth": "comprimento do nome: {width}/{maxWidth}px",
  "setup.error.emptyName": "Digite um nome.",
  "setup.error.minLength": "O nome deve ter pelo menos {minLength} caracteres.",
  "setup.error.maxWidth": "O nome deve caber em {maxWidth}px no rótulo do jogo.",
  "setup.start": "Iniciar",
  "settings.title": "Configurações",
  "settings.vibration": "Vibração",
  "settings.sfx": "SFX",
  "settings.reportBug": "Reportar bug",
  "settings.send": "Enviar",
  "settings.sending": "Enviando...",
  "settings.language": "Idioma",
  "settings.homeWidget": "Widget da tela inicial",
  "settings.homeWidgetDescription":
    "Adicione o widget do MonTTo à tela inicial do Android.",
  "settings.homeWidgetAdd": "Adicionar",
  "settings.homeWidgetAdd1x1": "Adicionar 1x1",
  "settings.homeWidgetAdd2x1": "Adicionar 2x1",
  "settings.homeWidgetAdding": "Adicionando...",
  "settings.homeWidgetUnavailable":
    "O widget da tela inicial está disponível apenas no app Android.",
  "settings.homeWidgetRequested":
    "A janela do launcher para adicionar o widget foi aberta. Confirme na tela inicial.",
  "settings.homeWidgetUnsupportedApi":
    "Esta versão do Android não oferece suporte para adicionar widgets fixados.",
  "settings.homeWidgetUnsupportedLauncher":
    "O launcher atual não oferece suporte para adicionar widgets fixados.",
  "settings.homeWidgetRequestFailed":
    "Não foi possível abrir a janela para adicionar o widget.",
  "settings.raiseNewMonster": "Criar novo monstro",
  "settings.resetConfirmCodeLabel": "Código de redefinição",
  "settings.resetTitle": "❗️Redefinir?",
  "settings.resetMessage": "Seu monstro atual e todo o progresso serão excluídos permanentemente. Você voltará à tela de configuração para chocar um novo.",
  "loading.label": "Carregando...",
  "loading.errorTitle": "Erro de carregamento",
  "loading.timeoutTitle": "Tempo de carregamento esgotado",
  "loading.timeoutMessage": "O jogo está demorando muito para carregar. Toque em OK para fechar ou Enviar log para compartilhar diagnósticos.",
  "loading.finishFailed": "O jogo não conseguiu terminar de carregar. Toque em OK para fechar ou Enviar log para compartilhar diagnósticos.",
  "viewport.portraitOnly": "Somente retrato",
  "viewport.rotateDevice": "Gire o dispositivo",
  "viewport.backToPortrait": "de volta ao modo retrato.",
  "viewport.unsupportedRatio": "Esta proporção de tela não é suportada.",
  "viewport.useTallerPortrait": "Use uma tela retrato mais alta.",
  "offlineAd.title": "Conectando anúncio...",
  "offlineAd.message": "Falhas contínuas na conexão de anúncios podem prejudicar a criação do monstro.",
  "offlineAd.returningIn": "Voltando em {seconds}s",
  "diagnostics.prepareFailed": "Falha ao preparar os diagnósticos.",
  "diagnostics.flappyPrepareFailed": "Falha ao preparar os logs do FlappyBird.",
  "diagnostics.gmailNotice": "A tela de composição abriu fora do app. O suporte a anexos só é garantido quando o Gmail abre diretamente.",
  "diagnostics.gmailOpenFailed": "Falha ao abrir o rascunho do Gmail. Verifique se o Gmail está instalado.",
  "diagnostics.resetFailed": "Falha ao redefinir os dados do jogo.",
  "diagnostics.sendLog": "Enviar log",
  "diagnostics.sendLogs": "Enviar logs",
  "diagnostics.openGmail": "Abrir Gmail",
  "diagnostics.gmailWillOpen": "O app Gmail será aberto em seguida.",
  "diagnostics.gmailAttachments": "Os arquivos de diagnóstico serão anexados ao e-mail de rascunho.",
  "dataRecovery.title": "Recuperação de dados",
  "dataRecovery.corruptedReset": "Os dados existentes do jogo estão corrompidos e não podem ser recuperados. Pressione Confirmar para redefinir os dados e voltar à tela inicial de configuração.",
  "dataRecovery.readFailedReset": "Houve um problema ao ler os dados existentes do jogo. Pressione Confirmar para redefinir os dados e voltar à tela inicial de configuração.",
  "flappy.gameOver": "Fim de jogo",
  "flappy.exit": "Sair",
  "flappy.retry": "Repetir",
  "flappy.bgm": "BGM",
  "flappy.sfx": "SFX",
  "flappy.preparing": "Preparando...",
  "flappy.skyDev": "Sky Dev",
  "flappy.resume": "Continuar",
  "flappy.best": "Recorde: {score}",
  "flappy.score": "Pontuação: {score}",
  "flappy.nearMissGood": "Bom!",
  "flappy.nearMissGreat": "Ótimo!",
  "flappy.restartInstruction": "Repetir",
  "flappy.openSource": "Open source",
  "timeOfDay.day": "Dia",
  "timeOfDay.sunrise": "Nascer do sol",
  "timeOfDay.sunset": "Pôr do sol",
  "timeOfDay.night": "Noite",
  "main.eggUnavailable": "não disponível no estado de ovo.",
  "main.objectLimitReached": "O número máximo de objetos foi atingido.",
  "main.cleanObjectsPrompt": "Limpe e tente novamente.",
  "monsterInfo.title": "Sobre {name}",
  "monsterInfo.level": "Nível",
  "monsterInfo.stamina": "Stamina",
  "monsterInfo.evolution": "Evolução",
  "monsterInfo.levelEgg": "Ovo",
  "monsterInfo.levelPhase": "Lv.{phase}",
  "monsterInfo.evolutionEstimate": "Tempo estimado de evolução",
  "monsterInfo.evolutionEstimateRange": "média {average} ({min} - {max})",
  "monsterInfo.evolutionEstimateTerminal": "Sem próxima evolução",
};

export const TRANSLATIONS: Record<LocaleCode, TranslationDictionary> = {
  en,
  ko,
  ja,
  "zh-TW": zhTW,
  "zh-HK": zhHK,
  hi,
  th,
  vi,
  "pt-BR": ptBR,
};

const missingTranslationWarnings = new Set<string>();

export function isLocaleCode(value: unknown): value is LocaleCode {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export function normalizeLocale(value: unknown): LocaleCode {
  if (isLocaleCode(value)) {
    return value;
  }

  return DEFAULT_LOCALE;
}

function normalizeLanguageTag(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/_/g, "-");
}

function getSupportedLocaleByCanonicalTag(languageTag: string): LocaleCode | null {
  const lowerLanguageTag = languageTag.toLowerCase();

  for (const locale of SUPPORTED_LOCALES) {
    if (locale.toLowerCase() === lowerLanguageTag) {
      return locale;
    }
  }

  return null;
}

function resolveChineseLocale(parts: string[]): LocaleCode | null {
  const subtags = parts.slice(1).map((part) => part.toLowerCase());

  if (subtags.includes("hk") || subtags.includes("mo")) {
    return "zh-HK";
  }

  if (subtags.includes("tw") || subtags.includes("hant")) {
    return "zh-TW";
  }

  return null;
}

export function resolveLocaleFromLanguageTag(value: unknown): LocaleCode | null {
  const languageTag = normalizeLanguageTag(value);

  if (!languageTag) {
    return null;
  }

  const exactLocale = getSupportedLocaleByCanonicalTag(languageTag);
  if (exactLocale) {
    return exactLocale;
  }

  const parts = languageTag.split("-").filter(Boolean);
  const baseLanguage = parts[0]?.toLowerCase();

  if (!baseLanguage) {
    return null;
  }

  if (baseLanguage === "zh") {
    return resolveChineseLocale(parts);
  }

  return getSupportedLocaleByCanonicalTag(baseLanguage);
}

export function resolveLocaleFromLanguageTags(
  values: unknown,
  fallback: LocaleCode = DEFAULT_LOCALE,
): LocaleCode {
  const languageTags = Array.isArray(values) ? values : [values];

  for (const languageTag of languageTags) {
    const locale = resolveLocaleFromLanguageTag(languageTag);
    if (locale) {
      return locale;
    }
  }

  return fallback;
}

export function translate(
  locale: LocaleCode,
  key: TranslationKey,
  params: TranslationParams = {},
): string {
  const template =
    (TRANSLATIONS[locale] as Record<string, string | undefined>)[key] ??
    (TRANSLATIONS[DEFAULT_LOCALE] as Record<string, string | undefined>)[key];

  if (typeof template !== "string") {
    const warningKey = `${locale}:${key}`;

    if (!missingTranslationWarnings.has(warningKey)) {
      missingTranslationWarnings.add(warningKey);
      console.warn(
        `[i18n] missing translation for key "${key}" in locale "${locale}" and fallback "${DEFAULT_LOCALE}"`,
      );
    }

    return key;
  }

  return template.replace(/\{(\w+)\}/g, (match, paramKey: string) => {
    const value = params[paramKey];

    if (value === null || typeof value === "undefined") {
      return match;
    }

    return String(value);
  });
}

export function assertTranslationParity(): void {
  const expectedKeys = Object.keys(en).sort();

  for (const locale of SUPPORTED_LOCALES) {
    const actualKeys = Object.keys(TRANSLATIONS[locale]).sort();
    const missingKeys = expectedKeys.filter((key) => !actualKeys.includes(key));
    const extraKeys = actualKeys.filter((key) => !expectedKeys.includes(key));

    if (missingKeys.length > 0 || extraKeys.length > 0) {
      throw new Error(
        `[i18n] Locale ${locale} dictionary mismatch. missing=${missingKeys.join(",")}; extra=${extraKeys.join(",")}`,
      );
    }
  }
}
