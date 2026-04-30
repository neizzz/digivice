import { type ControlButtonParams, ControlButtonType } from "@digivice/game";
import type React from "react";
import { useRef, useState, useLayoutEffect } from "react";
import ControlButton from "./ControlButton";

interface ControlButtonsProps {
  buttonParams: [ControlButtonParams, ControlButtonParams, ControlButtonParams];
  onButtonPress: (buttonType: ControlButtonType) => void;
  onSliderChange?: (value: number) => void;
  onSliderEnd?: () => void;
}

const ControlButtonsContainer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div className="w-4/5 max-w-[300px] flex justify-between mx-auto">
    {children}
  </div>
);

const ControlButtons: React.FC<ControlButtonsProps> = ({
  buttonParams,
  onButtonPress,
  onSliderChange,
  onSliderEnd,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const secondButtonRef = useRef<HTMLDivElement>(null);
  const thirdButtonRef = useRef<HTMLDivElement>(null);
  const [sliderWidth, setSliderWidth] = useState<number | undefined>(undefined); // 기본값
  const buttonTypes = buttonParams.map((buttonParam) => buttonParam.type) as [
    ControlButtonType,
    ControlButtonType,
    ControlButtonType,
  ];
  const shouldRenderSlider =
    buttonTypes.indexOf(ControlButtonType.Clean) !== -1;
  const cleanButtonParam = buttonParams.find(
    (buttonParam) => buttonParam.type === ControlButtonType.Clean,
  );

  useLayoutEffect(() => {
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
  }, [buttonTypes[0], buttonTypes[1], buttonTypes[2], shouldRenderSlider]);

  // Clean 버튼을 슬라이더로 사용
  if (shouldRenderSlider && sliderWidth) {
    return (
      <ControlButtonsContainer>
        <div ref={containerRef} className="flex justify-between w-full">
          {/* 첫 번째 버튼 */}
          <div className={"shrink-0 "}>
            <ControlButton
              type={buttonParams[0].type}
              onClick={() => onButtonPress(buttonParams[0].type)}
            />
          </div>
          {/* 두 번째 버튼 - Clean 타입 버튼을 슬라이더로 표시 */}
          <div ref={secondButtonRef}>
            <ControlButton
              key={cleanButtonParam?.sliderSessionKey ?? "clean-slider"}
              type={ControlButtonType.Clean}
              sliderWidth={sliderWidth}
              initialSliderValue={cleanButtonParam?.initialSliderValue ?? 0.5}
              hasCleaningTarget={cleanButtonParam?.hasCleaningTarget ?? false}
              onSliderChange={onSliderChange}
              onSliderEnd={onSliderEnd}
              onClick={() => onButtonPress(buttonParams[1].type)}
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
          type={buttonParams[0].type}
          onClick={() => onButtonPress(buttonParams[0].type)}
        />
        <div ref={secondButtonRef}>
          <ControlButton
            type={buttonParams[1].type}
            onClick={() => onButtonPress(buttonParams[1].type)}
          />
        </div>
        <div ref={thirdButtonRef}>
          <ControlButton
            type={buttonParams[2].type}
            onClick={() => onButtonPress(buttonParams[2].type)}
          />
        </div>
      </div>
    </ControlButtonsContainer>
  );
};

export default ControlButtons;
