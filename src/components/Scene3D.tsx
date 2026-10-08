import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Course } from '../domain/course';
import type { Run } from '../domain/run';
import { defaultPath, pathToWorld, smoothPath } from '../domain/path';
import {
  CAMERA_LABELS,
  buildSceneModel,
  cameraPreset,
  type CameraPreset,
  type CameraView,
  type SceneModel,
  type Vec3,
} from '../domain/scene';

class WebGLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <p role="alert" className="rounded border border-red-500 p-4">
          The 3D view could not start. Your browser or device may not support WebGL.
        </p>
      );
    }
    return this.props.children;
  }
}

function Label({ text, position }: { text: string; position: Vec3 }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;

    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = 'rgba(15, 23, 42, 0.85)';
      context.fillRect(0, 0, 128, 64);
      context.fillStyle = '#ffffff';
      context.font = 'bold 34px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, 64, 34);
    }

    return new THREE.CanvasTexture(canvas);
  }, [text]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={position} scale={[1.6, 0.8, 1]}>
      <spriteMaterial map={texture} depthTest={false} transparent />
    </sprite>
  );
}

function PolyLine({ points, colour }: { points: Vec3[]; colour: string }) {
  const object = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    );

    return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: colour }));
  }, [points, colour]);

  useEffect(
    () => () => {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    },
    [object],
  );

  return <primitive object={object} />;
}

function Controls({ view, resetKey }: { view: CameraView; resetKey: number }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl]);

  useFrame(() => controlsRef.current?.update());

  useEffect(() => {
    camera.position.set(view.position[0], view.position[1], view.position[2]);
    controlsRef.current?.target.set(view.target[0], view.target[1], view.target[2]);
    camera.lookAt(view.target[0], view.target[1], view.target[2]);
    controlsRef.current?.update();
  }, [camera, view, resetKey]);

  return null;
}

function interpolatePath(points: Vec3[], progress: number): Vec3 {
  if (points.length === 0) return [0, 0, 0];
  if (points.length === 1) return points[0];

  const clamped = Math.max(0, Math.min(1, progress));
  const lengths: number[] = [];
  let total = 0;

  for (let i = 1; i < points.length; i += 1) {
    const length = Math.hypot(
      points[i][0] - points[i - 1][0],
      points[i][1] - points[i - 1][1],
      points[i][2] - points[i - 1][2],
    );

    lengths.push(length);
    total += length;
  }

  if (total <= 0) return points[0];

  let distance = clamped * total;

  for (let i = 0; i < lengths.length; i += 1) {
    if (distance <= lengths[i]) {
      const ratio = lengths[i] === 0 ? 0 : distance / lengths[i];
      const a = points[i];
      const b = points[i + 1];

      return [
        a[0] + (b[0] - a[0]) * ratio,
        a[1] + (b[1] - a[1]) * ratio,
        a[2] + (b[2] - a[2]) * ratio,
      ];
    }

    distance -= lengths[i];
  }

  return points[points.length - 1];
}

interface SkierProps {
  path: Vec3[];
  playing: boolean;
  speed: number;
  resetKey: number;
  onProgress: (progress: number) => void;
  onFinish: () => void;
}

