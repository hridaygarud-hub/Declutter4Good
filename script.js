import * as THREE from 'https://esm.sh/three@0.161.0';
import { GLTFLoader } from 'https://esm.sh/three@0.161.0/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'https://esm.sh/three@0.161.0/examples/jsm/controls/OrbitControls';

window.history.scrollRestoration = "manual";

window.scrollTo(0, 0);

// Setup GSAP
gsap.registerPlugin(ScrollTrigger);

let scene, camera, renderer, mixer, controls;
let model, particles;
const clock = new THREE.Clock();
let isDebugMode = false;
let clips = [];

// Calibration-friendly Camera Focus Views
// These coordinates can be fine-tuned using the calibration tool (Press 'D')
const cameraViews = [
  { // 0: Start / Hero (Overview)
    px: 0, py: 100, pz: 220,
    tx: -0.19, ty: 5.77, tz: -0.80
  },
  { // 1: The Desk
    px: -20, py: 100, pz: 60,
    tx: 150, ty: 4.81, tz: 100
  },
  {
    px: 10, py: 120, pz: 120,
    tx: -2.99, ty: 5.64, tz: -9.58
  },
  { // 3: The Side Table
    px: 90, py: 200, pz: -100,
    tx: -2.99, ty: 10, tz: -9.58
  },
  { // Floor / Rug - looking at entrance rug from back
    px: 70, py: 100, pz: 150,
    tx: 0.5, ty: -100, tz: 9
  },

  { // 5: The Coffee Table
    px: -1.35, py: 100, pz: 4.81,
    tx: 2.02, ty: 1.90, tz: 4.30
  },

  { // 6: Clean Room (Final zoom out overview)
    px: 0, py: 100, pz: 220,
    tx: -0.19, ty: 5.77, tz: -0.80
  },

  { // 6: Clean Room (Final zoom out overview)
    px: 0, py: 100, pz: 220,
    tx: -0.19, ty: 5.77, tz: -0.80
  }
];

// Current animated values mapped by GSAP
const cameraTargetVal = {
  px: cameraViews[0].px,
  py: cameraViews[0].py,
  pz: cameraViews[0].pz,
  tx: cameraViews[0].tx,
  ty: cameraViews[0].ty,
  tz: cameraViews[0].tz
};

// Initialize custom cursor
function initCursor() {
  const cursorDot = document.querySelector('.custom-cursor-dot');
  const cursorOutline = document.querySelector('.custom-cursor-outline');

  let mouseX = 0, mouseY = 0;
  let outlineX = 0, outlineY = 0;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    cursorDot.style.left = mouseX + 'px';
    cursorDot.style.top = mouseY + 'px';
  });

  function updateCursor() {
    const dx = mouseX - outlineX;
    const dy = mouseY - outlineY;

    outlineX += dx * 0.15;
    outlineY += dy * 0.15;

    cursorOutline.style.left = outlineX + 'px';
    cursorOutline.style.top = outlineY + 'px';

    requestAnimationFrame(updateCursor);
  }
  updateCursor();

  // Add hover classes
  const interactives = document.querySelectorAll('a, button, .pill, .process-item, .nav-links li, .include-item, #copyCoords');
  interactives.forEach(el => {
    el.addEventListener('mouseenter', () => {
      document.body.classList.add('hover-interactive');
    });
    el.addEventListener('mouseleave', () => {
      document.body.classList.remove('hover-interactive');
    });
  });
}

