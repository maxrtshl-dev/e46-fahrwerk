import { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import type { Computed } from "../app/compute";
import type { Setup } from "../app/store";
import type { SideResult } from "../core/frontAxle";
import { fmtMm } from "../core/format";
import type { TwoLinkResult } from "../core/twoLink";
import { MM_PER_INCH, tireRadius, wheelLateralShift, rimWidthMm, type TireSize } from "../core/tire";
import { archEdge, between, bodyToRoad, Helix, v3 } from "./geometry";
import { archCutMaterial, buildE46Body } from "./e46Body";
import { buildE46Details, type DetailKind } from "./e46Details";
import { styling68Hub, wheelStar } from "./styling68";
import type { WheelStyle } from "../core/data";

const DEG = Math.PI / 180;

export interface Palette {
  body: string;
  tire: string;
  rim: string;
  arm: string;
  spring: string;
  rc: string;
  edge: string;
  glass: string;
}

interface Look {
  palette: Palette;
  opacity: number; // 1 = voll, < 1 = Vergleichssetup
  showBody: boolean;
  labels: boolean;
}

function Mat({ color, opacity, metal = 0.1 }: { color: string; opacity: number; metal?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      metalness={metal}
      roughness={0.55}
      transparent={opacity < 1}
      opacity={opacity}
      depthWrite={opacity >= 1}
    />
  );
}

function Rod({ a, b, r, color, opacity }: { a: THREE.Vector3; b: THREE.Vector3; r: number; color: string; opacity: number }) {
  const t = useMemo(() => between(a, b), [a, b]);
  return (
    <mesh position={t.position} quaternion={t.quaternion}>
      <cylinderGeometry args={[r, r, t.length, 14]} />
      <Mat color={color} opacity={opacity} />
    </mesh>
  );
}

function Joint({ p, r, color, opacity }: { p: THREE.Vector3; r: number; color: string; opacity: number }) {
  return (
    <mesh position={p}>
      <sphereGeometry args={[r, 16, 12]} />
      <Mat color={color} opacity={opacity} metal={0.4} />
    </mesh>
  );
}

/** Rad: Reifen (Rotationskörper), Felgenbett, Stern im Stil Styling 68. Achse = y. */
function Wheel({
  center,
  camberDeg,
  side,
  tire,
  widthJ,
  et,
  look,
  style,
}: {
  style: WheelStyle;
  center: THREE.Vector3;
  camberDeg: number;
  side: 1 | -1; // 1 = links (+y)
  tire: TireSize;
  widthJ: number;
  et: number;
  look: Look;
}) {
  const r = tireRadius(tire);
  const rimR = (tire.rimInch * MM_PER_INCH) / 2;
  const b = rimWidthMm(widthJ);
  const lathe = useMemo(() => {
    const w = tire.widthMm;
    const pts = [
      new THREE.Vector2(rimR, -b / 2),
      new THREE.Vector2(rimR + (r - rimR) * 0.35, -w / 2),
      new THREE.Vector2(r - 18, -w / 2 + 4),
      new THREE.Vector2(r, -w / 2 + 38),
      new THREE.Vector2(r, w / 2 - 38),
      new THREE.Vector2(r - 18, w / 2 - 4),
      new THREE.Vector2(rimR + (r - rimR) * 0.35, w / 2),
      new THREE.Vector2(rimR, b / 2),
    ];
    return new THREE.LatheGeometry(pts, 56);
  }, [r, rimR, b, tire.widthMm]);
  const { palette, opacity } = look;
  // links: Sturz negativ → oben nach innen (−y) = positive Drehung um x; rechts gespiegelt
  const rotX = side === 1 ? -camberDeg * DEG : camberDeg * DEG;
  const star = useMemo(() => wheelStar(style, { rimR, hubFace: et, lip: b / 2 }), [style, rimR, et, b]);
  const hub = useMemo(() => styling68Hub({ rimR, hubFace: et, lip: b / 2 }), [rimR, et, b]);
  return (
    <group position={center} rotation={[rotX, 0, side === 1 ? 0 : Math.PI]}>
      <mesh geometry={lathe}>
        <meshStandardMaterial
          color={palette.tire}
          roughness={0.9}
          side={THREE.DoubleSide}
          transparent={opacity < 1}
          opacity={opacity}
          depthWrite={opacity >= 1}
        />
      </mesh>
      <mesh>
        <cylinderGeometry args={[rimR - 8, rimR - 8, b, 48, 1, true]} />
        <meshStandardMaterial color={palette.rim} metalness={0.6} roughness={0.35} side={THREE.DoubleSide} transparent={opacity < 1} opacity={opacity} />
      </mesh>
      {/* Stern Styling 68: innen auf der Radanlagefläche (ET), außen bis zum Horn gewölbt */}
      <mesh geometry={star}>
        <meshStandardMaterial color={palette.rim} metalness={0.75} roughness={0.28} transparent={opacity < 1} opacity={opacity} />
      </mesh>
      <mesh geometry={hub}>
        <meshStandardMaterial color={palette.rim} metalness={0.6} roughness={0.4} transparent={opacity < 1} opacity={opacity} />
      </mesh>
      {/* äußeres Felgenhorn */}
      <mesh position={[0, b / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[rimR - 2, 7, 10, 64]} />
        <meshStandardMaterial color={palette.rim} metalness={0.75} roughness={0.25} transparent={opacity < 1} opacity={opacity} />
      </mesh>
    </group>
  );
}

function FrontCorner({ s, look }: { s: SideResult; look: Look }) {
  const p = (q: { y: number; z: number }) => v3(0, q.y, q.z);
  const A = p(s.lowerArmInner);
  const B = p(s.lowerArmOuter);
  const T = p(s.strutTop);
  const { palette: c, opacity } = look;
  // Feder auf dem oberen Drittel des Federbeins
  const springBase = B.clone().lerp(T, 0.45);
  const spring = between(springBase, T);
  const helix = useMemo(() => new THREE.TubeGeometry(new Helix(62, spring.length, 6.5), 260, 6, 8, false), [spring.length]);
  return (
    <group>
      <Rod a={A} b={B} r={14} color={c.arm} opacity={opacity} />
      <Rod a={B} b={T} r={24} color={c.arm} opacity={opacity} />
      <Joint p={A} r={22} color={c.arm} opacity={opacity} />
      <Joint p={B} r={22} color={c.arm} opacity={opacity} />
      <mesh position={T} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[70, 70, 22, 24]} />
        <Mat color={c.arm} opacity={opacity} metal={0.4} />
      </mesh>
      <group position={springBase} quaternion={spring.quaternion}>
        <mesh geometry={helix}>
          <Mat color={c.spring} opacity={opacity} metal={0.3} />
        </mesh>
      </group>
    </group>
  );
}

function RearCorner({ r, x, mirror, look }: { r: TwoLinkResult; x: number; mirror: boolean; look: Look }) {
  const f = (q: { y: number; z: number }) => v3(x, mirror ? -q.y : q.y, q.z);
  const { palette: c, opacity } = look;
  const Li = f(r.lowerInner);
  const Lo = f(r.lowerOuter);
  const Ui = f(r.upperInner);
  const Uo = f(r.upperOuter);
  return (
    <group>
      <Rod a={Li} b={Lo} r={16} color={c.arm} opacity={opacity} />
      <Rod a={Ui} b={Uo} r={12} color={c.arm} opacity={opacity} />
      <Rod a={Lo} b={Uo} r={20} color={c.arm} opacity={opacity} />
      {[Li, Lo, Ui, Uo].map((p, i) => (
        <Joint key={i} p={p} r={20} color={c.arm} opacity={opacity} />
      ))}
    </group>
  );
}

/** Lage der Karosserie (Karosserie → Fahrbahn) und Rollzentren im Karosseriesystem. */
export function carPose(c: Computed) {
  const wb = c.d.vehicle.wheelbase.value ?? 2725;
  const axle = c.axle ?? c.stockAxle;
  const rear = c.rear;
  const gF = axle ? (axle.left.groundZ + axle.right.groundZ) / 2 : 0;
  const gR = rear ? (rear.left.groundZ + rear.right.groundZ) / 2 : 0;
  const roll = axle
    ? Math.atan2(axle.left.contactPoint.z - axle.right.contactPoint.z, axle.left.contactPoint.y - axle.right.contactPoint.y)
    : 0;
  const matrix = bodyToRoad(gF, gR, wb, roll);
  const rcF = axle?.rollCenter ? v3(0, axle.rollCenter.y, axle.rollCenter.z) : null;
  const rcRh = rear ? ((rear.left.rollCenterHeight ?? 0) + (rear.right.rollCenterHeight ?? 0)) / 2 : null;
  const rcR = rear && rcRh !== null ? v3(-wb, 0, gR + rcRh) : null;
  return { matrix, gF, gR, rcF, rcR, rcRh };
}

/** Etiketten in Fahrbahnkoordinaten, für die HTML-Ebene über der Szene. */
export function carLabels(c: Computed): { id: string; pos: THREE.Vector3; text: string }[] {
  const p = carPose(c);
  const out: { id: string; pos: THREE.Vector3; text: string }[] = [];
  if (p.rcF) out.push({ id: "va", pos: p.rcF.clone().applyMatrix4(p.matrix), text: `RZ VA ${fmtMm(c.axle?.rollCenterHeight ?? null, c.kinConfidence, true)}` });
  if (p.rcR && p.rcRh !== null) out.push({ id: "ha", pos: p.rcR.clone().applyMatrix4(p.matrix), text: `RZ HA ${fmtMm(p.rcRh, c.rearConfidence, true)}` });
  return out;
}

export function Car({ c, s, look }: { c: Computed; s: Setup; look: Look }) {
  const d = c.d;
  const wb = d.vehicle.wheelbase.value ?? 2725;
  const axle = c.axle ?? c.stockAxle;
  const rear = c.rear;
  const refF = d.wheels.current.front;
  const refR = d.wheels.current.rear;

  const { matrix, rcF, rcR } = useMemo(() => carPose(c), [c]);
  const zcF = refF.staticRadius;
  const zcR = refR.staticRadius;
  const archF = d.vehicle.stockHeightFront.value ?? 385;
  const archR = d.vehicle.stockHeightRear.value ?? 365;

  const { palette, opacity } = look;
  const v = d.vehicle;
  const dims = {
    length: v.bodyLength.value ?? 4488,
    width: v.bodyWidth.value ?? 1757,
    height: v.bodyHeight.value ?? 1369,
    wheelbase: wb,
    overhangFront: v.overhangFront.value ?? 790,
  };
  const halfW = dims.width / 2;
  const body = useMemo(
    () => buildE46Body(dims, { paint: new THREE.Color(palette.body) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dims.length, dims.width, dims.height, dims.wheelbase, dims.overhangFront, palette.body],
  );
  const details = useMemo(() => buildE46Details(body.model), [body]);
  const detailMats = useMemo(() => {
    const t = (o: number) => ({ transparent: true, opacity: o * opacity, depthWrite: false, side: THREE.DoubleSide });
    const mats: Record<DetailKind, THREE.Material> = {
      glass: new THREE.MeshStandardMaterial({ color: palette.glass, roughness: 0.05, metalness: 0.4, ...t(0.55) }),
      black: new THREE.MeshStandardMaterial({ color: "#14181b", roughness: 0.6, ...t(0.85) }),
      chrome: new THREE.MeshStandardMaterial({ color: "#d9dee2", roughness: 0.15, metalness: 0.9, ...t(0.9) }),
      lens: new THREE.MeshStandardMaterial({ color: "#e8f0f6", emissive: "#9fb4c4", emissiveIntensity: 0.25, roughness: 0.1, ...t(0.7) }),
      red: new THREE.MeshStandardMaterial({ color: "#b3121b", emissive: "#5a0508", emissiveIntensity: 0.4, roughness: 0.2, ...t(0.85) }),
      paint: new THREE.MeshStandardMaterial({ color: palette.body, roughness: 0.3, metalness: 0.3, ...t(0.5) }),
      white: new THREE.MeshStandardMaterial({ color: "#f2f2ee", roughness: 0.5, ...t(0.85) }),
      smoke: new THREE.MeshStandardMaterial({ color: "#3a3f44", roughness: 0.15, metalness: 0.3, ...t(0.85) }),
    };
    return mats;
  }, [opacity, palette.body, palette.glass]);
  const bodyMat = useMemo(
    () =>
      archCutMaterial({
        opacity: 0.3 * look.opacity,
        innerY: halfW * 0.55,
        arches: [
          { x: 0, z: zcF, r: archF },
          { x: -wb, z: zcR, r: archR },
        ],
      }),
    [look.opacity, halfW, zcF, zcR, archF, archR, wb],
  );

  const tf = c.fitFront.wheel.tire;
  const tr = c.fitRear.wheel.tire;
  const shiftF = wheelLateralShift(refF.et ?? s.wheels.front.et, s.wheels.front.et, s.wheels.front.spacer);
  const shiftR = wheelLateralShift(refR.et ?? s.wheels.rear.et, s.wheels.rear.et, s.wheels.rear.spacer);
  const axisPts = rcF && rcR ? [rcF.clone().lerp(rcR, -0.25), rcR.clone().lerp(rcF, -0.25)] : null;

  return (
    <group matrixAutoUpdate={false} matrix={matrix}>
      {look.showBody && (
        <>
          <mesh geometry={body.geometry} material={bodyMat} renderOrder={2} />
          {body.lines.map((pts, i) => (
            <Line key={`l${i}`} points={pts} color={palette.edge} lineWidth={1.2} transparent opacity={0.55 * opacity} />
          ))}
          {details.meshes.map((dm, i) => (
            <mesh key={`d${i}`} geometry={dm.geometry} material={detailMats[dm.kind]} renderOrder={3} />
          ))}
          {details.lines.map((dl, i) => (
            <Line
              key={`dl${i}`}
              points={dl.points}
              color={dl.kind === "chrome" ? "#c9d0d5" : dl.kind === "ring" ? "#ffffff" : dl.kind === "trim" ? "#15191c" : palette.edge}
              lineWidth={dl.kind === "ring" ? 2.2 : dl.kind === "chrome" ? 1.8 : dl.kind === "trim" ? 2.4 : 1}
              transparent
              opacity={(dl.kind === "seam" ? 0.6 : 0.95) * opacity}
            />
          ))}
          {[1, -1].flatMap((sd) => [
            <Line key={`f${sd}`} points={archEdge(0, zcF, archF, sd * (halfW - 8))} color={palette.edge} lineWidth={2.5} transparent opacity={opacity} />,
            <Line key={`r${sd}`} points={archEdge(-wb, zcR, archR, sd * (halfW - 8))} color={palette.edge} lineWidth={2.5} transparent opacity={opacity} />,
          ])}
        </>
      )}

      {axle && tf && (
        <>
          <FrontCorner s={axle.left} look={look} />
          <FrontCorner s={axle.right} look={look} />
          <Wheel
            center={v3(0, axle.left.wheelCenter.y + shiftF, axle.left.wheelCenter.z)}
            camberDeg={axle.left.camberBodyDeg}
            side={1}
            tire={tf}
            widthJ={s.wheels.front.widthJ}
            et={s.wheels.front.et}
            look={look}
            style={s.wheelStyle}
          />
          <Wheel
            center={v3(0, axle.right.wheelCenter.y - shiftF, axle.right.wheelCenter.z)}
            camberDeg={axle.right.camberBodyDeg}
            side={-1}
            tire={tf}
            widthJ={s.wheels.front.widthJ}
            et={s.wheels.front.et}
            look={look}
            style={s.wheelStyle}
          />
        </>
      )}

      {rear && tr && (
        <>
          <RearCorner r={rear.left} x={-wb} mirror={false} look={look} />
          <RearCorner r={rear.right} x={-wb} mirror look={look} />
          <Wheel
            center={v3(-wb, rear.left.wheelCenter.y + shiftR, rear.left.wheelCenter.z)}
            camberDeg={rear.left.camberBodyDeg}
            side={1}
            tire={tr}
            widthJ={s.wheels.rear.widthJ}
            et={s.wheels.rear.et}
            look={look}
            style={s.wheelStyle}
          />
          <Wheel
            center={v3(-wb, -(rear.right.wheelCenter.y + shiftR), rear.right.wheelCenter.z)}
            camberDeg={rear.right.camberBodyDeg}
            side={-1}
            tire={tr}
            widthJ={s.wheels.rear.widthJ}
            et={s.wheels.rear.et}
            look={look}
            style={s.wheelStyle}
          />
        </>
      )}

      {/* Rollzentren und Rollachse */}
      {rcF && <Joint p={rcF} r={34} color={palette.rc} opacity={opacity} />}
      {rcR && <Joint p={rcR} r={34} color={palette.rc} opacity={opacity} />}
      {axisPts && <Line points={axisPts} color={palette.rc} lineWidth={3} dashed={opacity < 1} dashSize={80} gapSize={50} transparent opacity={opacity} />}
    </group>
  );
}
