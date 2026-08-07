import { useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { APP_VERSION } from '../lib/constants';

export default function DynamicPWA() {
  const { settings } = useSettings();

  useEffect(() => {
    if (!settings) return;

    const appName = `DAVVERO System v${APP_VERSION}`;
    const shortName = 'DAVVERO System';

    // 1. Atualizar Título da Página
    document.title = appName;

    // 2. Atualizar Apple Mobile Web App Title
    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitle) {
      appleTitle = document.createElement('meta');
      appleTitle.setAttribute('name', 'apple-mobile-web-app-title');
      document.head.appendChild(appleTitle);
    }
    appleTitle.setAttribute('content', shortName);

    // 3. Atualizar Meta Theme Color
    let themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.setAttribute('name', 'theme-color');
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.setAttribute('content', settings.instColor || "#0ea5e9");

    // 4. Atualizar Favicon
    let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (favicon) {
      favicon.href = settings.instLogo || "/icon.svg";
    }

    // Nota: Deixamos o manifest.json estático para garantir a instalação no PC.
    // O Chrome no Desktop é rigoroso com manifestos dinâmicos/blob.
    
    return () => {};
  }, [settings]);

  return null;
}
