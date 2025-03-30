import type { ControlButtonType } from "@digivice/game";
import type React from "react";
import styled from "styled-components";
import ControlButton from "./ControlButton";

// 버튼 타입에 대한 확장 정의 (기존 모듈에 추가하거나 여기서 재정의)

// // 버튼 세트 정의
// export interface ControlButtonSetConfig {
//   id: ControlButtonUseCase;
//   buttons: [ControlButtonType, ControlButtonType, ControlButtonType];
// }

// 미리 정의된 버튼 세트들
// export const BUTTON_SETS: ControlButtonSetConfig[] = [
//   {
//     id: ControlButtonUseCase.Default,
//     buttons: [ControlButtonType.Cancel, ControlButtonType.Settings, ControlButtonType.Next],
//   },
//   {
//     id: ControlButtonUseCase.ActiveMenuItem,
//     buttons: [ControlButtonType.Cancel, ControlButtonType.Confirm, ControlButtonType.Next],
//   },
//   {
//     id: ControlButtonUseCase.GameFlappyBird,
//     buttons: [ControlButtonType.Attack, ControlButtonType.DoubleJump, ControlButtonType.Jump],
//   },
//   // 추가적인 버튼 세트 정의 가능
// ];

interface ControlButtonsProps {
	buttonTypes: [ControlButtonType, ControlButtonType, ControlButtonType];
	onButtonPress: (buttonType: ControlButtonType) => void;
}

const ControlButtonsContainer = styled.div`
  width: 80%;
  max-width: 300px;
  display: flex;
  justify-content: space-between;
  margin: 0 auto;
`;

const ControlButtons: React.FC<ControlButtonsProps> = ({
	buttonTypes,
	onButtonPress,
}) => {
	// 현재 활성 세트 찾기

	return (
		<ControlButtonsContainer>
			<ControlButton
				type={buttonTypes[0]}
				onClick={() => onButtonPress(buttonTypes[0])}
			/>
			<ControlButton
				type={buttonTypes[1]}
				onClick={() => onButtonPress(buttonTypes[1])}
			/>
			<ControlButton
				type={buttonTypes[2]}
				onClick={() => onButtonPress(buttonTypes[2])}
			/>
		</ControlButtonsContainer>
	);
};

export default ControlButtons;
