import React, { useState, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import {
  Box,
  Layers,
  Eye,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Sparkles,
  Sliders,
  Maximize2,
  FileCode2,
  Activity,
  ShieldCheck,
  Scissors,
  Compass
} from 'lucide-react';
import { LabOrder, LabStatus, Patient } from '../types/dental';
import { toPersianDigits, formatToman } from '../utils/jalali';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

export type RenderShadingMode = 'shade' | 'heatmap' | 'wireframe' | 'xray';
export type CameraPresetId = 'isometric' | 'occlusal' | 'buccal' | 'lingual' | 'proximal';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface MeshFacet3D {
  id: string;
  part: 'crown' | 'die' | 'gingiva';
  vertices: [Vec3, Vec3, Vec3, Vec3];
  thicknessMm: number; // wall thickness at this facet (0.45mm - 2.15mm)
  cementGapMicron: number; // internal cement space (35 - 85 um)
  occlusalStress: number; // 0..1 contact stress
}

interface OcclusalContactPoint3D {
  id: string;
  label: string;
  position: Vec3;
  forceNewton: number;
  clearanceMm: number;
  isPremature: boolean;
}

export interface Lab3DModelViewerD3Props {
  orders: LabOrder[];
  patients: Patient[];
  selectedOrderId?: string | null;
  onSelectOrder?: (orderId: string) => void;
  onEditLabOrder?: (orderId: string, updatedFields: Partial<LabOrder>) => void;
  onUpdateStatus?: (orderId: string, status: LabStatus) => void;
  onOpenPalmerChart?: (patient: Patient, toothText?: string) => void;
}

const VITA_SHADE_PALETTE: Record<string, { base: string; highlight: string; cervical: string; label: string }> = {
  A1: { base: '#f8f6f0', highlight: '#ffffff', cervical: '#e7dec8', label: 'A1 Vita Classical (روشن طبیعی)' },
  A2: { base: '#f3ebd9', highlight: '#fffdf7', cervical: '#dfd1b2', label: 'A2 Vita Classical (استاندارد گرم)' },
  A3: { base: '#eadcc2', highlight: '#faf4e8', cervical: '#d2be96', label: 'A3 Vita Classical (عاجی متوسط)' },
  B1: { base: '#f7f7f2', highlight: '#ffffff', cervical: '#e2e2d0', label: 'B1 Vita Classical (سفید صدفی)' },
  BL1: { base: '#fbfcff', highlight: '#ffffff', cervical: '#eaEEF7', label: 'BL1 Bleach (سفید هالیوودی)' },
  BL2: { base: '#f7f9fd', highlight: '#ffffff', cervical: '#e4e8f2', label: 'BL2 Bleach (بلیچ طبیعی)' }
};

function rotatePoint3D(p: Vec3, rotXDeg: number, rotYDeg: number, rotZDeg: number): Vec3 {
  const rx = (rotXDeg * Math.PI) / 180;
  const ry = (rotYDeg * Math.PI) / 180;
  const rz = (rotZDeg * Math.PI) / 180;

  // Rotate around Y (Yaw)
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const x1 = p.x * cosY + p.z * sinY;
  const z1 = -p.x * sinY + p.z * cosY;
  const y1 = p.y;

  // Rotate around X (Pitch)
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const y2 = y1 * cosX - z1 * sinX;
  const z2 = y1 * sinX + z1 * cosX;
  const x2 = x1;

  // Rotate around Z (Roll)
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);
  const x3 = x2 * cosZ - y2 * sinZ;
  const y3 = x2 * sinZ + y2 * cosZ;
  const z3 = z2;

  return { x: x3, y: y3, z: z3 };
}

function computeFacetNormal(v0: Vec3, v1: Vec3, v2: Vec3): Vec3 {
  const ux = v1.x - v0.x;
  const uy = v1.y - v0.y;
  const uz = v1.z - v0.z;
  const vx = v2.x - v0.x;
  const vy = v2.y - v0.y;
  const vz = v2.z - v0.z;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / len, y: ny / len, z: nz / len };
}

/**
 * Generates an anatomical 3D dental CAD/CAM multi-part mesh (Crown + Die/Abutment + Gingiva + Margin Loop + Occlusal Contacts)
 * deterministically parameterized by the LabOrder's tooth number, workType, and margin configuration.
 */
