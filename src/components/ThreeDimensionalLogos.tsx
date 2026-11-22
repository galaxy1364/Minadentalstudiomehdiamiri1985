import React from 'react';

interface Logo3DProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

/**
 * 1. 3D Sculpted Clinic Home / Dashboard Logo
 * Isometric 3D emerald & pearl clinic building with volumetric roof extrusion and 3D tooth crest.
 */
export const Logo3DHome: React.FC<Logo3DProps> = ({ size = 32, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_5px_10px_rgba(16,185,129,0.34)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_home_wall" x1="12" y1="20" x2="44" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="55%" stopColor="#f1f5f9" />
        <stop offset="100%" stopColor="#cbd5e1" />
      </linearGradient>
      <linearGradient id="md3d_home_roof" x1="28" y1="5" x2="28" y2="27" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="55%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
      <linearGradient id="md3d_home_door" x1="28" y1="30" x2="28" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#0284c7" />
      </linearGradient>
    </defs>
    {/* Contact Shadow */}
    <ellipse cx="28" cy="50" rx="20" ry="3.5" fill="#0f172a" fillOpacity="0.18" />
    {/* 3D Building Base Extrusion (Depth Layer) */}
    <rect x="11" y="25" width="34" height="24" rx="7" fill="#94a3b8" />
    {/* 3D Building Main Sculpted Block */}
    <rect x="11" y="22" width="34" height="24" rx="7" fill="url(#md3d_home_wall)" stroke="#ffffff" strokeWidth="1.2" />
    {/* 3D Glass Entrance Arch */}
    <rect x="22" y="31" width="12" height="15" rx="4" fill="#0369a1" />
    <rect x="22" y="29.5" width="12" height="15.5" rx="4" fill="url(#md3d_home_door)" stroke="#bae6fd" strokeWidth="1" />
    <path d="M23.5 31H29L25 43.5H23.5V31Z" fill="#ffffff" fillOpacity="0.45" />
    {/* 3D Roof Extrusion Rim */}
    <path
      d="M6 25.5L26.2 8.2C27.24 7.32 28.76 7.32 29.8 8.2L50 25.5C51.2 26.5 50.5 28.5 48.9 28.5H7.1C5.5 28.5 4.8 26.5 6 25.5Z"
      fill="#065f46"
    />
    {/* 3D Roof Upper Glossy Surface */}
    <path
      d="M6 23L26.2 5.8C27.24 4.92 28.76 4.92 29.8 5.8L50 23C51.2 24 50.5 26 48.9 26H7.1C5.5 26 4.8 24 6 23Z"
      fill="url(#md3d_home_roof)"
      stroke="#6ee7b7"
      strokeWidth="1"
    />
    {/* Specular Roof Sheen */}
    <path d="M28 6.5L46 22H36L28 13.5V6.5Z" fill="#ffffff" fillOpacity="0.32" />
    {/* 3D Embossed Medical Cross Badge */}
    <circle cx="28" cy="19" r="5.5" fill="#ffffff" stroke="#a7f3d0" strokeWidth="1" />
    <rect x="26.7" y="15.8" width="2.6" height="6.4" rx="1" fill="#059669" />
    <rect x="24.8" y="17.7" width="6.4" height="2.6" rx="1" fill="#059669" />
  </svg>
);

/**
 * 2. 3D Sculpted Patients & Medical Dossier Logo
 * Clean 3D sky-blue clinical card with a sculpted 3D pearl user bust and golden dental star.
 */
export const Logo3DPatients: React.FC<Logo3DProps> = ({ size = 32, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_5px_10px_rgba(2,132,199,0.34)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_pat_card" x1="8" y1="8" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="55%" stopColor="#0284c7" />
        <stop offset="100%" stopColor="#0369a1" />
      </linearGradient>
      <linearGradient id="md3d_pat_avatar" x1="18" y1="14" x2="36" y2="44" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="65%" stopColor="#f1f5f9" />
        <stop offset="100%" stopColor="#cbd5e1" />
      </linearGradient>
      <linearGradient id="md3d_pat_badge" x1="34" y1="30" x2="48" y2="46" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fde047" />
        <stop offset="55%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="20" ry="3.5" fill="#0f172a" fillOpacity="0.18" />
    {/* 3D Folder Extrusion Base */}
    <rect x="7" y="13" width="42" height="35" rx="10" fill="#075985" />
    {/* 3D Folder Front Body */}
    <rect x="7" y="10" width="42" height="35" rx="10" fill="url(#md3d_pat_card)" stroke="#bae6fd" strokeWidth="1.2" />
    {/* Top Specular Glass Reflection */}
    <path d="M17 11H39C44 11 47 14 47 18C35 20 21 20 9 18C9 14 12 11 17 11Z" fill="#ffffff" fillOpacity="0.26" />
    {/* 3D Sculpted Patient Head Sphere */}
    <circle cx="25" cy="22.5" r="6.8" fill="#94a3b8" />
    <circle cx="25" cy="21" r="6.8" fill="url(#md3d_pat_avatar)" stroke="#ffffff" strokeWidth="1" />
    <ellipse cx="23" cy="18.8" rx="2.2" ry="1.4" fill="#ffffff" fillOpacity="0.85" />
    {/* 3D Sculpted Patient Shoulders */}
    <path d="M13.5 39C13.5 33.5 18.5 30 25 30C31.5 30 36.5 33.5 36.5 39V40.5H13.5V39Z" fill="#94a3b8" />
    <path
      d="M13.5 37.5C13.5 32 18.5 28.8 25 28.8C31.5 28.8 36.5 32 36.5 37.5C36.5 39 35.3 40 33.8 40H16.2C14.7 40 13.5 39 13.5 37.5Z"
      fill="url(#md3d_pat_avatar)"
      stroke="#ffffff"
      strokeWidth="1"
    />
    {/* 3D Golden Tooth Verification Coin at Bottom-Right */}
    <circle cx="41" cy="39.5" r="7.5" fill="#78350f" />
    <circle cx="41" cy="38" r="7.5" fill="url(#md3d_pat_badge)" stroke="#fef08a" strokeWidth="1.2" />
    <path
      d="M38.2 35.5C38.2 33.8 39.5 33 41 33C42.5 33 43.8 33.8 43.8 35.5C43.8 37.2 43.1 39.5 42.4 41.5C42 42.5 41.5 42.5 41 41C40.5 42.5 40 42.5 39.6 41.5C38.9 39.5 38.2 37.2 38.2 35.5Z"
      fill="#ffffff"
    />
  </svg>
);

/**
 * 3. 3D Sculpted Dental Treatment & Anatomical Tooth Logo
 * Iconic, crystal-clear 3D porcelain molar tooth on a 3D turquoise cushion with a 3D golden spark.
 */
export const Logo3DTreatments: React.FC<Logo3DProps> = ({ size = 32, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_5px_10px_rgba(13,148,136,0.36)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_trt_base" x1="8" y1="8" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#2dd4bf" />
        <stop offset="55%" stopColor="#0d9488" />
        <stop offset="100%" stopColor="#115e59" />
      </linearGradient>
      <linearGradient id="md3d_trt_tooth" x1="16" y1="10" x2="40" y2="46" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="55%" stopColor="#f8fafc" />
        <stop offset="100%" stopColor="#cbd5e1" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="20" ry="3.5" fill="#0f172a" fillOpacity="0.18" />
    {/* 3D Turquoise Squircle Cushion Extrusion */}
    <rect x="8" y="11" width="40" height="38" rx="12" fill="#134e4a" />
    <rect x="8" y="8" width="40" height="38" rx="12" fill="url(#md3d_trt_base)" stroke="#99f6e4" strokeWidth="1.2" />
    <path d="M18 9.5H38C43 9.5 46 12.5 46 16.5C34 18.5 22 18.5 10 16.5C10 12.5 13 9.5 18 9.5Z" fill="#ffffff" fillOpacity="0.24" />
    {/* 3D Sculpted Anatomical Molar Shadow & Depth */}
    <path
      d="M16.5 21.5C16.5 15.8 20.5 13.5 24.8 14.3C26.5 14.6 27.2 15.4 28 15.4C28.8 15.4 29.5 14.6 31.2 14.3C35.5 13.5 39.5 15.8 39.5 21.5C39.5 26.8 37.4 32 35.5 38.2C34.5 41.4 33.1 42.8 31.6 42.5C30.2 42.2 29.5 37.8 28 36C26.5 37.8 25.8 42.2 24.4 42.5C22.9 42.8 21.5 41.4 20.5 38.2C18.6 32 16.5 26.8 16.5 21.5Z"
      fill="#64748b"
    />
    {/* 3D Sculpted Anatomical Molar Pearl Body */}
    <path
      d="M16.5 19.5C16.5 13.8 20.5 11.5 24.8 12.3C26.5 12.6 27.2 13.4 28 13.4C28.8 13.4 29.5 12.6 31.2 12.3C35.5 11.5 39.5 13.8 39.5 19.5C39.5 24.8 37.4 30 35.5 36.2C34.5 39.4 33.1 40.8 31.6 40.5C30.2 40.2 29.5 35.8 28 34C26.5 35.8 25.8 40.2 24.4 40.5C22.9 40.8 21.5 39.4 20.5 36.2C18.6 30 16.5 24.8 16.5 19.5Z"
      fill="url(#md3d_trt_tooth)"
      stroke="#ffffff"
      strokeWidth="1.2"
    />
    {/* 3D Enamel Crown Specular Dome */}
    <ellipse cx="22.5" cy="17.5" rx="3.5" ry="2.2" transform="rotate(-20 22.5 17.5)" fill="#ffffff" />
    <path d="M23 14.5C25.5 16 30.5 16 33 14.5" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
    {/* 3D Golden Star Glint */}
    <path d="M41 12L42.3 15.2L45.5 16.5L42.3 17.8L41 21L39.7 17.8L36.5 16.5L39.7 15.2L41 12Z" fill="#fde047" />
  </svg>
);

/**
 * 4. 3D Sculpted Financial, Wallet & Gold Coin Logo
 * Iconic 3D banking wallet with a thick 3D embossed golden Toman bullion coin.
 */
export const Logo3DFinancial: React.FC<Logo3DProps> = ({ size = 32, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_5px_10px_rgba(217,119,6,0.36)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_fin_wallet" x1="6" y1="12" x2="44" y2="46" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#10b981" />
        <stop offset="55%" stopColor="#059669" />
        <stop offset="100%" stopColor="#065f46" />
      </linearGradient>
      <linearGradient id="md3d_fin_coin" x1="22" y1="18" x2="50" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="45%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="20" ry="3.5" fill="#0f172a" fillOpacity="0.18" />
    {/* 3D Bank Card Peeking from Top of Wallet */}
    <rect x="12" y="7" width="26" height="16" rx="4" transform="rotate(-7 12 7)" fill="#38bdf8" stroke="#bae6fd" strokeWidth="1" />
    {/* 3D Emerald Banking Wallet Extrusion & Body */}
    <rect x="6" y="17" width="38" height="29" rx="8" fill="#064e3b" />
    <rect x="6" y="14" width="38" height="29" rx="8" fill="url(#md3d_fin_wallet)" stroke="#6ee7b7" strokeWidth="1.2" />
    <path d="M14 15.5H36C40 15.5 42.5 18 42.5 21C31 22.8 19 22.8 7.5 21C7.5 18 10 15.5 14 15.5Z" fill="#ffffff" fillOpacity="0.22" />
    {/* 3D Sculpted Gold Coin with Rim Extrusion */}
    <circle cx="37" cy="36.5" r="13" fill="#78350f" />
    <circle cx="37" cy="34" r="13" fill="url(#md3d_fin_coin)" stroke="#fef08a" strokeWidth="1.4" />
    <circle cx="37" cy="34" r="9.8" fill="#d97706" stroke="#fde047" strokeWidth="1" />
    {/* Specular Coin Highlight & Checkmark/Currency Emblem */}
    <path d="M32.5 34.2L35.5 37.2L41.8 30.8" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * 5. 3D Sculpted Appointments & Iranian Calendar Logo
 * Thick 3D calendar block with crimson header, 3D metallic rings, and 3D confirmed day tile.
 */
export const Logo3DAppointments: React.FC<Logo3DProps> = ({ size = 32, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_5px_10px_rgba(37,99,235,0.34)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_apt_body" x1="8" y1="14" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="65%" stopColor="#f1f5f9" />
        <stop offset="100%" stopColor="#cbd5e1" />
      </linearGradient>
      <linearGradient id="md3d_apt_head" x1="8" y1="10" x2="48" y2="23" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="55%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>
      <linearGradient id="md3d_apt_badge" x1="20" y1="26" x2="36" y2="42" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="20" ry="3.5" fill="#0f172a" fillOpacity="0.18" />
    {/* 3D Calendar Base Extrusion */}
    <rect x="8" y="14" width="40" height="34" rx="10" fill="#64748b" />
    {/* 3D Calendar White Block */}
    <rect x="8" y="10.5" width="40" height="34" rx="10" fill="url(#md3d_apt_body)" stroke="#ffffff" strokeWidth="1.2" />
    {/* 3D Cobalt Header Cap */}
    <path d="M8 19.5C8 14.5 12 10.5 17 10.5H39C44 10.5 48 14.5 48 19.5V22.5H8V19.5Z" fill="url(#md3d_apt_head)" />
    <path d="M16 11.5H40C43.5 11.5 46 13.5 46.5 16.5H9.5C10 13.5 12.5 11.5 16 11.5Z" fill="#ffffff" fillOpacity="0.28" />
    {/* 3D Metallic Binding Rings */}
    <rect x="16.5" y="6" width="4.5" height="9" rx="2.25" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
    <rect x="35" y="6" width="4.5" height="9" rx="2.25" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
    {/* 3D Raised Day Pill in Center */}
    <rect x="17" y="27" width="22" height="13.5" rx="4.5" fill="#065f46" />
    <rect x="17" y="25.5" width="22" height="13.5" rx="4.5" fill="url(#md3d_apt_badge)" stroke="#a7f3d0" strokeWidth="1" />
    <path d="M23.5 32.5L26.8 35.6L33 29.4" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * 6. 3D Sculpted Services Grid Launcher Logo
 * Four 3D glossy jewel blocks (Sky, Emerald, Amber, Purple) with true 3D thickness.
 */
export const Logo3DGridServices: React.FC<Logo3DProps> = ({ size = 32, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_5px_10px_rgba(139,92,246,0.34)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_grd_1" x1="8" y1="8" x2="25" y2="25" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38bdf8" /><stop offset="100%" stopColor="#0284c7" />
      </linearGradient>
      <linearGradient id="md3d_grd_2" x1="31" y1="8" x2="48" y2="25" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#059669" />
      </linearGradient>
      <linearGradient id="md3d_grd_3" x1="8" y1="31" x2="25" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fde047" /><stop offset="100%" stopColor="#d97706" />
      </linearGradient>
      <linearGradient id="md3d_grd_4" x1="31" y1="31" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#c084fc" /><stop offset="100%" stopColor="#7e22ce" />
      </linearGradient>
    </defs>
    {/* Top-Left 3D Block */}
    <rect x="8" y="10.5" width="17" height="17" rx="5.5" fill="#075985" />
    <rect x="8" y="8" width="17" height="17" rx="5.5" fill="url(#md3d_grd_1)" stroke="#bae6fd" strokeWidth="1" />
    <ellipse cx="14" cy="12" rx="3.5" ry="1.6" fill="#ffffff" fillOpacity="0.55" />
    {/* Top-Right 3D Block */}
    <rect x="31" y="10.5" width="17" height="17" rx="5.5" fill="#065f46" />
    <rect x="31" y="8" width="17" height="17" rx="5.5" fill="url(#md3d_grd_2)" stroke="#a7f3d0" strokeWidth="1" />
    <ellipse cx="37" cy="12" rx="3.5" ry="1.6" fill="#ffffff" fillOpacity="0.55" />
    {/* Bottom-Left 3D Block */}
    <rect x="8" y="33.5" width="17" height="17" rx="5.5" fill="#92400e" />
    <rect x="8" y="31" width="17" height="17" rx="5.5" fill="url(#md3d_grd_3)" stroke="#fef08a" strokeWidth="1" />
    <ellipse cx="14" cy="35" rx="3.5" ry="1.6" fill="#ffffff" fillOpacity="0.55" />
    {/* Bottom-Right 3D Block */}
    <rect x="31" y="33.5" width="17" height="17" rx="5.5" fill="#581c87" />
    <rect x="31" y="31" width="17" height="17" rx="5.5" fill="url(#md3d_grd_4)" stroke="#e9d5ff" strokeWidth="1" />
    <ellipse cx="37" cy="35" rx="3.5" ry="1.6" fill="#ffffff" fillOpacity="0.55" />
  </svg>
);

/**
 * 7. 3D Sculpted Fast Action Zap Logo
 * Volumetric 3D golden-lime lightning bolt inside a 3D dark-emerald power medallion.
 */
export const Logo3DThumbZap: React.FC<Logo3DProps> = ({ size = 32, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_5px_10px_rgba(132,204,22,0.42)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_zap_bolt" x1="32" y1="6" x2="18" y2="50" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="30%" stopColor="#d9f99d" />
        <stop offset="65%" stopColor="#facc15" />
        <stop offset="100%" stopColor="#ca8a04" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="16" ry="3" fill="#0f172a" fillOpacity="0.18" />
    {/* 3D Bolt Depth Extrusion */}
    <path d="M32 8.5L13 29.5H26.5L21 50.5L43 24.5H29.5L32 8.5Z" fill="#854d0e" />
    {/* 3D Bolt Glossy Body */}
    <path
      d="M32 6L13 27H26.5L21 48L43 22H29.5L32 6Z"
      fill="url(#md3d_zap_bolt)"
      stroke="#fef08a"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <path d="M31 9L16 25.5H25.5L31 9Z" fill="#ffffff" fillOpacity="0.6" />
  </svg>
);

/**
 * 8. 3D Sculpted Titanium Implant Fixture & Porcelain Crown Logo
 * Unmistakable 3-part 3D dental implant: 3D porcelain crown + 3D gold hex abutment + 3D helical titanium screw.
 */
export const Logo3DImplant: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(14,165,233,0.42)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_imp_crown" x1="16" y1="4" x2="40" y2="23" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="60%" stopColor="#f1f5f9" />
        <stop offset="100%" stopColor="#cbd5e1" />
      </linearGradient>
      <linearGradient id="md3d_imp_gold" x1="20" y1="21" x2="36" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
      <linearGradient id="md3d_imp_ti" x1="18" y1="28" x2="38" y2="50" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#e2e8f0" />
        <stop offset="35%" stopColor="#94a3b8" />
        <stop offset="75%" stopColor="#475569" />
        <stop offset="100%" stopColor="#1e293b" />
      </linearGradient>
    </defs>
    {/* 3D Cyan Osseointegration Pedestal Ring */}
    <ellipse cx="28" cy="49" rx="18" ry="4.5" fill="#0284c7" fillOpacity="0.24" />
    <ellipse cx="28" cy="49" rx="13" ry="2.8" fill="#38bdf8" fillOpacity="0.4" />
    {/* 1. 3D Sculpted Porcelain Crown */}
    <path
      d="M15.5 14C15.5 8.5 19.8 5.5 24.5 6.3C26.4 6.6 27.2 7.5 28 7.5C28.8 7.5 29.6 6.6 31.5 6.3C36.2 5.5 40.5 8.5 40.5 14C40.5 18.2 38 21.5 34.8 22.5H21.2C18 21.5 15.5 18.2 15.5 14Z"
      fill="#94a3b8"
    />
    <path
      d="M15.5 12.5C15.5 7 19.8 4 24.5 4.8C26.4 5.1 27.2 6 28 6C28.8 6 29.6 5.1 31.5 4.8C36.2 4 40.5 7 40.5 12.5C40.5 16.7 38 20 34.8 21H21.2C18 20 15.5 16.7 15.5 12.5Z"
      fill="url(#md3d_imp_crown)"
      stroke="#ffffff"
      strokeWidth="1.2"
    />
    <ellipse cx="22.5" cy="10" rx="3.8" ry="2" transform="rotate(-15 22.5 10)" fill="#ffffff" />
    {/* 2. 3D Golden Titanium-Nitride Transmucosal Abutment Collar */}
    <path d="M20.5 21H35.5L33.8 26.5H22.2L20.5 21Z" fill="url(#md3d_imp_gold)" stroke="#fef08a" strokeWidth="0.9" />
    {/* 3. 3D Cylindrical Titanium Fixture Core & Helical Screw Threads */}
    <path d="M22.5 26.5H33.5L31 48C30.8 49.5 29.5 50.5 28 50.5C26.5 50.5 25.2 49.5 25 48L22.5 26.5Z" fill="url(#md3d_imp_ti)" />
    {/* 3D Helical Thread Ridges */}
    <rect x="20" y="28" width="16" height="3.4" rx="1.7" transform="rotate(-6 28 29.7)" fill="url(#md3d_imp_ti)" stroke="#f8fafc" strokeWidth="0.8" />
    <rect x="20.8" y="33.2" width="14.4" height="3.4" rx="1.7" transform="rotate(-6 28 34.9)" fill="url(#md3d_imp_ti)" stroke="#f8fafc" strokeWidth="0.8" />
    <rect x="21.6" y="38.4" width="12.8" height="3.4" rx="1.7" transform="rotate(-6 28 40.1)" fill="url(#md3d_imp_ti)" stroke="#f8fafc" strokeWidth="0.8" />
    <rect x="22.6" y="43.5" width="10.8" height="3.2" rx="1.6" transform="rotate(-6 28 45.1)" fill="url(#md3d_imp_ti)" stroke="#38bdf8" strokeWidth="0.8" />
  </svg>
);

/**
 * 9. 3D Sculpted Dental Prosthetics Laboratory Logo
 * Realistic 3D 3-unit zirconia crown bridge mounted on a 3D purple articulatory dental cast base.
 */
export const Logo3DLab: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(168,85,247,0.42)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_lab_base" x1="6" y1="30" x2="50" y2="50" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#c084fc" />
        <stop offset="50%" stopColor="#9333ea" />
        <stop offset="100%" stopColor="#581c87" />
      </linearGradient>
      <linearGradient id="md3d_lab_tooth" x1="12" y1="10" x2="44" y2="38" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="60%" stopColor="#f3e8ff" />
        <stop offset="100%" stopColor="#d8b4fe" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="21" ry="3.5" fill="#0f172a" fillOpacity="0.2" />
    {/* 3D Purple Articulatory Dental Model Cast Base (Extrusion + Top) */}
    <path d="M7 36C7 32 13 29 28 29C43 29 49 32 49 36V43C49 47 41 49.5 28 49.5C15 49.5 7 47 7 43V36Z" fill="#4c1d95" />
    <path
      d="M7 33.5C7 29.5 13 26.5 28 26.5C43 26.5 49 29.5 49 33.5V39.5C49 43.5 41 46.5 28 46.5C15 46.5 7 43.5 7 39.5V33.5Z"
      fill="url(#md3d_lab_base)"
      stroke="#e9d5ff"
      strokeWidth="1.2"
    />
    {/* Gold Die Pins under Bridge */}
    <rect x="14.5" y="29" width="3" height="6" rx="1.2" fill="#facc15" />
    <rect x="38.5" y="29" width="3" height="6" rx="1.2" fill="#facc15" />
    {/* 3D Sculpted 3-Unit Zirconia Crown Bridge */}
    {/* Left Abutment Crown */}
    <path
      d="M9.5 20C9.5 15.5 12.5 13 16 13C19.5 13 22 15.5 22 20C22 24.5 20.5 29.5 18.8 31.5H13.2C11.5 29.5 9.5 24.5 9.5 20Z"
      fill="url(#md3d_lab_tooth)"
      stroke="#ffffff"
      strokeWidth="1.1"
    />
    {/* Right Abutment Crown */}
    <path
      d="M34 20C34 15.5 36.5 13 40 13C43.5 13 46.5 15.5 46.5 20C46.5 24.5 44.5 29.5 42.8 31.5H37.2C35.5 29.5 34 24.5 34 20Z"
      fill="url(#md3d_lab_tooth)"
      stroke="#ffffff"
      strokeWidth="1.1"
    />
    {/* Center Pontic Crown (Slightly Raised & Larger) */}
    <path
      d="M20.5 18C20.5 12.8 23.8 10 28 10C32.2 10 35.5 12.8 35.5 18C35.5 23.5 33.8 29.5 31.5 32H24.5C22.2 29.5 20.5 23.5 20.5 18Z"
      fill="url(#md3d_lab_tooth)"
      stroke="#ffffff"
      strokeWidth="1.3"
    />
    {/* Specular Gloss Highlights on All 3 Units */}
    <ellipse cx="14.5" cy="17" rx="2" ry="1.2" fill="#ffffff" />
    <ellipse cx="26.5" cy="14.5" rx="2.8" ry="1.5" fill="#ffffff" />
    <ellipse cx="39" cy="17" rx="2" ry="1.2" fill="#ffffff" />
    {/* Golden CAD/CAM Precision Sparkle */}
    <path d="M28 3L29.2 6.2L32.5 7.5L29.2 8.8L28 12L26.8 8.8L23.5 7.5L26.8 6.2L28 3Z" fill="#fde047" />
  </svg>
);

/**
 * 10. 3D Sculpted Sayad Bank Check Logo
 * Authentic 3D rose/purple Sayad check leaf with 3D golden bank hologram seal.
 */
export const Logo3DSayadCheck: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(244,63,94,0.38)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_chk_card" x1="6" y1="12" x2="50" y2="44" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fff1f2" />
        <stop offset="55%" stopColor="#ffe4e6" />
        <stop offset="100%" stopColor="#fecdd3" />
      </linearGradient>
      <linearGradient id="md3d_chk_top" x1="6" y1="12" x2="50" y2="23" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fb7185" />
        <stop offset="50%" stopColor="#e11d48" />
        <stop offset="100%" stopColor="#9f1239" />
      </linearGradient>
      <linearGradient id="md3d_chk_seal" x1="32" y1="26" x2="48" y2="44" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="21" ry="3.5" fill="#0f172a" fillOpacity="0.18" />
    {/* 3D Check Extrusion Depth */}
    <rect x="6" y="15" width="44" height="30" rx="8" fill="#9f1239" />
    {/* 3D Check Main Sheet */}
    <rect x="6" y="11.5" width="44" height="30" rx="8" fill="url(#md3d_chk_card)" stroke="#ffffff" strokeWidth="1.2" />
    {/* 3D Crimson Sayad Header Banner */}
    <path d="M6 19.5C6 15.1 9.6 11.5 14 11.5H42C46.4 11.5 50 15.1 50 19.5V22H6V19.5Z" fill="url(#md3d_chk_top)" />
    <rect x="11" y="15" width="15" height="3.2" rx="1.6" fill="#ffffff" fillOpacity="0.9" />
    {/* Sayad 16-Digit Amount Lines */}
    <rect x="11" y="26.5" width="21" height="3" rx="1.5" fill="#e11d48" />
    <rect x="11" y="32.5" width="15" height="2.8" rx="1.4" fill="#fb7185" />
    {/* 3D Sculpted Golden Central Bank Seal */}
    <circle cx="40" cy="34.5" r="8.5" fill="#78350f" />
    <circle cx="40" cy="32.5" r="8.5" fill="url(#md3d_chk_seal)" stroke="#fef08a" strokeWidth="1.2" />
    <path d="M36.5 32.5L39 35L43.8 30.2" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * 11. 3D Sculpted Installments & Stacked Gold Bullion Logo
 * Three 3D extruded golden coins stacked beside an emerald growth pillar.
 */
export const Logo3DInstallments: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(245,158,11,0.4)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_ins_coin" x1="10" y1="16" x2="36" y2="46" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
      <linearGradient id="md3d_ins_badge" x1="30" y1="10" x2="49" y2="30" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="20" ry="3.5" fill="#0f172a" fillOpacity="0.18" />
    {/* Bottom 3D Gold Coin Cylinder */}
    <path d="M10 38V42.5C10 45.8 16.3 48.5 24 48.5C31.7 48.5 38 45.8 38 42.5V38H10Z" fill="#92400e" />
    <ellipse cx="24" cy="38" rx="14" ry="5.5" fill="url(#md3d_ins_coin)" stroke="#fef08a" strokeWidth="1" />
    {/* Middle 3D Gold Coin Cylinder */}
    <path d="M10 29V33.5C10 36.8 16.3 39.5 24 39.5C31.7 39.5 38 36.8 38 33.5V29H10Z" fill="#b45309" />
    <ellipse cx="24" cy="29" rx="14" ry="5.5" fill="url(#md3d_ins_coin)" stroke="#fef08a" strokeWidth="1" />
    {/* Top 3D Gold Coin Cylinder */}
    <path d="M10 20V24.5C10 27.8 16.3 30.5 24 30.5C31.7 30.5 38 27.8 38 24.5V20H10Z" fill="#d97706" />
    <ellipse cx="24" cy="20" rx="14" ry="5.5" fill="url(#md3d_ins_coin)" stroke="#ffffff" strokeWidth="1.2" />
    <ellipse cx="20" cy="18.5" rx="6" ry="2" fill="#ffffff" fillOpacity="0.55" />
    {/* 3D Emerald Approved Installment Orb */}
    <circle cx="41" cy="23.5" r="9.5" fill="#064e3b" />
    <circle cx="41" cy="21.5" r="9.5" fill="url(#md3d_ins_badge)" stroke="#a7f3d0" strokeWidth="1.2" />
    <path d="M37 21.5L39.8 24.3L45.5 18.6" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * 12. 3D Sculpted Clinical AI Assistant (Gemini Crystal) Logo
 */
export const Logo3DAiGemini: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_16px_rgba(139,92,246,0.46)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_ai_orb" x1="8" y1="8" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="50%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#d946ef" />
      </linearGradient>
      <linearGradient id="md3d_ai_star" x1="14" y1="12" x2="42" y2="42" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="55%" stopColor="#e0e7ff" />
        <stop offset="100%" stopColor="#bae6fd" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="19" ry="3.5" fill="#0f172a" fillOpacity="0.2" />
    {/* 3D Indigo-Violet Glass Sphere Base */}
    <circle cx="28" cy="29.5" r="19.5" fill="#4c1d95" />
    <circle cx="28" cy="27" r="19.5" fill="url(#md3d_ai_orb)" stroke="#e9d5ff" strokeWidth="1.2" />
    <ellipse cx="21" cy="15.5" rx="7.5" ry="3.8" transform="rotate(-25 21 15.5)" fill="#ffffff" fillOpacity="0.4" />
    {/* 3D Sculpted Gemini 4-Point Diamond Star */}
    <path
      d="M28 11C28 20.5 20.5 28 11 28C20.5 28 28 35.5 28 45C28 35.5 35.5 28 45 28C35.5 28 28 20.5 28 11Z"
      fill="url(#md3d_ai_star)"
      stroke="#ffffff"
      strokeWidth="1.2"
    />
    <circle cx="40" cy="15" r="2.8" fill="#fde047" />
  </svg>
);

/**
 * 13. 3D Sculpted Inventory & Medical Supply Box Logo
 * True 3D isometric box with illuminated faces and a 3D embossed medical badge.
 */
export const Logo3DInventory: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(16,185,129,0.4)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_inv_top" x1="10" y1="8" x2="46" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6ee7b7" />
        <stop offset="100%" stopColor="#10b981" />
      </linearGradient>
      <linearGradient id="md3d_inv_left" x1="9" y1="18" x2="28" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
      <linearGradient id="md3d_inv_right" x1="28" y1="18" x2="47" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50.5" rx="20" ry="3.5" fill="#0f172a" fillOpacity="0.2" />
    {/* Isometric Cube Top Face */}
    <path d="M28 7L47 17.5L28 28L9 17.5L28 7Z" fill="url(#md3d_inv_top)" stroke="#a7f3d0" strokeWidth="1" />
    {/* Isometric Cube Left Face */}
    <path d="M9 17.5L28 28V48.5L9 38V17.5Z" fill="url(#md3d_inv_left)" stroke="#6ee7b7" strokeWidth="1" />
    {/* Isometric Cube Right Face */}
    <path d="M28 28L47 17.5V38L28 48.5V28Z" fill="url(#md3d_inv_right)" stroke="#34d399" strokeWidth="1" />
    {/* 3D Golden Packing Tape Strip on Top */}
    <path d="M18.5 12.2L37.5 22.8L33.5 25L14.5 14.5L18.5 12.2Z" fill="#fde047" fillOpacity="0.9" />
    {/* 3D White Medical Cross Shield on Front Left Face */}
    <circle cx="18.5" cy="33" r="5.5" fill="#ffffff" />
    <rect x="17.3" y="30" width="2.4" height="6" rx="1" fill="#059669" />
    <rect x="15.5" y="31.8" width="6" height="2.4" rx="1" fill="#059669" />
  </svg>
);

/**
 * 14. 3D Sculpted Smart Reminders & Golden Bell Logo
 * Glossy 3D sculpted golden bell with volumetric dome highlight and 3D ruby badge.
 */
export const Logo3DReminders: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(245,158,11,0.42)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_rem_bell" x1="14" y1="8" x2="42" y2="42" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="45%" stopColor="#f59e0b" />
        <stop offset="85%" stopColor="#d97706" />
        <stop offset="100%" stopColor="#92400e" />
      </linearGradient>
      <linearGradient id="md3d_rem_badge" x1="34" y1="8" x2="48" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fb7185" />
        <stop offset="100%" stopColor="#e11d48" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="18" ry="3.5" fill="#0f172a" fillOpacity="0.18" />
    {/* 3D Bell Clapper Sphere */}
    <circle cx="28" cy="44" r="5.5" fill="#78350f" />
    <circle cx="28" cy="42.5" r="5" fill="#f59e0b" stroke="#fef08a" strokeWidth="1" />
    {/* 3D Bell Top Ring */}
    <circle cx="28" cy="9" r="3.8" fill="#d97706" stroke="#fef08a" strokeWidth="1.2" />
    {/* 3D Bell Dome Shadow Base */}
    <path
      d="M28 11C19.5 11 14.5 17 14.5 26C14.5 33.5 10 37 10 39.5H46C46 37 41.5 33.5 41.5 26C41.5 17 36.5 11 28 11Z"
      fill="#78350f"
    />
    {/* 3D Bell Dome Sculpted Gold Surface */}
    <path
      d="M28 9.5C19.5 9.5 14.5 15.5 14.5 24.5C14.5 32 10 35.5 10 38H46C46 35.5 41.5 32 41.5 24.5C41.5 15.5 36.5 9.5 28 9.5Z"
      fill="url(#md3d_rem_bell)"
      stroke="#fef08a"
      strokeWidth="1.2"
    />
    {/* Bell Specular Reflection Strip */}
    <path d="M21 14C23 12 25.5 11.5 26.5 11.5C24 17 22.5 25 22.5 35H17.5C17.5 26 18.8 18 21 14Z" fill="#ffffff" fillOpacity="0.48" />
    {/* 3D Ruby Alert Orb */}
    <circle cx="41" cy="16" r="7" fill="url(#md3d_rem_badge)" stroke="#ffffff" strokeWidth="1.4" />
    <rect x="40" y="12.2" width="2" height="4.5" rx="1" fill="#ffffff" />
    <circle cx="41" cy="18.6" r="1.1" fill="#ffffff" />
  </svg>
);

/**
 * 15. 3D Sculpted Digital Radiology & OPG X-Ray Logo
 */
export const Logo3DXRay: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(6,182,212,0.42)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_xry_frame" x1="6" y1="8" x2="50" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
      <linearGradient id="md3d_xry_tooth" x1="18" y1="14" x2="38" y2="42" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="50%" stopColor="#67e8f9" />
        <stop offset="100%" stopColor="#06b6d4" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="20" ry="3.5" fill="#0f172a" fillOpacity="0.2" />
    {/* 3D Sensor Case Extrusion */}
    <rect x="7" y="12" width="42" height="35" rx="10" fill="#0e7490" />
    <rect x="7" y="9" width="42" height="35" rx="10" fill="url(#md3d_xry_frame)" stroke="#22d3ee" strokeWidth="1.5" />
    {/* Glowing Neon Cyan X-Ray Tooth */}
    <path
      d="M19.5 20C19.5 15.5 22.8 13.5 26 14.2C27.2 14.4 27.6 15 28 15C28.4 15 28.8 14.4 30 14.2C33.2 13.5 36.5 15.5 36.5 20C36.5 24.2 34.8 28.8 33.2 34.2C32.4 36.8 31.3 38 30 37.8C29 37.5 28.8 34 28 32.5C27.2 34 27 37.5 26 37.8C24.7 38 23.6 36.8 22.8 34.2C21.2 28.8 19.5 24.2 19.5 20Z"
      fill="url(#md3d_xry_tooth)"
    />
    {/* Translucent Root Canal Core */}
    <path
      d="M25 21C25 19 26.5 18 28 18C29.5 18 31 19 31 21C31 24 29.8 28 28 32.5C26.2 28 25 24 25 21Z"
      fill="#083344"
      fillOpacity="0.65"
    />
  </svg>
);

/**
 * 16. 3D Sculpted Marketing & Campaigns Megaphone Logo
 */
export const Logo3DMarketing: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(236,72,153,0.4)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_mkt_cone" x1="12" y1="12" x2="42" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f472b6" />
        <stop offset="55%" stopColor="#ec4899" />
        <stop offset="100%" stopColor="#9d174d" />
      </linearGradient>
      <linearGradient id="md3d_mkt_rim" x1="36" y1="10" x2="46" y2="38" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="19" ry="3.5" fill="#0f172a" fillOpacity="0.18" />
    {/* 3D Handle Grip */}
    <path d="M15 29L12.5 41.5C12.2 43 13.3 44.5 14.8 44.5H18.2C19.5 44.5 20.6 43.5 20.9 42.2L23 29H15Z" fill="#831843" stroke="#fbcfe8" strokeWidth="1" />
    {/* 3D Megaphone Body */}
    <path d="M14 20.5L39 11V37L14 28.5V20.5Z" fill="url(#md3d_mkt_cone)" stroke="#fbcfe8" strokeWidth="1.2" />
    <path d="M15 21.5L37 13.5V19L15 24V21.5Z" fill="#ffffff" fillOpacity="0.35" />
    {/* 3D Back Cap */}
    <rect x="8.5" y="20" width="6.5" height="9" rx="3" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />
    {/* 3D Golden Bell Rim */}
    <ellipse cx="39.5" cy="24" rx="5.2" ry="13.5" fill="url(#md3d_mkt_rim)" stroke="#fef08a" strokeWidth="1.2" />
    <ellipse cx="39" cy="24" rx="2.5" ry="7.5" fill="#78350f" />
  </svg>
);

/**
 * 17. 3D Sculpted Palmer Dental Chart Logo
 */
export const Logo3DPalmerChart: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(20,184,166,0.4)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_plm_plate" x1="8" y1="8" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#14b8a6" />
        <stop offset="100%" stopColor="#0f766e" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="20" ry="3.5" fill="#0f172a" fillOpacity="0.18" />
    <rect x="8" y="11" width="40" height="37" rx="11" fill="#134e4a" />
    <rect x="8" y="8" width="40" height="37" rx="11" fill="url(#md3d_plm_plate)" stroke="#99f6e4" strokeWidth="1.2" />
    {/* 3D Palmer Crosshair Axes */}
    <rect x="26.8" y="13" width="2.4" height="27" rx="1.2" fill="#ccfbf1" fillOpacity="0.7" />
    <rect x="13" y="25.3" width="30" height="2.4" rx="1.2" fill="#ccfbf1" fillOpacity="0.7" />
    {/* 3D Sculpted Central Pearl Molar */}
    <path
      d="M20.5 21C20.5 16.5 23.8 14.5 28 14.5C32.2 14.5 35.5 16.5 35.5 21C35.5 25.2 33.8 30 32.2 34.8C31.5 37 30.3 38 29.3 37.5C28.5 37 28.4 33.8 28 32.5C27.6 33.8 27.5 37 26.7 37.5C25.7 38 24.5 37 23.8 34.8C22.2 30 20.5 25.2 20.5 21Z"
      fill="#ffffff"
      stroke="#fde047"
      strokeWidth="1.2"
    />
  </svg>
);

/**
 * 18. 3D Sculpted Guarantee Check Logo
 */
export const Logo3DGuaranteeCheck: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(225,29,72,0.4)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_gua_body" x1="6" y1="12" x2="50" y2="44" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fb7185" />
        <stop offset="55%" stopColor="#e11d48" />
        <stop offset="100%" stopColor="#881337" />
      </linearGradient>
      <linearGradient id="md3d_gua_shield" x1="30" y1="22" x2="48" y2="44" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="55%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="20" ry="3.5" fill="#0f172a" fillOpacity="0.18" />
    <rect x="6" y="15" width="44" height="29" rx="8" fill="#4c0519" />
    <rect x="6" y="12" width="44" height="29" rx="8" fill="url(#md3d_gua_body)" stroke="#fecdd3" strokeWidth="1.2" />
    <rect x="11" y="19" width="18" height="3" rx="1.5" fill="#ffffff" />
    <rect x="11" y="25" width="14" height="2.8" rx="1.4" fill="#ffe4e6" fillOpacity="0.8" />
    <rect x="11" y="31" width="11" height="2.8" rx="1.4" fill="#ffe4e6" fillOpacity="0.6" />
    {/* 3D Golden Security Shield */}
    <path
      d="M39 20L31 23.5V31.5C31 37.5 34.4 42.2 39 44C43.6 42.2 47 37.5 47 31.5V23.5L39 20Z"
      fill="url(#md3d_gua_shield)"
      stroke="#ffffff"
      strokeWidth="1.2"
    />
    <path d="M35.8 32L38.2 34.4L42.8 29.8" stroke="#78350f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * 19. 3D Sculpted Smart POS Terminal Logo
 */
export const Logo3DPosTerminal: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(234,179,8,0.4)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_pos_body" x1="12" y1="10" x2="44" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#475569" />
        <stop offset="55%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
      <linearGradient id="md3d_pos_scr" x1="16" y1="13" x2="40" y2="29" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#4ade80" />
        <stop offset="100%" stopColor="#16a34a" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50.5" rx="18" ry="3.2" fill="#0f172a" fillOpacity="0.2" />
    {/* Paper Roll Receipt Emerging from Top */}
    <path d="M18 6H38V13H18V6Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
    {/* 3D POS Terminal Chassis */}
    <rect x="12" y="13" width="32" height="36" rx="8" fill="#020617" />
    <rect x="12" y="10.5" width="32" height="36" rx="8" fill="url(#md3d_pos_body)" stroke="#94a3b8" strokeWidth="1.2" />
    {/* 3D Glowing Emerald Screen */}
    <rect x="16" y="14.5" width="24" height="14" rx="4" fill="url(#md3d_pos_scr)" stroke="#bbf7d0" strokeWidth="1" />
    <path d="M24 21.5L27 24.5L33 18.5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    {/* 3D Physical Tactile Keypad */}
    <rect x="16.5" y="32" width="6" height="4" rx="1.5" fill="#94a3b8" />
    <rect x="25" y="32" width="6" height="4" rx="1.5" fill="#94a3b8" />
    <rect x="33.5" y="32" width="6" height="4" rx="1.5" fill="#22c55e" />
    <rect x="16.5" y="38.5" width="6" height="4" rx="1.5" fill="#94a3b8" />
    <rect x="25" y="38.5" width="6" height="4" rx="1.5" fill="#94a3b8" />
    <rect x="33.5" y="38.5" width="6" height="4" rx="1.5" fill="#facc15" />
  </svg>
);

