import { loginIcon } from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";

export const ExcalidrawPlusPromoBanner = (_props: { isSignedIn: boolean }) => {
  const { t } = useI18n();
  return (
    <a
      href="/sign-in"
      className="plus-banner"
    >
      <span className="plus-banner__icon">{loginIcon}</span>
      <span className="plus-banner__text">
        <span className="plus-banner__title">{t("labels.signIn")}</span>
      </span>
    </a>
  );
};
