import { type ControlButtonType, Game } from "@digivice/game";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import ControlButtons from "./components/ControlButtons";

const GameContainer: React.FC = () => {
	const gameContainerRef = useRef<HTMLDivElement>(null);
	const [gameInstance, setGameInstance] = useState<Game | null>(null);

	const [buttonTypes, setButtonTypes] = useState<
		[ControlButtonType, ControlButtonType, ControlButtonType] | null
	>(null);

	// Game 인스턴스 생성은 한 번만 실행되도록 보장
	useEffect(() => {
		let game: Game | null = null;

		if (gameContainerRef.current) {
			// Game 인스턴스 생성
			game = new Game({
				parentElement: gameContainerRef.current as HTMLDivElement,
				changeControlButtons: (controlButtonParams) => {
					setButtonTypes(
						() =>
							controlButtonParams.map(
								(controlButtonParam) => controlButtonParam.type,
							) as [ControlButtonType, ControlButtonType, ControlButtonType],
					);
				},
			});
			setGameInstance(game);
		}

		// 컴포넌트 언마운트 시 제대로 정리
		return () => {
			if (game) {
				game.destroy();
				setGameInstance(null);
			}
		};
	}, []);

	// 버튼 클릭 핸들러 - Game 인스턴스에 버튼 타입만 전달
	const handleButtonPress = useCallback(
		(buttonType: ControlButtonType) => {
			if (gameInstance) {
				gameInstance.handleControlButtonClick(buttonType);
			}
		},
		[gameInstance],
	);

	return (
		<>
			<div id="game-container" ref={gameContainerRef}>
				{/* 게임 캔버스가 여기에 렌더링됨 */}
			</div>

			{buttonTypes && (
				<div style={{ marginTop: "40px" }}>
					<ControlButtons
						buttonTypes={buttonTypes}
						onButtonPress={handleButtonPress}
					/>
				</div>
			)}
		</>
	);
};

export default GameContainer;
