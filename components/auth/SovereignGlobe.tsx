'use client';
/**
 * SovereignGlobe — Cinematic Earth-from-Space
 * Earth positioned on LEFT half of screen (camera aims right).
 * North Africa (Libya/Egypt/Tunisia) targeted after rotation settles.
 * Canvas alpha:true — CSS nebula gradient visible on right half.
 *
 * Rotation calibration (Three.js SphereGeometry UV mapping):
 *   Camera at +Z sees Earth local direction (-sin(earthY), 0, cos(earthY))
 *   For lon=20°E (Libya): phi=3.49rad → earthY=-1.93 rad
 *   For lat=28°N at center: earthX=+0.49 rad (positive = N.Pole toward camera)
 */
import { useEffect, useRef } from 'react';

interface Props {
  onReady?: () => void;
  skipIntro?: boolean;
}

const ATMO_VERT = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const ATMO_FRAG = `
  varying vec3 vNormal;
  void main() {
    float i = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.5);
    gl_FragColor = vec4(0.15, 0.50, 1.0, 1.0) * i;
  }
`;

// Target: North Africa visible, Earth fills left ~60% of screen
const SETTLED = {
  camX:    0.0,
  camY:    0.25,
  camZ:    2.35,   // close enough to see curvature prominently
  // Camera looks slightly RIGHT → Earth appears on LEFT
  lookAtX: 0.38,
  lookAtY: -0.05,
  // Earth rotation targets Libya / North Africa (lon≈20°E, lat≈28°N)
  earthY: -1.93,  // lon=20°E faces camera
  earthX:  0.49,  // lat=28°N at vertical center
};