/**
 * 20. 3D Sculpted Comprehensive Treatment Plans Board Logo
 */
export const Logo3DTreatmentPlans: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(249,115,22,0.4)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_pln_board" x1="10" y1="8" x2="46" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fb923c" />
        <stop offset="100%" stopColor="#c2410c" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50.5" rx="19" ry="3.2" fill="#0f172a" fillOpacity="0.18" />
    <rect x="10" y="12" width="36" height="37" rx="9" fill="#7c2d12" />
    <rect x="10" y="9" width="36" height="37" rx="9" fill="url(#md3d_pln_board)" stroke="#fed7aa" strokeWidth="1.2" />
    <rect x="14" y="13.5" width="28" height="28.5" rx="6" fill="#ffffff" />
    <rect x="20" y="6" width="16" height="5.5" rx="2.5" fill="#facc15" stroke="#ffffff" strokeWidth="1" />
    <circle cx="19.5" cy="21" r="3" fill="#10b981" />
    <rect x="25" y="19.5" width="13" height="3" rx="1.5" fill="#94a3b8" />
    <circle cx="19.5" cy="28.5" r="3" fill="#f97316" />
    <rect x="25" y="27" width="13" height="3" rx="1.5" fill="#94a3b8" />
    <circle cx="19.5" cy="36" r="3" fill="#3b82f6" />
    <rect x="25" y="34.5" width="10" height="3" rx="1.5" fill="#cbd5e1" />
  </svg>
);

