import React, { useMemo } from 'react';
import QRCode from 'qrcode';

interface RealQrCodeProps {
  value: string;
  size?: number;
  darkColor?: string;
  lightColor?: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * Generates an authentic ISO/IEC 18004 scannable QR code synchronously as crisp SVG paths.
 * Works identically during SSR (renderToStaticMarkup) and on-device camera/gallery scans.
 */
export const RealQrCode: React.FC<RealQrCodeProps> = ({
  value,
  size = 128,
  darkColor = '#0f172a',
  lightColor = '#ffffff',
  className = '',
  ariaLabel
}) => {
  const qrData = useMemo(() => {
    const safeVal = (value && value.trim()) || 'MINADENTAL';
    try {
      const qr = QRCode.create(safeVal, { errorCorrectionLevel: 'M' });
      const modules = qr.modules;
      const count = modules.size;
      const paths: string[] = [];

      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (modules.get(r, c)) {
            paths.push(`M${c},${r}h1v1h-1z`);
          }
        }
      }

      return {
        viewBoxSize: count + 2,
        pathData: paths.join('')
      };
    } catch {
      return null;
    }
  }, [value]);

  if (!qrData) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-slate-100 rounded-xl text-[10px] font-mono text-slate-500 ${className}`}
      >
        {value}
      </div>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`-1 -1 ${qrData.viewBoxSize} ${qrData.viewBoxSize}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={ariaLabel || `کد QR قابل اسکن ${value}`}
      className={className}
    >
      <rect x="-1" y="-1" width={qrData.viewBoxSize} height={qrData.viewBoxSize} fill={lightColor} />
      <path d={qrData.pathData} fill={darkColor} />
    </svg>
  );
};
