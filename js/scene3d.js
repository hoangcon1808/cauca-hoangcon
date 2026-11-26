/* ======================== THREE.JS 3D WORLD ENGINE ======================== */
window.Scene3D = (() => {
  let container, renderer, scene, camera;
  let sunLight, hemiLight, pointGlow, stormLight;
  let waterMesh, waterGeo, waterOrigPos;
  let boatGroup, rodMesh, rodTipLocal, lineMesh, bobberGroup, bossGroup;
  let envGroup, weatherPoints, weatherMeta = [], ambientFishMeshes = [];
  let splashParticles = [], ringMeshes = [];
  let currentMap = null;
  let ready = false;

  const CAM_PRESETS = [
    { name: '🎥 3D Chuẩn',  pos: new THREE.Vector3(-4.5, 6.2, 13.5), look: new THREE.Vector3(3.2, 0.2, 0.5) },
    { name: '🎥 Góc Thuyền', pos: new THREE.Vector3(-9.5, 4.4, 6.8),  look: new THREE.Vector3(6.5, 0.0, 0.0) },
    { name: '🎥 Toàn Cảnh', pos: new THREE.Vector3(2.0, 11.2, 19.5), look: new THREE.Vector3(2.0, 0.0, -2.0) }
  ];
  let camIndex = 0;
  let camPosCurrent = new THREE.Vector3(-4.5, 6.2, 13.5);
  let camLookCurrent = new THREE.Vector3(3.2, 0.2, 0.5);
  let lightningTimer = 0;

  function init(el) {
    container = el;
    if (typeof THREE === 'undefined') {
      el.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:#94a3b8;">Không tải được thư viện 3D Three.js</div>';
      return;
    }

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x7dd3fc, 0.015);

    const w = el.clientWidth || 600;
    const h = el.clientHeight || 400;
    camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 220);
    camera.position.copy(camPosCurrent);
    camera.lookAt(camLookCurrent);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    el.innerHTML = '';
    el.appendChild(renderer.domElement);

    // Lighting
    hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.85);
    scene.add(hemiLight);

    sunLight = new THREE.DirectionalLight(0xfff3b0, 1.35);
    sunLight.position.set(18, 22, -16);
    scene.add(sunLight);

    pointGlow = new THREE.PointLight(0x00f3ff, 0.8, 35);
    pointGlow.position.set(0, 6, 4);
    scene.add(pointGlow);

    stormLight = new THREE.PointLight(0xf43f5e, 0, 50);
    stormLight.position.set(6, 12, -2);
    scene.add(stormLight);

    // Animated Low-Poly Water Plane
    waterGeo = new THREE.PlaneGeometry(110, 110, 46, 46);
    waterGeo.rotateX(-Math.PI / 2);
    waterOrigPos = Float32Array.from(waterGeo.attributes.position.array);

    const waterMat = new THREE.MeshPhongMaterial({
      color: 0x0e8aa8,
      emissive: 0x042636,
      specular: 0x93c5fd,
      shininess: 95,
      flatShading: true,
      transparent: true,
      opacity: 0.92
    });
    waterMesh = new THREE.Mesh(waterGeo, waterMat);
    scene.add(waterMesh);

    // Deep seabed below translucent water
    const bedGeo = new THREE.PlaneGeometry(120, 120);
    bedGeo.rotateX(-Math.PI / 2);
    const bedMat = new THREE.MeshBasicMaterial({ color: 0x031724 });
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.position.y = -2.2;
    scene.add(bed);

    envGroup = new THREE.Group();
    scene.add(envGroup);

    buildBoatAndFisher();
    buildLineAndBobber();
    buildAmbientFish();

    window.addEventListener('resize', handleResize);
    if (window.ResizeObserver) {
      new ResizeObserver(handleResize).observe(container);
    }

    ready = true;
  }

  function handleResize() {
    if (!renderer || !container) return;
    const w = container.clientWidth || 600;
    const h = container.clientHeight || 400;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function buildBoatAndFisher() {
    boatGroup = new THREE.Group();
    boatGroup.position.set(-4.2, 0.1, 1.2);

    // Wooden Boat Hull
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.75, flatShading: true });
    const hullGeo = new THREE.CylinderGeometry(1.15, 0.72, 4.4, 6);
    hullGeo.rotateZ(Math.PI / 2);
    hullGeo.scale(1, 0.58, 0.95);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 0.2;
    boatGroup.add(hull);

    // Gold trim rail
    const railMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.4, roughness: 0.4 });
    const railGeo = new THREE.BoxGeometry(3.8, 0.12, 1.55);
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.y = 0.55;
    boatGroup.add(rail);

    // Lantern on boat bow
    const lanternMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), lanternMat);
    lantern.position.set(1.9, 1.05, 0);
    boatGroup.add(lantern);

    // Fisher Body
    const shirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.42, 1.05, 8),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, flatShading: true })
    );
    shirt.position.set(0.2, 1.1, 0);
    boatGroup.add(shirt);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.6 })
    );
    head.position.set(0.2, 1.82, 0);
    boatGroup.add(head);

    // Vietnamese Conical Hat (Nón lá)
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.68, 0.46, 12),
      new THREE.MeshStandardMaterial({ color: 0xeab308, flatShading: true })
    );
    hat.position.set(0.2, 2.12, 0);
    boatGroup.add(hat);

    // Fishing Rod Pivot
    const rodGeo = new THREE.CylinderGeometry(0.03, 0.07, 4.6, 7);
    rodGeo.translate(0, 2.3, 0);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, emissive: 0x000000, roughness: 0.3, metalness: 0.5 });
    rodMesh = new THREE.Mesh(rodGeo, rodMat);
    rodMesh.position.set(0.65, 1.35, 0.1);
    rodMesh.rotation.z = -0.82;
    boatGroup.add(rodMesh);

    rodTipLocal = new THREE.Vector3(0, 4.55, 0);
    scene.add(boatGroup);
  }

  function buildLineAndBobber() {
    // Curved fishing line (16 segments)
    const pts = [];
    for (let i = 0; i <= 16; i++) pts.push(new THREE.Vector3());
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.85 });
    lineMesh = new THREE.Line(lineGeo, lineMat);
    lineMesh.visible = false;
    scene.add(lineMesh);

    // Bobber
    bobberGroup = new THREE.Group();
    const topHalf = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x450a0a })
    );
    const botHalf = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    stick.position.y = 0.22;
    bobberGroup.add(topHalf, botHalf, stick);
    bobberGroup.visible = false;
    scene.add(bobberGroup);
  }

  function buildAmbientFish() {
    ambientFishMeshes = [];
    const fMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.32 });
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 5), fMat);
      body.rotation.z = -Math.PI / 2;
      g.add(body);
      g.position.set((Math.random() - 0.5) * 26, -0.55, (Math.random() - 0.5) * 16);
      g.userData = {
        angle: Math.random() * Math.PI * 2,
        speed: 1.2 + Math.random() * 1.4,
        radius: 3 + Math.random() * 7,
        cx: 2 + (Math.random() - 0.5) * 10,
        cz: (Math.random() - 0.5) * 8
      };
      scene.add(g);
      ambientFishMeshes.push(g);
    }
  }

  function clearGroup(grp) {
    while (grp.children.length > 0) {
      const child = grp.children[0];
      grp.remove(child);
    }
  }

  function setMap(mapObj) {
    if (!ready || !mapObj) return;
    currentMap = mapObj;
    clearGroup(envGroup);
    weatherMeta = [];
    if (weatherPoints) { scene.remove(weatherPoints); weatherPoints = null; }

    scene.background = new THREE.Color(mapObj.skyHex);
    scene.fog = new THREE.FogExp2(mapObj.fogHex, mapObj.biome === 'trench' ? 0.022 : 0.014);
    waterMesh.material.color.setHex(mapObj.waterHex);
    waterMesh.material.emissive.setHex(mapObj.deepHex);
    sunLight.color.setHex(mapObj.sunHex);
    pointGlow.color.setHex(mapObj.sunHex);

    // Sun or Moon sphere in sky
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 16, 16),
      new THREE.MeshBasicMaterial({ color: mapObj.sunHex })
    );
    orb.position.set(22, 16, -34);
    envGroup.add(orb);

    const b = mapObj.biome;

    // Distant Islands / Mountains Ring
    const islandCount = b === 'ocean' ? 3 : 7;
    for (let i = 0; i < islandCount; i++) {
      const angle = -Math.PI * 0.85 + (i / Math.max(1, islandCount - 1)) * Math.PI * 0.9;
      const dist = 24 + (i % 3) * 7;
      const ix = Math.cos(angle) * dist + 4;
      const iz = -Math.abs(Math.sin(angle) * dist) - 10;

      if (b === 'arctic') {
        // 3D Icebergs
        const h = 4 + (i % 3) * 2.5;
        const ice = new THREE.Mesh(
          new THREE.ConeGeometry(3.5 + (i % 2) * 2, h, 5),
          new THREE.MeshStandardMaterial({ color: 0xe0f2fe, emissive: 0x0c4a6e, roughness: 0.25, flatShading: true })
        );
        ice.position.set(ix, h * 0.35, iz);
        ice.rotation.y = i * 1.1;
        envGroup.add(ice);
      } else if (b === 'volcano') {
        // Volcanic Peaks with Glowing Lava Core
        const h = i === 3 ? 13 : (5 + (i % 3) * 2.4);
        const r = i === 3 ? 8.5 : 4.5;
        const rock = new THREE.Mesh(
          new THREE.ConeGeometry(r, h, 7),
          new THREE.MeshStandardMaterial({ color: 0x291515, roughness: 0.9, flatShading: true })
        );
        rock.position.set(ix, h * 0.42, iz);
        envGroup.add(rock);
        if (i === 3) {
          const lava = new THREE.Mesh(
            new THREE.CylinderGeometry(1.5, 1.1, 0.8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff4500 })
          );
          lava.position.set(ix, h * 0.86, iz);
          envGroup.add(lava);
        }
      } else if (b === 'trench') {
        // Glowing Neon Abyssal Crystals
        const h = 6 + (i % 3) * 3;
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(2.2, 0),
          new THREE.MeshStandardMaterial({
            color: i % 2 === 0 ? 0xa855f7 : 0x00f3ff,
            emissive: i % 2 === 0 ? 0x6b21a8 : 0x0891b2,
            emissiveIntensity: 0.9,
            flatShading: true
          })
        );
        crystal.scale.set(1, h / 3, 1);
        crystal.position.set(ix, h * 0.25, iz);
        envGroup.add(crystal);
      } else {
        // Classic Hills / Tropical Islands
        const hillColor = b === 'bay' ? 0xfde68a : (b === 'ocean' ? 0x1e293b : 0x15803d);
        const h = b === 'bay' ? 2.8 : (4.5 + (i % 3) * 2.2);
        const hill = new THREE.Mesh(
          new THREE.ConeGeometry(5 + (i % 3) * 1.8, h, 7),
          new THREE.MeshStandardMaterial({ color: hillColor, roughness: 0.85, flatShading: true })
        );
        hill.position.set(ix, h * 0.35, iz);
        envGroup.add(hill);

        // Trees on Pond / River / Bay islands
        if (b === 'pond' || b === 'river' || b === 'bay') {
          const tree = new THREE.Group();
          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.16, 0.24, 2.2, 6),
            new THREE.MeshStandardMaterial({ color: 0x78350f })
          );
          trunk.position.y = 1.1;
          const crown = new THREE.Mesh(
            new THREE.ConeGeometry(1.2, 2.3, 6),
            new THREE.MeshStandardMaterial({ color: b === 'river' ? 0x65a30d : 0x16a34a, flatShading: true })
          );
          crown.position.y = 2.6;
          tree.add(trunk, crown);
          tree.position.set(ix + 1.2, h * 0.4, iz + 1.5);
          envGroup.add(tree);
        }
      }
    }

    // Extra Biome Props
    if (b === 'pond') {
      // Floating Lily Pads + Pink Lotus
      const padMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 });
      const flowerMat = new THREE.MeshBasicMaterial({ color: 0xf472b6 });
      for (let i = 0; i < 10; i++) {
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.08, 10), padMat);
        pad.position.set(-10 + i * 2.4, 0.08, -6 - (i % 3) * 2.5);
        envGroup.add(pad);
        if (i % 3 === 0) {
          const fl = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), flowerMat);
          fl.position.set(pad.position.x, 0.26, pad.position.z);
          envGroup.add(fl);
        }
      }
    } else if (b === 'bay') {
      // Glowing Coral Clusters near surface
      const coralColors = [0xf43f5e, 0xfb923c, 0xc084fc, 0x38bdf8];
      for (let i = 0; i < 8; i++) {
        const c = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.75, 0),
          new THREE.MeshStandardMaterial({ color: coralColors[i % 4], flatShading: true })
        );
        c.position.set(-2 + i * 2.2, -0.45, -7 - (i % 2) * 3);
        envGroup.add(c);
      }
    } else if (b === 'ocean') {
      // Lighthouse on distant rock
      const lh = new THREE.Group();
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 5.5, 8), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
      tower.position.y = 2.75;
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 10), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      top.position.y = 5.8;
      lh.add(tower, top);
      lh.position.set(-14, 0.5, -18);
      envGroup.add(lh);
    } else if (b === 'arctic') {
      // Aurora Borealis ribbon in sky
      const auroraGeo = new THREE.PlaneGeometry(55, 7, 24, 2);
      const pos = auroraGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setZ(i, Math.sin(pos.getX(i) * 0.16) * 4);
      }
      const auroraMat = new THREE.MeshBasicMaterial({
        color: 0x34d399, transparent: true, opacity: 0.34, side: THREE.DoubleSide
      });
      const aurora = new THREE.Mesh(auroraGeo, auroraMat);
      aurora.position.set(4, 15, -30);
      envGroup.add(aurora);
    }

    // Night Starfield for night/deep biomes
    if (['ocean', 'arctic', 'trench'].includes(b)) {
      const starPos = [];
      for (let i = 0; i < 160; i++) {
        starPos.push((Math.random() - 0.5) * 120, 8 + Math.random() * 35, -25 - Math.random() * 45);
      }
      const sGeo = new THREE.BufferGeometry();
      sGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
      const stars = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.38 }));
      envGroup.add(stars);
    }

    // Dynamic Weather Particles (Snow / Volcano Embers / Abyssal Fireflies)
    if (['arctic', 'volcano', 'trench', 'pond'].includes(b)) {
      const count = 90;
      const arr = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        arr[i * 3] = (Math.random() - 0.5) * 36;
        arr[i * 3 + 1] = Math.random() * 14;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 28;
        weatherMeta.push({ vy: b === 'volcano' ? (1.2 + Math.random() * 1.4) : (b === 'arctic' ? -(1.8 + Math.random() * 1.5) : 0.35), phase: Math.random() * 6.28 });
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const pColor = b === 'volcano' ? 0xff6b35 : (b === 'arctic' ? 0xffffff : (b === 'trench' ? 0xc084fc : 0xfef08a));
      weatherPoints = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: pColor, size: b === 'arctic' ? 0.25 : 0.2, transparent: true, opacity: 0.85 }));
      scene.add(weatherPoints);
    }
  }

  function ensureBossMesh(bossData) {
    if (!bossData) {
      if (bossGroup) { scene.remove(bossGroup); bossGroup = null; }
      return;
    }
    if (bossGroup && bossGroup.userData.bossId === bossData.id) return;
    if (bossGroup) scene.remove(bossGroup);

    bossGroup = new THREE.Group();
    bossGroup.userData.bossId = bossData.id;

    // Dramatic 3D Sea Monster Construct (Core + Glowing Eyes + Tentacles/Spikes)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: bossData.colorHex || 0xf43f5e,
      emissive: bossData.colorHex || 0x881337,
      emissiveIntensity: 0.35,
      roughness: 0.35,
      flatShading: true
    });
    const core = new THREE.Mesh(new THREE.DodecahedronGeometry(1.75, 1), bodyMat);
    bossGroup.add(core);

    // Glowing Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), eyeMat);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), eyeMat);
    eyeL.position.set(-1.35, 0.55, 0.65);
    eyeR.position.set(-1.35, 0.55, -0.65);
    bossGroup.add(eyeL, eyeR);

    // 6 Animated Tentacles / Horns
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.8, 6), bodyMat);
      spike.position.set(Math.cos(a) * 1.9, -0.2, Math.sin(a) * 1.9);
      spike.rotation.z = -Math.cos(a) * 0.7;
      spike.rotation.x = Math.sin(a) * 0.7;
      bossGroup.add(spike);
    }

    // Aura Ring on Water
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(2.1, 2.75, 24),
      new THREE.MeshBasicMaterial({ color: 0xf43f5e, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = -0.3;
    bossGroup.add(aura);

    bossGroup.position.set(7.2, 0.2, -0.5);
    scene.add(bossGroup);
  }

  function spawnSplash(wx, wz, count = 10) {
    if (!ready) return;
    const mat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.9 });
    const geo = new THREE.SphereGeometry(0.11, 5, 5);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(wx, 0.15, wz);
      m.userData = {
        vx: (Math.random() - 0.5) * 4.2,
        vy: 2.5 + Math.random() * 3.4,
        vz: (Math.random() - 0.5) * 4.2,
        life: 0.55 + Math.random() * 0.25
      };
      scene.add(m);
      splashParticles.push(m);
    }

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.42, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(wx, 0.12, wz);
    ring.userData = { life: 0.9 };
    scene.add(ring);
    ringMeshes.push(ring);
  }

  function triggerLightning() { lightningTimer = 0.45; }

  function cycleCamera() {
    camIndex = (camIndex + 1) % CAM_PRESETS.length;
    return CAM_PRESETS[camIndex].name;
  }

  function projectToScreen(wx, wy, wz) {
    if (!ready || !container) return { x: 50, y: 50 };
    const v = new THREE.Vector3(wx, wy, wz).project(camera);
    return {
      x: (v.x * 0.5 + 0.5) * container.clientWidth,
      y: (-v.y * 0.5 + 0.5) * container.clientHeight
    };
  }

  function update(dt, t, snap) {
    if (!ready) return;
    const isStorm = !!snap.activeBoss;

    // 1. Animate 3D Water Waves
    const pos = waterGeo.attributes.position;
    const amp = isStorm ? 0.52 : (currentMap?.biome === 'ocean' ? 0.34 : 0.2);
    const freq = isStorm ? 2.8 : 1.7;
    for (let i = 0; i < pos.count; i++) {
      const ox = waterOrigPos[i * 3];
      const oz = waterOrigPos[i * 3 + 2];
      const wave = Math.sin(ox * 0.28 + t * freq) * amp + Math.cos(oz * 0.24 + t * (freq * 0.85)) * (amp * 0.75);
      pos.setY(i, wave);
    }
    pos.needsUpdate = true;

    // 2. Storm / Lightning Lighting
    if (isStorm) {
      stormLight.intensity = 1.6 + Math.sin(t * 7) * 0.5;
      if (lightningTimer > 0) {
        lightningTimer -= dt;
        hemiLight.intensity = 2.6;
      } else {
        hemiLight.intensity = 0.55;
      }
    } else {
      stormLight.intensity = 0;
      hemiLight.intensity = 0.9;
    }

    // 3. Boat & Rod Motion
    const boatBob = Math.sin(t * (isStorm ? 3.8 : 2.1)) * (isStorm ? 0.25 : 0.14);
    boatGroup.position.y = 0.1 + boatBob;
    boatGroup.rotation.z = Math.sin(t * 1.9) * (isStorm ? 0.08 : 0.04);
    boatGroup.rotation.x = Math.cos(t * 1.5) * 0.03;

    // Update Rod Visual Color + Bending
    const rodColor = new THREE.Color(snap.rodColor || '#d6d3d1');
    rodMesh.material.color.copy(rodColor);
    rodMesh.material.emissive.copy(snap.rodGlow ? rodColor : new THREE.Color(0x000000));
    rodMesh.material.emissiveIntensity = snap.rodGlow ? 0.45 : 0;

    let targetRotZ = -0.78;
    if (snap.phase === 'CASTING') targetRotZ = -0.35 - snap.castProgress * 0.65;
    else if (snap.phase === 'BITING') targetRotZ = -1.05 + Math.sin(t * 25) * 0.08;
    else if (snap.phase === 'REELING') targetRotZ = -1.18 + Math.sin(t * 18) * 0.1;
    rodMesh.rotation.z += (targetRotZ - rodMesh.rotation.z) * Math.min(1, dt * 12);

    // 4. Boss 3D Mesh
    ensureBossMesh(snap.activeBoss ? snap.activeBoss.data : null);
    if (bossGroup && snap.activeBoss) {
      bossGroup.position.x = snap.activeBoss.wx;
      bossGroup.position.z = snap.activeBoss.wz;
      bossGroup.position.y = 0.35 + Math.sin(t * 3.5) * 0.32;
      bossGroup.rotation.y = Math.sin(t * 1.2) * 0.35;
    }

    // 5. Fishing Line & Bobber
    if (snap.phase !== 'IDLE') {
      const tipWorld = rodTipLocal.clone().applyMatrix4(rodMesh.matrixWorld);
      let bx = snap.bobberX;
      let bz = snap.bobberZ;
      let by = 0.15;

      if (snap.phase === 'CASTING') {
        const p = snap.castProgress;
        bx = tipWorld.x + (snap.bobberX - tipWorld.x) * p;
        bz = tipWorld.z + (snap.bobberZ - tipWorld.z) * p;
        by = tipWorld.y * (1 - p) + 0.15 * p + Math.sin(p * Math.PI) * 3.4;
      } else if (snap.phase === 'WAITING') {
        by = 0.12 + Math.sin(t * 4) * 0.1;
      } else if (snap.phase === 'BITING') {
        by = -0.15 + Math.sin(t * 30) * 0.22;
      } else if (snap.phase === 'REELING') {
        bx += Math.sin(t * 15) * 0.45;
        by = snap.currentBossFight ? 0.6 : 0.08;
      }

      bobberGroup.visible = !snap.currentBossFight;
      bobberGroup.position.set(bx, by, bz);

      // Update Curved Fishing Line
      lineMesh.visible = true;
      lineMesh.material.color.setHex(snap.currentBossFight ? 0xfb7185 : 0xe0f2fe);
      const lPos = lineMesh.geometry.attributes.position;
      const midX = (tipWorld.x + bx) * 0.5;
      const midZ = (tipWorld.z + bz) * 0.5;
      const sag = snap.phase === 'REELING' ? 0.1 : 1.1;
      const midY = (tipWorld.y + by) * 0.5 - sag;
      for (let i = 0; i <= 16; i++) {
        const u = i / 16;
        const inv = 1 - u;
        const lx = inv * inv * tipWorld.x + 2 * inv * u * midX + u * u * bx;
        const ly = inv * inv * tipWorld.y + 2 * inv * u * midY + u * u * by;
        const lz = inv * inv * tipWorld.z + 2 * inv * u * midZ + u * u * bz;
        lPos.setXYZ(i, lx, ly, lz);
      }
      lPos.needsUpdate = true;
    } else {
      lineMesh.visible = false;
      bobberGroup.visible = false;
    }

    // 6. Ambient Underwater Fish
    for (const f of ambientFishMeshes) {
      f.userData.angle += dt * 0.38 * f.userData.speed;
      const nx = f.userData.cx + Math.cos(f.userData.angle) * f.userData.radius;
      const nz = f.userData.cz + Math.sin(f.userData.angle) * (f.userData.radius * 0.65);
      f.rotation.y = Math.atan2(f.position.z - nz, nx - f.position.x);
      f.position.x = nx;
      f.position.z = nz;
    }

    // 7. Weather Particles
    if (weatherPoints) {
      const wp = weatherPoints.geometry.attributes.position;
      for (let i = 0; i < weatherMeta.length; i++) {
        let y = wp.getY(i) + weatherMeta[i].vy * dt;
        let x = wp.getX(i) + Math.sin(t + weatherMeta[i].phase) * 0.5 * dt;
        if (y < 0) y = 14;
        if (y > 14) y = 0.2;
        wp.setXY(i, x, y);
      }
      wp.needsUpdate = true;
    }

    // 8. Splashes & Water Rings
    for (let i = splashParticles.length - 1; i >= 0; i--) {
      const p = splashParticles[i];
      p.position.x += p.userData.vx * dt;
      p.position.y += p.userData.vy * dt;
      p.position.z += p.userData.vz * dt;
      p.userData.vy -= 9.5 * dt;
      p.userData.life -= dt;
      if (p.userData.life <= 0) { scene.remove(p); splashParticles.splice(i, 1); }
    }
    for (let i = ringMeshes.length - 1; i >= 0; i--) {
      const r = ringMeshes[i];
      r.scale.addScalar(dt * 3.8);
      r.userData.life -= dt;
      r.material.opacity = Math.max(0, r.userData.life * 0.8);
      if (r.userData.life <= 0) { scene.remove(r); ringMeshes.splice(i, 1); }
    }

    // 9. Smooth Dynamic Camera (Slight Zoom on Boss/Reel)
    const preset = CAM_PRESETS[camIndex];
    const targetCamPos = preset.pos.clone();
    const targetLook = preset.look.clone();
    if (snap.phase === 'REELING') {
      targetCamPos.z -= 1.8;
      targetCamPos.y -= 0.5;
      if (snap.currentBossFight && snap.activeBoss) {
        targetLook.set(snap.activeBoss.wx * 0.65, 0.5, snap.activeBoss.wz);
      }
    }
    camPosCurrent.lerp(targetCamPos, Math.min(1, dt * 3.5));
    camLookCurrent.lerp(targetLook, Math.min(1, dt * 4.5));
    camera.position.copy(camPosCurrent);
    camera.lookAt(camLookCurrent);

    renderer.render(scene, camera);
  }

  return { init, setMap, spawnSplash, triggerLightning, cycleCamera, projectToScreen, update };
})();