/**
 * 21. 3D Sculpted Clinical Analytics & Reports Logo
 */
export const Logo3DReports: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(59,130,246,0.4)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_rep_1" x1="10" y1="26" x2="20" y2="46" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38bdf8" /><stop offset="100%" stopColor="#0284c7" />
      </linearGradient>
      <linearGradient id="md3d_rep_2" x1="23" y1="18" x2="33" y2="46" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#c084fc" /><stop offset="100%" stopColor="#7e22ce" />
      </linearGradient>
      <linearGradient id="md3d_rep_3" x1="36" y1="10" x2="46" y2="46" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#059669" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="21" ry="3.5" fill="#0f172a" fillOpacity="0.18" />
    {/* 3D Column 1 */}
    <rect x="10" y="29" width="10" height="18" rx="3.5" fill="#075985" />
    <rect x="10" y="27" width="10" height="18" rx="3.5" fill="url(#md3d_rep_1)" stroke="#bae6fd" strokeWidth="1" />
    {/* 3D Column 2 */}
    <rect x="23" y="20" width="10" height="27" rx="3.5" fill="#581c87" />
    <rect x="23" y="18" width="10" height="27" rx="3.5" fill="url(#md3d_rep_2)" stroke="#e9d5ff" strokeWidth="1" />
    {/* 3D Column 3 */}
    <rect x="36" y="12" width="10" height="35" rx="3.5" fill="#065f46" />
    <rect x="36" y="10" width="10" height="35" rx="3.5" fill="url(#md3d_rep_3)" stroke="#a7f3d0" strokeWidth="1" />
  </svg>
);

