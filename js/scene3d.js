/* ======================== THREE.JS 3D WORLD ENGINE ======================== */
window.Scene3D = (() => {
  let container, renderer, scene, camera;
  let sunLight, hemiLight, pointGlow, stormLight, feverLight;
  let waterMesh, waterGeo, waterOrigPos;
  let boatGroup, boatHullGroup, rodMesh, rodTipLocal, lineMesh, bobberGroup, bossGroup;
  let envGroup, weatherPoints, weatherMeta = [], ambientFishMeshes = [];
  let splashParticles = [], ringMeshes = [], jumpingFish = [];
  let currentMap = null;
  let currentBoatType = 'wood';
  let ready = false;

  // 360° Orbit Camera Controls (Spherical coordinates around lookTarget)
  const CAM_PRESETS = [
    { name: '🎥 3D Chuẩn',   yaw: -0.45, pitch: 0.36, dist: 15.5, target: new THREE.Vector3(2.2, 0.4, 0.5) },
    { name: '🎥 Góc Thuyền', yaw: -1.12, pitch: 0.25, dist: 12.2, target: new THREE.Vector3(2.8, 0.6, 0.4) },
    { name: '🎥 Toàn Cảnh',  yaw: 0.05,  pitch: 0.55, dist: 22.0, target: new THREE.Vector3(1.8, 0.2, -1.5) }
  ];
  let camIndex = 0;
  let orbit = { yaw: -0.45, pitch: 0.36, dist: 15.5, targetYaw: -0.45, targetPitch: 0.36, targetDist: 15.5 };
  let lookCurrent = new THREE.Vector3(2.2, 0.4, 0.5);
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
    camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 240);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    el.innerHTML = '';
    el.appendChild(renderer.domElement);

    // Lighting
    hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.88);
    scene.add(hemiLight);

    sunLight = new THREE.DirectionalLight(0xfff3b0, 1.35);
    sunLight.position.set(18, 22, -16);
    scene.add(sunLight);

    pointGlow = new THREE.PointLight(0x00f3ff, 0.85, 38);
    pointGlow.position.set(0, 6, 4);
    scene.add(pointGlow);

    stormLight = new THREE.PointLight(0xf43f5e, 0, 52);
    stormLight.position.set(6, 12, -2);
    scene.add(stormLight);

    feverLight = new THREE.PointLight(0xfbbf24, 0, 48);
    feverLight.position.set(3, 9, 2);
    scene.add(feverLight);

    // Animated Low-Poly Water Plane
    waterGeo = new THREE.PlaneGeometry(120, 120, 48, 48);
    waterGeo.rotateX(-Math.PI / 2);
    waterOrigPos = Float32Array.from(waterGeo.attributes.position.array);

    const waterMat = new THREE.MeshPhongMaterial({
      color: 0x0e8aa8,
      emissive: 0x042636,
      specular: 0x93c5fd,
      shininess: 98,
      flatShading: true,
      transparent: true,
      opacity: 0.92
    });
    waterMesh = new THREE.Mesh(waterGeo, waterMat);
    scene.add(waterMesh);

    const bed = new THREE.Mesh(
      new THREE.PlaneGeometry(130, 130).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x031724 })
    );
    bed.position.y = -2.3;
    scene.add(bed);

    envGroup = new THREE.Group();
    scene.add(envGroup);

    buildBoatAndFisher();
    buildLineAndBobber();
    buildAmbientFish();

    window.addEventListener('resize', handleResize);
    if (window.ResizeObserver) new ResizeObserver(handleResize).observe(container);
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

  function clearGroup(grp) {
    while (grp.children.length > 0) grp.remove(grp.children[0]);
  }

  function buildBoatAndFisher() {
    boatGroup = new THREE.Group();
    boatGroup.position.set(-4.2, 0.1, 1.2);

    boatHullGroup = new THREE.Group();
    boatGroup.add(boatHullGroup);

    // Fisher Body + Nón Lá
    const shirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.42, 1.05, 8),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, flatShading: true })
    );
    shirt.position.set(0.2, 1.15, 0);
    boatGroup.add(shirt);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.6 })
    );
    head.position.set(0.2, 1.87, 0);
    boatGroup.add(head);

    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.68, 0.46, 12),
      new THREE.MeshStandardMaterial({ color: 0xeab308, flatShading: true })
    );
    hat.position.set(0.2, 2.17, 0);
    boatGroup.add(hat);

    // Fishing Rod
    const rodGeo = new THREE.CylinderGeometry(0.03, 0.07, 4.6, 7);
    rodGeo.translate(0, 2.3, 0);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, emissive: 0x000000, roughness: 0.3, metalness: 0.5 });
    rodMesh = new THREE.Mesh(rodGeo, rodMat);
    rodMesh.position.set(0.65, 1.4, 0.1);
    rodMesh.rotation.z = -0.82;
    boatGroup.add(rodMesh);

    rodTipLocal = new THREE.Vector3(0, 4.55, 0);
    scene.add(boatGroup);
    setBoat('wood');
  }

  // 5 MẪU THUYỀN 3D KHÁC NHAU
  function setBoat(boatId) {
    if (!boatHullGroup) return;
    currentBoatType = boatId || 'wood';
    clearGroup(boatHullGroup);

    if (currentBoatType === 'speedboat') {
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(4.6, 0.65, 1.8),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.35, roughness: 0.3, flatShading: true })
      );
      hull.position.y = 0.25;
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(4.65, 0.16, 1.84),
        new THREE.MeshStandardMaterial({ color: 0xef4444 })
      );
      stripe.position.y = 0.35;
      const windshield = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.65, 1.45),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72 })
      );
      windshield.position.set(1.1, 0.8, 0);
      windshield.rotation.z = -0.35;
      boatHullGroup.add(hull, stripe, windshield);
    } else if (currentBoatType === 'pirate') {
      const hull = new THREE.Mesh(
        new THREE.CylinderGeometry(1.45, 0.9, 5.4, 6).rotateZ(Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85, flatShading: true })
      );
      hull.scale.set(1, 0.65, 1.05);
      hull.position.y = 0.25;
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.12, 4.4, 7),
        new THREE.MeshStandardMaterial({ color: 0x78350f })
      );
      mast.position.set(-1.1, 2.2, 0);
      const sail = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 2.1, 2.4),
        new THREE.MeshStandardMaterial({ color: 0x1e293b })
      );
      sail.position.set(-0.95, 2.7, 0);
      const skull = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      skull.position.set(-0.82, 2.7, 0);
      boatHullGroup.add(hull, mast, sail, skull);
    } else if (currentBoatType === 'yacht') {
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 0.85, 2.25),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.45, roughness: 0.22 })
      );
      hull.position.y = 0.25;
      const goldTrim = new THREE.Mesh(
        new THREE.BoxGeometry(5.68, 0.14, 2.3),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.2 })
      );
      goldTrim.position.y = 0.62;
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 1.15, 1.75),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.25 })
      );
      cabin.position.set(-1.3, 1.15, 0);
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(2.35, 0.48, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0369a1, emissiveIntensity: 0.4 })
      );
      glass.position.set(-1.3, 1.25, 0);
      boatHullGroup.add(hull, goldTrim, cabin, glass);
    } else if (currentBoatType === 'cyber') {
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(2.4, 2.0, 0.55, 8),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.2 })
      );
      disc.position.y = 0.35;
      const neonRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.35, 0.1, 8, 24).rotateX(Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x00f3ff })
      );
      neonRing.position.y = 0.38;
      const coreRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.4, 0.08, 8, 20).rotateX(Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xff00ea })
      );
      coreRing.position.y = 0.68;
      boatHullGroup.add(disc, neonRing, coreRing);
    } else {
      // Classic wooden boat
      const hullGeo = new THREE.CylinderGeometry(1.15, 0.72, 4.4, 6).rotateZ(Math.PI / 2);
      hullGeo.scale(1, 0.58, 0.95);
      const hull = new THREE.Mesh(hullGeo, new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.75, flatShading: true }));
      hull.position.y = 0.2;
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 0.12, 1.55),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.4, roughness: 0.4 })
      );
      rail.position.y = 0.55;
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      lantern.position.set(1.9, 1.05, 0);
      boatHullGroup.add(hull, rail, lantern);
    }
  }

  function buildLineAndBobber() {
    const pts = [];
    for (let i = 0; i <= 16; i++) pts.push(new THREE.Vector3());
    lineMesh = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.85 })
    );
    lineMesh.visible = false;
    scene.add(lineMesh);

    bobberGroup = new THREE.Group();
    const topHalf = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x450a0a })
    );
    const botHalf = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    stick.position.y = 0.22;
    bobberGroup.add(topHalf, botHalf, stick);
    bobberGroup.visible = false;
    scene.add(bobberGroup);
  }

  function buildAmbientFish() {
    ambientFishMeshes = [];
    const fMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.34 });
    for (let i = 0; i < 9; i++) {
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

    const orb = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 16), new THREE.MeshBasicMaterial({ color: mapObj.sunHex }));
    orb.position.set(22, 16, -34);
    envGroup.add(orb);

    const b = mapObj.biome;
    const islandCount = b === 'ocean' ? 3 : 7;
    for (let i = 0; i < islandCount; i++) {
      const angle = -Math.PI * 0.85 + (i / Math.max(1, islandCount - 1)) * Math.PI * 0.9;
      const dist = 24 + (i % 3) * 7;
      const ix = Math.cos(angle) * dist + 4;
      const iz = -Math.abs(Math.sin(angle) * dist) - 10;

      if (b === 'arctic') {
        const h = 4 + (i % 3) * 2.5;
        const ice = new THREE.Mesh(
          new THREE.ConeGeometry(3.5 + (i % 2) * 2, h, 5),
          new THREE.MeshStandardMaterial({ color: 0xe0f2fe, emissive: 0x0c4a6e, roughness: 0.25, flatShading: true })
        );
        ice.position.set(ix, h * 0.35, iz);
        ice.rotation.y = i * 1.1;
        envGroup.add(ice);
      } else if (b === 'volcano') {
        const h = i === 3 ? 13 : (5 + (i % 3) * 2.4);
        const r = i === 3 ? 8.5 : 4.5;
        const rock = new THREE.Mesh(
          new THREE.ConeGeometry(r, h, 7),
          new THREE.MeshStandardMaterial({ color: 0x291515, roughness: 0.9, flatShading: true })
        );
        rock.position.set(ix, h * 0.42, iz);
        envGroup.add(rock);
        if (i === 3) {
          const lava = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.1, 0.8, 8), new THREE.MeshBasicMaterial({ color: 0xff4500 }));
          lava.position.set(ix, h * 0.86, iz);
          envGroup.add(lava);
        }
      } else if (b === 'trench') {
        const h = 6 + (i % 3) * 3;
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(2.2, 0),
          new THREE.MeshStandardMaterial({
            color: i % 2 === 0 ? 0xa855f7 : 0x00f3ff,
            emissive: i % 2 === 0 ? 0x6b21a8 : 0x0891b2,
            emissiveIntensity: 0.9, flatShading: true
          })
        );
        crystal.scale.set(1, h / 3, 1);
        crystal.position.set(ix, h * 0.25, iz);
        envGroup.add(crystal);
      } else {
        const hillColor = b === 'bay' ? 0xfde68a : (b === 'ocean' ? 0x1e293b : 0x15803d);
        const h = b === 'bay' ? 2.8 : (4.5 + (i % 3) * 2.2);
        const hill = new THREE.Mesh(
          new THREE.ConeGeometry(5 + (i % 3) * 1.8, h, 7),
          new THREE.MeshStandardMaterial({ color: hillColor, roughness: 0.85, flatShading: true })
        );
        hill.position.set(ix, h * 0.35, iz);
        envGroup.add(hill);

        if (b === 'pond' || b === 'river' || b === 'bay') {
          const tree = new THREE.Group();
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x78350f }));
          trunk.position.y = 1.1;
          const crown = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.3, 6), new THREE.MeshStandardMaterial({ color: b === 'river' ? 0x65a30d : 0x16a34a, flatShading: true }));
          crown.position.y = 2.6;
          tree.add(trunk, crown);
          tree.position.set(ix + 1.2, h * 0.4, iz + 1.5);
          envGroup.add(tree);
        }
      }
    }

    if (b === 'pond') {
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
      const coralColors = [0xf43f5e, 0xfb923c, 0xc084fc, 0x38bdf8];
      for (let i = 0; i < 8; i++) {
        const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 0), new THREE.MeshStandardMaterial({ color: coralColors[i % 4], flatShading: true }));
        c.position.set(-2 + i * 2.2, -0.45, -7 - (i % 2) * 3);
        envGroup.add(c);
      }
    } else if (b === 'ocean') {
      const lh = new THREE.Group();
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 5.5, 8), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
      tower.position.y = 2.75;
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 10), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      top.position.y = 5.8;
      lh.add(tower, top);
      lh.position.set(-14, 0.5, -18);
      envGroup.add(lh);
    } else if (b === 'arctic') {
      const auroraGeo = new THREE.PlaneGeometry(55, 7, 24, 2);
      const pos = auroraGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 0.16) * 4);
      const aurora = new THREE.Mesh(auroraGeo, new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.34, side: THREE.DoubleSide }));
      aurora.position.set(4, 15, -30);
      envGroup.add(aurora);
    }

    if (['ocean', 'arctic', 'trench'].includes(b)) {
      const starPos = [];
      for (let i = 0; i < 160; i++) starPos.push((Math.random() - 0.5) * 120, 8 + Math.random() * 35, -25 - Math.random() * 45);
      const sGeo = new THREE.BufferGeometry();
      sGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
      envGroup.add(new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.38 })));
    }

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

    const bodyMat = new THREE.MeshStandardMaterial({
      color: bossData.colorHex || 0xf43f5e,
      emissive: bossData.colorHex || 0x881337,
      emissiveIntensity: 0.35, roughness: 0.35, flatShading: true
    });
    bossGroup.add(new THREE.Mesh(new THREE.DodecahedronGeometry(1.75, 1), bodyMat));

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), eyeMat);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), eyeMat);
    eyeL.position.set(-1.35, 0.55, 0.65);
    eyeR.position.set(-1.35, 0.55, -0.65);
    bossGroup.add(eyeL, eyeR);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.8, 6), bodyMat);
      spike.position.set(Math.cos(a) * 1.9, -0.2, Math.sin(a) * 1.9);
      spike.rotation.z = -Math.cos(a) * 0.7;
      spike.rotation.x = Math.sin(a) * 0.7;
      bossGroup.add(spike);
    }

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

  // HIỆU ỨNG CÁ 3D NHẢY TUNG KHỎI MẶT NƯỚC KHI CÂU TRÚNG
  function spawnCaughtFishJump(startX, startZ, hexColor = 0x38bdf8, scale = 1.0) {
    if (!ready) return;
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: hexColor, emissive: hexColor, emissiveIntensity: 0.45, roughness: 0.3, flatShading: true
    });
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.55 * scale, 0), mat);
    body.scale.set(1.7, 0.8, 0.55);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.35 * scale, 0.65 * scale, 4), mat);
    tail.rotation.z = -Math.PI / 2;
    tail.position.x = -0.95 * scale;
    g.add(body, tail);
    g.position.set(startX, 0, startZ);
    g.userData = {
      sx: startX, sz: startZ,
      ex: boatGroup.position.x + 1.2, ez: boatGroup.position.z,
      t: 0, dur: 0.82
    };
    scene.add(g);
    jumpingFish.push(g);
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

  // Orbit 360° & Zoom API
  function rotateOrbit(dx, dy) {
    orbit.targetYaw -= dx * 0.0075;
    orbit.targetPitch = Math.max(0.14, Math.min(1.18, orbit.targetPitch + dy * 0.006));
  }

  function zoomOrbit(delta) {
    orbit.targetDist = Math.max(8.5, Math.min(28, orbit.targetDist + delta * 0.015));
  }

  function cycleCamera() {
    camIndex = (camIndex + 1) % CAM_PRESETS.length;
    const p = CAM_PRESETS[camIndex];
    orbit.targetYaw = p.yaw;
    orbit.targetPitch = p.pitch;
    orbit.targetDist = p.dist;
    return p.name;
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
    const isFever = !!snap.isFever;

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

    // 2. Storm / Fever Lighting
    feverLight.intensity = isFever ? (2.2 + Math.sin(t * 8) * 0.6) : 0;
    if (isStorm) {
      stormLight.intensity = 1.6 + Math.sin(t * 7) * 0.5;
      if (lightningTimer > 0) { lightningTimer -= dt; hemiLight.intensity = 2.6; }
      else hemiLight.intensity = 0.55;
    } else {
      stormLight.intensity = 0;
      hemiLight.intensity = isFever ? 1.15 : 0.9;
    }

    // 3. Boat & Rod Motion
    const boatBob = Math.sin(t * (isStorm ? 3.8 : 2.1)) * (isStorm ? 0.25 : 0.14);
    boatGroup.position.y = 0.1 + boatBob;
    boatGroup.rotation.z = Math.sin(t * 1.9) * (isStorm ? 0.08 : 0.04);
    boatGroup.rotation.x = Math.cos(t * 1.5) * 0.03;

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
      let bx = snap.bobberX, bz = snap.bobberZ, by = 0.15;

      if (snap.phase === 'CASTING') {
        const p = snap.castProgress;
        bx = tipWorld.x + (snap.bobberX - tipWorld.x) * p;
        bz = tipWorld.z + (snap.bobberZ - tipWorld.z) * p;
        by = tipWorld.y * (1 - p) + 0.15 * p + Math.sin(p * Math.PI) * 3.4;
      } else if (snap.phase === 'WAITING') by = 0.12 + Math.sin(t * 4) * 0.1;
      else if (snap.phase === 'BITING') by = -0.15 + Math.sin(t * 30) * 0.22;
      else if (snap.phase === 'REELING') { bx += Math.sin(t * 15) * 0.45; by = snap.currentBossFight ? 0.6 : 0.08; }

      bobberGroup.visible = !snap.currentBossFight;
      bobberGroup.position.set(bx, by, bz);

      lineMesh.visible = true;
      lineMesh.material.color.setHex(snap.currentBossFight ? 0xfb7185 : (isFever ? 0xfef08a : 0xe0f2fe));
      const lPos = lineMesh.geometry.attributes.position;
      const midX = (tipWorld.x + bx) * 0.5;
      const midZ = (tipWorld.z + bz) * 0.5;
      const midY = (tipWorld.y + by) * 0.5 - (snap.phase === 'REELING' ? 0.1 : 1.1);
      for (let i = 0; i <= 16; i++) {
        const u = i / 16, inv = 1 - u;
        lPos.setXYZ(
          i,
          inv * inv * tipWorld.x + 2 * inv * u * midX + u * u * bx,
          inv * inv * tipWorld.y + 2 * inv * u * midY + u * u * by,
          inv * inv * tipWorld.z + 2 * inv * u * midZ + u * u * bz
        );
      }
      lPos.needsUpdate = true;
    } else {
      lineMesh.visible = false;
      bobberGroup.visible = false;
    }

    // 6. Jumping Caught 3D Fish
    for (let i = jumpingFish.length - 1; i >= 0; i--) {
      const f = jumpingFish[i];
      f.userData.t += dt;
      const p = Math.min(1, f.userData.t / f.userData.dur);
      f.position.x = f.userData.sx + (f.userData.ex - f.userData.sx) * p;
      f.position.z = f.userData.sz + (f.userData.ez - f.userData.sz) * p;
      f.position.y = Math.sin(p * Math.PI) * 4.5 + 0.4;
      f.rotation.y += dt * 9;
      f.rotation.z = Math.cos(p * Math.PI) * 1.1;
      if (p >= 1) { scene.remove(f); jumpingFish.splice(i, 1); }
    }

    // 7. Ambient Fish
    for (const f of ambientFishMeshes) {
      f.userData.angle += dt * 0.38 * f.userData.speed;
      const nx = f.userData.cx + Math.cos(f.userData.angle) * f.userData.radius;
      const nz = f.userData.cz + Math.sin(f.userData.angle) * (f.userData.radius * 0.65);
      f.rotation.y = Math.atan2(f.position.z - nz, nx - f.position.x);
      f.position.x = nx; f.position.z = nz;
    }

    // 8. Weather Particles
    if (weatherPoints) {
      const wp = weatherPoints.geometry.attributes.position;
      for (let i = 0; i < weatherMeta.length; i++) {
        let y = wp.getY(i) + weatherMeta[i].vy * dt;
        let x = wp.getX(i) + Math.sin(t + weatherMeta[i].phase) * 0.5 * dt;
        if (y < 0) y = 14; if (y > 14) y = 0.2;
        wp.setXY(i, x, y);
      }
      wp.needsUpdate = true;
    }

    // 9. Splashes & Rings
    for (let i = splashParticles.length - 1; i >= 0; i--) {
      const p = splashParticles[i];
      p.position.x += p.userData.vx * dt; p.position.y += p.userData.vy * dt; p.position.z += p.userData.vz * dt;
      p.userData.vy -= 9.5 * dt; p.userData.life -= dt;
      if (p.userData.life <= 0) { scene.remove(p); splashParticles.splice(i, 1); }
    }
    for (let i = ringMeshes.length - 1; i >= 0; i--) {
      const r = ringMeshes[i];
      r.scale.addScalar(dt * 3.8); r.userData.life -= dt;
      r.material.opacity = Math.max(0, r.userData.life * 0.8);
      if (r.userData.life <= 0) { scene.remove(r); ringMeshes.splice(i, 1); }
    }

    // 10. Smooth Spherical Orbit Camera
    const s = Math.min(1, dt * 6);
    orbit.yaw += (orbit.targetYaw - orbit.yaw) * s;
    orbit.pitch += (orbit.targetPitch - orbit.pitch) * s;
    const effDist = orbit.targetDist - (snap.phase === 'REELING' ? 2.0 : 0);
    orbit.dist += (effDist - orbit.dist) * s;

    const baseTarget = CAM_PRESETS[camIndex].target.clone();
    if (snap.currentBossFight && snap.activeBoss) {
      baseTarget.set(snap.activeBoss.wx * 0.55, 0.6, snap.activeBoss.wz);
    }
    lookCurrent.lerp(baseTarget, Math.min(1, dt * 4));

    const cx = lookCurrent.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist;
    const cy = lookCurrent.y + Math.sin(orbit.pitch) * orbit.dist;
    const cz = lookCurrent.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist;
    camera.position.set(cx, Math.max(1.5, cy), cz);
    camera.lookAt(lookCurrent);

    renderer.render(scene, camera);
  }

  return {
    init, setMap, setBoat, spawnSplash, spawnCaughtFishJump,
    triggerLightning, rotateOrbit, zoomOrbit, cycleCamera, projectToScreen, update
  };
})();
