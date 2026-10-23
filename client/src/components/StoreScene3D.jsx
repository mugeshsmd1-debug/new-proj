import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function StoreScene3D({ className = '' }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 200;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 2, 7);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Group for entire rotating model
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Core 3D Diamond / Crystal Store Hub
    const coreGeo = new THREE.OctahedronGeometry(1.2, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x6366f1, // Indigo
      emissive: 0x4338ca,
      emissiveIntensity: 0.6,
      roughness: 0.15,
      metalness: 0.85,
      wireframe: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    mainGroup.add(coreMesh);

    // Outer wireframe cage
    const wireGeo = new THREE.IcosahedronGeometry(1.6, 1);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8, // Sky blue
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    mainGroup.add(wireMesh);

    // Orbiting Floating 3D Product Cubes
    const cubesGroup = new THREE.Group();
    mainGroup.add(cubesGroup);

    const cubeColors = [0x10b981, 0xf59e0b, 0xec4899, 0x8b5cf6];
    const orbitingCubes = [];

    for (let i = 0; i < 4; i++) {
      const cGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
      const cMat = new THREE.MeshStandardMaterial({
        color: cubeColors[i],
        roughness: 0.3,
        metalness: 0.7,
      });
      const cube = new THREE.Mesh(cGeo, cMat);
      cubesGroup.add(cube);
      orbitingCubes.push({
        mesh: cube,
        angle: (i * Math.PI) / 2,
        speed: 0.015 + i * 0.003,
        radius: 2.2,
        yOffset: (i - 1.5) * 0.4,
      });
    }

    // Glowing Particle Ring
    const particlesCount = 180;
    const posArray = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount; i++) {
      const angle = (i / particlesCount) * Math.PI * 2;
      const radius = 2.6 + (Math.random() - 0.5) * 0.6;
      posArray[i * 3] = Math.cos(angle) * radius;
      posArray[i * 3 + 1] = (Math.random() - 0.5) * 0.8;
      posArray[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.05,
      color: 0xa855f7,
      transparent: true,
      opacity: 0.7,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    mainGroup.add(particleSystem);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x6366f1, 4, 15);
    pointLight1.position.set(4, 4, 4);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x06b6d4, 3, 15);
    pointLight2.position.set(-4, -2, -4);
    scene.add(pointLight2);

    // Mouse Tracking for Interactive 3D Parallax
    let targetRotationX = 0;
    let targetRotationY = 0;
    let mouseX = 0;
    let mouseY = 0;

    const onMouseMove = (event) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((event.clientX - rect.left) / width) * 2 - 1;
      mouseY = -(((event.clientY - rect.top) / height) * 2 - 1);
      targetRotationY = mouseX * 0.6;
      targetRotationX = -mouseY * 0.4;
    };

    container.addEventListener('mousemove', onMouseMove);

    // Click effect (burst spin)
    let spinSpeed = 0.01;
    const onClick = () => {
      spinSpeed = 0.07;
      coreMat.emissiveIntensity = 1.4;
      setTimeout(() => {
        spinSpeed = 0.01;
        coreMat.emissiveIntensity = 0.6;
      }, 500);
    };
    container.addEventListener('click', onClick);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth camera / scene tilt interpolation
      mainGroup.rotation.y += (targetRotationY - mainGroup.rotation.y) * 0.05 + spinSpeed;
      mainGroup.rotation.x += (targetRotationX - mainGroup.rotation.x) * 0.05;

      // Floating bobbing motion
      mainGroup.position.y = Math.sin(elapsedTime * 1.5) * 0.15;

      // Core rotation & wireframe rotation
      coreMesh.rotation.y = elapsedTime * 0.8;
      coreMesh.rotation.x = Math.sin(elapsedTime * 0.5) * 0.4;
      wireMesh.rotation.y = -elapsedTime * 0.4;
      wireMesh.rotation.z = Math.cos(elapsedTime * 0.4) * 0.2;

      // Orbiting cubes
      orbitingCubes.forEach((item) => {
        item.angle += item.speed;
        item.mesh.position.x = Math.cos(item.angle) * item.radius;
        item.mesh.position.z = Math.sin(item.angle) * item.radius;
        item.mesh.position.y = item.yOffset + Math.sin(elapsedTime * 2 + item.angle) * 0.2;
        item.mesh.rotation.x += 0.02;
        item.mesh.rotation.y += 0.03;
      });

      // Particle system rotation
      particleSystem.rotation.y = -elapsedTime * 0.2;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('click', onClick);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`relative cursor-pointer select-none ${className}`}
      title="Click 3D Store Core for energy pulse!"
    />
  );
}
