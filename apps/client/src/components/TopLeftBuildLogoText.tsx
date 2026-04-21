import "./TopLeftBuildLogoText.css";

const buildLogoText = __APP_LOGO_TEXT__.trim();

export default function TopLeftBuildLogoText() {
  if (!buildLogoText) {
    return null;
  }

  return <div className="build-logo-text">{buildLogoText}</div>;
}
