import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { Camera, ScanLine, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { bookingPathFromQr } from './qrBookingPath';

interface QrScannerButtonProps {
  scanQrCode?: () => Promise<string | null>;
}

export function QrScannerButton({ scanQrCode }: Readonly<QrScannerButtonProps>) {
  const { t } = useTranslation(['customer', 'common']);
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [isLaunchingNative, setIsLaunchingNative] = useState(false);

  useEffect(() => {
    if (!open || !videoRef.current) return;
    let active = true;
    const reader = new BrowserQRCodeReader();
    void reader
      .decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result) => {
          if (!active || !result) return;
          const target = bookingPathFromQr(result.getText());
          if (!target) {
            setError(t('scanner.invalidCode', { ns: 'customer' }));
            return;
          }
          controlsRef.current?.stop();
          setOpen(false);
          navigate(target);
        }
      )
      .then((controls) => {
        if (!active) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      })
      .catch(() => {
        if (active) setError(t('scanner.cameraUnavailable', { ns: 'customer' }));
      });
    return () => {
      active = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [navigate, open, t]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function close() {
    controlsRef.current?.stop();
    setOpen(false);
    setError('');
  }

  function openBrowserScanner(message = '') {
    setError(message);
    setOpen(true);
  }

  async function launchScanner() {
    setError('');
    if (!scanQrCode) {
      openBrowserScanner();
      return;
    }

    setIsLaunchingNative(true);
    try {
      const value = await scanQrCode();
      if (!value) return;
      const target = bookingPathFromQr(value);
      if (!target) {
        openBrowserScanner(t('scanner.invalidCode', { ns: 'customer' }));
        return;
      }
      navigate(target);
    } catch {
      openBrowserScanner();
    } finally {
      setIsLaunchingNative(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void launchScanner()}
        disabled={isLaunchingNative}
        className="relative -mt-6 flex min-h-16 min-w-0 flex-1 flex-col items-center justify-end gap-1 pb-2 text-xs font-bold text-line-green lg:hidden"
        aria-label={t('scanner.open', { ns: 'customer' })}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-line-green text-white shadow-lg">
          <ScanLine className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="text-[11px] leading-3">
          {isLaunchingNative
            ? t('scanner.opening', { ns: 'customer' })
            : t('scanner.scan', { ns: 'customer' })}
        </span>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex h-dvh flex-col bg-gray-950"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-scanner-title"
          >
            <header className="flex items-center justify-between px-4 py-4 text-white">
              <div>
                <p className="text-xs font-bold uppercase text-line-green">QR</p>
                <h2 id="qr-scanner-title" className="mt-1 text-lg font-bold">
                  {t('scanner.title', { ns: 'customer' })}
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
                aria-label={t('actions.close', { ns: 'common' })}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>
            <div className="relative flex flex-1 items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                autoPlay
                muted
                playsInline
              />
              <div className="pointer-events-none absolute h-64 w-64 rounded-lg border-2 border-line-green shadow-[0_0_0_9999px_rgba(3,7,18,0.45)]" />
            </div>
            <footer className="safe-bottom bg-gray-950 px-5 py-5 text-center text-sm text-gray-300">
              {error ? (
                <p className="text-red-300">{error}</p>
              ) : (
                <p className="inline-flex items-center gap-2">
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  {t('scanner.hint', { ns: 'customer' })}
                </p>
              )}
            </footer>
          </div>,
          document.body
        )}
    </>
  );
}
