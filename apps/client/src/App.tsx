import "./App.css";
import { GameDataManager } from "@digivice/game";
import { useLayoutEffect, useState, useTransition } from "react";
import GameContainer from "./GameContainer";
import { SetupLayer } from "./layers/SetupLayer";
import { createInitialGameData } from "./utils/data";

const App = () => {
	const [isExistData, setIsExistData] = useState(false);
	const [isLoading, startLoadData] = useTransition();

	useLayoutEffect(() => {
		startLoadData(async () => {
			const gameData = await GameDataManager.loadData();

			if (gameData) {
				setIsExistData(true);
			}
		});
	}, []);

	return (
		<div id="app-container">
			{isLoading ? (
				"로딩중"
			) : isExistData ? (
				<GameContainer />
			) : (
				<SetupLayer
					onComplete={(formData) => {
						startLoadData(async () => {
							await GameDataManager.saveData(createInitialGameData(formData));
							await GameDataManager.loadData();
							setIsExistData(true);
						});
					}}
				/>
			)}
		</div>
	);
};

export default App;