function initThree() {
  const canvas = document.getElementById('glCanvas');

  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(cameraViews[0].px, cameraViews[0].py, cameraViews[0].pz);

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // OrbitControls for calibration/debug
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enabled = false; // Disabled by default, enabled in debug mode
  controls.target.set(cameraViews[0].tx, cameraViews[0].ty, cameraViews[0].tz);
  controls.update();

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfffdfa, 1.5);
  keyLight.position.set(30, 50, 40);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.bias = -0.001;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xd9e8ff, 0.8);
  fillLight.position.set(-30, 20, -40);
  scene.add(fillLight);

  // Floating Particles
  const particleGeo = new THREE.BufferGeometry();
  const particleCount = 400;
  const posArray = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 80;
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

  // Soft circle texture using simple canvas
  const canvasParticle = document.createElement('canvas');
  canvasParticle.width = 16;
  canvasParticle.height = 16;
  const ctx = canvasParticle.getContext('2d');
  const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 16, 16);
  const texture = new THREE.CanvasTexture(canvasParticle);

  const particleMat = new THREE.PointsMaterial({
    size: 0.25,
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: 0xF5EFE4
  });

  particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // Loading Manager
  const manager = new THREE.LoadingManager();
  const loaderBar = document.getElementById('loaderBar');
  const loaderStatus = document.getElementById('loaderStatus');
  const loadingScreen = document.getElementById('loadingScreen');

  manager.onProgress = (url, itemsLoaded, itemsTotal) => {
    const progress = (itemsLoaded / itemsTotal) * 100;
    loaderBar.style.width = progress + '%';
    loaderStatus.innerText = `Loading Room... ${Math.round(progress)}%`;
  };

  manager.onLoad = () => {
    setTimeout(() => {
      loadingScreen.style.opacity = 0;
      loadingScreen.style.visibility = 'hidden';
      window.scrollTo(0, 0);

      initScrollAnimation();
    }, 500);
  };

  // Load Room GLB
  const loader = new GLTFLoader(manager);
  loader.load('FinalRoomFinal.glb', (gltf) => {
    model = gltf.scene;

    // Scale and position adjustment if needed
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(model);

    // Calculate boundary sizes for calibration help
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    console.log('Model details:', { size, center });

    // Initialize animation mixer
    if (gltf.animations && gltf.animations.length > 0) {
      clips = gltf.animations;
      mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(clips[0]);
      action.play();
      mixer.setTime(0); // Start at frame 0
    }
  }, undefined, (err) => {
    console.error('Error loading room GLB:', err);
    loaderStatus.innerText = 'Failed to load room model.';
  });

  window.addEventListener('resize', onWindowResize);
  setupDebugControls();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// SETUP GSAP SCROLL STORY
function initScrollAnimation() {
  const panels = document.querySelectorAll('.story-panel');
  const numPanels = panels.length; // 7 panels

  // Timeline to scrub camera variables
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: ".scroll-container",
      start: "top top",
      end: `+=${(numPanels - 1) * 100}%`,
      scrub: 1.2,
      pin: true,
      onUpdate: (self) => {
        if (isDebugMode) return; // Freeze scroll controls when calibrating camera

        const progress = self.progress;
        // Divide progress into segments matching the camera timeline
        const camSegment = 1 / (numPanels - 1);
        const index = Math.min(Math.round(progress / camSegment), numPanels - 1);

        // Update active classes for overlay text card fade-ins
        panels.forEach((panel, idx) => {
          const card = panel.querySelector('.panel-card');
          if (idx === index) {
            panel.classList.add('active');
            if (card) card.classList.add('visible');
          } else {
            panel.classList.remove('active');
            if (card) card.classList.remove('visible');
          }
        });

        // The camera timeline has (numPanels - 1) segments.
        // Scrub the cleaning animation during the very last segment of the camera timeline.

        if (progress >= (numPanels - 2) * camSegment) {
          const finalProgress = (progress - ((numPanels - 2) * camSegment)) / camSegment; // 0 to 1
          scrubCleaningAnimation(finalProgress);
        } else {
          scrubCleaningAnimation(0);
        }
      }
    }
  });

  // Construct camera views tween steps
  for (let i = 1; i < cameraViews.length; i++) {
    tl.to(cameraTargetVal, {
      px: cameraViews[i].px,
      py: cameraViews[i].py,
      pz: cameraViews[i].pz,
      tx: cameraViews[i].tx,
      ty: cameraViews[i].ty,
      tz: cameraViews[i].tz,
      ease: "power2.inOut",
      duration: 1
    });
  }

  // Navbar background change on scroll past first screen
  const navEl = document.querySelector('nav');
  if (navEl) {
    ScrollTrigger.create({
      trigger: "#panel-desk",
      start: "top center",
      onEnter: () => navEl.classList.add('scrolled'),
      onLeaveBack: () => navEl.classList.remove('scrolled')
    });
  }

  // Fade out 3D canvas when entering the solid content blocks for performance optimization
  ScrollTrigger.create({
    trigger: ".tagline-band",
    start: "top bottom",
    onEnter: () => gsap.to(renderer.domElement, { opacity: 0, duration: 0.6 }),
    onLeaveBack: () => gsap.to(renderer.domElement, { opacity: 1, duration: 0.6 })
  });
}