/**
 * 22. 3D Sculpted Clinic Settings Gear Logo
 */
export const Logo3DSettings: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(100,116,139,0.4)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_set_gear" x1="10" y1="8" x2="46" y2="46" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#e2e8f0" />
        <stop offset="50%" stopColor="#64748b" />
        <stop offset="100%" stopColor="#1e293b" />
      </linearGradient>
      <linearGradient id="md3d_set_core" x1="18" y1="18" x2="38" y2="38" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="55%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="19" ry="3.5" fill="#0f172a" fillOpacity="0.18" />
    {/* 3D Gear Base Extrusion */}
    <circle cx="28" cy="29.5" r="19" fill="#0f172a" />
    {/* 3D Gear Main Disc */}
    <circle cx="28" cy="27" r="19" fill="url(#md3d_set_gear)" stroke="#f8fafc" strokeWidth="1.3" />
    {/* 3D Golden Hub Core */}
    <circle cx="28" cy="27" r="10.5" fill="url(#md3d_set_core)" stroke="#ffffff" strokeWidth="1.2" />
    <circle cx="28" cy="27" r="4.5" fill="#1e293b" stroke="#fde047" strokeWidth="1" />
  </svg>
);

/**
 * 23. 3D Sculpted Doctor Commissions Medallion Logo
 */