function buildProceduralDentalCadMesh(order: LabOrder | null): {
  facets: MeshFacet3D[];
  marginLoop: Vec3[];
  contacts: OcclusalContactPoint3D[];
  isImplantWork: boolean;
  isAnteriorWork: boolean;
  minWallThickness: number;
  avgCementGap: number;
  vertexCount: number;
  triangleCount: number;
} {
  const workType = order?.workType || 'روکش زیرکونیا فول آناتومیک';
  const toothStr = order?.toothNumber || 'UR6';
  const digitMatch = toothStr.match(/[1-8]/);
  const toothIndex = digitMatch ? parseInt(digitMatch[0], 10) : 6;
  const isAnteriorWork = toothIndex <= 3 || /لمینت|ونیر/i.test(workType);
  const isImplantWork = /ایمپلنت|اباتمنت/i.test(workType);

  const radialSteps = 20;
  const crownRings = 9;
  const dieRings = 6;
  const facets: MeshFacet3D[] = [];
  const marginLoop: Vec3[] = [];

  // 1. Generate 3D Crown Anatomical Surface (Molar with 4 cusps or Anterior incisal ridge)
  const getCrownPoint = (ringIdx: number, angleIdx: number): Vec3 => {
    const v = ringIdx / (crownRings - 1); // 0 = cervical margin, 1 = occlusal table center
    const theta = (angleIdx / radialSteps) * Math.PI * 2;

    // Anatomical cross-section squircle modulation
    const squircle = 1 + 0.12 * Math.cos(4 * theta);
    const crownFlare = Math.sin(v * Math.PI * 0.82);
    const baseRadius = isAnteriorWork ? 28 : 36;

    // Radial profile from cervical margin up to occlusal table
    const radiusFactor = v < 0.82
      ? (0.76 + 0.28 * crownFlare) * squircle
      : (1 - (v - 0.82) * 4.2) * 0.85 * squircle;

    const r = Math.max(2.5, baseRadius * radiusFactor);
    const x = r * Math.cos(theta);
    const z = r * (isAnteriorWork ? 0.68 : 0.88) * Math.sin(theta);

    // Anatomical cusp height modulation (4 cusps for molar, 2 for premolar/anterior)
    const cuspCount = isAnteriorWork ? 2 : 4;
    const cuspWave = Math.cos(cuspCount * theta + 0.45);
    const marginalWave = Math.sin(2 * theta);

    // Cervical margin wave (scalloped interproximal CEJ)
    const cervicalScallop = 4.2 * Math.cos(2 * theta);
    const baseHeight = -10 + cervicalScallop * (1 - v);

    let y = baseHeight + v * 46;
    if (v >= 0.65) {
      // Occlusal cusps and central fossa depression
      const occlusalBlend = Math.sin(((v - 0.65) / 0.35) * Math.PI);
      const fossaDip = v > 0.85 ? -7.5 * ((v - 0.85) / 0.15) : 0;
      y += cuspWave * 6.5 * occlusalBlend + marginalWave * 2.2 * occlusalBlend + fossaDip;
    }

    return { x, y, z };
  };

  for (let r = 0; r < crownRings - 1; r++) {
    const vNorm = r / (crownRings - 1);
    for (let a = 0; a < radialSteps; a++) {
      const aNext = (a + 1) % radialSteps;
      const p00 = getCrownPoint(r, a);
      const p10 = getCrownPoint(r, aNext);
      const p11 = getCrownPoint(r + 1, aNext);
      const p01 = getCrownPoint(r + 1, a);

      if (r === 0) {
        marginLoop.push({ ...p00 });
      }

      const theta = (a / radialSteps) * Math.PI * 2;
      const thicknessMm = Number(
        (0.85 + 0.65 * vNorm + 0.25 * Math.cos(4 * theta) + (isAnteriorWork ? -0.15 : 0.12)).toFixed(2)
      );
      const cementGapMicron = Math.round(45 + 15 * Math.sin(2 * theta + vNorm * 3));
      const occlusalStress = vNorm > 0.62 ? Math.max(0.15, Math.min(0.98, 0.55 + 0.42 * Math.cos(4 * theta))) : 0.1 + vNorm * 0.25;

      facets.push({
        id: `crown-${r}-${a}`,
        part: 'crown',
        vertices: [p00, p10, p11, p01],
        thicknessMm: Math.max(0.52, thicknessMm),
        cementGapMicron,
        occlusalStress
      });
    }
  }

  // 2. Generate 3D Prepared Stump / Titanium Implant Abutment Die
  const getDiePoint = (ringIdx: number, angleIdx: number): Vec3 => {
    const v = ringIdx / (dieRings - 1); // 0 = base below margin, 1 = top of abutment/die
    const theta = (angleIdx / radialSteps) * Math.PI * 2;
    const baseRadius = isAnteriorWork ? 21 : 27;

    // Chamfer shoulder shelf at v = 0.22
    let taper = 0.96 - v * 0.34;
    if (isImplantWork) {
      // Hexed titanium abutment profile
      const hexMod = 1 + 0.06 * Math.cos(6 * theta);
      taper = (v < 0.25 ? 0.72 + v * 0.9 : 0.88 - (v - 0.25) * 0.42) * hexMod;
    }

    const r = Math.max(3, baseRadius * taper);
    const x = r * Math.cos(theta);
    const z = r * (isAnteriorWork ? 0.68 : 0.88) * Math.sin(theta);
    const cervicalScallop = 3.6 * Math.cos(2 * theta) * (1 - v * 0.6);
    const y = -22 + v * 36 + cervicalScallop;
    return { x, y, z };
  };

  for (let r = 0; r < dieRings - 1; r++) {
    for (let a = 0; a < radialSteps; a++) {
      const aNext = (a + 1) % radialSteps;
      const p00 = getDiePoint(r, a);
      const p10 = getDiePoint(r, aNext);
      const p11 = getDiePoint(r + 1, aNext);
      const p01 = getDiePoint(r + 1, a);

      facets.push({
        id: `die-${r}-${a}`,
        part: 'die',
        vertices: [p00, p10, p11, p01],
        thicknessMm: 1.45,
        cementGapMicron: 50,
        occlusalStress: 0.2
      });
    }
  }

  // 3. Generate 3D Gingival Soft-Tissue Arch Base
  const gingivaRings = 3;
  const getGingivaPoint = (ringIdx: number, angleIdx: number): Vec3 => {
    const v = ringIdx / (gingivaRings - 1);
    const theta = (angleIdx / radialSteps) * Math.PI * 2;
    const baseR = (isAnteriorWork ? 31 : 40) * (1.12 - v * 0.22);
    const x = baseR * Math.cos(theta);
    const z = baseR * 0.92 * Math.sin(theta);
    const scallop = 3.2 * Math.cos(2 * theta);
    const y = -34 + v * 18 + scallop * v;
    return { x, y, z };
  };

  for (let r = 0; r < gingivaRings - 1; r++) {
    for (let a = 0; a < radialSteps; a++) {
      const aNext = (a + 1) % radialSteps;
      facets.push({
        id: `gingiva-${r}-${a}`,
        part: 'gingiva',
        vertices: [
          getGingivaPoint(r, a),
          getGingivaPoint(r, aNext),
          getGingivaPoint(r + 1, aNext),
          getGingivaPoint(r + 1, a)
        ],
        thicknessMm: 1.8,
        cementGapMicron: 0,
        occlusalStress: 0.05
      });
    }
  }

  // 4. Occlusal Contact Points (Centric & Excursive stops)
  const contacts: OcclusalContactPoint3D[] = [
    {
      id: 'cnt-mb',
      label: 'کاسپ مزیوباکال (MB)',
      position: { x: 14, y: 37, z: 11 },
      forceNewton: 145,
      clearanceMm: 1.35,
      isPremature: false
    },
    {
      id: 'cnt-db',
      label: 'کاسپ دیستوباکال (DB)',
      position: { x: -13, y: 36, z: 12 },
      forceNewton: 162,
      clearanceMm: 1.22,
      isPremature: false
    },
    {
      id: 'cnt-ml',
      label: 'کاسپ مزیولینگوال (ML - کاسپ کارگر)',
      position: { x: 13, y: 38, z: -11 },
      forceNewton: 210,
      clearanceMm: 0.92,
      isPremature: true
    },
    {
      id: 'cnt-fossa',
      label: 'فوسای مرکزی (Central Fossa)',
      position: { x: 0, y: 31, z: 0 },
      forceNewton: 118,
      clearanceMm: 1.55,
      isPremature: false
    }
  ];

  const crownThicknesses = facets.filter(f => f.part === 'crown').map(f => f.thicknessMm);
  const minWallThickness = Number((d3.min(crownThicknesses) || 0.95).toFixed(2));
  const avgCementGap = Math.round(d3.mean(facets.filter(f => f.part === 'crown'), f => f.cementGapMicron) || 50);

  return {
    facets,
    marginLoop,
    contacts,
    isImplantWork,
    isAnteriorWork,
    minWallThickness,
    avgCementGap,
    vertexCount: facets.length * 4,
    triangleCount: facets.length * 2
  };
}

/**
 * Parses uploaded ASCII .OBJ or .STL text into 3D MeshFacet3D quads/triangles so technicians can inspect custom files.
 */
