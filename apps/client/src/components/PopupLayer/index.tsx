import type React from "react";

interface PopupProps {
	title: string;
	content: React.ReactNode;
	onConfirm?: () => void;
	onCancel?: () => void;
	confirmText?: string;
	cancelText?: string;
}

const PopupLayer: React.FC<PopupProps> = ({
	title = "알림!",
	content,
	onConfirm,
	onCancel,
	confirmText = "확인",
	cancelText = "취소",
}) => {
	return (
		<div className="text-black">
			<div className="inline-block bg-layer-bg p-5 border-4 border-[#222] shadow-[0_4px_0_#222,0_-4px_0_#222,4px_0_0_#222,-4px_0_0_#222,4px_4px_0_#222,-4px_4px_0_#222,4px_-4px_0_#222,-4px_-4px_0_#222] text-center relative">
				<div className="text-xl text-component-negative font-bold mb-[15px] pb-[10px] border-b-4 border-[#222]">
					{title}
				</div>
				<div className="mb-5 leading-[1.6] text-base">{content}</div>
				<div className="flex justify-center gap-[15px]">
					{onCancel && (
						<button
							type={"button"}
							onClick={onCancel}
							className="text-base bg-component-negative text-white border-2 border-[#222] p-[10px_15px] cursor-pointer uppercase shadow-[2px_2px_0_#222] relative top-0 left-0 transition-all duration-50"
						>
							{cancelText}
						</button>
					)}
					<button
						type={"button"}
						onClick={onConfirm}
						className="text-base bg-component-positive text-white border-2 border-[#222] p-[10px_15px]  cursor-pointer uppercase shadow-[2px_2px_0_#222]"
					>
						{confirmText}
					</button>
				</div>
			</div>
		</div>
	);
};

export default PopupLayer;