export const Logo3DCommissions: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(244,63,94,0.38)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_com_medal" x1="14" y1="8" x2="42" y2="36" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="18" ry="3.2" fill="#0f172a" fillOpacity="0.18" />
    {/* 3D Ribbon Tails */}
    <path d="M21 30L14 48L22 43.5L26 48L25 30H21Z" fill="#059669" stroke="#a7f3d0" strokeWidth="1" />
    <path d="M35 30L42 48L34 43.5L30 48L31 30H35Z" fill="#10b981" stroke="#a7f3d0" strokeWidth="1" />
    {/* 3D Golden Medallion */}
    <circle cx="28" cy="23.5" r="14.5" fill="#78350f" />
    <circle cx="28" cy="21" r="14.5" fill="url(#md3d_com_medal)" stroke="#ffffff" strokeWidth="1.3" />
    <path d="M24 25L32 17M24.5 18C24.5 18.8 23.8 19.5 23 19.5C22.2 19.5 21.5 18.8 21.5 18C21.5 17.2 22.2 16.5 23 16.5C23.8 16.5 24.5 17.2 24.5 18ZM34.5 24C34.5 24.8 33.8 25.5 33 25.5C32.2 25.5 31.5 24.8 31.5 24C31.5 23.2 32.2 22.5 33 22.5C33.8 22.5 34.5 23.2 34.5 24Z" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

