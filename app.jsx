const { useEffect, useMemo, useRef, useState } = React;

function createNoiseTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function useImmersiveHoliScene(palette, energy) {
  useEffect(() => {
    const mount = document.getElementById("bg-canvas-wrap");
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1200);
    camera.position.z = 36;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearAlpha(0);
    mount.appendChild(renderer.domElement);

    const mouse = new THREE.Vector2(0, 0);
    const targetRot = new THREE.Vector2(0, 0);

    const group = new THREE.Group();
    scene.add(group);

    const pointsCount = window.innerWidth < 760 ? 2600 : 4200;
    const positions = new Float32Array(pointsCount * 3);
    const colors = new Float32Array(pointsCount * 3);
    const sizes = new Float32Array(pointsCount);

    const c1 = new THREE.Color(palette[0]);
    const c2 = new THREE.Color(palette[1]);
    const c3 = new THREE.Color(palette[2]);
    const c4 = new THREE.Color(palette[3]);

    for (let i = 0; i < pointsCount; i += 1) {
      const i3 = i * 3;
      const r = Math.random() * 24 + 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi) * (Math.random() * 1.7);

      const t = Math.random();
      const base = t < 0.25 ? c1 : t < 0.5 ? c2 : t < 0.75 ? c3 : c4;
      colors[i3] = base.r;
      colors[i3 + 1] = base.g;
      colors[i3 + 2] = base.b;
      sizes[i] = Math.random() * 1.5 + 0.5;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const particleMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: energy },
      },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        uniform float uTime;
        uniform float uEnergy;
        void main() {
          vColor = color;
          vec3 p = position;
          float wave = sin(uTime * 0.6 + p.x * 0.18 + p.y * 0.08) * 0.9;
          float orbit = cos(uTime * 0.3 + p.z * 0.25) * 0.55;
          p.x += wave * (0.7 + uEnergy * 0.012);
          p.y += orbit * (0.8 + uEnergy * 0.012);
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = size * (280.0 / -mvPosition.z) * (1.0 + uEnergy * 0.003);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = distance(gl_PointCoord, vec2(0.5));
          float alpha = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor, alpha * 0.95);
        }
      `,
      vertexColors: true,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    group.add(particles);

    const noiseTexture = createNoiseTexture(128);
    const haloMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uNoise: { value: noiseTexture },
        uColorA: { value: c1 },
        uColorB: { value: c3 },
        uEnergy: { value: energy },
      },
      vertexShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uEnergy;
        void main() {
          vUv = uv;
          vec3 p = position;
          float f = sin((p.x + p.y) * 0.4 + uTime * 0.55) * (0.7 + uEnergy * 0.006);
          p.z += f;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uNoise;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform float uTime;
        uniform float uEnergy;
        void main() {
          vec2 uv = vUv;
          float n1 = texture2D(uNoise, uv * 2.0 + vec2(uTime * 0.03, -uTime * 0.02)).r;
          float n2 = texture2D(uNoise, uv * 3.8 - vec2(uTime * 0.02, uTime * 0.025)).r;
          float mixV = smoothstep(0.15, 0.95, n1 * 0.7 + n2 * 0.7);
          vec3 color = mix(uColorA, uColorB, mixV);
          float alpha = (0.22 + uEnergy * 0.002) * smoothstep(1.0, 0.2, length(uv - 0.5));
          gl_FragColor = vec4(color, alpha);
        }
      `,
      blending: THREE.AdditiveBlending,
    });

    const halo = new THREE.Mesh(new THREE.PlaneGeometry(80, 80, 64, 64), haloMaterial);
    halo.position.z = -10;
    scene.add(halo);

    const light = new THREE.PointLight("#ffffff", 2.4, 220);
    light.position.set(0, 10, 28);
    scene.add(light);

    const clock = new THREE.Clock();

    const onPointerMove = (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      targetRot.x = mouse.y * 0.28;
      targetRot.y = mouse.x * 0.35;
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("resize", onResize);

    let frame;
    const animate = () => {
      const t = clock.getElapsedTime();
      particleMaterial.uniforms.uTime.value = t;
      particleMaterial.uniforms.uEnergy.value += (energy - particleMaterial.uniforms.uEnergy.value) * 0.03;
      haloMaterial.uniforms.uTime.value = t;
      haloMaterial.uniforms.uEnergy.value += (energy - haloMaterial.uniforms.uEnergy.value) * 0.03;

      group.rotation.x += (targetRot.x - group.rotation.x) * 0.05;
      group.rotation.y += (targetRot.y - group.rotation.y) * 0.05;
      group.rotation.z = Math.sin(t * 0.15) * 0.15;
      particles.rotation.y += 0.0018 + energy * 0.000015;
      halo.rotation.z = -t * 0.05;
      halo.scale.setScalar(1 + Math.sin(t * 0.6) * 0.035 + energy * 0.00045);

      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      noiseTexture.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      halo.geometry.dispose();
      haloMaterial.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [palette, energy]);
}

