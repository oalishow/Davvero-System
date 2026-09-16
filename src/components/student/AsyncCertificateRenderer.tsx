import React, { memo, useState, useEffect } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db, appId } from "../../lib/firebase";
import { ASSETS_DOC_PATH } from "../../lib/constants";
import type { Event, Member, CertificateTemplate } from "../../types";
import CertificateRenderer from "../CertificateRenderer";

interface AsyncCertificateRendererProps {
  event: Event;
  member: Member;
  isOrganizer?: boolean;
  id?: string;
}

export const AsyncCertificateRenderer = memo(
  ({
    event,
    member,
    isOrganizer,
    id,
  }: AsyncCertificateRendererProps) => {
    const getInitialTemplate = (): CertificateTemplate => {
      if (isOrganizer) {
        if (event.organizationCertificateTemplate) {
          return event.organizationCertificateTemplate;
        }
        if (event.certificateTemplate) {
          return {
            ...event.certificateTemplate,
            subtitleText: event.certificateTemplate.subtitleText || "DE ORGANIZAÇÃO",
          };
        }
        return {
          bgStyle: "theme-classic",
          fontFamily: "serif",
          titleText: "CERTIFICADO",
          subtitleText: "DE ORGANIZAÇÃO",
          bodyText: "",
          signatureName: "",
          signatureRole: "",
          isApproved: false,
        };
      }
      return (
        event.certificateTemplate || {
          bgStyle: "theme-classic",
          fontFamily: "serif",
          titleText: "CERTIFICADO",
          subtitleText: "DE PARTICIPAÇÃO",
          bodyText: "",
          signatureName: "",
          signatureRole: "",
          isApproved: false,
        }
      );
    };

    const [template, setTemplate] = useState<CertificateTemplate>(getInitialTemplate);

    useEffect(() => {
      setTemplate(getInitialTemplate());
    }, [event.id, isOrganizer, event.organizationCertificateTemplate, event.certificateTemplate]);

    useEffect(() => {
      let isMounted = true;
      const localKey = `davveroId_cert_assets_${event.id}_${isOrganizer ? "org" : "part"}`;

      const applyAssets = (assets: any) => {
        if (!assets || !isMounted) return;
        try {
          localStorage.setItem(localKey, JSON.stringify(assets));
        } catch {}
        setTemplate((prev) =>
          prev
            ? {
                ...prev,
                ...(assets.backgroundImageUrl && {
                  backgroundImageUrl: assets.backgroundImageUrl,
                }),
                ...(assets.logoUrl && {
                  logoUrl: assets.logoUrl,
                }),
                ...(assets.logo2Url && {
                  logo2Url: assets.logo2Url,
                }),
                ...(assets.fajopaDirectorSignatureUrl && {
                  fajopaDirectorSignatureUrl:
                    assets.fajopaDirectorSignatureUrl,
                }),
                ...(assets.seminarRectorSignatureUrl && {
                  seminarRectorSignatureUrl:
                    assets.seminarRectorSignatureUrl,
                }),
                ...(assets.signature1Url && {
                  signature1Url: assets.signature1Url,
                }),
                ...(assets.signature2Url && {
                  signature2Url: assets.signature2Url,
                }),
                ...(assets.signature3Url && {
                  signature3Url: assets.signature3Url,
                }),
              }
            : prev,
        );
      };

      // Tentar restaurar imediatamente do cache local para renderização offline instantânea
      try {
        const cached = localStorage.getItem(localKey);
        if (cached) {
          applyAssets(JSON.parse(cached));
        }
      } catch {}

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return () => {
          isMounted = false;
        };
      }

      // 1. Immediate direct fetch for instantaneous rendering with fallback for organizer
      const fetchAssets = async () => {
        try {
          if (isOrganizer) {
            const orgDocRef = doc(db, ASSETS_DOC_PATH(appId, `cert_assets_org_${event.id}`));
            const orgSnap = await getDoc(orgDocRef);
            if (isMounted && orgSnap.exists()) {
              const snapData = orgSnap.data();
              const assets = snapData?.data !== undefined ? snapData.data : snapData;
              if (assets && Object.keys(assets).length > 0) {
                applyAssets(assets);
                return;
              }
            }
          }
          // Fallback to primary event assets
          const mainDocRef = doc(db, ASSETS_DOC_PATH(appId, `cert_assets_${event.id}`));
          const mainSnap = await getDoc(mainDocRef);
          if (isMounted && mainSnap.exists()) {
            const snapData = mainSnap.data();
            const assets = snapData?.data !== undefined ? snapData.data : snapData;
            applyAssets(assets);
          }
        } catch (err) {
          console.warn("Notice loading cert assets", err);
        }
      };

      fetchAssets();

      // 2. Realtime listener for live sync
      const primaryDocId = isOrganizer ? `cert_assets_org_${event.id}` : `cert_assets_${event.id}`;
      const unsub = onSnapshot(doc(db, ASSETS_DOC_PATH(appId, primaryDocId)), (snap) => {
        if (snap.exists()) {
          const snapData = snap.data();
          const assets = snapData?.data !== undefined ? snapData.data : snapData;
          applyAssets(assets);
        }
      }, (err) => {
        console.warn("Notice in cert assets snapshot", err);
      });

      return () => {
        isMounted = false;
        if (unsub) unsub();
      };
    }, [event.id, isOrganizer, event.organizationCertificateTemplate, event.certificateTemplate]);

    if (!template) return null;
    return (
      <CertificateRenderer
        id={id || `cert-node-${isOrganizer ? "org" : "part"}-${event.id}`}
        event={event}
        template={template}
        member={member}
        isOrganizer={isOrganizer}
      />
    );
  },
);

export default AsyncCertificateRenderer;