/**
 * 24. 3D Sculpted Caller ID & Phone Handset Logo
 */
export const Logo3DCallerId: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(2,132,199,0.4)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_cal_phone" x1="12" y1="12" x2="44" y2="44" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="55%" stopColor="#0284c7" />
        <stop offset="100%" stopColor="#0369a1" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="19" ry="3.2" fill="#0f172a" fillOpacity="0.18" />
    <rect x="8" y="11" width="40" height="37" rx="12" fill="#075985" />
    <rect x="8" y="8" width="40" height="37" rx="12" fill="url(#md3d_cal_phone)" stroke="#bae6fd" strokeWidth="1.2" />
    <path
      d="M18 18C18 15.5 20.5 14 22.8 15.8L25.2 19C26.4 20.5 25.6 22.5 24.4 23.3C26 26.2 28.8 29 31.7 30.6C32.5 29.4 34.5 28.6 36 29.8L39.2 32.2C41 34.5 39.5 37 37 37C27 37 18 28 18 18Z"
      fill="#ffffff"
    />
  </svg>
);

/**
 * 25. 3D Sculpted Health Insurance Shield Logo
 */
export const Logo3DInsurance: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(217,70,239,0.4)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_ins_shd" x1="10" y1="8" x2="46" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#e879f9" />
        <stop offset="50%" stopColor="#c026d3" />
        <stop offset="100%" stopColor="#701a75" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50.5" rx="18" ry="3.2" fill="#0f172a" fillOpacity="0.18" />
    {/* 3D Shield Depth Extrusion */}
    <path d="M28 10L11 16.5V29.5C11 39.5 18 47.2 28 50C38 47.2 45 39.5 45 29.5V16.5L28 10Z" fill="#4a044e" />
    {/* 3D Shield Glossy Front */}
    <path
      d="M28 7.5L11 14V27C11 37 18 44.7 28 47.5C38 44.7 45 37 45 27V14L28 7.5Z"
      fill="url(#md3d_ins_shd)"
      stroke="#f5d0fe"
      strokeWidth="1.3"
    />
    <path d="M28 9L13 15V27C13 33 16.5 38.5 22 42L28 9Z" fill="#ffffff" fillOpacity="0.22" />
    {/* 3D Embossed Medical Cross */}
    <rect x="25.5" y="18.5" width="5" height="16" rx="2" fill="#ffffff" />
    <rect x="20" y="24" width="16" height="5" rx="2" fill="#ffffff" />
  </svg>
);