export default function SovereignGlobe({ onReady, skipIntro = false }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cbRef    = useRef(onReady);
  cbRef.current  = onReady;

  useEffect(() => {
    if (typeof window === 'undefined' || !mountRef.current) return;
    try {
      const t = document.createElement('canvas');
      if (!t.getContext('webgl') && !t.getContext('experimental-webgl')) return;
    } catch { return; }

    let rafId    = 0;
    let renderer: any = null;

    const run = async () => {
      const [THREE, { gsap }] = await Promise.all([import('three'), import('gsap')]);
      const mount = mountRef.current;
      if (!mount) return;

      // ── Renderer (alpha → CSS bg shows through) ──────────────────────────────
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping         = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;
      mount.appendChild(renderer.domElement);

      const scene  = new THREE.Scene();
      const aspect = window.innerWidth / window.innerHeight;
      const camera = new THREE.PerspectiveCamera(50, aspect, 0.01, 2000);

      // Deep space start vs settled
      if (skipIntro) {
        camera.position.set(SETTLED.camX, SETTLED.camY, SETTLED.camZ);
      } else {
        camera.position.set(0.5, 1.2, 10.5);   // very far — tiny Earth
      }

      // ── Lighting ─────────────────────────────────────────────────────────────
      // Sun: top-right, warm white (matches reference image)
      const sun = new THREE.DirectionalLight(0xfff5e0, 4.2);
      sun.position.set(5, 4, 3);
      scene.add(sun);
      scene.add(new THREE.AmbientLight(0x060c1a, 1.2));

      // ── Starfield ────────────────────────────────────────────────────────────
      const mkStars = (count: number, spread: number, size: number, opacity: number) => {
        const v: number[] = [];
        for (let i = 0; i < count; i++) {
          const r  = spread * (0.55 + Math.random() * 0.45);
          const th = Math.random() * Math.PI * 2;
          const ph = Math.acos(2 * Math.random() - 1);
          v.push(r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph));
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
        return new THREE.Points(geo, new THREE.PointsMaterial({
          color: 0xffffff, size, sizeAttenuation: true, transparent: true, opacity,
        }));
      };
      const stars1 = mkStars(16000, 700, 0.55, 0.82);  // distant faint
      const stars2 = mkStars(3500,  300, 0.95, 0.96);  // nearby bright
      scene.add(stars1, stars2);

      // Subtle starfield parallax
      gsap.to(stars1.rotation, {
        y: 0.05, x: 0.02, duration: 22, ease: 'sine.inOut', repeat: -1, yoyo: true,
      });

      // ── Textures ─────────────────────────────────────────────────────────────
      const loader = new THREE.TextureLoader();
      const load   = (u: string) => loader.loadAsync(u).catch(() => null);
      const [dayTex, nightTex, cloudsTex, bumpTex] = await Promise.all([
        load('/earth/earth-day.jpg'),
        load('/earth/earth-night.png'),
        load('/earth/earth-clouds-alpha.png'),
        load('/earth/topology.png'),
      ]);

      // ── Earth sphere ──────────────────────────────────────────────────────────
      const earthMat = new THREE.MeshStandardMaterial({
        map:       dayTex   || undefined,
        roughness: 0.60,
        metalness: 0.0,
        ...(nightTex ? {
          emissiveMap:       nightTex,
          emissive:          new THREE.Color(0xffcc44),
          emissiveIntensity: 0.52,
        } : {}),
        ...(bumpTex ? {
          bumpMap:      bumpTex,
          bumpScale:    0.03,
          roughnessMap: bumpTex,
        } : {}),
      });
      const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 128), earthMat);

      // ── Cloud layer ───────────────────────────────────────────────────────────
      let clouds: THREE.Mesh | null = null;
      if (cloudsTex) {
        clouds = new THREE.Mesh(
          new THREE.SphereGeometry(1.018, 64, 64),
          new THREE.MeshStandardMaterial({
            map: cloudsTex, transparent: true, opacity: 0.48, depthWrite: false,
          }),
        );
        scene.add(clouds);
      }

      // ── Atmospheric rim glow ──────────────────────────────────────────────────
      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(1.28, 64, 64),
        new THREE.ShaderMaterial({
          vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG,
          side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true,
        }),
      );
      scene.add(atmo);
      scene.add(earth);

      // ── Earth rotation start ──────────────────────────────────────────────────
      const startEarthY = skipIntro ? SETTLED.earthY : SETTLED.earthY - 1.8;  // start showing Atlantic
      const startEarthX = skipIntro ? SETTLED.earthX : SETTLED.earthX + 0.1;
      earth.rotation.set(startEarthX, startEarthY, 0);
      if (clouds) clouds.rotation.set(startEarthX, startEarthY, 0);

      // ── Resize ────────────────────────────────────────────────────────────────
      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', onResize);

      // Live lookAt target (animated)
      const lookTarget = { x: 0.0, y: 0.0 };

      // ── GSAP Cinematic Timeline ───────────────────────────────────────────────
      let settled = skipIntro;

      if (!skipIntro) {
        const tl = gsap.timeline({
          onComplete: () => { settled = true; cbRef.current?.(); },
        });

        // Phase 1 (0→2.5s): camera rushes from deep space toward Earth
        tl.to(camera.position, {
          x: SETTLED.camX + 0.3, y: SETTLED.camY + 0.3, z: SETTLED.camZ + 1.8,
          duration: 2.5, ease: 'power2.out',
        }, 0);

        // Phase 2 (1.2→4.8s): Earth rotates to bring North Africa to center-left
        tl.to(earth.rotation, {
          y: SETTLED.earthY, x: SETTLED.earthX,
          duration: 3.6, ease: 'power3.out',
        }, 1.2);
        if (clouds) {
          tl.to(clouds.rotation, {
            y: SETTLED.earthY, x: SETTLED.earthX,
            duration: 3.6, ease: 'power3.out',
          }, 1.2);
        }

        // Phase 2b: camera aim drifts right (Earth moves to left of screen)
        tl.to(lookTarget, {
          x: SETTLED.lookAtX, y: SETTLED.lookAtY,
          duration: 3.0, ease: 'power2.inOut',
        }, 1.5);

        // Phase 3 (4→5.8s): final precision settle
        tl.to(camera.position, {
          x: SETTLED.camX, y: SETTLED.camY, z: SETTLED.camZ,
          duration: 1.8, ease: 'expo.out',
        }, 4.0);

      } else {
        lookTarget.x = SETTLED.lookAtX;
        lookTarget.y = SETTLED.lookAtY;
        setTimeout(() => cbRef.current?.(), 80);
      }

      // ── Render loop ───────────────────────────────────────────────────────────
      const animate = (ts: number) => {
        rafId = requestAnimationFrame(animate);

        if (settled) {
          // Very slow idle drift
          earth.rotation.y  += 0.000055;
          if (clouds) clouds.rotation.y += 0.000072;
        }

        camera.lookAt(lookTarget.x, lookTarget.y, 0);
        renderer.render(scene, camera);
      };
      rafId = requestAnimationFrame(animate);

      return () => window.removeEventListener('resize', onResize);
    };

    let cleanup: (() => void) | undefined;
    run().then(fn => { cleanup = fn; });
    return () => {
      cancelAnimationFrame(rafId);
      cleanup?.();
      if (renderer) { renderer.dispose(); renderer.domElement?.remove(); }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={mountRef} className="absolute inset-0" />;
}