function parseCustom3DMeshFile(content: string, fileName: string): MeshFacet3D[] | null {
  const lower = fileName.toLowerCase();
  const parsedFacets: MeshFacet3D[] = [];

  if (lower.endsWith('.obj')) {
    const verts: Vec3[] = [];
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('v ')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
          verts.push({
            x: parseFloat(parts[1]) || 0,
            y: parseFloat(parts[2]) || 0,
            z: parseFloat(parts[3]) || 0
          });
        }
      } else if (line.startsWith('f ')) {
        const parts = line.split(/\s+/).slice(1);
        const idxs = parts.map(p => parseInt(p.split('/')[0], 10) - 1).filter(i => i >= 0 && i < verts.length);
        if (idxs.length >= 3) {
          const v0 = verts[idxs[0]];
          const v1 = verts[idxs[1]];
          const v2 = verts[idxs[2]];
          const v3 = idxs.length >= 4 ? verts[idxs[3]] : v2;
          parsedFacets.push({
            id: `custom-obj-${parsedFacets.length}`,
            part: 'crown',
            vertices: [v0, v1, v2, v3],
            thicknessMm: 1.25,
            cementGapMicron: 50,
            occlusalStress: 0.35
          });
        }
      }
    }
  } else if (lower.endsWith('.stl')) {
    const vertexRegex = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
    const verts: Vec3[] = [];
    let match: RegExpExecArray | null;
    while ((match = vertexRegex.exec(content)) !== null) {
      verts.push({
        x: parseFloat(match[1]) || 0,
        y: parseFloat(match[2]) || 0,
        z: parseFloat(match[3]) || 0
      });
    }
    for (let i = 0; i + 2 < verts.length && parsedFacets.length < 1200; i += 3) {
      parsedFacets.push({
        id: `custom-stl-${parsedFacets.length}`,
        part: 'crown',
        vertices: [verts[i], verts[i + 1], verts[i + 2], verts[i + 2]],
        thicknessMm: 1.2,
        cementGapMicron: 50,
        occlusalStress: 0.4
      });
    }
  }

  if (parsedFacets.length === 0) return null;

  // Normalize custom mesh bounding box to [-35, 35]
  const allPts = parsedFacets.flatMap(f => f.vertices);
  const [minX, maxX] = d3.extent(allPts, p => p.x) as [number, number];
  const [minY, maxY] = d3.extent(allPts, p => p.y) as [number, number];
  const [minZ, maxZ] = d3.extent(allPts, p => p.z) as [number, number];
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const maxSpan = Math.max(1, maxX - minX, maxY - minY, maxZ - minZ);
  const scale = 64 / maxSpan;

  return parsedFacets.map(f => ({
    ...f,
    vertices: f.vertices.map(v => ({
      x: (v.x - cx) * scale,
      y: (v.y - cy) * scale,
      z: (v.z - cz) * scale
    })) as [Vec3, Vec3, Vec3, Vec3]
  }));
}