/**
 * 26. 3D Sculpted Autoclave & Sterilization Chamber Logo
 */
export const Logo3DSterilization: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(6,182,212,0.4)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_str_drum" x1="8" y1="8" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#67e8f9" />
        <stop offset="50%" stopColor="#0891b2" />
        <stop offset="100%" stopColor="#164e63" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50.5" rx="19" ry="3.2" fill="#0f172a" fillOpacity="0.2" />
    <circle cx="28" cy="29.5" r="19.5" fill="#083344" />
    <circle cx="28" cy="27" r="19.5" fill="url(#md3d_str_drum)" stroke="#cffafe" strokeWidth="1.3" />
    <circle cx="28" cy="27" r="12.5" fill="#0f172a" stroke="#22d3ee" strokeWidth="1.2" />
    {/* 3D Sterile Sparkle Star inside Chamber */}
    <path d="M28 17L30.2 23.8L37 26L30.2 28.2L28 35L25.8 28.2L19 26L25.8 23.8L28 17Z" fill="#fde047" />
  </svg>
);

/**
 * 27. 3D Sculpted Online Patient Booking Smartphone Logo
 */
export const Logo3DOnlineBooking: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(16,185,129,0.4)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_obk_phone" x1="14" y1="8" x2="42" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50.5" rx="17" ry="3" fill="#0f172a" fillOpacity="0.18" />
    <rect x="13" y="9.5" width="30" height="39" rx="8" fill="#064e3b" />
    <rect x="13" y="7" width="30" height="39" rx="8" fill="url(#md3d_obk_phone)" stroke="#a7f3d0" strokeWidth="1.2" />
    <rect x="16.5" y="11.5" width="23" height="29" rx="4.5" fill="#ffffff" />
    <circle cx="28" cy="26" r="7.5" fill="#10b981" />
    <path d="M24.5 26L27 28.5L32 23.5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * 28. 3D Sculpted Digital CAD/CAM Lab Portal Logo
 */