function Skier({ path, playing, speed, resetKey, onProgress, onFinish }: SkierProps) {
  const groupRef = useRef<THREE.Group>(null);
  const leftLowerLegRef = useRef<THREE.Mesh>(null);
  const rightLowerLegRef = useRef<THREE.Mesh>(null);
  const progressRef = useRef(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    progressRef.current = 0;
    finishedRef.current = false;
    onProgress(0);
  }, [path, resetKey, onProgress]);

  useFrame((state, delta) => {
    if (!groupRef.current || path.length === 0) return;

    if (playing) {
      progressRef.current = Math.min(1, progressRef.current + delta * speed * 0.08);
      onProgress(progressRef.current);
      if (progressRef.current >= 1 && !finishedRef.current) {
        finishedRef.current = true;
        onFinish();
      }
    }

    const t = progressRef.current;
    const pos = interpolatePath(path, t);
    const eps = 0.02;
    const prev = interpolatePath(path, Math.max(0, t - eps));
    const next = interpolatePath(path, Math.min(1, t + eps));

    groupRef.current.position.set(pos[0], pos[1] + 0.65, pos[2]);

    const lookTarget = new THREE.Vector3(next[0], next[1] + 0.65, next[2]);
    groupRef.current.lookAt(lookTarget);

    const forwardX = next[0] - prev[0];
    const forwardZ = next[2] - prev[2];
    const forwardLen = Math.hypot(forwardX, forwardZ);
    if (forwardLen > 0.001 && t > 0 && t < 1) {
      const fnx = forwardX / forwardLen;
      const fnz = forwardZ / forwardLen;

      const prevForwardX = pos[0] - prev[0];
      const prevForwardZ = pos[2] - prev[2];
      const prevLen = Math.hypot(prevForwardX, prevForwardZ);
      if (prevLen > 0.001) {
        const pfnx = prevForwardX / prevLen;
        const pfnz = prevForwardZ / prevLen;
        const crossY = pfnx * fnz - pfnz * fnx;
        const dot = pfnx * fnx + pfnz * fnz;
        const turnAngle = Math.atan2(crossY, dot);

        const leanAxis = new THREE.Vector3(fnz, 0, -fnx);
        const leanAngle = THREE.MathUtils.clamp(turnAngle * 0.45, -0.5, 0.5);
        groupRef.current.rotateOnWorldAxis(leanAxis, leanAngle);
      }
    }

    const kneeFlex = Math.sin(state.clock.getElapsedTime() * 6) * 0.08;
    if (leftLowerLegRef.current) leftLowerLegRef.current.rotation.x = kneeFlex;
    if (rightLowerLegRef.current) rightLowerLegRef.current.rotation.x = -kneeFlex;
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow receiveShadow position={[0, 0.98, 0]}>
        <sphereGeometry args={[0.2, 12, 10]} />
        <meshStandardMaterial color="#111827" />
      </mesh>

      <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
        <capsuleGeometry args={[0.2, 0.4, 5, 8]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>

      <mesh castShadow receiveShadow position={[0, 0.25, 0]}>
        <boxGeometry args={[0.3, 0.15, 0.25]} />
        <meshStandardMaterial color="#ea580c" />
      </mesh>

      <group position={[-0.08, 0.25, 0]}>
        <mesh castShadow receiveShadow position={[0, -0.25, 0]}>
          <boxGeometry args={[0.09, 0.45, 0.11]} />
          <meshStandardMaterial color="#2563eb" />
        </mesh>
        <mesh ref={leftLowerLegRef} castShadow receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[0.09, 0.35, 0.11]} />
          <meshStandardMaterial color="#2563eb" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, -0.72, 0]}>
          <boxGeometry args={[0.12, 0.12, 0.2]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        <mesh receiveShadow position={[0, -0.76, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.1, 1.2, 0.03]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
      </group>

      <group position={[0.08, 0.25, 0]}>
        <mesh castShadow receiveShadow position={[0, -0.25, 0]}>
          <boxGeometry args={[0.09, 0.45, 0.11]} />
          <meshStandardMaterial color="#2563eb" />
        </mesh>
        <mesh ref={rightLowerLegRef} castShadow receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[0.09, 0.35, 0.11]} />
          <meshStandardMaterial color="#2563eb" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, -0.72, 0]}>
          <boxGeometry args={[0.12, 0.12, 0.2]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        <mesh receiveShadow position={[0, -0.76, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.1, 1.2, 0.03]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
      </group>

      <mesh castShadow receiveShadow position={[-0.25, 0.5, 0]}>
        <boxGeometry args={[0.07, 0.4, 0.07]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
      <mesh castShadow receiveShadow position={[-0.28, 0.12, 0]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>

      <mesh castShadow receiveShadow position={[0.25, 0.5, 0]}>
        <boxGeometry args={[0.07, 0.4, 0.07]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
      <mesh castShadow receiveShadow position={[0.28, 0.12, 0]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>

      <mesh castShadow receiveShadow position={[-0.18, 0.15, -0.25]} rotation={[0.15, 0, -0.15]}>
        <cylinderGeometry args={[0.015, 0.02, 0.9, 6]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh castShadow receiveShadow position={[0.18, 0.15, -0.25]} rotation={[0.15, 0, 0.15]}>
        <cylinderGeometry args={[0.015, 0.02, 0.9, 6]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
    </group>
  );
}

interface ContentProps {
  model: SceneModel;
  wireframe: boolean;
  grid: boolean;
  labels: boolean;
  skierPath: Vec3[];
  playing: boolean;
  speed: number;
  resetKey: number;
  onProgress: (progress: number) => void;
  onFinish: () => void;
}

function SceneContents({
  model,
  wireframe,
  grid,
  labels,
  skierPath,
  playing,
  speed,
  resetKey,
  onProgress,
  onFinish,
}: ContentProps) {
  const { surface } = model;
  const d = Math.max(surface.width, surface.length);

  return (
    <>
      <ambientLight intensity={0.6} />

      <directionalLight
        position={[d, d * 1.5, -d]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-d}
        shadow-camera-right={d}
        shadow-camera-top={d}
        shadow-camera-bottom={-d}
        shadow-camera-near={0.5}
        shadow-camera-far={d * 6}
      />

      <mesh rotation={[surface.angleRad - Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[surface.width, surface.length]} />
        <meshStandardMaterial color="#e8f1f8" wireframe={wireframe} side={THREE.DoubleSide} />
      </mesh>

      {grid && (
        <group rotation={[surface.angleRad, 0, 0]} position={[0, 0.02, 0]}>
          <gridHelper args={[d, Math.round(d), '#64748b', '#94a3b8']} />
        </group>
      )}

      {model.poles.map((pole) => (
        <mesh
          key={pole.id}
          position={[pole.position[0], pole.position[1] + pole.height / 2, pole.position[2]]}
          castShadow
        >
          <cylinderGeometry args={[pole.radius, pole.radius, pole.height, 12]} />
          <meshStandardMaterial color={pole.colour} />
        </mesh>
      ))}

      {[...model.panels, ...model.bars].map((bar) => (
        <mesh key={bar.id} position={bar.position} rotation={[0, bar.yaw, 0]} castShadow>
          <boxGeometry args={bar.size} />
          <meshStandardMaterial color={bar.colour} />
        </mesh>
      ))}

      {model.hazards.map((hazard) => (
        <group key={hazard.id} position={hazard.position} rotation={[surface.angleRad, 0, 0]}>
          <mesh position={[0, 0.03, 0]} rotation={[0, hazard.yaw, 0]}>
            <boxGeometry args={[hazard.size[0], 0.04, hazard.size[1]]} />
            <meshStandardMaterial color={hazard.colour} transparent opacity={0.5} />
          </mesh>
        </group>
      ))}

      {labels &&
        model.labels.map((label) => (
          <Label key={label.id} text={label.text} position={label.position} />
        ))}

      {model.courseLine.length > 1 && <PolyLine points={model.courseLine} colour="#0ea5e9" />}

      {skierPath.length > 1 && (
        <>
          <PolyLine points={skierPath} colour="#f97316" />
          <Skier
            path={skierPath}
            playing={playing}
            speed={speed}
            resetKey={resetKey}
            onProgress={onProgress}
            onFinish={onFinish}
          />
        </>
      )}
    </>
  );
}

const PRESETS: CameraPreset[] = ['orbit', 'top', 'side', 'first_person'];
const btn = 'rounded border border-slate-400 px-3 py-1 text-sm';

export default function Scene3D({ course, run }: { course: Course; run?: Run }) {
  const model = useMemo(() => buildSceneModel(course), [course]);
  const isCustomPath = run !== undefined && run.path.length > 0;
  const skierPath = useMemo(() => {
    const source = run && run.path.length > 0 ? run.path : defaultPath(course);
    const smoothed = smoothPath(source, 8);
    return pathToWorld(course, smoothed);
  }, [course, run]);

  const [preset, setPreset] = useState<CameraPreset>('orbit');
  const [resetKey, setResetKey] = useState(0);
  const [wireframe, setWireframe] = useState(false);
  const [grid, setGrid] = useState(true);
  const [labels, setLabels] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);

  const view = useMemo(() => cameraPreset(course, preset), [course, preset]);

  const d = Math.max(course.width, course.length);

  const resetPlayback = () => {
    setPlaying(false);
    setProgress(0);
    setResetKey((key) => key + 1);
  };

  const handleProgressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPlaying(false);
    setProgress(Number(event.target.value));
    setResetKey((key) => key + 1);
  };

  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap items-center gap-2"
        role="toolbar"
        aria-label="3D view controls"
      >
        {PRESETS.map((presetName) => (
          <button
            key={presetName}
            type="button"
            className={`${btn} ${preset === presetName ? 'bg-sky-700 text-white' : ''}`}
            aria-pressed={preset === presetName}
            onClick={() => setPreset(presetName)}
          >
            {CAMERA_LABELS[presetName]}
          </button>
        ))}

        <button type="button" className={btn} onClick={() => setResetKey((key) => key + 1)}>
          Reset camera
        </button>

        <label className="text-sm">
          <input
            type="checkbox"
            checked={wireframe}
            onChange={(event) => setWireframe(event.target.checked)}
          />{' '}
          Wireframe
        </label>

        <label className="text-sm">
          <input
            type="checkbox"
            checked={grid}
            onChange={(event) => setGrid(event.target.checked)}
          />{' '}
          Grid
        </label>

        <label className="text-sm">
          <input
            type="checkbox"
            checked={labels}
            onChange={(event) => setLabels(event.target.checked)}
          />{' '}
          Labels
        </label>
      </div>

      <section className="flex flex-wrap items-center gap-2 rounded border border-slate-400 p-3">
        <strong className="mr-2">Skier playback</strong>

        <button
          type="button"
          className="rounded bg-sky-700 px-3 py-1 text-sm text-white"
          onClick={() => setPlaying((value) => !value)}
          disabled={skierPath.length < 2}
        >
          {playing ? 'Pause' : 'Play'}
        </button>

        <button
          type="button"
          className={btn}
          onClick={resetPlayback}
          disabled={skierPath.length < 2}
        >
          Reset skier
        </button>

        <label className="text-sm">
          Speed{' '}
          <select
            className="rounded border border-slate-400 bg-white p-1 dark:bg-slate-800"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </label>

        <label className="min-w-48 flex-1 text-sm">
          Progress
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            onChange={handleProgressChange}
            className="ml-2 align-middle"
          />
        </label>

        <span className="text-sm">{Math.round(progress * 100)}%</span>
      </section>

      <div className="h-[65vh] min-h-[320px] w-full overflow-hidden rounded border border-slate-400">
        <WebGLBoundary>
          <Canvas
            shadows
            camera={{
              position: view.position,
              fov: 50,
              near: 0.1,
              far: d * 20 + 500,
            }}
          >
            <Controls view={view} resetKey={resetKey} />

            <SceneContents
              model={model}
              wireframe={wireframe}
              grid={grid}
              labels={labels}
              skierPath={skierPath}
              playing={playing}
              speed={speed}
              resetKey={resetKey}
              onProgress={setProgress}
              onFinish={resetPlayback}
            />
          </Canvas>
        </WebGLBoundary>
      </div>

      <ul className="rounded border border-amber-500 p-3 text-sm">
        {model.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}

        {skierPath.length < 2 && (
          <li>Add a start, at least one numbered gate, and a finish to enable skier playback.</li>
        )}

        {run && (
          <li>
            Path source: {isCustomPath ? 'custom route for this run' : 'default course route'}
            {isCustomPath && ' (edit in the Runs tab under "Edit run")'}.
          </li>
        )}

        <li>
          Playback follows the route in the 3D scene and is a visual simulation, not an actual
          recorded skier trajectory.
        </li>
      </ul>
    </div>
  );
}
