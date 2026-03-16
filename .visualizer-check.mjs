
    import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

    const viewport = document.getElementById('viewport');
    const practicalityEl = document.getElementById('practicality');
    const wisdomEl = document.getElementById('wisdom');
    const stabilityEl = document.getElementById('stability');
    const practicalitySliderLabel = document.getElementById('practicalitySliderLabel');
    const empathySliderLabel = document.getElementById('empathySliderLabel');
    const wisdomSliderLabel = document.getElementById('wisdomSliderLabel');
    const knowledgeSliderLabel = document.getElementById('knowledgeSliderLabel');
    const negativeStabilityLabel = document.getElementById('negativeStabilityLabel');
    const positiveStabilityLabel = document.getElementById('positiveStabilityLabel');
    const coordX = document.getElementById('coord-x');
    const coordY = document.getElementById('coord-y');
    const coordZ = document.getElementById('coord-z');
    const resetBtn = document.getElementById('resetBtn');
    const rotateLeftBtn = document.getElementById('rotateLeftBtn');
    const rotateRightBtn = document.getElementById('rotateRightBtn');
    const crosshair = document.getElementById('crosshair');
    const viewLabels = document.getElementById('viewLabels');
    const labelEmpathy = document.getElementById('labelEmpathy');
    const labelPracticality = document.getElementById('labelPracticality');
    const labelWisdom = document.getElementById('labelWisdom');
    const labelKnowledge = document.getElementById('labelKnowledge');
    const sliderTooltip = document.getElementById('sliderTooltip');
    const aspectTooltip = document.getElementById('aspectTooltip');

    const rangeInputs = [practicalityEl, wisdomEl, stabilityEl];
    const aspectTooltipDefs = [
      { node: practicalitySliderLabel, input: practicalityEl, side: 'left' },
      { node: empathySliderLabel, input: practicalityEl, side: 'right' },
      { node: wisdomSliderLabel, input: wisdomEl, side: 'left' },
      { node: knowledgeSliderLabel, input: wisdomEl, side: 'right' }
    ];

    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    viewport.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100);

    scene.add(new THREE.AmbientLight(0xffffff, 1.3));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.65);
    rimLight.position.set(-4, 2, -3);
    scene.add(rimLight);

    const grid = new THREE.GridHelper(8, 16, 0x445066, 0x263041);
    grid.position.y = -1.75;
    grid.material.transparent = true;
    grid.material.opacity = 0.22;
    scene.add(grid);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const octaGroup = new THREE.Group();
    rootGroup.add(octaGroup);

    const octaGeom = new THREE.OctahedronGeometry(1, 0);
    const solidMat = new THREE.MeshPhysicalMaterial({
      color: 0x98a7c7,
      transparent: true,
      opacity: 0.26,
      roughness: 0.72,
      metalness: 0,
      side: THREE.FrontSide,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    });
    octaGroup.add(new THREE.Mesh(octaGeom, solidMat));

    octaGroup.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(octaGeom),
      new THREE.LineBasicMaterial({ color: 0xe6edf9, transparent: true, opacity: 0.3, depthTest: true })
    ));

    const equatorPoints = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(1, 0, 0)
    ];
    octaGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(equatorPoints),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, depthTest: true })
    ));

    octaGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.2, 0, 0), new THREE.Vector3(1.2, 0, 0)]),
      new THREE.LineBasicMaterial({ color: 0x6ad1ff, transparent: true, opacity: 0.16, depthTest: true })
    ));

    octaGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -1.2), new THREE.Vector3(0, 0, 1.2)]),
      new THREE.LineBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.16, depthTest: true })
    ));

    const pickMesh = new THREE.Mesh(
      octaGeom,
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    octaGroup.add(pickMesh);

    const pointerConeHeight = 0.13;
    const pointerConeRadius = 0.05;
    const pointerLift = 0.0025;
    const pointerMaterial = new THREE.MeshStandardMaterial({
      color: 0xff3b3b,
      roughness: 0.35,
      metalness: 0.05,
      emissive: 0x320404
    });

    const pointerMarker = new THREE.Group();
    pointerMarker.renderOrder = 5;

    const pointerOuterCone = new THREE.Mesh(
      new THREE.ConeGeometry(pointerConeRadius, pointerConeHeight, 26, 1),
      pointerMaterial
    );
    pointerOuterCone.position.y = pointerConeHeight * 1.5;
    pointerMarker.add(pointerOuterCone);

    const pointerInnerCone = new THREE.Mesh(
      new THREE.ConeGeometry(pointerConeRadius, pointerConeHeight, 26, 1),
      pointerMaterial
    );
    pointerInnerCone.rotation.z = Math.PI;
    pointerInnerCone.position.y = pointerConeHeight * 0.5;
    pointerMarker.add(pointerInnerCone);

    octaGroup.add(pointerMarker);

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const tempVec3 = new THREE.Vector3();
    const tempQuat = new THREE.Quaternion();
    const labelCenterLocal = new THREE.Vector3(0, 0, 0);
    const labelDefs = [
      { node: labelEmpathy, local: new THREE.Vector3(1, 0, 0) },
      { node: labelPracticality, local: new THREE.Vector3(-1, 0, 0) },
      { node: labelWisdom, local: new THREE.Vector3(0, 0, 1) },
      { node: labelKnowledge, local: new THREE.Vector3(0, 0, -1) }
    ];

    const WORLD_X = new THREE.Vector3(1, 0, 0);
    const WORLD_Y = new THREE.Vector3(0, 1, 0);
    const WORLD_Z = new THREE.Vector3(0, 0, 1);

    const state = {
      target: new THREE.Vector3(0, 0, 0),
      distance: 4.25,
      panVel: new THREE.Vector3(),
      zoomVel: 0,
      draggingPoint: false,
      rotating: false,
      lastX: 0,
      lastY: 0,
      point: new THREE.Vector3(0, 0, 0),
      pointNormal: new THREE.Vector3(0, 1, 0),
      snappedTopBottom: false,
      orientation: new THREE.Quaternion(),
      angularAxis: new THREE.Vector3(0, 1, 0),
      angularSpeed: 0,
      snapQuat: null,
      rotateGrabLocal: null,
      rotateGrabValid: false,
      lastSnapKey: null,
      surfaceLocked: false,
      stabilitySign: 1,
      hoveredSlider: null,
      hoveredAspectLabel: null
    };

    const SNAP_EPS = THREE.MathUtils.degToRad(10);
    const PAN_DAMP = 0.82;
    const ZOOM_DAMP = 0.86;
    const ANGULAR_DAMP = 0.9;
    const CANONICAL_VIEWS = [];
    const CANONICAL_SIDE_VIEWS = [];

    function makeCanonicalQuat(yaw, pitch) {
      return new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    }

    function buildCanonicalViews() {
      const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
      for (const yaw of yaws) {
        const side = { key: `side-${yaw}`, type: 'side', yaw, pitch: 0, quat: makeCanonicalQuat(yaw, 0) };
        CANONICAL_VIEWS.push(side);
        CANONICAL_SIDE_VIEWS.push(side);
        CANONICAL_VIEWS.push({ key: `top-${yaw}`, type: 'top', yaw, pitch: -Math.PI / 2, quat: makeCanonicalQuat(yaw, -Math.PI / 2) });
        CANONICAL_VIEWS.push({ key: `bottom-${yaw}`, type: 'bottom', yaw, pitch: Math.PI / 2, quat: makeCanonicalQuat(yaw, Math.PI / 2) });
      }
    }
    buildCanonicalViews();

    function setNDCFromEvent(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function syncSceneMatrices() {
      rootGroup.position.copy(state.target);
      octaGroup.quaternion.copy(state.orientation);
      rootGroup.updateMatrixWorld(true);
      camera.updateMatrixWorld();
    }

    function sliderToDomain(v) {
      return v / 100;
    }

    function bipolarFromPair(posValue) {
      return sliderToDomain(posValue) * 2 - 1;
    }

    function bipolarFromReversedPair(posValue) {
      return -bipolarFromPair(posValue);
    }

    function pairFromBipolar(t) {
      return (THREE.MathUtils.clamp(t, -1, 1) + 1) * 50;
    }

    function reversedPairFromBipolar(t) {
      return pairFromBipolar(-t);
    }

    function formatCoordValue(value) {
      const cleaned = Math.abs(value) < 5e-7 ? 0 : value;
      const formatted = cleaned.toFixed(3);
      return formatted === '-0.000' ? '0.000' : formatted;
    }

    function parseCoordValue(text) {
      const trimmed = text.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }

    function formatPercentNumber(value, { signed = false } = {}) {
      const cleaned = Math.abs(value) < 0.05 ? 0 : value;
      const rounded = Math.round(cleaned * 10) / 10;
      const whole = Math.abs(rounded - Math.round(rounded)) < 1e-9;
      const text = whole ? String(Math.round(rounded)) : rounded.toFixed(1);
      if (!signed) return `${text}%`;
      const prefix = rounded > 0 ? '+' : '';
      return `${prefix}${text}%`;
    }

    function getPairSliderKnobPercent(input) {
      return Math.abs(parseFloat(input.value) - 50) * 2;
    }

    function getAspectLabelPercent(input, side) {
      const value = parseFloat(input.value);
      return side === 'left' ? 100 - value : value;
    }

    function updateStabilitySignFromSlider(rawValue = parseFloat(stabilityEl.value)) {
      if (rawValue > 0.0001) state.stabilitySign = 1;
      else if (rawValue < -0.0001) state.stabilitySign = -1;
    }

    function updateStabilityLabels() {
      const value = parseFloat(stabilityEl.value);
      const eps = 0.0001;
      negativeStabilityLabel.classList.toggle('active', value < -eps);
      positiveStabilityLabel.classList.toggle('active', value > eps);
    }

    function updatePairLabels(leftLabel, rightLabel, axisValue, positiveSide, stabilityValue) {
      const eps = 0.0001;
      leftLabel.classList.remove('active');
      rightLabel.classList.remove('active');

      if (axisValue > eps) {
        (positiveSide === 'left' ? leftLabel : rightLabel).classList.add('active');
        return;
      }

      if (axisValue < -eps) {
        (positiveSide === 'left' ? rightLabel : leftLabel).classList.add('active');
        return;
      }

      if (stabilityValue > eps) {
        leftLabel.classList.add('active');
        rightLabel.classList.add('active');
      }
    }

    function updateAspectLabels() {
      const x = bipolarFromPair(parseFloat(practicalityEl.value));
      const z = bipolarFromReversedPair(parseFloat(wisdomEl.value));
      const stabilityValue = parseFloat(stabilityEl.value);

      updatePairLabels(practicalitySliderLabel, empathySliderLabel, x, 'right', stabilityValue);
      updatePairLabels(wisdomSliderLabel, knowledgeSliderLabel, z, 'left', stabilityValue);
    }

    function engageSurfaceLock(preferredSign = null) {
      state.surfaceLocked = true;
      if (preferredSign === 1 || preferredSign === -1) {
        state.stabilitySign = preferredSign;
        return;
      }
      updateStabilitySignFromSlider();
    }

    function pointFromControls() {
      if (!state.surfaceLocked) {
        return new THREE.Vector3(0, 0, 0);
      }

      const xAxis = bipolarFromPair(parseFloat(practicalityEl.value));
      const zAxis = bipolarFromReversedPair(parseFloat(wisdomEl.value));
      const norm = Math.max(1, Math.abs(xAxis) + Math.abs(zAxis));
      const x = xAxis / norm;
      const z = zAxis / norm;
      const yMag = Math.max(0, 1 - Math.abs(x) - Math.abs(z));
      const y = yMag * state.stabilitySign;

      stabilityEl.value = (y * 100).toFixed(3);
      return new THREE.Vector3(x, y, z);
    }

    function controlsFromPoint(point, options = {}) {
      const { preserveActiveCoordRaw = false } = options;
      const practicality = pairFromBipolar(point.x);
      const wisdom = reversedPairFromBipolar(point.z);

      practicalityEl.value = practicality.toFixed(3);
      wisdomEl.value = wisdom.toFixed(3);
      stabilityEl.value = (THREE.MathUtils.clamp(point.y, -1, 1) * 100).toFixed(3);

      if (Math.abs(point.y) > 1e-6) {
        state.stabilitySign = Math.sign(point.y);
      }
      if (Math.abs(point.x) + Math.abs(point.y) + Math.abs(point.z) > 1e-5) {
        state.surfaceLocked = true;
      }

      updateStabilityLabels();
      updateAspectLabels();
      updateCoordLabels({ preserveActiveCoordRaw });
      if (state.hoveredSlider) showSliderTooltip(state.hoveredSlider);
      if (state.hoveredAspectLabel) showAspectTooltip(state.hoveredAspectLabel);
    }

    function projectPointToOctaSurface(localPoint) {
      const manhattan = Math.abs(localPoint.x) + Math.abs(localPoint.y) + Math.abs(localPoint.z);
      if (manhattan < 1e-8) {
        return new THREE.Vector3(0, state.stabilitySign, 0);
      }
      return localPoint.clone().multiplyScalar(1 / manhattan);
    }

    function getOctaSurfaceNormal(localPoint) {
      const normal = new THREE.Vector3(
        Math.abs(localPoint.x) > 1e-6 ? Math.sign(localPoint.x) : 0,
        Math.abs(localPoint.y) > 1e-6 ? Math.sign(localPoint.y) : 0,
        Math.abs(localPoint.z) > 1e-6 ? Math.sign(localPoint.z) : 0,
      );

      if (normal.lengthSq() < 1e-8) {
        normal.set(0, state.stabilitySign >= 0 ? 1 : -1, 0);
      }

      return normal.normalize();
    }

    function updatePointerNormalFromPoint() {
      const p = state.point.clone();
      const sum = Math.abs(p.x) + Math.abs(p.y) + Math.abs(p.z);
      if (sum > 1e-8) {
        const surfacePoint = Math.abs(sum - 1) < 0.0005 ? p : projectPointToOctaSurface(p);
        state.pointNormal.copy(getOctaSurfaceNormal(surfacePoint));
      } else {
        state.pointNormal.set(0, 1, 0);
      }
    }

    function applyPointVisuals() {
      const p = state.point.clone();
      const n = state.pointNormal.clone().normalize();
      pointerMarker.position.copy(p).addScaledVector(n, 0.0025);
      tempQuat.setFromUnitVectors(WORLD_Y, n);
      pointerMarker.quaternion.copy(tempQuat);
    }

    function updateCoordLabels(options = {}) {
      const { preserveActiveCoordRaw = false } = options;
      const active = preserveActiveCoordRaw ? document.activeElement : null;

      if (active !== coordX) coordX.value = formatCoordValue(state.point.x);
      if (active !== coordY) coordY.value = formatCoordValue(state.point.y);
      if (active !== coordZ) coordZ.value = formatCoordValue(state.point.z);
    }

    function getFallbackSignForAxis(axis) {
      if (axis === 'y') {
        if (Math.abs(state.point.x) > 1e-8) return Math.sign(state.point.x);
        if (Math.abs(state.point.z) > 1e-8) return Math.sign(state.point.z);
        return 1;
      }
      return state.stabilitySign >= 0 ? 1 : -1;
    }

    function rebalancePointFromAxis(axis, rawValue) {
      const next = state.point.clone();
      const edited = THREE.MathUtils.clamp(rawValue, -1, 1);
      next[axis] = edited;

      const otherAxes = ['x', 'y', 'z'].filter((key) => key !== axis);
      const remaining = Math.max(0, 1 - Math.abs(edited));
      const otherAbsSum = Math.abs(next[otherAxes[0]]) + Math.abs(next[otherAxes[1]]);

      if (remaining < 1e-8) {
        next[otherAxes[0]] = 0;
        next[otherAxes[1]] = 0;
        return projectPointToOctaSurface(next);
      }

      if (otherAbsSum > 1e-8) {
        const scale = remaining / otherAbsSum;
        next[otherAxes[0]] *= scale;
        next[otherAxes[1]] *= scale;
      } else {
        next[otherAxes[0]] = 0;
        next[otherAxes[1]] = 0;
        const fallbackAxis = axis === 'y' ? 'x' : 'y';
        next[fallbackAxis] = remaining * getFallbackSignForAxis(axis);
      }

      return projectPointToOctaSurface(next);
    }

    function applyCoordAxisInput(axis, rawValue, preserveActiveCoordRaw = true) {
      const next = rebalancePointFromAxis(axis, rawValue);
      state.point.copy(next);
      state.surfaceLocked = true;
      if (Math.abs(next.y) > 1e-6) state.stabilitySign = Math.sign(next.y);
      updatePointerNormalFromPoint();
      applyPointVisuals();
      controlsFromPoint(next, { preserveActiveCoordRaw });
    }

    function commitCoordInput(axis, input) {
      const parsed = parseCoordValue(input.value);
      if (parsed === null) {
        input.value = formatCoordValue(state.point[axis]);
        return;
      }

      applyCoordAxisInput(axis, parsed, false);
      input.value = formatCoordValue(state.point[axis]);
    }

    function setupCoordInputs() {
      const defs = [
        { axis: 'x', input: coordX },
        { axis: 'y', input: coordY },
        { axis: 'z', input: coordZ }
      ];

      for (const { axis, input } of defs) {
        input.addEventListener('pointerdown', (event) => {
          if (document.activeElement !== input) return;
          const fullySelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;
          if (!fullySelected) return;
          event.preventDefault();
          requestAnimationFrame(() => {
            const end = input.value.length;
            input.setSelectionRange(end, end);
          });
        });

        input.addEventListener('focus', () => {
          requestAnimationFrame(() => {
            if (document.activeElement === input) input.select();
          });
        });

        input.addEventListener('input', () => {
          const parsed = parseCoordValue(input.value);
          if (parsed === null) return;
          applyCoordAxisInput(axis, parsed, true);
        });

        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commitCoordInput(axis, input);
            input.blur();
            return;
          }

          if (event.key === 'Tab') {
            commitCoordInput(axis, input);
            return;
          }

          if (event.key === 'Escape') {
            input.value = formatCoordValue(state.point[axis]);
            input.blur();
          }
        });

        input.addEventListener('blur', () => {
          commitCoordInput(axis, input);
        });
      }
    }

    function applyPointFromControls() {
      state.point.copy(pointFromControls());
      updatePointerNormalFromPoint();
      applyPointVisuals();
      updateStabilityLabels();
      updateAspectLabels();
      updateCoordLabels();
      if (state.hoveredSlider) showSliderTooltip(state.hoveredSlider);
      if (state.hoveredAspectLabel) showAspectTooltip(state.hoveredAspectLabel);
    }

    function formatSliderPercent(input) {
      const value = parseFloat(input.value);
      if (input === stabilityEl) {
        return formatPercentNumber(value, { signed: true });
      }
      return formatPercentNumber(getPairSliderKnobPercent(input));
    }

    function showSliderTooltip(input) {
      if (!input) return;
      const rect = input.getBoundingClientRect();
      const min = parseFloat(input.min || '0');
      const max = parseFloat(input.max || '100');
      const value = parseFloat(input.value);
      const ratio = max === min ? 0 : (value - min) / (max - min);
      const x = rect.left + rect.width * ratio;
      const y = rect.top;

      sliderTooltip.textContent = formatSliderPercent(input);
      sliderTooltip.style.left = `${Math.max(16, Math.min(window.innerWidth - 16, x))}px`;
      sliderTooltip.style.top = `${y}px`;
      sliderTooltip.classList.add('show');
      input.title = sliderTooltip.textContent;
    }

    function hideSliderTooltip() {
      state.hoveredSlider = null;
      sliderTooltip.classList.remove('show');
    }

    function showAspectTooltip(def) {
      if (!def) return;
      const rect = def.node.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top;

      aspectTooltip.textContent = formatPercentNumber(getAspectLabelPercent(def.input, def.side));
      aspectTooltip.style.left = `${Math.max(16, Math.min(window.innerWidth - 16, x))}px`;
      aspectTooltip.style.top = `${y}px`;
      aspectTooltip.classList.add('show');
      def.node.title = aspectTooltip.textContent;
    }

    function hideAspectTooltip() {
      state.hoveredAspectLabel = null;
      aspectTooltip.classList.remove('show');
    }

    function installSliderTooltips() {
      for (const input of rangeInputs) {
        input.addEventListener('pointerenter', () => {
          state.hoveredSlider = input;
          showSliderTooltip(input);
        });
        input.addEventListener('pointermove', () => {
          state.hoveredSlider = input;
          showSliderTooltip(input);
        });
        input.addEventListener('pointerleave', hideSliderTooltip);
        input.addEventListener('blur', hideSliderTooltip);
      }
    }

    function installAspectTooltips() {
      for (const def of aspectTooltipDefs) {
        def.node.addEventListener('pointerenter', () => {
          state.hoveredAspectLabel = def;
          showAspectTooltip(def);
        });
        def.node.addEventListener('pointermove', () => {
          state.hoveredAspectLabel = def;
          showAspectTooltip(def);
        });
        def.node.addEventListener('pointerleave', hideAspectTooltip);
      }
    }

    function setupSliders() {
      practicalityEl.addEventListener('input', () => {
        engageSurfaceLock();
        applyPointFromControls();
      });

      wisdomEl.addEventListener('input', () => {
        engageSurfaceLock();
        applyPointFromControls();
      });

      stabilityEl.addEventListener('input', () => {
        const raw = parseFloat(stabilityEl.value);
        const preferredSign = raw < 0 ? -1 : 1;
        engageSurfaceLock(preferredSign);
        applyPointFromControls();
      });

      for (const input of rangeInputs) {
        input.addEventListener('input', () => {
          if (state.hoveredSlider === input) showSliderTooltip(input);
        });
      }
    }

    function angleBetweenQuats(a, b) {
      return 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));
    }

    function nearestCanonicalSideView(quat = state.orientation) {
      let best = null;
      let bestAngle = Infinity;
      for (const entry of CANONICAL_SIDE_VIEWS) {
        const ang = angleBetweenQuats(quat, entry.quat);
        if (ang < bestAngle) {
          bestAngle = ang;
          best = entry;
        }
      }
      return { entry: best, angle: bestAngle };
    }

    function projectVectorOntoPlane(vector, planeNormal) {
      return vector.clone().addScaledVector(planeNormal, -vector.dot(planeNormal));
    }

    function getTopBottomSnapInfo(quat = state.orientation) {
      const stabilityAxisWorld = WORLD_Y.clone().applyQuaternion(quat).normalize();
      const zDot = THREE.MathUtils.clamp(stabilityAxisWorld.dot(WORLD_Z), -1, 1);
      const angle = Math.acos(Math.abs(zDot));
      const targetY = zDot >= 0 ? WORLD_Z.clone() : WORLD_Z.clone().negate();

      let targetX = WORLD_X.clone().applyQuaternion(quat);
      targetX = projectVectorOntoPlane(targetX, targetY);

      if (targetX.lengthSq() < 1e-8) {
        targetX = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
        targetX = projectVectorOntoPlane(targetX, targetY);
      }

      if (targetX.lengthSq() < 1e-8) {
        targetX = projectVectorOntoPlane(WORLD_X.clone(), targetY);
      }

      targetX.normalize();
      const targetZ = new THREE.Vector3().crossVectors(targetX, targetY).normalize();
      const snapMatrix = new THREE.Matrix4().makeBasis(targetX, targetY, targetZ);
      const snapQuat = new THREE.Quaternion().setFromRotationMatrix(snapMatrix).normalize();

      return {
        type: zDot >= 0 ? 'top' : 'bottom',
        key: zDot >= 0 ? 'top-axis' : 'bottom-axis',
        angle,
        quat: snapQuat
      };
    }

    function applySnapSlerp() {
      if (!state.snapQuat) return;
      state.orientation.slerp(state.snapQuat, 0.18);
      if (angleBetweenQuats(state.orientation, state.snapQuat) < 0.0015) {
        state.orientation.copy(state.snapQuat);
        state.snapQuat = null;
      }
    }

    function applyAngularMomentum() {
      if (state.rotating) return;
      if (state.angularSpeed > 1e-5) {
        tempQuat.setFromAxisAngle(state.angularAxis, state.angularSpeed);
        state.orientation.multiply(tempQuat).normalize();
        state.angularSpeed *= ANGULAR_DAMP;
      } else {
        state.angularSpeed = 0;
      }
    }

    function applyCamera() {
      applySnapSlerp();
      applyAngularMomentum();

      state.target.add(state.panVel);
      state.distance = Math.max(1.7, Math.min(12, state.distance + state.zoomVel));
      state.panVel.multiplyScalar(PAN_DAMP);
      state.zoomVel *= ZOOM_DAMP;

      syncSceneMatrices();
      camera.position.set(0, 0, state.distance);
      camera.lookAt(rootGroup.position);
      camera.updateMatrixWorld();
      updateSnapFlags();
    }

    function maybeSnapView() {
      const topBottom = getTopBottomSnapInfo();
      if (topBottom.angle < SNAP_EPS) {
        state.snapQuat = topBottom.quat;
        return;
      }

      const { entry, angle } = nearestCanonicalSideView();
      if (entry && angle < SNAP_EPS) {
        state.snapQuat = entry.quat.clone();
      }
    }

    function updateSnapFlags() {
      const topBottom = getTopBottomSnapInfo();
      const snappedTopBottom = topBottom.angle < 0.025;
      state.snappedTopBottom = snappedTopBottom;
      state.lastSnapKey = snappedTopBottom ? topBottom.key : null;
      rotateLeftBtn.style.display = snappedTopBottom ? '' : 'none';
      rotateRightBtn.style.display = snappedTopBottom ? '' : 'none';
      viewLabels.style.display = 'block';
      crosshair.style.display = snappedTopBottom ? 'block' : 'none';
    }

    function intersectSurface(event) {
      syncSceneMatrices();
      setNDCFromEvent(event);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObject(pickMesh, false);
      return hits.length ? hits[0] : null;
    }

    function startPointDrag(event) {
      const hit = intersectSurface(event);
      if (!hit) return false;
      state.draggingPoint = true;
      viewport.classList.add('dragging-point');
      applyHitToPoint(hit);
      return true;
    }

    function startSurfaceRotate(event) {
      const hit = intersectSurface(event);
      if (!hit) return false;
      state.rotating = true;
      state.snapQuat = null;
      state.angularSpeed = 0;
      viewport.classList.add('rotating');
      state.rotateGrabLocal = octaGroup.worldToLocal(hit.point.clone()).normalize();
      state.rotateGrabValid = true;
      return true;
    }

    function applySurfaceRotate(event) {
      if (!state.rotateGrabValid || !state.rotateGrabLocal) return;
      const hit = intersectSurface(event);
      if (!hit) return;

      const currentLocal = octaGroup.worldToLocal(hit.point.clone()).normalize();
      if (currentLocal.lengthSq() < 1e-8 || state.rotateGrabLocal.lengthSq() < 1e-8) return;

      tempQuat.setFromUnitVectors(state.rotateGrabLocal, currentLocal);
      state.orientation.multiply(tempQuat).normalize();
      syncSceneMatrices();

      const axis = tempVec3.set(tempQuat.x, tempQuat.y, tempQuat.z);
      if (axis.lengthSq() > 1e-10) {
        axis.normalize();
        state.angularAxis.copy(axis);
        state.angularSpeed = 2 * Math.acos(Math.min(1, Math.max(-1, tempQuat.w)));
      }
    }

    function applyHitToPoint(hit) {
      const localPoint = projectPointToOctaSurface(octaGroup.worldToLocal(hit.point.clone()));
      state.point.copy(localPoint);
      state.surfaceLocked = true;
      if (Math.abs(localPoint.y) > 1e-6) state.stabilitySign = Math.sign(localPoint.y);
      updatePointerNormalFromPoint();
      controlsFromPoint(localPoint);
      applyPointVisuals();
    }

    function projectWorldToScreen(worldPoint) {
      const v = worldPoint.clone().project(camera);
      return {
        x: (v.x * 0.5 + 0.5) * window.innerWidth,
        y: (-v.y * 0.5 + 0.5) * window.innerHeight,
        visible: v.z > -1 && v.z <= 1
      };
    }

    function projectLocalToScreen(localPoint) {
      const worldPoint = octaGroup.localToWorld(localPoint.clone());
      return projectWorldToScreen(worldPoint);
    }

    function isLabelOccluded(localPoint) {
      const outerLocal = localPoint.clone().multiplyScalar(1.08);
      const worldPoint = octaGroup.localToWorld(outerLocal);
      const cameraPos = camera.getWorldPosition(new THREE.Vector3());
      const dir = worldPoint.clone().sub(cameraPos);
      const dist = dir.length();
      if (dist < 1e-6) return false;

      raycaster.set(cameraPos, dir.normalize());
      const prevFar = raycaster.far;
      raycaster.far = Math.max(0.001, dist - 0.03);
      const hits = raycaster.intersectObject(pickMesh, false);
      raycaster.far = prevFar;
      return hits.length > 0;
    }

    function placeLabel(node, localPoint) {
      const baseScreen = projectLocalToScreen(localPoint);
      if (!baseScreen.visible) {
        node.style.display = 'none';
        return;
      }

      const outerScreen = projectLocalToScreen(localPoint.clone().multiplyScalar(1.22));
      let dx = outerScreen.x - baseScreen.x;
      let dy = outerScreen.y - baseScreen.y;

      if (Math.hypot(dx, dy) < 0.001) {
        const centerScreen = projectLocalToScreen(labelCenterLocal);
        dx = baseScreen.x - centerScreen.x;
        dy = baseScreen.y - centerScreen.y;
      }

      const len = Math.hypot(dx, dy) || 1;
      const offset = state.snappedTopBottom ? 34 : 28;
      const hidden = !state.snappedTopBottom && isLabelOccluded(localPoint);

      node.style.display = hidden ? 'none' : 'block';
      node.style.left = `${baseScreen.x + (dx / len) * offset}px`;
      node.style.top = `${baseScreen.y + (dy / len) * offset}px`;
      node.style.opacity = hidden ? '0' : '1';
    }

    function updateCrosshairAndLabels() {
      if (state.snappedTopBottom) {
        const pt2 = projectLocalToScreen(state.point);
        crosshair.style.left = `${pt2.x}px`;
        crosshair.style.top = `${pt2.y}px`;
      }

      for (const def of labelDefs) placeLabel(def.node, def.local);
    }

    function resetView() {
      state.snapQuat = makeCanonicalQuat(Math.PI / 4, -0.55);
      state.angularSpeed = 0;
      state.panVel.set(0, 0, 0);
      state.zoomVel = 0;
      state.target.set(0, 0, 0);
      state.surfaceLocked = false;
      state.stabilitySign = 1;
      practicalityEl.value = '50';
      wisdomEl.value = '50';
      stabilityEl.value = '0';
      applyPointFromControls();
    }

    function rotateTopView(dir) {
      if (!state.snappedTopBottom) return;
      const base = state.snapQuat ? state.snapQuat.clone() : state.orientation.clone();
      const delta = new THREE.Quaternion().setFromAxisAngle(WORLD_Z, dir * Math.PI / 2);
      state.snapQuat = delta.multiply(base).normalize();
    }

    function runSelfTests() {
      const eps = 1e-6;
      const near = (a, b, msg) => console.assert(Math.abs(a - b) < eps, msg + ` | got ${a}, expected ${b}`);
      const truthy = (v, msg) => console.assert(!!v, msg);

      state.surfaceLocked = false;
      practicalityEl.value = '50'; wisdomEl.value = '50'; stabilityEl.value = '0';
      let p = pointFromControls();
      near(p.x, 0, 'initial center x');
      near(p.y, 0, 'initial center y');
      near(p.z, 0, 'initial center z');

      state.surfaceLocked = true;
      state.stabilitySign = 1;
      practicalityEl.value = '50'; wisdomEl.value = '50';
      p = pointFromControls();
      near(p.x, 0, 'balanced positive x');
      near(p.y, 1, 'balanced positive y');
      near(p.z, 0, 'balanced positive z');

      state.stabilitySign = -1;
      p = pointFromControls();
      near(p.y, -1, 'balanced negative y');

      state.stabilitySign = 1;
      practicalityEl.value = '100'; wisdomEl.value = '50';
      p = pointFromControls();
      near(p.x, 1, 'empathy max x');
      near(p.y, 0, 'empathy max y');
      near(p.z, 0, 'empathy max z');

      practicalityEl.value = '0'; wisdomEl.value = '50';
      p = pointFromControls();
      near(p.x, -1, 'practicality max x');
      near(p.y, 0, 'practicality max y');
      near(p.z, 0, 'practicality max z');

      practicalityEl.value = '50'; wisdomEl.value = '0';
      p = pointFromControls();
      near(p.x, 0, 'wisdom max x');
      near(p.y, 0, 'wisdom max y');
      near(p.z, 1, 'wisdom max z');

      practicalityEl.value = '50'; wisdomEl.value = '100';
      p = pointFromControls();
      near(p.x, 0, 'knowledge max x');
      near(p.y, 0, 'knowledge max y');
      near(p.z, -1, 'knowledge max z');

      practicalityEl.value = '75'; wisdomEl.value = '50';
      p = pointFromControls();
      near(p.x, 0.5, 'mid empathy x');
      near(p.y, 0.5, 'mid empathy y');
      near(p.z, 0, 'mid empathy z');

      practicalityEl.value = '100'; wisdomEl.value = '0';
      p = pointFromControls();
      near(p.x, 0.5, 'dual max x projected');
      near(p.y, 0, 'dual max y projected');
      near(p.z, 0.5, 'dual max z projected');

      controlsFromPoint(new THREE.Vector3(0.5, 0.5, 0));
      near(parseFloat(practicalityEl.value), 75, 'inverse practicality-axis slider from surface point');
      near(parseFloat(wisdomEl.value), 50, 'inverse wisdom from surface point');
      near(parseFloat(stabilityEl.value), 50, 'inverse stability from surface point');

      controlsFromPoint(new THREE.Vector3(0, 0, 1));
      near(parseFloat(wisdomEl.value), 0, 'inverse wisdom slider reaches left for wisdom');

      controlsFromPoint(new THREE.Vector3(0, 0, -1));
      near(parseFloat(wisdomEl.value), 100, 'inverse wisdom slider reaches right for knowledge');

      const projected = projectPointToOctaSurface(new THREE.Vector3(0.2, 0.2, 0));
      near(projected.x, 0.5, 'projected drag point x');
      near(projected.y, 0.5, 'projected drag point y');
      near(projected.z, 0, 'projected drag point z');
      truthy(getOctaSurfaceNormal(new THREE.Vector3(0.5, 0.5, 0)).distanceTo(new THREE.Vector3(1, 1, 0).normalize()) < eps, 'drag normal matches octa face');

      state.point.set(0, 1, 0);
      let manual = rebalancePointFromAxis('x', -0.4);
      near(manual.x, -0.4, 'coord edit x keeps edited value');
      near(manual.y, 0.6, 'coord edit x rebalances y');
      near(manual.z, 0, 'coord edit x keeps z at zero');

      state.point.set(0.5, 0.5, 0);
      manual = rebalancePointFromAxis('z', 0.25);
      near(manual.x, 0.375, 'coord edit z rescales x');
      near(manual.y, 0.375, 'coord edit z rescales y');
      near(manual.z, 0.25, 'coord edit z keeps edited z');
      truthy(formatCoordValue(-0.4) === '-0.400', 'coord format pads leading zero and decimals');

      const qTop = makeCanonicalQuat(0, -Math.PI / 2);
      truthy(getTopBottomSnapInfo(qTop).type === 'top', 'top-bottom snapping recognizes top');

      stabilityEl.value = '0';
      updateStabilityLabels();
      truthy(!negativeStabilityLabel.classList.contains('active'), 'negative label inactive at zero');
      truthy(!positiveStabilityLabel.classList.contains('active'), 'positive label inactive at zero');
    }

    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      state.zoomVel += e.deltaY * 0.0016;
    }, { passive: false });

    renderer.domElement.addEventListener('pointerdown', (e) => {
      state.lastX = e.clientX;
      state.lastY = e.clientY;

      if (e.button === 0) {
        if (startPointDrag(e)) {
          e.preventDefault();
          renderer.domElement.setPointerCapture(e.pointerId);
          return;
        }
      }

      if (e.button === 2) {
        if (startSurfaceRotate(e)) {
          e.preventDefault();
          renderer.domElement.setPointerCapture(e.pointerId);
          return;
        }
      }

      if (e.button === 1) {
        e.preventDefault();
        return;
      }
    });

    renderer.domElement.addEventListener('pointermove', (e) => {
      state.lastX = e.clientX;
      state.lastY = e.clientY;

      if (state.draggingPoint) {
        const hit = intersectSurface(e);
        if (hit) applyHitToPoint(hit);
        return;
      }

      if (state.rotating) {
        applySurfaceRotate(e);
        return;
      }
    });

    function endPointer(e) {
      if (state.draggingPoint) {
        state.draggingPoint = false;
        viewport.classList.remove('dragging-point');
      }
      if (state.rotating) {
        state.rotating = false;
        state.rotateGrabLocal = null;
        state.rotateGrabValid = false;
        viewport.classList.remove('rotating');
        maybeSnapView();
      }
      try { renderer.domElement.releasePointerCapture(e.pointerId); } catch {}
    }

    renderer.domElement.addEventListener('pointerup', endPointer);
    renderer.domElement.addEventListener('pointercancel', endPointer);

    resetBtn.addEventListener('click', resetView);
    rotateLeftBtn.addEventListener('click', () => rotateTopView(-1));
    rotateRightBtn.addEventListener('click', () => rotateTopView(1));

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (state.hoveredSlider) showSliderTooltip(state.hoveredSlider);
      if (state.hoveredAspectLabel) showAspectTooltip(state.hoveredAspectLabel);
    });

    function setPointFromExternal(point) {
      if (!point || typeof point !== 'object') return;
      const x = Number(point.x);
      const y = Number(point.y);
      const z = Number(point.z);
      if (![x, y, z].every(Number.isFinite)) return;
      state.point.set(x, y, z);
      state.surfaceLocked = Math.abs(x) + Math.abs(y) + Math.abs(z) > 0.0001;
      if (Math.abs(y) > 1e-6) state.stabilitySign = Math.sign(y);
      updatePointerNormalFromPoint();
      applyPointVisuals();
      controlsFromPoint(state.point);
    }

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'set-point') {
        setPointFromExternal(event.data.point);
      }
    });

    function animate() {
      requestAnimationFrame(animate);
      applyCamera();
      pointerMarker.visible = !state.snappedTopBottom;
      updateCrosshairAndLabels();
      renderer.render(scene, camera);
    }

    installSliderTooltips();
    installAspectTooltips();
    setupSliders();
    setupCoordInputs();
    applyPointFromControls();
    resetView();
    runSelfTests();
    animate();
  