// Scrub the clearing animation based on scroll progress of final panel
function scrubCleaningAnimation(progress) {
  if (!mixer || clips.length === 0) return;
  const action = mixer.clipAction(clips[0]);
  const duration = action.getClip().duration;

  // Set the animation time relative to final step scroll progress
  mixer.setTime(progress * duration);
}

// DEBUG / CALIBRATION SYSTEM
function setupDebugControls() {
  const debugPanel = document.getElementById('debugPanel');
  const canvas = document.getElementById('glCanvas');
  const copyBtn = document.getElementById('copyCoords');

  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'd') {
      isDebugMode = !isDebugMode;
      if (isDebugMode) {
        debugPanel.style.display = 'block';
        controls.enabled = true;
        canvas.classList.add('clickable');
        console.log('Camera calibration enabled. Use mouse to position camera, then copy coordinates.');
      } else {
        debugPanel.style.display = 'none';
        controls.enabled = false;
        canvas.classList.remove('clickable');
      }
    }
  });

  copyBtn.addEventListener('click', () => {
    const pos = camera.position;
    const target = controls.target;
    const coords = {
      px: parseFloat(pos.x.toFixed(2)),
      py: parseFloat(pos.y.toFixed(2)),
      pz: parseFloat(pos.z.toFixed(2)),
      tx: parseFloat(target.x.toFixed(2)),
      ty: parseFloat(target.y.toFixed(2)),
      tz: parseFloat(target.z.toFixed(2))
    };
    const jsonStr = JSON.stringify(coords, null, 2);

    navigator.clipboard.writeText(jsonStr).then(() => {
      alert('Copied Camera View JSON to Clipboard:\n' + jsonStr);
    }).catch(err => {
      console.error('Failed to copy coordinates:', err);
    });
  });
}

function updateDebugDisplay() {
  if (!isDebugMode) return;
  const pos = camera.position;
  const target = controls.target;
  document.getElementById('camPos').innerText = `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`;
  document.getElementById('camTarget').innerText = `${target.x.toFixed(2)}, ${target.y.toFixed(2)}, ${target.z.toFixed(2)}`;
}

// RENDER LOOP
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (isDebugMode) {
    controls.update();
    updateDebugDisplay();
  } else {
    // Interpolate camera to the values set by GSAP ScrollTrigger
    camera.position.x += (cameraTargetVal.px - camera.position.x) * 0.1;
    camera.position.y += (cameraTargetVal.py - camera.position.y) * 0.1;
    camera.position.z += (cameraTargetVal.pz - camera.position.z) * 0.1;

    // Manually focus camera on target
    const currentTarget = new THREE.Vector3(
      controls.target.x + (cameraTargetVal.tx - controls.target.x) * 0.1,
      controls.target.y + (cameraTargetVal.ty - controls.target.y) * 0.1,
      controls.target.z + (cameraTargetVal.tz - controls.target.z) * 0.1
    );
    controls.target.copy(currentTarget);
    camera.lookAt(currentTarget);
  }

  // Animate dust particles for premium live look
  if (particles) {
    particles.rotation.y += 0.0006;
    particles.rotation.x += 0.0003;
  }

  renderer.render(scene, camera);
}

// Start website engine
initCursor();
initThree();
animate();