function App() {
  const palettes = useMemo(
    () => [
      ["#ff2e88", "#ffd166", "#00f5ff", "#8b5cf6"],
      ["#00ffa3", "#ff006e", "#ffd60a", "#4cc9f0"],
      ["#f72585", "#7209b7", "#3a0ca3", "#4cc9f0"],
      ["#f15bb5", "#fee440", "#00bbf9", "#00f5d4"],
    ],
    []
  );

  const [palette, setPalette] = useState(palettes[0]);
  const [meter, setMeter] = useState(28);
  const [energy, setEnergy] = useState(24);
  const [bursts, setBursts] = useState(0);
  const [mode, setMode] = useState("festival");
  const meterRef = useRef(null);

  useImmersiveHoliScene(palette, energy);

  const pulseUI = (intensity = 1) => {
    anime({
      targets: ".card, .meter-area, .cta-wrap, .interactive-pad",
      translateY: [0, -8 * intensity, 0],
      scale: [1, 1 + 0.015 * intensity, 1],
      duration: 600,
      easing: "easeOutElastic(1, .6)",
      delay: anime.stagger(60),
    });
  };

  const colorBlast = (boost = 14) => {
    const nextMeter = Math.min(100, meter + boost);
    const nextEnergy = Math.min(100, energy + boost * 0.9);
    setMeter(nextMeter);
    setEnergy(nextEnergy);
    setBursts((v) => v + 1);
    pulseUI(Math.min(2.6, boost / 10));

    anime({
      targets: ".floating-chip",
      translateY: [0, -10, 0],
      opacity: [1, 0.4, 1],
      duration: 550,
      easing: "easeOutQuad",
      delay: anime.stagger(40),
    });
  };

  const randomizePalette = () => {
    const next = palettes[Math.floor(Math.random() * palettes.length)];
    setPalette(next);
    colorBlast(18);

    anime({
      targets: ":root",
      duration: 700,
      easing: "linear",
      update: () => {
        document.documentElement.style.setProperty("--accent-1", next[0]);
        document.documentElement.style.setProperty("--accent-2", next[1]);
        document.documentElement.style.setProperty("--accent-3", next[2]);
      },
    });
  };

  const toggleMode = () => {
    const nextMode = mode === "festival" ? "neon-night" : "festival";
    setMode(nextMode);
    document.body.setAttribute("data-mode", nextMode);
    colorBlast(10);
  };

  useEffect(() => {
    document.body.setAttribute("data-mode", mode);
    document.documentElement.style.setProperty("--accent-1", palette[0]);
    document.documentElement.style.setProperty("--accent-2", palette[1]);
    document.documentElement.style.setProperty("--accent-3", palette[2]);
  }, []);

  useEffect(() => {
    anime({
      targets: ".nav, .hero > *, .stats .card, .meter-area, .interactive-pad",
      opacity: [0, 1],
      translateY: [34, 0],
      duration: 950,
      easing: "easeOutExpo",
      delay: anime.stagger(80),
    });
  }, []);

  useEffect(() => {
    anime({
      targets: meterRef.current,
      width: `${meter}%`,
      duration: 500,
      easing: "easeOutQuart",
    });
  }, [meter]);

  useEffect(() => {
    const decay = setInterval(() => {
      setMeter((m) => Math.max(16, m - 1.8));
      setEnergy((e) => Math.max(12, e - 1.4));
    }, 1200);
    return () => clearInterval(decay);
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      document.documentElement.style.setProperty("--mx", `${x}`);
      document.documentElement.style.setProperty("--my", `${y}`);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div className="page">
      <nav className="nav">
        <p className="brand">Holi<span>HyperFlow</span></p>
        <div className="row compact">
          <button className="btn ghost" onClick={toggleMode}>Toggle {mode === "festival" ? "Neon" : "Festival"}</button>
          <button className="btn" onClick={() => colorBlast(12)}>Throw Colors</button>
        </div>
      </nav>

      <section className="hero">
        <span className="tag">React + Three.js shader particles + Anime.js orchestration</span>
        <h1>Hyper-interactive Holi universe with fluid motion, responsive choreography, and living color.</h1>
        <p>
          Move your pointer to bend the 3D powder field, trigger layered UI pulses, switch visual modes, and intensify festival energy in real time.
        </p>

        <div className="cta-wrap">
          <button className="btn big" onClick={() => colorBlast(24)}>Start Grand Celebration</button>
          <button className="btn ghost big" onClick={randomizePalette}>Shuffle Cosmic Palette</button>
        </div>

        <div className="floating-chips">
          <span className="floating-chip">Energy {Math.round(energy)}%</span>
          <span className="floating-chip">Bursts {bursts}</span>
          <span className="floating-chip">Mode {mode}</span>
        </div>
      </section>

      <section className="stats">
        <article className="card interactive" onClick={() => colorBlast(8)}>
          <h3>Reactive Fluid Field</h3>
          <p>Custom shader particles swirl with dynamic wave motion and pointer-driven orientation.</p>
        </article>
        <article className="card interactive" onClick={randomizePalette}>
          <h3>Palette Intelligence</h3>
          <p>Multi-stop palettes update scene glow, UI accents, and interaction aura live.</p>
        </article>
        <article className="card interactive" onClick={() => colorBlast(15)}>
          <h3>Responsive Choreography</h3>
          <p>Elastic anime.js timelines orchestrate layered content bursts across screen sizes.</p>
        </article>
      </section>

      <section className="meter-area">
        <div className="meter-head">
          <h3>Holi Happiness Meter</h3>
          <strong>{Math.round(meter)}%</strong>
        </div>
        <div className="meter-track" onClick={() => colorBlast(6)}>
          <div className="meter-fill" ref={meterRef}></div>
        </div>
      </section>

      <section className="interactive-pad" onClick={() => colorBlast(10)}>
        <h4>Interactive Pad</h4>
        <p>Tap/click anywhere here for instant burst amplification and ripple choreography.</p>
      </section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