export const Logo3DDigitalLabPortal: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(139,92,246,0.4)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_dlp_disc" x1="8" y1="8" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#a78bfa" />
        <stop offset="55%" stopColor="#7c3aed" />
        <stop offset="100%" stopColor="#4c1d95" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50.5" rx="19" ry="3.2" fill="#0f172a" fillOpacity="0.2" />
    <circle cx="28" cy="29.5" r="19" fill="#2e1065" />
    <circle cx="28" cy="27" r="19" fill="url(#md3d_dlp_disc)" stroke="#ddd6fe" strokeWidth="1.3" />
    <path
      d="M21 21C21 17 24 15 28 15C32 15 35 17 35 21C35 25 33.5 29.5 31.8 34C31 36 30 37 29 36.5C28.3 36 28.2 33 28 32C27.8 33 27.7 36 27 36.5C26 37 25 36 24.2 34C22.5 29.5 21 25 21 21Z"
      fill="#ffffff"
    />
  </svg>
);

/**
 * 29. 3D Sculpted SMS Gateway & Message Envelope Logo
 */
export const Logo3DSmsGateway: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(139,92,246,0.38)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_sms_box" x1="8" y1="12" x2="48" y2="44" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#a78bfa" />
        <stop offset="100%" stopColor="#6d28d9" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50" rx="20" ry="3.2" fill="#0f172a" fillOpacity="0.18" />
    <rect x="7" y="15" width="42" height="29" rx="9" fill="#4c1d95" />
    <rect x="7" y="12" width="42" height="29" rx="9" fill="url(#md3d_sms_box)" stroke="#ede9fe" strokeWidth="1.2" />
    <path d="M11 16L28 28.5L45 16" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * 30. 3D Sculpted Clinical Audit & Quality Shield Logo
 */
export const Logo3DClinicalAudit: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(132,204,22,0.4)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_aud_shd" x1="10" y1="8" x2="46" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#a3e635" />
        <stop offset="55%" stopColor="#65a30d" />
        <stop offset="100%" stopColor="#3f6212" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50.5" rx="18" ry="3.2" fill="#0f172a" fillOpacity="0.18" />
    <path d="M28 10L11 16.5V29.5C11 39.5 18 47.2 28 50C38 47.2 45 39.5 45 29.5V16.5L28 10Z" fill="#1a2e05" />
    <path
      d="M28 7.5L11 14V27C11 37 18 44.7 28 47.5C38 44.7 45 37 45 27V14L28 7.5Z"
      fill="url(#md3d_aud_shd)"
      stroke="#ecfccb"
      strokeWidth="1.3"
    />
    <circle cx="28" cy="26.5" r="10" fill="#ffffff" />
    <path d="M23.5 26.5L26.8 29.8L33 23.6" stroke="#3f6212" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * 31. 3D Sculpted Live Sync Dual-Platform Logo
 */
export const Logo3DLiveSync: React.FC<Logo3DProps> = ({ size = 44, className = '', glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 transition-transform ${glow ? 'drop-shadow-[0_6px_14px_rgba(14,165,233,0.4)]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="md3d_syn_orb" x1="8" y1="8" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#0284c7" />
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="50.5" rx="19" ry="3.2" fill="#0f172a" fillOpacity="0.18" />
    <circle cx="28" cy="29.5" r="19" fill="#075985" />
    <circle cx="28" cy="27" r="19" fill="url(#md3d_syn_orb)" stroke="#bae6fd" strokeWidth="1.2" />
    <path d="M19 23H35L31 19M37 31H21L25 35" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * 32. 3D Sculpted Main Dental Brand Tooth Logo
 */
export const Logo3DMainDentalTooth: React.FC<Logo3DProps> = ({ size = 38, className = '', glow = true }) => {
  const [hasError, setHasError] = React.useState(false);

  if (!hasError) {
    return (
      <img
        src="/logo.png"
        alt="مینادنتال"
        width={size}
        height={size}
        onError={() => setHasError(true)}
        className={`shrink-0 object-contain select-none pointer-events-none transition-transform ${glow ? 'drop-shadow-[0_4px_10px_rgba(168,85,247,0.42)]' : ''} ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return <Logo3DTreatments size={size} className={className} glow={glow} />;
};
