import type React from "react";
import { useState } from "react";
import PopupLayer from "../components/PopupLayer";

type SettingFormData = {
	name: string;
};

export interface SetupLayerProps {
	onComplete: (formData: SettingFormData) => void;
}

export const SetupLayer: React.FC<SetupLayerProps> = ({ onComplete }) => {
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);

	const handleConfirm = () => {
		if (!name.trim()) {
			setError("닉네임을 입력해주세요!");
			return;
		}

		if (name.length < 2 || name.length > 10) {
			setError("닉네임은 2~10자 사이로 입력해주세요!");
			return;
		}

		// 닉네임 유효성 검사 통과 시 완료 콜백 호출
		onComplete({
			name: name.trim(),
		});
	};

	return (
		<div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
			<PopupLayer
				title="Spawn Monster!"
				content={
					<div className="flex flex-col items-center gap-4">
						<div className="w-full">
							<input
								type="text"
								value={name}
								onChange={(e) => {
									setName(e.target.value);
									setError(null);
								}}
								placeholder="Monster Name"
								maxLength={20}
								className="w-full px-3 py-2 text-center border-2 border-[#222] text-xs focus:outline-none focus:ring-2 focus:ring-[#d95763]"
							/>
							<div className={"mt-4 text-xs text-gray-600"}>
								Name length: {name.length}/20
							</div>
							{error && (
								<p className="mt-4\2 text-component-negative text-[0.7em]">
									{error}
								</p>
							)}
						</div>
					</div>
				}
				onConfirm={handleConfirm}
				confirmText="Start"
			/>
		</div>
	);
};
