import { ControlButtonType } from "@digivice/game";
import type React from "react";
import { useRef, useState, useLayoutEffect } from "react";
import ControlButton from "./ControlButton";

interface ControlButtonsProps {
  buttonTypes: [ControlButtonType, ControlButtonType, ControlButtonType];
  onButtonPress: (buttonType: ControlButtonType) => void;
  onSliderChange?: (value: number) => void;
  initialSliderValue?: number;
}

const ControlButtonsContainer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div className="w-4/5 max-w-[300px] flex justify-between mx-auto">
    {children}
  </div>
);

const ControlButtons: React.FC<ControlButtonsProps> = ({
  buttonTypes,
  onButtonPress,
  onSliderChange,
  initialSliderValue = 0.5,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const secondButtonRef = useRef<HTMLDivElement>(null);
  const thirdButtonRef = useRef<HTMLDivElement>(null);
  const [sliderWidth, setSliderWidth] = useState<number | undefined>(undefined); // 기본값

  useLayoutEffect(() => {
    // 2번째와 3번째 버튼의 총 너비 계산
    const shouldRenderSlider =
      buttonTypes.indexOf(ControlButtonType.Clean) !== -1;

    if (
      shouldRenderSlider &&
      secondButtonRef.current &&
      thirdButtonRef.current
    ) {
      const secondButtonLeft = secondButtonRef.current.offsetLeft;
      const thirdButtonLeft = thirdButtonRef.current.offsetLeft;
      const thirdButtonWidth = thirdButtonRef.current.offsetWidth;

      const calculatedWidth =
        thirdButtonWidth + thirdButtonLeft - secondButtonLeft;
      setSliderWidth(calculatedWidth);
    } else {
      setSliderWidth(undefined);
    }
  }, [buttonTypes]);

  // Clean 버튼을 슬라이더로 사용
  if (sliderWidth) {
    return (
      <ControlButtonsContainer>
        <div ref={containerRef} className="flex justify-between w-full">
          {/* 첫 번째 버튼 */}
          <div className={"shrink-0 "}>
            <ControlButton
              type={buttonTypes[0]}
              onClick={() => onButtonPress(buttonTypes[0])}
            />
          </div>
          {/* 두 번째 버튼 - Clean 타입 버튼을 슬라이더로 표시 */}
          <div ref={secondButtonRef}>
            <ControlButton
              type={ControlButtonType.Clean}
              sliderWidth={sliderWidth}
              initialSliderValue={initialSliderValue}
              onSliderChange={onSliderChange}
              onClick={() => onButtonPress(buttonTypes[1])}
            />
          </div>
        </div>
      </ControlButtonsContainer>
    );
  }

  // 기존 3개 버튼 레이아웃
  return (
    <ControlButtonsContainer>
      <div ref={containerRef} className="flex justify-between w-full">
        <ControlButton
          type={buttonTypes[0]}
          onClick={() => onButtonPress(buttonTypes[0])}
        />
        <div ref={secondButtonRef}>
          <ControlButton
            type={buttonTypes[1]}
            onClick={() => onButtonPress(buttonTypes[1])}
          />
        </div>
        <div ref={thirdButtonRef}>
          <ControlButton
            type={buttonTypes[2]}
            onClick={() => onButtonPress(buttonTypes[2])}
          />
        </div>
      </div>
    </ControlButtonsContainer>
  );
};

export default ControlButtons;