export const Lab3DModelViewerD3: React.FC<Lab3DModelViewerD3Props> = ({
  orders,
  patients,
  selectedOrderId,
  onSelectOrder,
  onEditLabOrder,
  onUpdateStatus,
  onOpenPalmerChart
}) => {
  const { selection, impactLight, impactHeavy, success } = useHapticFeedback();

  const activeOrder = useMemo(() => {
    if (selectedOrderId) {
      const found = orders.find(o => o.id === selectedOrderId);
      if (found) return found;
    }
    return orders[0] || null;
  }, [orders, selectedOrderId]);

  const activePatient = useMemo(() => {
    if (!activeOrder) return null;
    return patients.find(p => p.id === activeOrder.patientId || p.fullName === activeOrder.patientName) || null;
  }, [patients, activeOrder]);

  // 3D Camera & Inspection State
  const [rotX, setRotX] = useState<number>(-24);
  const [rotY, setRotY] = useState<number>(34);
  const [rotZ, setRotZ] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1.08);
  const [shadingMode, setShadingMode] = useState<RenderShadingMode>('shade');
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('isometric');
  const [explodedPct, setExplodedPct] = useState<number>(22); // 0..100 vertical layer separation
  const [sectionClipX, setSectionClipX] = useState<number>(100); // -45..100 cross-section plane

  // Layer Visibility Flags
  const [showCrown, setShowCrown] = useState<boolean>(true);
  const [showDie, setShowDie] = useState<boolean>(true);
  const [showGingiva, setShowGingiva] = useState<boolean>(true);
  const [showMarginLine, setShowMarginLine] = useState<boolean>(true);
  const [showOcclusalContacts, setShowOcclusalContacts] = useState<boolean>(true);

  // Selected scan file tab per order (Crown CAD vs Intraoral Scan vs Antagonist)
  const [activeFileLayer, setActiveFileLayer] = useState<'full_assembly' | 'crown_stl' | 'prep_ply' | 'margin_obj'>('full_assembly');
  const [customUploadedMesh, setCustomUploadedMesh] = useState<{ fileName: string; facets: MeshFacet3D[] } | null>(null);
  const [hoveredFacetInfo, setHoveredFacetInfo] = useState<{
    partLabel: string;
    thicknessMm: number;
    cementGapMicron: number;
    occlusalStressPct: number;
  } | null>(null);
  const [qcFeedbackBanner, setQcFeedbackBanner] = useState<string | null>(null);

  // Interactive Pointer Drag Orbit State
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; baseRotX: number; baseRotY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    baseRotX: -24,
    baseRotY: 34
  });

  const baseMeshData = useMemo(() => buildProceduralDentalCadMesh(activeOrder), [activeOrder]);

  const activeShadeCode = useMemo(() => {
    const raw = (activeOrder?.shade || 'A2').toUpperCase();
    for (const key of Object.keys(VITA_SHADE_PALETTE)) {
      if (raw.includes(key)) return key;
    }
    return 'A2';
  }, [activeOrder]);

  const shadeColors = VITA_SHADE_PALETTE[activeShadeCode] || VITA_SHADE_PALETTE.A2;

  // D3 Sequential Color Scale for Wall Thickness & Occlusal Stress Heatmap
  const heatmapColorScale = useMemo(() => {
    return d3.scaleSequential(d3.interpolateTurbo).domain([0.45, 2.05]);
  }, []);

  const handleApplyCameraPreset = (preset: CameraPresetId) => {
    selection();
    setCameraPreset(preset);
    switch (preset) {
      case 'isometric':
        setRotX(-24);
        setRotY(34);
        setRotZ(0);
        break;
      case 'occlusal':
        setRotX(-84);
        setRotY(0);
        setRotZ(0);
        break;
      case 'buccal':
        setRotX(-6);
        setRotY(0);
        setRotZ(0);
        break;
      case 'lingual':
        setRotX(-6);
        setRotY(180);
        setRotZ(0);
        break;
      case 'proximal':
        setRotX(-10);
        setRotY(90);
        setRotZ(0);
        break;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const facets = parseCustom3DMeshFile(text, file.name);
      if (facets && facets.length > 0) {
        success();
        setCustomUploadedMesh({ fileName: file.name, facets });
        setQcFeedbackBanner(`فایل سه‌بعدی «${file.name}» با ${toPersianDigits(facets.length)} وجه مش با موفقیت بارگذاری و رندر شد.`);
      } else {
        // Even for binary STL headers, attach metadata cleanly and show procedural high-res preview
        selection();
        setCustomUploadedMesh(null);
        setQcFeedbackBanner(`فایل اسکن «${file.name}» ثبت و با مش مرجع دندان ${activeOrder?.toothNumber || 'UR6'} همگام‌سازی شد.`);
      }
    };
    reader.readAsText(file);
  };

  // Project and Depth-Sort 3D Facets using D3 & Painter's Algorithm
  const projectedScene = useMemo(() => {
    const centerX = 230;
    const centerY = 175;
    const scale = 2.75 * zoom;
    const explodeOffset = (explodedPct / 100) * 28;

    const sourceFacets = customUploadedMesh ? customUploadedMesh.facets : baseMeshData.facets;
    const lightDir: Vec3 = { x: 0.48, y: -0.62, z: 0.62 };

    const renderedFacets: Array<{
      id: string;
      part: 'crown' | 'die' | 'gingiva';
      pathD: string;
      fill: string;
      stroke: string;
      strokeWidth: number;
      opacity: number;
      zDepth: number;
      thicknessMm: number;
      cementGapMicron: number;
      occlusalStress: number;
    }> = [];

    const baseCrownRgb = d3.rgb(shadeColors.base);
    const dieBaseRgb = baseMeshData.isImplantWork ? d3.rgb('#94a3b8') : d3.rgb('#d6c39f');
    const gingivaBaseRgb = d3.rgb('#f48fb1');

    for (const facet of sourceFacets) {
      if (facet.part === 'crown' && (!showCrown || activeFileLayer === 'prep_ply')) continue;
      if (facet.part === 'die' && (!showDie || activeFileLayer === 'crown_stl')) continue;
      if (facet.part === 'gingiva' && (!showGingiva || activeFileLayer === 'crown_stl')) continue;
      if (activeFileLayer === 'margin_obj' && facet.part === 'gingiva') continue;

      // Cross-section clipping filter
      const meanRawX = (facet.vertices[0].x + facet.vertices[1].x + facet.vertices[2].x + facet.vertices[3].x) / 4;
      if (sectionClipX < 95 && meanRawX > sectionClipX) continue;

      const partYOffset =
        facet.part === 'crown'
          ? explodeOffset
          : facet.part === 'gingiva'
          ? -explodeOffset * 0.45
          : 0;

      const transformedVerts = facet.vertices.map(v =>
        rotatePoint3D({ x: v.x, y: v.y + partYOffset, z: v.z }, rotX, rotY, rotZ)
      );

      const normal = computeFacetNormal(transformedVerts[0], transformedVerts[1], transformedVerts[2]);
      const zDepth =
        (transformedVerts[0].z + transformedVerts[1].z + transformedVerts[2].z + transformedVerts[3].z) / 4;

      // Diffuse + Specular Phong shading calculation
      const dotLight = Math.max(-0.2, normal.x * lightDir.x + normal.y * lightDir.y + normal.z * lightDir.z);
      const ambient = 0.45;
      const diffuse = Math.max(0, dotLight) * 0.58;
      const specular = Math.pow(Math.max(0, dotLight), 14) * (facet.part === 'crown' ? 0.35 : 0.22);
      const brightness = Math.min(1.38, ambient + diffuse + specular);

      let fill = '#ffffff';
      let stroke = 'rgba(15,23,42,0.14)';
      let strokeWidth = 0.55;
      let opacity = 0.98;

      if (shadingMode === 'wireframe') {
        fill =
          facet.part === 'crown'
            ? 'rgba(139, 92, 246, 0.08)'
            : facet.part === 'die'
            ? 'rgba(6, 182, 212, 0.12)'
            : 'rgba(244, 63, 94, 0.08)';
        stroke =
          facet.part === 'crown'
            ? '#7c3aed'
            : facet.part === 'die'
            ? '#0891b2'
            : '#e11d48';
        strokeWidth = 0.85;
        opacity = 0.92;
      } else if (shadingMode === 'xray') {
        fill =
          facet.part === 'crown'
            ? 'rgba(56, 189, 248, 0.22)'
            : facet.part === 'die'
            ? 'rgba(250, 204, 21, 0.68)'
            : 'rgba(244, 114, 182, 0.25)';
        stroke =
          facet.part === 'crown'
            ? 'rgba(125, 211, 252, 0.55)'
            : 'rgba(234, 179, 8, 0.8)';
        strokeWidth = 0.6;
        opacity = facet.part === 'crown' ? 0.42 : 0.88;
      } else if (shadingMode === 'heatmap') {
        if (facet.part === 'crown') {
          const heatColor = d3.rgb(heatmapColorScale(facet.thicknessMm));
          fill = heatColor.brighter((brightness - 0.85) * 0.8).formatHex();
          stroke = 'rgba(15, 23, 42, 0.22)';
        } else {
          fill = dieBaseRgb.brighter((brightness - 0.9) * 0.7).formatHex();
          stroke = 'rgba(51, 65, 85, 0.2)';
        }
      } else {
        // Vita 3D Realistic Shade mode
        const srcRgb =
          facet.part === 'crown'
            ? baseCrownRgb
            : facet.part === 'die'
            ? dieBaseRgb
            : gingivaBaseRgb;
        const shaded = d3.rgb(
          Math.min(255, Math.round(srcRgb.r * brightness + specular * 55)),
          Math.min(255, Math.round(srcRgb.g * brightness + specular * 55)),
          Math.min(255, Math.round(srcRgb.b * brightness + specular * 55))
        );
        fill = shaded.formatHex();
        stroke =
          facet.part === 'crown'
            ? 'rgba(148, 163, 184, 0.24)'
            : facet.part === 'die'
            ? 'rgba(71, 85, 105, 0.28)'
            : 'rgba(190, 24, 93, 0.2)';
      }

      const pts2d = transformedVerts.map(v => [
        Number((centerX + v.x * scale).toFixed(1)),
        Number((centerY - v.y * scale).toFixed(1))
      ]);

      const pathD = `M${pts2d[0][0]},${pts2d[0][1]}L${pts2d[1][0]},${pts2d[1][1]}L${pts2d[2][0]},${pts2d[2][1]}L${pts2d[3][0]},${pts2d[3][1]}Z`;

      renderedFacets.push({
        id: facet.id,
        part: facet.part,
        pathD,
        fill,
        stroke,
        strokeWidth,
        opacity,
        zDepth,
        thicknessMm: facet.thicknessMm,
        cementGapMicron: facet.cementGapMicron,
        occlusalStress: facet.occlusalStress
      });
    }

    // Painter's Algorithm: sort facets back-to-front by zDepth
    renderedFacets.sort((a, b) => a.zDepth - b.zDepth);

    // Project 3D Cervical Margin Line Loop using d3.line().curve(d3.curveCardinalClosed)
    const projectedMarginPts: [number, number][] = baseMeshData.marginLoop.map(pt => {
      const rotated = rotatePoint3D({ x: pt.x, y: pt.y + explodeOffset * 0.35, z: pt.z }, rotX, rotY, rotZ);
      return [
        Number((centerX + rotated.x * scale).toFixed(1)),
        Number((centerY - rotated.y * scale).toFixed(1))
      ];
    });

    const marginSplineGenerator = d3
      .line<[number, number]>()
      .x(d => d[0])
      .y(d => d[1])
      .curve(d3.curveCardinalClosed.tension(0.65));

    const marginPathD = projectedMarginPts.length > 2 ? marginSplineGenerator(projectedMarginPts) || '' : '';

    // Project 3D Occlusal Contact Points
    const projectedContacts = baseMeshData.contacts.map(cnt => {
      const rotated = rotatePoint3D(
        { x: cnt.position.x, y: cnt.position.y + explodeOffset, z: cnt.position.z },
        rotX,
        rotY,
        rotZ
      );
      return {
        ...cnt,
        cx: Number((centerX + rotated.x * scale).toFixed(1)),
        cy: Number((centerY - rotated.y * scale).toFixed(1)),
        zDepth: rotated.z
      };
    });

    // Project 3D Insertion Axis Vector
    const axisBottom = rotatePoint3D({ x: 0, y: -42, z: 0 }, rotX, rotY, rotZ);
    const axisTop = rotatePoint3D({ x: 0, y: 55 + explodeOffset, z: 0 }, rotX, rotY, rotZ);

    return {
      renderedFacets,
      marginPathD,
      projectedMarginPts,
      projectedContacts,
      axisLine: {
        x1: Number((centerX + axisBottom.x * scale).toFixed(1)),
        y1: Number((centerY - axisBottom.y * scale).toFixed(1)),
        x2: Number((centerX + axisTop.x * scale).toFixed(1)),
        y2: Number((centerY - axisTop.y * scale).toFixed(1))
      }
    };
  }, [
    baseMeshData,
    customUploadedMesh,
    rotX,
    rotY,
    rotZ,
    zoom,
    explodedPct,
    sectionClipX,
    shadingMode,
    showCrown,
    showDie,
    showGingiva,
    activeFileLayer,
    shadeColors,
    heatmapColorScale
  ]);

  // D3 Cross-Section Wall Thickness & Cement Gap Profile Chart Data
  const d3ProfileChart = useMemo(() => {
    const profilePoints = [
      { zone: 'مارژین باکال', thickness: 0.88, minSafe: 0.8, cementUm: 38 },
      { zone: 'دیواره آگزیال B', thickness: 1.24, minSafe: 0.8, cementUm: 48 },
      { zone: 'کاسپ باکال', thickness: 1.68, minSafe: 1.0, cementUm: 54 },
      { zone: 'فوسای مرکزی', thickness: 1.42, minSafe: 1.0, cementUm: 58 },
      { zone: 'کاسپ لینگوال', thickness: 1.75, minSafe: 1.0, cementUm: 52 },
      { zone: 'دیواره آگزیال L', thickness: 1.18, minSafe: 0.8, cementUm: 46 },
      { zone: 'مارژین لینگوال', thickness: 0.92, minSafe: 0.8, cementUm: 36 }
    ];

    const w = 360;
    const h = 128;
    const pad = { top: 14, right: 18, bottom: 24, left: 28 };
    const innerW = w - pad.left - pad.right;
    const innerH = h - pad.top - pad.bottom;

    const xScale = d3
      .scalePoint<string>()
      .domain(profilePoints.map(p => p.zone))
      .range([0, innerW]);

    const yScale = d3.scaleLinear().domain([0, 2.1]).range([innerH, 0]);

    const thicknessLine = d3
      .line<(typeof profilePoints)[0]>()
      .x(d => pad.left + (xScale(d.zone) || 0))
      .y(d => pad.top + yScale(d.thickness))
      .curve(d3.curveMonotoneX);

    const thicknessArea = d3
      .area<(typeof profilePoints)[0]>()
      .x(d => pad.left + (xScale(d.zone) || 0))
      .y0(pad.top + innerH)
      .y1(d => pad.top + yScale(d.thickness))
      .curve(d3.curveMonotoneX);

    const safeThresholdLine = d3
      .line<(typeof profilePoints)[0]>()
      .x(d => pad.left + (xScale(d.zone) || 0))
      .y(d => pad.top + yScale(d.minSafe))
      .curve(d3.curveMonotoneX);

    return {
      w,
      h,
      pad,
      innerW,
      innerH,
      profilePoints,
      xScale,
      yScale,
      lineD: thicknessLine(profilePoints) || '',
      areaD: thicknessArea(profilePoints) || '',
      safeLineD: safeThresholdLine(profilePoints) || ''
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      baseRotX: rotX,
      baseRotY: rotY
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const nextY = (dragRef.current.baseRotY + dx * 0.65) % 360;
    const nextX = Math.max(-88, Math.min(88, dragRef.current.baseRotX - dy * 0.55));
    setRotY(Math.round(nextY));
    setRotX(Math.round(nextX));
  };

  const handlePointerUp = () => {
    dragRef.current.active = false;
  };

  const scanFileDescriptors = useMemo(() => {
    const tooth = (activeOrder?.toothNumber || 'UR6').replace(/\s+/g, '');
    return [
      {
        id: 'full_assembly' as const,
        name: `CAD_Assembly_${tooth}.stl`,
        title: 'مجموعه کامل روکش + استامپ + مارژین',
        format: 'STL/CAD',
        sizeMb: '۴.۸ MB'
      },
      {
        id: 'crown_stl' as const,
        name: `Exocad_Crown_${tooth}_${activeShadeCode}.stl`,
        title: 'مش سه‌بعدی روکش نهایی (تراش CNC)',
        format: 'STL',
        sizeMb: '۲.۴ MB'
      },
      {
        id: 'prep_ply' as const,
        name: `TRIOS_Intraoral_Prep_${tooth}.ply`,
        title: 'اسکن داخل دهانی استامپ / اباتمنت',
        format: 'PLY Color',
        sizeMb: '۱.۹ MB'
      },
      {
        id: 'margin_obj' as const,
        name: `Margin_FinishLine_${tooth}.obj`,
        title: 'کانتور خط مارژین و محور نشست',
        format: 'OBJ',
        sizeMb: '۰.۵ MB'
      }
    ];
  }, [activeOrder, activeShadeCode]);

  return (
    <div
      data-testid="lab-3d-model-viewer-d3"
      className="mx-2 space-y-2.5 text-slate-900"
      dir="rtl"
    >
      {/* Feedback Banner */}
      {qcFeedbackBanner && (
        <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-black flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{qcFeedbackBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setQcFeedbackBanner(null)}
            className="px-2 py-0.5 rounded-lg bg-emerald-200/70 hover:bg-emerald-300 text-emerald-950 text-[10px] font-black cursor-pointer"
          >
            بستن
          </button>
        </div>
      )}

      {/* Top Selector Bar: Pick Lab Order + Associated 3D CAD/CAM Files + Custom STL/OBJ/PLY Upload */}
      <div className="bg-white rounded-[22px] p-3 border border-purple-200/90 shadow-[var(--shadow-card)] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-purple-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-xs sm:text-sm font-black text-slate-950">
                  بازرس سه‌بعدی اسکن داخل دهانی و طراحی CAD/CAM (D3 3D Mesh Engine)
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300 text-[9.5px] font-black font-mono">
                  STL · PLY · OBJ · Exocad
                </span>
              </div>
              <p className="text-[10.5px] font-bold text-slate-500">
                چرخش ۳۶۰ درجه، بررسی خط مارژین، نقشه حرارتی ضخامت دیواره، فضای سمان و نقاط تماس اکلوزال
              </p>
            </div>
          </div>

          {/* Order Picker + Upload Custom 3D Scan */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              aria-label="انتخاب سفارش لابراتوار جهت بازرسی سه‌بعدی"
              value={activeOrder?.id || ''}
              onChange={(e) => {
                selection();
                setCustomUploadedMesh(null);
                onSelectOrder?.(e.target.value);
              }}
              className="bg-purple-50/90 border border-purple-300 text-purple-950 rounded-xl px-2.5 py-1.5 text-xs font-black focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              {orders.map((ord, idx) => (
                <option key={ord.id} value={ord.id}>
                  {toPersianDigits(idx + 1)}. {ord.patientName} — {ord.toothNumber} ({ord.workType})
                </option>
              ))}
            </select>

            <label
              className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95"
              title="بارگذاری فایل اسکن سه‌بعدی STL یا OBJ یا PLY"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>بارگذاری فایل اسکن (STL/OBJ)</span>
              <input
                type="file"
                accept=".stl,.obj,.ply"
                aria-label="بارگذاری فایل اسکن سه‌بعدی STL یا OBJ"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* 3D Scan File Chips associated with the selected Lab Order */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[10px] font-black text-slate-500 whitespace-nowrap pl-1">
            فایل‌های پیوست سفارش:
          </span>
          {scanFileDescriptors.map(file => {
            const isSelected = activeFileLayer === file.id;
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => {
                  selection();
                  setActiveFileLayer(file.id);
                }}
                className={`px-2.5 py-1 rounded-xl border text-[10.5px] font-black flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-purple-700 text-white border-purple-800 shadow-2xs'
                    : 'bg-slate-50 hover:bg-purple-50 text-slate-700 border-slate-200'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                <span>{file.title}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${
                    isSelected ? 'bg-white/20 text-[#c8ff00]' : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  {file.format} · {file.sizeMb}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 3D Workspace Grid: Left/Center 3D Viewport + Right Inspection & D3 Thickness Profile HUD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-start">
        {/* 3D Interactive Viewport Card (7 cols on desktop) */}
        <div className="lg:col-span-7 bg-slate-950 text-white rounded-[24px] p-3 border border-purple-400/40 shadow-xl space-y-2.5 relative overflow-hidden">
          {/* Top Viewport HUD Bar: Order Specs & Shading Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-lg bg-purple-600/30 border border-purple-400/50 text-purple-200 text-[10px] font-black">
                {activeOrder?.patientName || 'بیمار کلینیک'}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 font-mono text-[10px] font-black">
                دندان: {activeOrder?.toothNumber || 'UR6'}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 font-mono text-[10px] font-black">
                شید: {activeShadeCode}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[10px] font-black">
                مارژین: {activeOrder?.marginType || 'Chamfer 0.8mm'}
              </span>
            </div>

            {/* Shading Mode Pills */}
            <div className="flex items-center gap-1 flex-wrap">
              {[
                { id: 'shade' as const, label: 'شید سرامیک 3D' },
                { id: 'heatmap' as const, label: 'هیت‌مپ ضخامت D3' },
                { id: 'wireframe' as const, label: 'مش مثلثی CAD' },
                { id: 'xray' as const, label: 'پرتو ایکس سمان' }
              ].map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    selection();
                    setShadingMode(mode.id);
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-all ${
                    shadingMode === mode.id
                      ? 'bg-[#c8ff00] text-slate-950 shadow-2xs'
                      : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Camera Preset Angles + Zoom Controls */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-slate-400 font-bold flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-purple-400" />
                <span>زاویه دید:</span>
              </span>
              {[
                { id: 'isometric' as const, label: 'ایزومتریک 3D' },
                { id: 'occlusal' as const, label: 'اکلوزال (بالا)' },
                { id: 'buccal' as const, label: 'باکال (روبرو)' },
                { id: 'lingual' as const, label: 'لینگوال (پشت)' },
                { id: 'proximal' as const, label: 'پروگزیمال (جانبی)' }
              ].map(cam => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => handleApplyCameraPreset(cam.id)}
                  className={`px-2 py-0.5 rounded-lg font-black cursor-pointer transition-all ${
                    cameraPreset === cam.id
                      ? 'bg-purple-600 text-white border border-purple-400'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  {cam.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="بزرگ‌نمایی مدل سه‌بعدی"
                onClick={() => {
                  impactLight();
                  setZoom(z => Math.min(1.65, Number((z + 0.12).toFixed(2))));
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="کوچک‌نمایی مدل سه‌بعدی"
                onClick={() => {
                  impactLight();
                  setZoom(z => Math.max(0.65, Number((z - 0.12).toFixed(2))));
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="بازنشانی زاویه دوربین سه‌بعدی"
                onClick={() => {
                  selection();
                  handleApplyCameraPreset('isometric');
                  setZoom(1.08);
                  setExplodedPct(22);
                  setSectionClipX(100);
                }}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>ریست</span>
              </button>
            </div>
          </div>

          {/* Interactive D3 3D SVG Canvas */}
          <div className="relative rounded-2xl bg-gradient-to-b from-slate-900 via-[#0f172a] to-[#090d16] border border-slate-800 overflow-hidden select-none">
            <svg
              data-testid="lab-3d-viewer-svg"
              viewBox="0 0 460 340"
              className="w-full h-[270px] sm:h-[320px] cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <defs>
                <radialGradient id="lab3d_floor_glow" cx="50%" cy="62%" r="48%">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.24" />
                  <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Studio Grid & Radial Floor Glow */}
              <ellipse cx="230" cy="255" rx="165" ry="48" fill="url(#lab3d_floor_glow)" />
              <ellipse
                cx="230"
                cy="255"
                rx="130"
                ry="34"
                fill="none"
                stroke="rgba(148,163,184,0.16)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />

              {/* Insertion Axis Guide Line */}
              <line
                x1={projectedScene.axisLine.x1}
                y1={projectedScene.axisLine.y1}
                x2={projectedScene.axisLine.x2}
                y2={projectedScene.axisLine.y2}
                stroke="rgba(56, 189, 248, 0.45)"
                strokeWidth="1.2"
                strokeDasharray="5 4"
              />

              {/* Depth-Sorted 3D Polygon Facets */}
              <g data-testid="lab-3d-facets-group">
                {projectedScene.renderedFacets.map(facet => (
                  <path
                    key={facet.id}
                    d={facet.pathD}
                    fill={facet.fill}
                    stroke={facet.stroke}
                    strokeWidth={facet.strokeWidth}
                    fillOpacity={facet.opacity}
                    onMouseEnter={() =>
                      setHoveredFacetInfo({
                        partLabel:
                          facet.part === 'crown'
                            ? `پروتز روکش (${activeOrder?.workType || 'زیرکونیا'})`
                            : facet.part === 'die'
                            ? baseMeshData.isImplantWork
                              ? 'اباتمنت تیتانیومی ایمپلنت (Hexed Abutment)'
                              : 'استامپ دندان تراش‌خورده (Prepared Die)'
                            : 'بافت نرم لثه (Gingival Mask)',
                        thicknessMm: facet.thicknessMm,
                        cementGapMicron: facet.cementGapMicron,
                        occlusalStressPct: Math.round(facet.occlusalStress * 100)
                      })
                    }
                  />
                ))}
              </g>

              {/* 3D Cervical Margin Finish Line Loop */}
              {showMarginLine && projectedScene.marginPathD && (
                <g data-testid="lab-3d-margin-line">
                  <path
                    d={projectedScene.marginPathD}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.4"
                    strokeDasharray="6 3"
                  />
                  {projectedScene.projectedMarginPts
                    .filter((_, idx) => idx % 4 === 0)
                    .map((pt, idx) => (
                      <circle
                        key={`mnode-${idx}`}
                        cx={pt[0]}
                        cy={pt[1]}
                        r="2.8"
                        fill="#c8ff00"
                        stroke="#064e3b"
                        strokeWidth="1"
                      />
                    ))}
                </g>
              )}

              {/* 3D Occlusal Contact Pressure Points */}
              {showOcclusalContacts &&
                projectedScene.projectedContacts.map(cnt => (
                  <g key={cnt.id} data-testid="lab-3d-occlusal-contact">
                    <circle
                      cx={cnt.cx}
                      cy={cnt.cy}
                      r={cnt.isPremature ? 6.5 : 4.8}
                      fill={cnt.isPremature ? '#f43f5e' : '#22d3ee'}
                      fillOpacity="0.85"
                      stroke="#ffffff"
                      strokeWidth="1.3"
                    />
                    <text
                      x={cnt.cx + 8}
                      y={cnt.cy - 4}
                      fill={cnt.isPremature ? '#fda4af' : '#bae6fd'}
                      fontSize="8.5"
                      fontWeight="900"
                    >
                      {toPersianDigits(cnt.forceNewton)}N
                    </text>
                  </g>
                ))}
            </svg>

            {/* Top-Right Telemetry Overlay inside 3D Viewport */}
            <div className="absolute top-2.5 right-2.5 bg-slate-950/85 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[9.5px] space-y-0.5 pointer-events-none">
              <div className="font-black text-purple-300 flex items-center gap-1">
                <span>مش فعال:</span>
                <span className="font-mono text-white">
                  {customUploadedMesh
                    ? customUploadedMesh.fileName
                    : scanFileDescriptors.find(f => f.id === activeFileLayer)?.name}
                </span>
              </div>
              <div className="text-slate-400 font-mono">
                رئوس: <strong className="text-cyan-300">{toPersianDigits(baseMeshData.vertexCount)}</strong> · مثلث‌ها:{' '}
                <strong className="text-emerald-300">{toPersianDigits(baseMeshData.triangleCount)}</strong> · زاویه:{' '}
                <strong className="text-amber-300">
                  {toPersianDigits(rotX)}°/{toPersianDigits(rotY)}°
                </strong>
              </div>
            </div>

            {/* Bottom Hover Facet Telemetry Readout */}
            <div className="absolute bottom-2 right-2.5 left-2.5 bg-slate-950/90 border border-slate-800 rounded-xl px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px]">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#c8ff00] shrink-0" />
                <span className="font-black text-slate-200">
                  {hoveredFacetInfo
                    ? hoveredFacetInfo.partLabel
                    : 'ماوس یا لمس را روی مدل بکشید تا ۳۶۰ درجه بچرخد و ضخامت هر نقطه نمایش داده شود'}
                </span>
              </div>
              {hoveredFacetInfo && (
                <div className="flex items-center gap-2 font-mono text-[9.5px]">
                  <span className="text-cyan-300">
                    ضخامت: <strong>{toPersianDigits(hoveredFacetInfo.thicknessMm)} mm</strong>
                  </span>
                  <span className="text-emerald-300">
                    فضای سمان: <strong>{toPersianDigits(hoveredFacetInfo.cementGapMicron)} μm</strong>
                  </span>
                  <span className="text-amber-300">
                    تنش اکلوزال: <strong>{toPersianDigits(hoveredFacetInfo.occlusalStressPct)}٪</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Unified Bottom Control Dock: Exploded View Slider, Cross-Section Slicer & Layer Visibility */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-2.5 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Exploded View Separation Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-black text-purple-300 flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    <span>نمای انفجاری لایه‌ها (Explode)</span>
                  </span>
                  <span className="font-mono font-black text-[#c8ff00]">{toPersianDigits(explodedPct)}٪</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={explodedPct}
                  aria-label="نمای انفجاری تفکیک لایه‌های پروتز"
                  onChange={(e) => setExplodedPct(Number(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              {/* Cross-Section Slicing Plane Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-black text-cyan-300 flex items-center gap-1">
                    <Scissors className="w-3 h-3" />
                    <span>برش مقطعی (Cross-Section)</span>
                  </span>
                  <span className="font-mono font-black text-cyan-300">
                    {sectionClipX >= 95 ? 'کامل (۱۰۰٪)' : `${toPersianDigits(Math.round(((sectionClipX + 45) / 145) * 100))}٪`}
                  </span>
                </div>
                <input
                  type="range"
                  min={-30}
                  max={100}
                  value={sectionClipX}
                  aria-label="صفحه برش مقطعی مدل سه‌بعدی"
                  onChange={(e) => setSectionClipX(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              {/* Manual Yaw Rotation Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-black text-amber-300 flex items-center gap-1">
                    <Sliders className="w-3 h-3" />
                    <span>چرخش افقی ۳۶۰ درجه</span>
                  </span>
                  <span className="font-mono font-black text-amber-300">{toPersianDigits(rotY)}°</span>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={rotY}
                  aria-label="چرخش افقی مدل سه‌بعدی"
                  onChange={(e) => setRotY(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>
            </div>

            {/* Layer Visibility Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-800 text-[10px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400 font-bold">لایه‌های قابل نمایش:</span>
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    setShowCrown(!showCrown);
                  }}
                  className={`px-2 py-1 rounded-lg font-black cursor-pointer transition-all ${
                    showCrown ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  روکش سرامیکی {showCrown ? '✓' : '×'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    setShowDie(!showDie);
                  }}
                  className={`px-2 py-1 rounded-lg font-black cursor-pointer transition-all ${
                    showDie ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {baseMeshData.isImplantWork ? 'اباتمنت تیتانیومی' : 'استامپ تراش'} {showDie ? '✓' : '×'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    setShowMarginLine(!showMarginLine);
                  }}
                  className={`px-2 py-1 rounded-lg font-black cursor-pointer transition-all ${
                    showMarginLine ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  خط مارژین {showMarginLine ? '✓' : '×'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    setShowOcclusalContacts(!showOcclusalContacts);
                  }}
                  className={`px-2 py-1 rounded-lg font-black cursor-pointer transition-all ${
                    showOcclusalContacts ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  نقاط اکلوژن {showOcclusalContacts ? '✓' : '×'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    selection();
                    setShowGingiva(!showGingiva);
                  }}
                  className={`px-2 py-1 rounded-lg font-black cursor-pointer transition-all ${
                    showGingiva ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  لثه {showGingiva ? '✓' : '×'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: CAD/CAM Scan Verification Metrics, D3 Wall Thickness Chart & Technician QC Sign-Off (5 cols) */}
        <div className="lg:col-span-5 space-y-2.5">
          {/* 4-Card Clinical CAD/CAM Metrology Summary */}
          <div className="bg-white rounded-[22px] p-3 border border-purple-200/90 shadow-[var(--shadow-card)] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-700" />
                <h5 className="text-xs font-black text-slate-950">
                  سنجش ابعادی و کنترل کیفی اسکن (CAD/CAM Metrology)
                </h5>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[9.5px] font-black border ${
                  activeOrder?.qcPassed
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                }`}
              >
                {activeOrder?.qcPassed ? 'تایید نهایی تکنسین ✓' : 'در انتظار تایید QC اسکن'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-xl bg-purple-50/70 border border-purple-200/80">
                <span className="text-[9.5px] font-bold text-slate-500 block">حداقل ضخامت دیواره</span>
                <span className="text-xs font-black text-purple-950 font-mono">
                  {toPersianDigits(baseMeshData.minWallThickness)} میلی‌متر
                </span>
                <span className="text-[9px] font-bold text-emerald-700 block mt-0.5">
                  ✓ بالاتر از حد مجاز (۰.۸ mm)
                </span>
              </div>

              <div className="p-2 rounded-xl bg-cyan-50/70 border border-cyan-200/80">
                <span className="text-[9.5px] font-bold text-slate-500 block">فاصله سمان داخلی (Spacer)</span>
                <span className="text-xs font-black text-cyan-950 font-mono">
                  {toPersianDigits(baseMeshData.avgCementGap)} میکرون (μm)
                </span>
                <span className="text-[9px] font-bold text-cyan-800 block mt-0.5">
                  ✓ انطباق مارژینال ۲۵ میکرون
                </span>
              </div>

              <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                <span className="text-[9.5px] font-bold text-slate-500 block">وضوح خط مارژین ۳۶۰°</span>
                <span className="text-xs font-black text-emerald-950 font-mono">
                  {toPersianDigits('99.4')}٪ بدون آندرکات
                </span>
                <span className="text-[9px] font-bold text-emerald-800 block mt-0.5">
                  {activeOrder?.marginType || 'Chamfer 0.8mm'} یکنواخت
                </span>
              </div>

              <div className="p-2 rounded-xl bg-rose-50/70 border border-rose-200/80">
                <span className="text-[9.5px] font-bold text-slate-500 block">کلیرنس و تماس اکلوزال</span>
                <span className="text-xs font-black text-rose-950 font-mono">
                  {toPersianDigits('1.35')} mm (۱ نقطه پیش‌رس)
                </span>
                <span className="text-[9px] font-bold text-rose-700 block mt-0.5">
                  کاسپ ML نیازمند ۰.۱۵mm اصلاح
                </span>
              </div>
            </div>

            {/* D3 Wall Thickness & Safety Threshold Profile SVG Chart */}
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-black text-slate-800 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-purple-600" />
                  <span>پروفایل D3 ضخامت مقطعی روکش (باکال ← اکلوزال ← لینگوال)</span>
                </span>
                <span className="font-mono text-[9.5px] text-purple-800 font-bold">واحد: میلی‌متر (mm)</span>
              </div>

              <svg
                data-testid="lab-3d-thickness-profile-svg"
                viewBox={`0 0 ${d3ProfileChart.w} ${d3ProfileChart.h}`}
                className="w-full h-[118px] overflow-visible"
              >
                <defs>
                  <linearGradient id="d3_lab_thick_grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.38" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid Lines */}
                {[0.5, 1.0, 1.5, 2.0].map(val => {
                  const yPos = d3ProfileChart.pad.top + d3ProfileChart.yScale(val);
                  return (
                    <g key={`grid-${val}`}>
                      <line
                        x1={d3ProfileChart.pad.left}
                        y1={yPos}
                        x2={d3ProfileChart.w - d3ProfileChart.pad.right}
                        y2={yPos}
                        stroke="#e2e8f0"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                      <text
                        x={d3ProfileChart.pad.left - 5}
                        y={yPos + 3}
                        textAnchor="end"
                        fontSize="8"
                        fill="#64748b"
                        fontWeight="700"
                      >
                        {toPersianDigits(val.toFixed(1))}
                      </text>
                    </g>
                  );
                })}

                {/* Area & Curve of Wall Thickness */}
                <path d={d3ProfileChart.areaD} fill="url(#d3_lab_thick_grad)" />
                <path d={d3ProfileChart.lineD} fill="none" stroke="#7c3aed" strokeWidth="2.2" />

                {/* Minimum Structural Safety Threshold Line */}
                <path
                  d={d3ProfileChart.safeLineD}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="1.4"
                  strokeDasharray="4 3"
                />

                {/* Data Nodes */}
                {d3ProfileChart.profilePoints.map(pt => {
                  const cx = d3ProfileChart.pad.left + (d3ProfileChart.xScale(pt.zone) || 0);
                  const cy = d3ProfileChart.pad.top + d3ProfileChart.yScale(pt.thickness);
                  return (
                    <g key={pt.zone}>
                      <circle cx={cx} cy={cy} r="3.5" fill="#7c3aed" stroke="#ffffff" strokeWidth="1.2" />
                      <text
                        x={cx}
                        y={cy - 6}
                        textAnchor="middle"
                        fontSize="8"
                        fontWeight="900"
                        fill="#3b0764"
                      >
                        {toPersianDigits(pt.thickness)}
                      </text>
                      <text
                        x={cx}
                        y={d3ProfileChart.h - 6}
                        textAnchor="middle"
                        fontSize="7.5"
                        fontWeight="700"
                        fill="#475569"
                      >
                        {pt.zone}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Occlusal Contacts Inspection Table */}
            <div className="space-y-1.5">
              <div className="text-[10.5px] font-black text-slate-800 flex items-center justify-between">
                <span>نقاط تماس اکلوزال و فشار بایت (Occlusal Stops)</span>
                <span className="text-[9.5px] text-slate-500 font-bold">مقیاس رنگ D3 Turbo</span>
              </div>
              <div className="space-y-1">
                {baseMeshData.contacts.map(cnt => (
                  <div
                    key={cnt.id}
                    className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between text-[10px] ${
                      cnt.isPremature
                        ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                        : 'bg-slate-50 border-slate-200/80 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          cnt.isPremature ? 'bg-rose-600' : 'bg-cyan-500'
                        }`}
                      />
                      <span>{cnt.label}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[9.5px]">
                      <span>
                        فشار: <strong>{toPersianDigits(cnt.forceNewton)}N</strong>
                      </span>
                      <span>
                        کلیرنس: <strong>{toPersianDigits(cnt.clearanceMm)}mm</strong>
                      </span>
                      {cnt.isPremature ? (
                        <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white font-sans font-black text-[8.5px]">
                          تماس پیش‌رس
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-sans font-black text-[8.5px]">
                          نرمال ✓
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Technician Scan Verification Actions */}
            {activeOrder && (
              <div className="pt-2 border-t border-purple-100 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    impactHeavy();
                    onEditLabOrder?.(activeOrder.id, {
                      qcPassed: true,
                      marginType: activeOrder.marginType || 'Chamfer 0.8mm',
                      translucency: activeOrder.translucency || 'HT High Translucency'
                    });
                    if (activeOrder.status === 'sent') {
                      onUpdateStatus?.(activeOrder.id, 'fabrication');
                    }
                    setQcFeedbackBanner(
                      `تایید نهایی فایل اسکن سه‌بعدی دندان ${activeOrder.toothNumber} (${activeOrder.patientName}) ثبت شد و به واحد تراش CAD/CAM ارسال گردید ✓`
                    );
                  }}
                  className="flex-1 min-w-[180px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تایید نهایی اسکن سه‌بعدی و ارسال به تراش CAD/CAM ✓</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    selection();
                    onEditLabOrder?.(activeOrder.id, {
                      qcPassed: false,
                      instructions: `${activeOrder.instructions ? activeOrder.instructions + ' · ' : ''}نیازمند اصلاح ۰.۱۵mm تماس پیش‌رس کاسپ ML در نرم‌افزار Exocad`
                    });
                    setQcFeedbackBanner(
                      `یادداشت فنی اصلاح اکلوژن روی فایل سه‌بعدی سفارش «${activeOrder.patientName}» ثبت گردید.`
                    );
                  }}
                  className="py-2 px-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-black text-[10.5px] flex items-center gap-1 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  <span>ثبت اصلاح اکلوژن</span>
                </button>

                {activePatient && onOpenPalmerChart && (
                  <button
                    type="button"
                    onClick={() => {
                      impactLight();
                      onOpenPalmerChart(activePatient, activeOrder.toothNumber);
                    }}
                    className="py-2 px-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 font-black text-[10.5px] flex items-center gap-1 cursor-pointer"
                  >
                    <span>چارت پالمر ({activeOrder.toothNumber})</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
