import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const InteractiveField: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check WebGL availability
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch (e) {
      console.warn('WebGL not available for interactive field:', e);
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.set(0, 25, 45);
    camera.lookAt(0, 0, 0);

    // Particle Grid Definition
    const rows = 65;
    const cols = 65;
    const count = rows * cols;
    const spacing = 1.6;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const basePositions = new Float32Array(count * 3);

    const color1 = new THREE.Color('#6366f1'); // Indigo
    const color2 = new THREE.Color('#10b981'); // Mint
    const color3 = new THREE.Color('#f59e0b'); // Amber

    let index = 0;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const x = (i - rows / 2) * spacing;
        const z = (j - cols / 2) * spacing;
        const y = 0;

        positions[index * 3] = x;
        positions[index * 3 + 1] = y;
        positions[index * 3 + 2] = z;

        basePositions[index * 3] = x;
        basePositions[index * 3 + 1] = y;
        basePositions[index * 3 + 2] = z;

        // Radial color mix
        const distFromCenter = Math.sqrt(x * x + z * z) / 45;
        const mixedColor = new THREE.Color();
        if (distFromCenter < 0.4) {
          mixedColor.lerpColors(color1, color2, distFromCenter * 2);
        } else {
          mixedColor.lerpColors(color2, color3, (distFromCenter - 0.4) * 1.5);
        }

        colors[index * 3] = mixedColor.r;
        colors[index * 3 + 1] = mixedColor.g;
        colors[index * 3 + 2] = mixedColor.b;

        index++;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Particle Texture creation
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.3, 'rgba(255,255,255,0.7)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      map: texture,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Mouse Interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      targetMouseX = (clientX / width - 0.5) * 2;
      targetMouseY = -(clientY / height - 0.5) * 2;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Handle Resize
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth || window.innerWidth;
      const newHeight = container.clientHeight || window.innerHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Smooth mouse interpolation
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      // Subtle camera panning based on mouse
      camera.position.x = mouseX * 8;
      camera.position.y = 25 + mouseY * 4;
      camera.lookAt(0, 0, 0);

      const positionAttr = geometry.attributes.position as THREE.BufferAttribute;
      const posArray = positionAttr.array as Float32Array;

      for (let k = 0; k < count; k++) {
        const bx = basePositions[k * 3];
        const bz = basePositions[k * 3 + 2];

        // Complex undulating wave calculation
        const wave1 = Math.sin(bx * 0.15 + elapsedTime * 1.2) * 1.4;
        const wave2 = Math.cos(bz * 0.15 + elapsedTime * 0.9) * 1.4;
        const wave3 = Math.sin((bx + bz) * 0.08 + elapsedTime * 1.5) * 1.8;

        // Interactive cursor ripple
        const dx = bx - mouseX * 25;
        const dz = bz - mouseY * 25;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const cursorInfluence = Math.max(0, 1 - dist / 16) * 3.5;

        posArray[k * 3 + 1] = wave1 + wave2 + wave3 + cursorInfluence;
      }

      positionAttr.needsUpdate = true;
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-60 mix-blend-screen"
      aria-hidden="true"
    />
  );
};
