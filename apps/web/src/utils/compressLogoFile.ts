const MAX_LOGO_EDGE = 720;
const LOGO_QUALITY = 0.74;
const MAX_DATA_URL_BYTES = 850_000;

export async function compressLogoFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error(i18n.t('common:clientErrors.imageRequired'));
  }

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_LOGO_EDGE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error(i18n.t('common:clientErrors.imageProcessFailed'));

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas);
  const dataUrl = await blobToDataUrl(blob);

  if (new Blob([dataUrl]).size > MAX_DATA_URL_BYTES) {
    throw new Error(i18n.t('common:clientErrors.imageTooLarge'));
  }

  return dataUrl;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(i18n.t('common:clientErrors.imageLoadFailed')));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(i18n.t('common:clientErrors.imageCompressFailed')));
      },
      'image/jpeg',
      LOGO_QUALITY
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(i18n.t('common:clientErrors.imageConvertFailed')));
    reader.readAsDataURL(blob);
  });
}
import { i18n } from '../i18n';
