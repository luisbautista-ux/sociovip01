"use client";

import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export function BusinessMap3D({ businessName, address }: { businessName: string; address?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050510");

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 12;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    // Grid Floor (Cyberpunk / Layla Style)
    const gridHelper = new THREE.GridHelper(50, 50, 0x4433ff, 0x111122);
    gridHelper.position.y = -5;
    scene.add(gridHelper);

    // Glowing Globe
    const geometry = new THREE.SphereGeometry(4, 64, 64);
    const material = new THREE.MeshPhongMaterial({
      color: 0x1a1a3a,
      emissive: 0x112244,
      specular: 0x888888,
      shininess: 100,
      wireframe: true,
    });
    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // Inner Solid Core
    const coreGeo = new THREE.SphereGeometry(3.9, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x050515 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // Atmosphere Glow
    const glowGeo = new THREE.SphereGeometry(4.5, 64, 64);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glow);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pLight1 = new THREE.PointLight(0x7c3aed, 1.5);
    pLight1.position.set(10, 10, 10);
    scene.add(pLight1);

    const pLight2 = new THREE.PointLight(0xff0088, 1);
    pLight2.position.set(-10, -5, 5);
    scene.add(pLight2);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;
    controls.enableZoom = false;

    const animate = () => {
      requestAnimationFrame(animate);
      globe.rotation.y += 0.002;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (containerRef.current) containerRef.current.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Floating UI Elements */}
      <div className="absolute top-8 left-8 p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-700">
        <h3 className="text-white font-bold text-2xl tracking-tight">Mapa 3D en vivo</h3>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <p className="text-white/50 text-xs uppercase tracking-widest font-semibold">{address || "Ubicación detectada"}</p>
        </div>
      </div>

      {/* Decorative circle */}
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-600/10 rounded-full blur-[100px]" />
    </div>
  );
}
