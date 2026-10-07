import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Course } from '../domain/course';
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
        <p role='alert' className='rounded border border-red-500 p-4'>
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
    const g = canvas.getContext('2d');
    if (g) {
      g.fillStyle = 'rgba(15, 23, 42, 0.85)';
      g.fillRect(0, 0, 128, 64);
      g.fillStyle = '#ffffff';
      g.font = 'bold 34px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, 64, 34);
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
  const ref = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    ref.current = controls;
    return () => {
      controls.dispose();
      ref.current = null;
    };
  }, [camera, gl]);
  useFrame(() => ref.current?.update());
  useEffect(() => {
    camera.position.set(view.position[0], view.position[1], view.position[2]);
    ref.current?.target.set(view.target[0], view.target[1], view.target[2]);
    camera.lookAt(view.target[0], view.target[1], view.target[2]);
    ref.current?.update();
  }, [camera, view, resetKey]);
  return null;
}

interface ContentProps {
  model: SceneModel;
  wireframe: boolean;
  grid: boolean;
  labels: boolean;
  skierPath?: Vec3[];
}

function SceneContents({ model, wireframe, grid, labels, skierPath }: ContentProps) {
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
        <meshStandardMaterial color='#e8f1f8' wireframe={wireframe} side={THREE.DoubleSide} />
      </mesh>
      {grid && (
        <group rotation={[surface.angleRad, 0, 0]} position={[0, 0.02, 0]}>
          <gridHelper args={[d, Math.round(d), '#64748b', '#94a3b8']} />
        </group>
      )}
      {model.poles.map((p) => (
        <mesh
          key={p.id}
          position={[p.position[0], p.position[1] + p.height / 2, p.position[2]]}
          castShadow
        >
          <cylinderGeometry args={[p.radius, p.radius, p.height, 12]} />
          <meshStandardMaterial color={p.colour} />
        </mesh>
      ))}
      {[...model.panels, ...model.bars].map((b) => (
        <mesh key={b.id} position={b.position} rotation={[0, b.yaw, 0]} castShadow>
          <boxGeometry args={b.size} />
          <meshStandardMaterial color={b.colour} />
        </mesh>
      ))}
      {model.hazards.map((h) => (
        <group key={h.id} position={h.position} rotation={[surface.angleRad, 0, 0]}>
          <mesh position={[0, 0.03, 0]} rotation={[0, h.yaw, 0]}>
            <boxGeometry args={[h.size[0], 0.04, h.size[1]]} />
            <meshStandardMaterial color={h.colour} transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
      {labels && model.labels.map((l) => <Label key={l.id} text={l.text} position={l.position} />)}
      {model.courseLine.length > 1 && <PolyLine points={model.courseLine} colour='#0ea5e9' />}
      {skierPath && skierPath.length > 1 && <PolyLine points={skierPath} colour='#f97316' />}
    </>
  );
}

const PRESETS: CameraPreset[] = ['orbit', 'top', 'side', 'first_person'];
const btn = 'rounded border border-slate-400 px-3 py-1 text-sm';

export default function Scene3D({ course, skierPath }: { course: Course; skierPath?: Vec3[] }) {
  const model = useMemo(() => buildSceneModel(course), [course]);
  const [preset, setPreset] = useState<CameraPreset>('orbit');
  const [resetKey, setResetKey] = useState(0);
  const [wireframe, setWireframe] = useState(false);
  const [grid, setGrid] = useState(true);
  const [labels, setLabels] = useState(true);
  const view = useMemo(() => cameraPreset(course, preset), [course, preset]);
  const d = Math.max(course.width, course.length);

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center gap-2' role='toolbar' aria-label='3D view controls'>
        {PRESETS.map((p) => (
          <button
            key={p}
            type='button'
            className={`${btn} ${preset === p ? 'bg-sky-700 text-white' : ''}`}
            aria-pressed={preset === p}
            onClick={() => setPreset(p)}
          >
            {CAMERA_LABELS[p]}
          </button>
        ))}
        <button type='button' className={btn} onClick={() => setResetKey((k) => k + 1)}>
          Reset camera
        </button>
        <label className='text-sm'>
          <input type='checkbox' checked={wireframe} onChange={(e) => setWireframe(e.target.checked)} />{' '}
          Wireframe
        </label>
        <label className='text-sm'>
          <input type='checkbox' checked={grid} onChange={(e) => setGrid(e.target.checked)} /> Grid
        </label>
        <label className='text-sm'>
          <input type='checkbox' checked={labels} onChange={(e) => setLabels(e.target.checked)} />{' '}
          Labels
        </label>
      </div>
      <div className='h-[65vh] min-h-[320px] w-full overflow-hidden rounded border border-slate-400'>
        <WebGLBoundary>
          <Canvas shadows camera={{ position: view.position, fov: 50, near: 0.1, far: d * 20 + 500 }}>
            <Controls view={view} resetKey={resetKey} />
            <SceneContents
              model={model}
              wireframe={wireframe}
              grid={grid}
              labels={labels}
              skierPath={skierPath}
            />
          </Canvas>
        </WebGLBoundary>
      </div>
      <ul className='rounded border border-amber-500 p-3 text-sm'>
        {model.warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
        {!skierPath && <li>No skier path yet: it appears once a run has been tracked from video.</li>}
      </ul>
    </div>
  );
}
