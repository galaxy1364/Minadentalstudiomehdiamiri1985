import React, { useState, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import {
  Box,
  Activity,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  Compass,
  Sliders,
  Layers,
  Sparkles,
  FlaskConical
} from 'lucide-react';
import { ImplantCase, ImplantStage, Patient } from '../types/dental';
import { toPersianDigits, toEnglishDigits } from '../utils/jalali';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

export type Implant3DShadingMode = 'titanium' | 'bone_heatmap' | 'wireframe' | 'xray_cbct';
export type ImplantCameraPreset = 'isometric' | 'buccal_cbct' | 'proximal_cross' | 'occlusal_crest';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface SurgicalFacet3D {
  id: string;
  part: 'fixture' | 'abutment' | 'bone' | 'graft' | 'nerve';
  vertices: [Vec3, Vec3, Vec3, Vec3];
  bicDensityScore: number; // Bone-to-Implant Contact 0.35..0.95
}

export interface Implant3DSurgicalPlannerD3Props {
  implantCases: ImplantCase[];
  patients: Patient[];
  selectedCaseId?: string | null;
  onSelectCase?: (caseId: string) => void;
  onEditImplantCase?: (caseId: string, updatedFields: Partial<ImplantCase>) => void;
  onAdvanceStage?: (caseId: string, nextStage: ImplantStage) => void;
  onOpenPalmerChart?: (patient: Patient, toothText?: string) => void;
  onNavigateToModule?: (targetView: string) => void;
}

function rotate3D(p: Vec3, rxDeg: number, ryDeg: number, rzDeg: number): Vec3 {
  const rx = (rxDeg * Math.PI) / 180;
  const ry = (ryDeg * Math.PI) / 180;
  const rz = (rzDeg * Math.PI) / 180;

  // Z rotation (implant tilt / angulation)
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);
  const xz = p.x * cosZ - p.y * sinZ;
  const yz = p.x * sinZ + p.y * cosZ;
  const zz = p.z;

  // Y rotation (camera yaw)
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const xy = xz * cosY + zz * sinY;
  const zy = -xz * sinY + zz * cosY;
  const yy = yz;

  // X rotation (camera pitch)
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const yx = yy * cosX - zy * sinX;
  const zx = yy * sinX + zy * cosX;

  return { x: xy, y: yx, z: zx };
}

