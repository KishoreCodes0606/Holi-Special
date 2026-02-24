const { useEffect, useMemo, useRef, useState } = React;

function useThreeBackground(colorSet) {
  useEffect(() => {
    const mount = document.getElementById("bg-canvas-wrap");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 36;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(renderer.domElement);

    const count = 1700;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const colorA = new THREE.Color(colorSet[0]);
    const colorB = new THREE.Color(colorSet[1]);
    const colorC = new THREE.Color(colorSet[2]);

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 90;
      positions[i3 + 1] = (Math.random() - 0.5) * 55;
      positions[i3 + 2] = (Math.random() - 0.5) * 80;

      const t = Math.random();
      const color = t < 0.33 ? colorA : t < 0.66 ? colorB : colorC;
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({ size: 0.42, vertexColors: true, transparent: true, opacity: 0.72 });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const clock = new THREE.Clock();
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", onResize);

    let raf;
    const animate = () => {
      const t = clock.getElapsedTime();
      points.rotation.y = t * 0.065;
      points.rotation.x = Math.sin(t * 0.2) * 0.08;
      points.position.y = Math.sin(t * 0.5) * 1.2;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [colorSet]);
}

function App() {
  const palettes = useMemo(
    () => [
      ["#ff4f95", "#ffd166", "#47f5ff"],
      ["#8b5cf6", "#ff6b6b", "#ffd93d"],
      ["#00f5d4", "#f72585", "#7b2ff7"],
    ],
    []
  );

  const [palette, setPalette] = useState(palettes[0]);
  const [meter, setMeter] = useState(18);
  const meterRef = useRef(null);

  useThreeBackground(palette);

  const burst = (boost = 12) => {
    setMeter((prev) => Math.min(100, prev + boost));
    anime({
      targets: ".card, .meter-area",
      translateY: [0, -8, 0],
      scale: [1, 1.01, 1],
      duration: 450,
      easing: "easeOutQuad",
      delay: anime.stagger(45),
    });
  };

  const shufflePalette = () => {
    const next = palettes[Math.floor(Math.random() * palettes.length)];
    setPalette(next);
    burst(16);
  };

  useEffect(() => {
    anime({
      targets: ".nav, .hero > *, .stats .card, .meter-area",
      opacity: [0, 1],
      translateY: [30, 0],
      duration: 850,
      delay: anime.stagger(90),
      easing: "easeOutExpo",
    });
  }, []);

  useEffect(() => {
    anime({
      targets: meterRef.current,
      width: `${meter}%`,
      duration: 550,
      easing: "easeOutCubic",
    });
  }, [meter]);

  useEffect(() => {
    const timer = setInterval(() => setMeter((prev) => Math.max(10, prev - 2)), 1400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="page">
      <nav className="nav">
        <p className="brand">Holi<span>Spectrum</span></p>
        <button className="btn alt" onClick={() => burst(10)}>Throw Colors</button>
      </nav>

      <section className="hero">
        <span className="tag">React + Three.js + Anime.js</span>
        <h1>Fluid, colorful, and festive Holi celebration experience.</h1>
        <p>
          Explore a visually rich Holi microsite with 3D floating colors, smooth anime.js motion, and responsive design built with React.
        </p>
        <div className="row">
          <button className="btn" onClick={() => burst(20)}>Start Celebration</button>
          <button className="btn alt" onClick={shufflePalette}>Shuffle Palette</button>
        </div>
      </section>

      <section className="stats">
        <article className="card">
          <h3>3D Color Flow</h3>
          <p>Three.js renders floating color particles for immersive depth.</p>
        </article>
        <article className="card">
          <h3>Anime Motion</h3>
          <p>Responsive UI elements animate with smooth spring-like timing.</p>
        </article>
        <article className="card">
          <h3>Mobile Ready</h3>
          <p>Fluid layout adapts gracefully across phones, tablets, and desktops.</p>
        </article>
      </section>

      <section className="meter-area">
        <h3>Holi Happiness Meter: {Math.round(meter)}%</h3>
        <div className="meter-track">
          <div className="meter-fill" ref={meterRef}></div>
        </div>
      </section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