function facetNormal(v0: Vec3, v1: Vec3, v2: Vec3): Vec3 {
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

export const Implant3DSurgicalPlannerD3: React.FC<Implant3DSurgicalPlannerD3Props> = ({
  implantCases,
  patients,
  selectedCaseId,
  onSelectCase,
  onEditImplantCase,
  onOpenPalmerChart,
  onNavigateToModule
}) => {
  const { selection, impactLight, impactHeavy } = useHapticFeedback();

  const activeCase = useMemo(() => {
    if (selectedCaseId) {
      const found = implantCases.find(c => c.id === selectedCaseId);
      if (found) return found;
    }
    return implantCases[0] || null;
  }, [implantCases, selectedCaseId]);

  const activePatient = useMemo(() => {
    if (!activeCase) return null;
    return patients.find(p => p.id === activeCase.patientId || p.fullName === activeCase.patientName) || null;
  }, [patients, activeCase]);

  // 3D Camera & Surgical Planning Controls
  const [rotX, setRotX] = useState<number>(-18);
  const [rotY, setRotY] = useState<number>(30);
  const [zoom, setZoom] = useState<number>(1.06);
  const [shadingMode, setShadingMode] = useState<Implant3DShadingMode>('titanium');
  const [cameraPreset, setCameraPreset] = useState<ImplantCameraPreset>('isometric');

  // Interactive Surgical Planning Sliders
  const [implantTiltDeg, setImplantTiltDeg] = useState<number>(0); // -15° to +15° surgical angulation
  const [subcrestalMm, setSubcrestalMm] = useState<number>(0.5); // -0.5mm supracrestal to +2.0mm subcrestal
  const [selectedBoneType, setSelectedBoneType] = useState<'D1' | 'D2' | 'D3' | 'D4'>(
    activeCase?.boneDensity || 'D2'
  );

  // Layer Visibility
  const [showFixture, setShowFixture] = useState<boolean>(true);
  const [showAbutment, setShowAbutment] = useState<boolean>(true);
  const [showBoneRidge, setShowBoneRidge] = useState<boolean>(true);
  const [showNerveCanal, setShowNerveCanal] = useState<boolean>(true);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const dragRef = useRef<{ active: boolean; startX: number; startY: number; baseRotX: number; baseRotY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    baseRotX: -18,
    baseRotY: 30
  });

  const parsedDiameterMm = useMemo(() => {
    const raw = toEnglishDigits(activeCase?.diameter || '4.1');
    const num = parseFloat(raw);
    return Number.isFinite(num) && num >= 2.5 ? num : 4.1;
  }, [activeCase]);

  const parsedLengthMm = useMemo(() => {
    const raw = toEnglishDigits(activeCase?.length || '10');
    const num = parseFloat(raw);
    return Number.isFinite(num) && num >= 6 ? num : 10;
  }, [activeCase]);

  const isMaxilla = useMemo(() => {
    const t = activeCase?.toothNumber || '';
    return /UR|UL|بالا/i.test(t);
  }, [activeCase]);

  // Apical Safety Clearance from Inferior Alveolar Nerve or Maxillary Sinus Floor
  const apicalClearanceMm = useMemo(() => {
    const baseAvailableBoneMm = 13.8;
    const tiltFactor = Math.cos((implantTiltDeg * Math.PI) / 180);
    const effectiveDepth = parsedLengthMm * tiltFactor + subcrestalMm;
    return Number(Math.max(0.4, baseAvailableBoneMm - effectiveDepth).toFixed(2));
  }, [parsedLengthMm, implantTiltDeg, subcrestalMm]);

  const isSafetyWarning = apicalClearanceMm < 2.0;

  // Build 3D Surgical Mesh (Threaded Titanium Fixture + Hex Abutment + Alveolar Bone Ridge + GBR Graft + Nerve/Sinus Canal)
  const surgicalMesh = useMemo(() => {
    const facets: SurgicalFacet3D[] = [];
    const radialSteps = 18;
    const fixtureRings = 11;
    const rBase = parsedDiameterMm * 3.1; // scaled radius
    const hTotal = parsedLengthMm * 3.9; // scaled length
    const yCrest = 10;
    const yTopFixture = yCrest - subcrestalMm * 3.8;
    const yBottomFixture = yTopFixture - hTotal;

    const densityBaseScore =
      selectedBoneType === 'D1' ? 0.92 : selectedBoneType === 'D2' ? 0.84 : selectedBoneType === 'D3' ? 0.68 : 0.52;

    // 1. Threaded Titanium Fixture Mesh
    const getFixturePt = (ringIdx: number, angleIdx: number): Vec3 => {
      const v = ringIdx / (fixtureRings - 1); // 0 = apex, 1 = coronal collar
      const theta = (angleIdx / radialSteps) * Math.PI * 2;
      const apexTaper = v < 0.25 ? 0.58 + (v / 0.25) * 0.42 : 1.0;
      // Helical thread extrusion
      const threadWave = v > 0.1 && v < 0.9 ? 1 + 0.13 * Math.sin(v * Math.PI * 10 + theta * 2) : 1;
      const r = rBase * apexTaper * threadWave;
      const rawPt: Vec3 = {
        x: r * Math.cos(theta),
        y: yBottomFixture + v * hTotal,
        z: r * Math.sin(theta)
      };
      return rotate3D(rawPt, 0, 0, implantTiltDeg);
    };

    for (let r = 0; r < fixtureRings - 1; r++) {
      const vNorm = r / (fixtureRings - 1);
      for (let a = 0; a < radialSteps; a++) {
        const aNext = (a + 1) % radialSteps;
        const bic = Math.min(0.98, Math.max(0.35, densityBaseScore - (1 - vNorm) * 0.12 + 0.08 * Math.cos((a / radialSteps) * Math.PI * 4)));
        facets.push({
          id: `fix-${r}-${a}`,
          part: 'fixture',
          vertices: [
            getFixturePt(r, a),
            getFixturePt(r, aNext),
            getFixturePt(r + 1, aNext),
            getFixturePt(r + 1, a)
          ],
          bicDensityScore: bic
        });
      }
    }

    // 2. Prosthetic Hexed Abutment Mesh above Fixture Collar
    const abutmentRings = 5;
    const getAbutmentPt = (ringIdx: number, angleIdx: number): Vec3 => {
      const v = ringIdx / (abutmentRings - 1);
      const theta = (angleIdx / radialSteps) * Math.PI * 2;
      const emergence = v < 0.35 ? 0.78 + v * 0.85 : 1.05 - (v - 0.35) * 0.55;
      const r = rBase * 0.85 * emergence;
      const rawPt: Vec3 = {
        x: r * Math.cos(theta),
        y: yTopFixture + v * 22,
        z: r * Math.sin(theta)
      };
      return rotate3D(rawPt, 0, 0, implantTiltDeg);
    };

    for (let r = 0; r < abutmentRings - 1; r++) {
      for (let a = 0; a < radialSteps; a++) {
        const aNext = (a + 1) % radialSteps;
        facets.push({
          id: `abut-${r}-${a}`,
          part: 'abutment',
          vertices: [
            getAbutmentPt(r, a),
            getAbutmentPt(r, aNext),
            getAbutmentPt(r + 1, aNext),
            getAbutmentPt(r + 1, a)
          ],
          bicDensityScore: 0.9
        });
      }
    }

    // 3. Alveolar Bone Ridge Arch (Cortical Crest + Trabecular Envelope)
    const boneRings = 5;
    const boneSteps = 14;
    const getBonePt = (ringIdx: number, stepIdx: number): Vec3 => {
      const v = ringIdx / (boneRings - 1); // 0 = basal bone, 1 = alveolar crest
      const theta = (stepIdx / boneSteps) * Math.PI * 2;
      const rx = (28 - v * 5) * Math.cos(theta);
      const rz = (22 - v * 4) * Math.sin(theta);
      const ry = -34 + v * 44;
      return { x: rx, y: ry, z: rz };
    };

    for (let r = 0; r < boneRings - 1; r++) {
      for (let a = 0; a < boneSteps; a++) {
        const aNext = (a + 1) % boneSteps;
        facets.push({
          id: `bone-${r}-${a}`,
          part: 'bone',
          vertices: [
            getBonePt(r, a),
            getBonePt(r, aNext),
            getBonePt(r + 1, aNext),
            getBonePt(r + 1, a)
          ],
          bicDensityScore: densityBaseScore
        });
      }
    }

    // 4. Optional GBR Bone Graft & Collagen Membrane Collar if boneGraft or membrane is true
    if (activeCase?.boneGraft || activeCase?.membrane) {
      const graftSteps = 14;
      for (let a = 0; a < graftSteps; a++) {
        const aNext = (a + 1) % graftSteps;
        const t0 = (a / graftSteps) * Math.PI * 2;
        const t1 = (aNext / graftSteps) * Math.PI * 2;
        facets.push({
          id: `graft-${a}`,
          part: 'graft',
          vertices: [
            { x: 24 * Math.cos(t0), y: 2, z: 19 * Math.sin(t0) },
            { x: 24 * Math.cos(t1), y: 2, z: 19 * Math.sin(t1) },
            { x: 18 * Math.cos(t1), y: 13, z: 15 * Math.sin(t1) },
            { x: 18 * Math.cos(t0), y: 13, z: 15 * Math.sin(t0) }
          ],
          bicDensityScore: 0.78
        });
      }
    }

    // 5. Mandibular Nerve Canal / Maxillary Sinus Floor Tube below Apex
    const canalSegments = 10;
    const canalCircleSteps = 8;
    const yCanalCenter = -43;
    const rCanal = 5.2;
    const getCanalPt = (segIdx: number, cIdx: number): Vec3 => {
      const u = segIdx / (canalSegments - 1); // -36 to +36 along X
      const alpha = (cIdx / canalCircleSteps) * Math.PI * 2;
      const x = -36 + u * 72;
      const archCurveY = Math.sin(u * Math.PI) * 3.5;
      const y = yCanalCenter + archCurveY + rCanal * Math.cos(alpha);
      const z = rCanal * Math.sin(alpha);
      return { x, y, z };
    };

    for (let s = 0; s < canalSegments - 1; s++) {
      for (let c = 0; c < canalCircleSteps; c++) {
        const cNext = (c + 1) % canalCircleSteps;
        facets.push({
          id: `nerve-${s}-${c}`,
          part: 'nerve',
          vertices: [
            getCanalPt(s, c),
            getCanalPt(s, cNext),
            getCanalPt(s + 1, cNext),
            getCanalPt(s + 1, c)
          ],
          bicDensityScore: 0.4
        });
      }
    }

    return {
      facets,
      yBottomFixture,
      yCanalCenter: yCanalCenter + rCanal
    };
  }, [parsedDiameterMm, parsedLengthMm, subcrestalMm, implantTiltDeg, selectedBoneType, activeCase]);

  const bicColorScale = useMemo(() => {
    return d3.scaleSequential(d3.interpolateTurbo).domain([0.35, 0.98]);
  }, []);

  // Project 3D Surgical Scene
  const projectedSurgicalScene = useMemo(() => {
    const cx = 230;
    const cy = 165;
    const scale = 2.65 * zoom;
    const lightDir: Vec3 = { x: 0.45, y: -0.6, z: 0.65 };

    const rendered: Array<{
      id: string;
      part: SurgicalFacet3D['part'];
      pathD: string;
      fill: string;
      stroke: string;
      strokeWidth: number;
      opacity: number;
      zDepth: number;
    }> = [];

    for (const facet of surgicalMesh.facets) {
      if (facet.part === 'fixture' && !showFixture) continue;
      if (facet.part === 'abutment' && !showAbutment) continue;
      if ((facet.part === 'bone' || facet.part === 'graft') && !showBoneRidge) continue;
      if (facet.part === 'nerve' && !showNerveCanal) continue;

      const tVerts = facet.vertices.map(v => rotate3D(v, rotX, rotY, 0));
      const normal = facetNormal(tVerts[0], tVerts[1], tVerts[2]);
      const zDepth = (tVerts[0].z + tVerts[1].z + tVerts[2].z + tVerts[3].z) / 4;

      const dotL = Math.max(-0.2, normal.x * lightDir.x + normal.y * lightDir.y + normal.z * lightDir.z);
      const brightness = Math.min(1.35, 0.48 + Math.max(0, dotL) * 0.62);

      let fill = '#94a3b8';
      let stroke = 'rgba(15,23,42,0.22)';
      let strokeWidth = 0.55;
      let opacity = 0.96;

      if (shadingMode === 'wireframe') {
        fill = 'rgba(15, 23, 42, 0.08)';
        stroke =
          facet.part === 'fixture'
            ? '#38bdf8'
            : facet.part === 'abutment'
            ? '#facc15'
            : facet.part === 'nerve'
            ? '#f43f5e'
            : '#a855f7';
        strokeWidth = 0.85;
        opacity = 0.9;
      } else if (shadingMode === 'xray_cbct') {
        fill =
          facet.part === 'fixture'
            ? 'rgba(226, 232, 240, 0.88)'
            : facet.part === 'abutment'
            ? 'rgba(250, 204, 21, 0.75)'
            : facet.part === 'nerve'
            ? 'rgba(244, 63, 94, 0.72)'
            : 'rgba(56, 189, 248, 0.14)';
        stroke =
          facet.part === 'nerve'
            ? '#fda4af'
            : facet.part === 'fixture'
            ? '#f8fafc'
            : 'rgba(125, 211, 252, 0.35)';
        opacity = facet.part === 'bone' ? 0.28 : 0.9;
      } else if (shadingMode === 'bone_heatmap') {
        if (facet.part === 'fixture' || facet.part === 'bone') {
          fill = d3.rgb(bicColorScale(facet.bicDensityScore)).brighter((brightness - 0.85) * 0.7).formatHex();
          opacity = facet.part === 'bone' ? 0.38 : 0.98;
        } else if (facet.part === 'nerve') {
          fill = '#e11d48';
          opacity = 0.88;
        } else {
          fill = '#eab308';
          opacity = 0.92;
        }
      } else {
        // Default Titanium & Translucent Alveolar Bone Studio Mode
        if (facet.part === 'fixture') {
          const baseTi = d3.rgb('#64748b');
          fill = d3
            .rgb(
              Math.min(255, Math.round(baseTi.r * brightness + 35)),
              Math.min(255, Math.round(baseTi.g * brightness + 42)),
              Math.min(255, Math.round(baseTi.b * brightness + 52))
            )
            .formatHex();
          stroke = 'rgba(226, 232, 240, 0.32)';
        } else if (facet.part === 'abutment') {
          const baseAu = d3.rgb('#eab308');
          fill = baseAu.brighter((brightness - 0.85) * 0.9).formatHex();
          stroke = 'rgba(254, 240, 138, 0.4)';
        } else if (facet.part === 'graft') {
          fill = 'rgba(52, 211, 153, 0.34)';
          stroke = 'rgba(16, 185, 129, 0.55)';
          opacity = 0.55;
        } else if (facet.part === 'nerve') {
          fill = isSafetyWarning ? '#e11d48' : '#f97316';
          stroke = '#fecdd3';
          opacity = 0.9;
        } else {
          // Translucent Alveolar Bone Envelope
          fill = 'rgba(226, 213, 187, 0.22)';
          stroke = 'rgba(203, 213, 225, 0.25)';
          opacity = 0.32;
        }
      }

      const pts2d = tVerts.map(v => [
        Number((cx + v.x * scale).toFixed(1)),
        Number((cy - v.y * scale).toFixed(1))
      ]);
      const pathD = `M${pts2d[0][0]},${pts2d[0][1]}L${pts2d[1][0]},${pts2d[1][1]}L${pts2d[2][0]},${pts2d[2][1]}L${pts2d[3][0]},${pts2d[3][1]}Z`;

      rendered.push({
        id: facet.id,
        part: facet.part,
        pathD,
        fill,
        stroke,
        strokeWidth,
        opacity,
        zDepth
      });
    }

    rendered.sort((a, b) => a.zDepth - b.zDepth);

    // Project Apical Safety Distance Vector (Apex of Fixture -> Nerve Canal / Sinus Floor)
    const apexPt = rotate3D(
      rotate3D({ x: 0, y: surgicalMesh.yBottomFixture, z: 0 }, 0, 0, implantTiltDeg),
      rotX,
      rotY,
      0
    );
    const canalPt = rotate3D({ x: 0, y: surgicalMesh.yCanalCenter, z: 0 }, rotX, rotY, 0);

    return {
      rendered,
      safetyVector: {
        x1: Number((cx + apexPt.x * scale).toFixed(1)),
        y1: Number((cy - apexPt.y * scale).toFixed(1)),
        x2: Number((cx + canalPt.x * scale).toFixed(1)),
        y2: Number((cy - canalPt.y * scale).toFixed(1))
      }
    };
  }, [
    surgicalMesh,
    rotX,
    rotY,
    zoom,
    shadingMode,
    showFixture,
    showAbutment,
    showBoneRidge,
    showNerveCanal,
    implantTiltDeg,
    isSafetyWarning,
    bicColorScale
  ]);

  // D3 Osseointegration & ISQ Stability Curve (Week 0 -> Week 12)
  const isqChart = useMemo(() => {
    const torqueVal = activeCase?.torque || 40;
    const baseIsq0 = Math.min(78, Math.max(54, Math.round(48 + torqueVal * 0.52)));
    const densityBonus =
      selectedBoneType === 'D1' ? 5 : selectedBoneType === 'D2' ? 3 : selectedBoneType === 'D3' ? -2 : -6;

    const weeks = [
      { week: 'هفته ۰ (جراحی)', isq: baseIsq0 + densityBonus },
      { week: 'هفته ۲ (افت اولیه)', isq: baseIsq0 + densityBonus - 6 },
      { week: 'هفته ۴ (کالوس)', isq: baseIsq0 + densityBonus - 1 },
      { week: 'هفته ۶ (ریمدلینگ)', isq: Math.min(84, baseIsq0 + densityBonus + 5) },
      { week: 'هفته ۸ (قالب‌گیری)', isq: Math.min(86, baseIsq0 + densityBonus + 9) },
      { week: 'هفته ۱۲ (بارگذاری)', isq: Math.min(88, baseIsq0 + densityBonus + 12) }
    ];

    const w = 360;
    const h = 126;
    const pad = { top: 14, right: 18, bottom: 24, left: 28 };
    const innerW = w - pad.left - pad.right;
    const innerH = h - pad.top - pad.bottom;

    const xScale = d3
      .scalePoint<string>()
      .domain(weeks.map(d => d.week))
      .range([0, innerW]);

    const yScale = d3.scaleLinear().domain([45, 92]).range([innerH, 0]);

    const lineGen = d3
      .line<(typeof weeks)[0]>()
      .x(d => pad.left + (xScale(d.week) || 0))
      .y(d => pad.top + yScale(d.isq))
      .curve(d3.curveMonotoneX);

    const areaGen = d3
      .area<(typeof weeks)[0]>()
      .x(d => pad.left + (xScale(d.week) || 0))
      .y0(pad.top + innerH)
      .y1(d => pad.top + yScale(d.isq))
      .curve(d3.curveMonotoneX);

    return {
      w,
      h,
      pad,
      weeks,
      xScale,
      yScale,
      lineD: lineGen(weeks) || '',
      areaD: areaGen(weeks) || '',
      thresholdY: pad.top + yScale(70)
    };
  }, [activeCase, selectedBoneType]);

  const handleApplyPreset = (preset: ImplantCameraPreset) => {
    selection();
    setCameraPreset(preset);
    switch (preset) {
      case 'isometric':
        setRotX(-18);
        setRotY(30);
        break;
      case 'buccal_cbct':
        setRotX(-4);
        setRotY(0);
        break;
      case 'proximal_cross':
        setRotX(-6);
        setRotY(90);
        break;
      case 'occlusal_crest':
        setRotX(-82);
        setRotY(0);
        break;
    }
  };

  return (
    <div data-testid="implant-3d-surgical-planner-d3" className="mx-2 space-y-2.5 text-slate-900" dir="rtl">
      {feedbackBanner && (
        <div className="p-2.5 rounded-2xl bg-cyan-50 border border-cyan-300 text-cyan-950 text-xs font-black flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-600 shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="px-2 py-0.5 rounded-lg bg-cyan-200/70 hover:bg-cyan-300 text-cyan-950 text-[10px] font-black cursor-pointer"
          >
            بستن
          </button>
        </div>
      )}

      {/* Top Case Picker Header */}
      <div className="bg-white rounded-[22px] p-3 border border-cyan-200/90 shadow-[var(--shadow-card)] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-600 via-sky-600 to-indigo-700 text-white flex items-center justify-center shadow-xs shrink-0">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs sm:text-sm font-black text-slate-950">
                شبیه‌ساز سه‌بعدی جراحی ایمپلنت، تراکم استخوان و فاصله از عصب / سینوس (D3 3D CBCT)
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-900 border border-cyan-300 text-[9.5px] font-black font-mono">
                3D Fixture · ISQ · CBCT Safety
              </span>
            </div>
            <p className="text-[10.5px] font-bold text-slate-500">
              بررسی سه‌بعدی محور کاشت فیکسچر، حاشیه ایمنی از کانال عصب فکی و منحنی پایداری استئواینتگریشن (ISQ)
            </p>
          </div>
        </div>

        <select
          aria-label="انتخاب کیس ایمپلنت جهت شبیه‌سازی سه‌بعدی جراحی"
          value={activeCase?.id || ''}
          onChange={(e) => {
            selection();
            onSelectCase?.(e.target.value);
          }}
          className="bg-cyan-50/90 border border-cyan-300 text-cyan-950 rounded-xl px-2.5 py-1.5 text-xs font-black focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
        >
          {implantCases.map((ic, idx) => (
            <option key={ic.id} value={ic.id}>
              {toPersianDigits(idx + 1)}. {ic.patientName} — {ic.toothNumber} ({ic.brand} Ø{ic.diameter}×{ic.length})
            </option>
          ))}
        </select>
      </div>

      {/* Main 3D Surgical Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-start">
        {/* Left/Center 3D Viewport (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950 text-white rounded-[24px] p-3 border border-cyan-400/40 shadow-xl space-y-2.5">
          {/* HUD Top Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
              <span className="px-2 py-0.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 font-black">
                {activeCase?.patientName || 'بیمار جراحی'}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 font-mono font-black">
                Ø{toPersianDigits(parsedDiameterMm)} × {toPersianDigits(parsedLengthMm)} mm
              </span>
              <span
                className={`px-2 py-0.5 rounded-lg font-mono font-black border ${
                  isSafetyWarning
                    ? 'bg-rose-600/40 border-rose-400 text-rose-200'
                    : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                }`}
              >
                فاصله از {isMaxilla ? 'کف سینوس' : 'کانال عصب'}: {toPersianDigits(apicalClearanceMm)} mm
              </span>
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              {[
                { id: 'titanium' as const, label: 'تیتانیوم و استخوان 3D' },
                { id: 'bone_heatmap' as const, label: 'هیت‌مپ تماس استخوان (BIC)' },
                { id: 'xray_cbct' as const, label: 'مقطع CBCT پرتو ایکس' },
                { id: 'wireframe' as const, label: 'شبکه مش جراحی' }
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    selection();
                    setShadingMode(m.id);
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-all ${
                    shadingMode === m.id
                      ? 'bg-[#c8ff00] text-slate-950 shadow-2xs'
                      : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Camera Presets */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-slate-400 font-bold flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>نمای جراحی:</span>
              </span>
              {[
                { id: 'isometric' as const, label: 'ایزومتریک 3D' },
                { id: 'buccal_cbct' as const, label: 'پانوراما / باکال' },
                { id: 'proximal_cross' as const, label: 'کراس‌سکشن CBCT' },
                { id: 'occlusal_crest' as const, label: 'کرست اکلوزال' }
              ].map(cam => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => handleApplyPreset(cam.id)}
                  className={`px-2 py-0.5 rounded-lg font-black cursor-pointer transition-all ${
                    cameraPreset === cam.id
                      ? 'bg-cyan-600 text-white border border-cyan-400'
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
                aria-label="بزرگ‌نمایی فیکسچر سه‌بعدی"
                onClick={() => {
                  impactLight();
                  setZoom(z => Math.min(1.6, Number((z + 0.12).toFixed(2))));
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="کوچک‌نمایی فیکسچر سه‌بعدی"
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
                aria-label="ریست زاویه شبیه‌ساز ایمپلنت"
                onClick={() => {
                  selection();
                  handleApplyPreset('isometric');
                  setImplantTiltDeg(0);
                  setSubcrestalMm(0.5);
                  setZoom(1.06);
                }}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>ریست</span>
              </button>
            </div>
          </div>

          {/* 3D Interactive SVG Canvas */}
          <div className="relative rounded-2xl bg-gradient-to-b from-slate-900 via-[#0b1324] to-[#070b14] border border-slate-800 overflow-hidden select-none">
            <svg
              data-testid="implant-3d-planner-svg"
              viewBox="0 0 460 330"
              className="w-full h-[265px] sm:h-[310px] cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={(e) => {
                dragRef.current = {
                  active: true,
                  startX: e.clientX,
                  startY: e.clientY,
                  baseRotX: rotX,
                  baseRotY: rotY
                };
              }}
              onPointerMove={(e) => {
                if (!dragRef.current.active) return;
                const dx = e.clientX - dragRef.current.startX;
                const dy = e.clientY - dragRef.current.startY;
                setRotY(Math.round((dragRef.current.baseRotY + dx * 0.65) % 360));
                setRotX(Math.round(Math.max(-85, Math.min(85, dragRef.current.baseRotX - dy * 0.55))));
              }}
              onPointerUp={() => {
                dragRef.current.active = false;
              }}
              onPointerLeave={() => {
                dragRef.current.active = false;
              }}
            >
              <g data-testid="implant-3d-facets-group">
                {projectedSurgicalScene.rendered.map(f => (
                  <path
                    key={f.id}
                    d={f.pathD}
                    fill={f.fill}
                    stroke={f.stroke}
                    strokeWidth={f.strokeWidth}
                    fillOpacity={f.opacity}
                  />
                ))}
              </g>

              {/* Apical Safety Margin Measurement Callout Vector */}
              {showNerveCanal && (
                <g data-testid="implant-3d-safety-vector">
                  <line
                    x1={projectedSurgicalScene.safetyVector.x1}
                    y1={projectedSurgicalScene.safetyVector.y1}
                    x2={projectedSurgicalScene.safetyVector.x2}
                    y2={projectedSurgicalScene.safetyVector.y2}
                    stroke={isSafetyWarning ? '#f43f5e' : '#10b981'}
                    strokeWidth="2.2"
                    strokeDasharray="4 3"
                  />
                  <circle
                    cx={projectedSurgicalScene.safetyVector.x1}
                    cy={projectedSurgicalScene.safetyVector.y1}
                    r="3.2"
                    fill="#c8ff00"
                  />
                  <circle
                    cx={projectedSurgicalScene.safetyVector.x2}
                    cy={projectedSurgicalScene.safetyVector.y2}
                    r="3.2"
                    fill={isSafetyWarning ? '#f43f5e' : '#10b981'}
                  />
                </g>
              )}
            </svg>
          </div>

          {/* Bottom Surgical Angulation, Subcrestal Depth & Layer Controls */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-2.5 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-black text-cyan-300 flex items-center gap-1">
                    <Sliders className="w-3 h-3" />
                    <span>زاویه محور کاشت (Angulation)</span>
                  </span>
                  <span className="font-mono font-black text-[#c8ff00]">{toPersianDigits(implantTiltDeg)}°</span>
                </div>
                <input
                  type="range"
                  min={-15}
                  max={15}
                  step={1}
                  value={implantTiltDeg}
                  aria-label="زاویه محور کاشت فیکسچر ایمپلنت"
                  onChange={(e) => setImplantTiltDeg(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-black text-amber-300 flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    <span>عمق ساب‌کرستال (Subcrestal Depth)</span>
                  </span>
                  <span className="font-mono font-black text-amber-300">{toPersianDigits(subcrestalMm)} mm</span>
                </div>
                <input
                  type="range"
                  min={-0.5}
                  max={2.0}
                  step={0.25}
                  value={subcrestalMm}
                  aria-label="عمق کاشت ساب‌کرستال ایمپلنت"
                  onChange={(e) => setSubcrestalMm(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-800 text-[10px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400 font-bold">لایه‌های جراحی:</span>
                <button
                  type="button"
                  onClick={() => setShowFixture(!showFixture)}
                  className={`px-2 py-1 rounded-lg font-black cursor-pointer ${
                    showFixture ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  فیکسچر تیتانیومی {showFixture ? '✓' : '×'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAbutment(!showAbutment)}
                  className={`px-2 py-1 rounded-lg font-black cursor-pointer ${
                    showAbutment ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  اباتمنت پروتزی {showAbutment ? '✓' : '×'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBoneRidge(!showBoneRidge)}
                  className={`px-2 py-1 rounded-lg font-black cursor-pointer ${
                    showBoneRidge ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  استخوان و GBR {showBoneRidge ? '✓' : '×'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNerveCanal(!showNerveCanal)}
                  className={`px-2 py-1 rounded-lg font-black cursor-pointer ${
                    showNerveCanal ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isMaxilla ? 'کف سینوس' : 'کانال عصب فکی'} {showNerveCanal ? '✓' : '×'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Bone Density D1-D4 Selector, D3 ISQ Stability Chart & Cross-Module Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="bg-white rounded-[22px] p-3 border border-cyan-200/90 shadow-[var(--shadow-card)] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-700" />
                <h5 className="text-xs font-black text-slate-950">
                  تراکم استخوان میش (Misch D1–D4) و پایداری ISQ
                </h5>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[9.5px] font-black border ${
                  isSafetyWarning
                    ? 'bg-rose-100 text-rose-900 border-rose-300'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                }`}
              >
                {isSafetyWarning ? 'هشدار نزدیکی به عصب/سینوس' : 'حاشیه ایمنی اپیکال استاندارد ✓'}
              </span>
            </div>

            {/* Bone Density D1-D4 Selector Buttons */}
            <div className="grid grid-cols-4 gap-1.5">
              {(['D1', 'D2', 'D3', 'D4'] as const).map(bType => (
                <button
                  key={bType}
                  type="button"
                  onClick={() => {
                    selection();
                    setSelectedBoneType(bType);
                  }}
                  className={`py-1.5 px-2 rounded-xl border text-center cursor-pointer transition-all ${
                    selectedBoneType === bType
                      ? 'bg-cyan-700 text-white border-cyan-800 shadow-2xs'
                      : 'bg-slate-50 hover:bg-cyan-50 text-slate-800 border-slate-200'
                  }`}
                >
                  <span className="text-xs font-black font-mono block">{bType}</span>
                  <span className="text-[8.5px] font-bold opacity-85 block">
                    {bType === 'D1'
                      ? 'کورتیکال متراکم'
                      : bType === 'D2'
                      ? 'متراکم-اسفنجی'
                      : bType === 'D3'
                      ? 'ترابکولار ظریف'
                      : 'اسفنجی نرم'}
                  </span>
                </button>
              ))}
            </div>

            {/* D3 Osseointegration ISQ Curve Chart */}
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-black text-slate-800 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-cyan-600" />
                  <span>منحنی پیش‌بینی پایداری استئواینتگریشن (ISQ D3 Curve)</span>
                </span>
                <span className="font-mono text-[9.5px] text-emerald-800 font-bold">مرز بارگذاری: ISQ ≥ ۷۰</span>
              </div>

              <svg
                data-testid="implant-3d-isq-chart-svg"
                viewBox={`0 0 ${isqChart.w} ${isqChart.h}`}
                className="w-full h-[118px] overflow-visible"
              >
                <defs>
                  <linearGradient id="d3_imp_isq_grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0891b2" stopOpacity="0.38" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
                  </linearGradient>
                </defs>

                {/* Safe Prosthetic Loading Threshold Line (ISQ = 70) */}
                <line
                  x1={isqChart.pad.left}
                  y1={isqChart.thresholdY}
                  x2={isqChart.w - isqChart.pad.right}
                  y2={isqChart.thresholdY}
                  stroke="#10b981"
                  strokeDasharray="4 3"
                  strokeWidth="1.3"
                />

                <path d={isqChart.areaD} fill="url(#d3_imp_isq_grad)" />
                <path d={isqChart.lineD} fill="none" stroke="#0891b2" strokeWidth="2.2" />

                {isqChart.weeks.map(pt => {
                  const cx = isqChart.pad.left + (isqChart.xScale(pt.week) || 0);
                  const cy = isqChart.pad.top + isqChart.yScale(pt.isq);
                  return (
                    <g key={pt.week}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r="3.5"
                        fill={pt.isq >= 70 ? '#10b981' : '#f59e0b'}
                        stroke="#ffffff"
                        strokeWidth="1.2"
                      />
                      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="8" fontWeight="900" fill="#0f172a">
                        {toPersianDigits(pt.isq)}
                      </text>
                      <text
                        x={cx}
                        y={isqChart.h - 6}
                        textAnchor="middle"
                        fontSize="7"
                        fontWeight="700"
                        fill="#475569"
                      >
                        {pt.week.split(' ')[0]} {pt.week.split(' ')[1]}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Surgeon Save & Cross-Module Actions */}
            {activeCase && (
              <div className="pt-2 border-t border-cyan-100 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    impactHeavy();
                    onEditImplantCase?.(activeCase.id, {
                      boneDensity: selectedBoneType,
                      notes: `${activeCase.notes || ''} · طرح سه‌بعدی جراحی: زاویه ${implantTiltDeg}°، عمق ساب‌کرستال ${subcrestalMm}mm، فاصله از عصب/سینوس ${apicalClearanceMm}mm (تراکم ${selectedBoneType})`
                    });
                    setFeedbackBanner(
                      `طرح جراحی سه‌بعدی دندان ${activeCase.toothNumber} (${activeCase.patientName}) با تراکم ${selectedBoneType} و فاصله ایمنی ${toPersianDigits(apicalClearanceMm)} میلی‌متر ذخیره شد ✓`
                    );
                  }}
                  className="flex-1 min-w-[180px] py-2 px-3 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-black text-[11px] flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ثبت و قفل طرح جراحی سه‌بعدی در پرونده ✓</span>
                </button>

                {onNavigateToModule && (
                  <button
                    type="button"
                    onClick={() => {
                      impactLight();
                      onNavigateToModule('lab');
                    }}
                    className="py-2 px-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-950 border border-purple-300 font-black text-[10.5px] flex items-center gap-1 cursor-pointer"
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-purple-700" />
                    <span>اسکن 3D روکش در لابراتوار</span>
                  </button>
                )}

                {activePatient && onOpenPalmerChart && (
                  <button
                    type="button"
                    onClick={() => {
                      impactLight();
                      onOpenPalmerChart(activePatient, activeCase.toothNumber);
                    }}
                    className="py-2 px-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 font-black text-[10.5px] flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>چارت پالمر</span>
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
