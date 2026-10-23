import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Layers, Flame, Store, RotateCcw, Box, Sparkles, ShoppingBag } from 'lucide-react';
import ProductIcon from './ProductIcon';

export default function Warehouse3D({ products = [], currencySymbol = '₹', onSelectProduct }) {
  const mountRef = useRef(null);
  const [hoveredProduct, setHoveredProduct] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [displayMode, setDisplayMode] = useState('planogram'); // 'planogram', 'heatmap', 'warehouse'

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 480;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16); // Deep slate

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 11, 18);
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Floor & Grid
    const gridHelper = new THREE.GridHelper(30, 30, 0x4f46e5, 0x1e293b);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    const floorGeo = new THREE.PlaneGeometry(36, 36);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090e17,
      roughness: 0.85,
      metalness: 0.25,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(12, 22, 12);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const blueLight = new THREE.PointLight(0x6366f1, 2.5, 25);
    blueLight.position.set(-12, 8, -6);
    scene.add(blueLight);

    const heatLight = new THREE.PointLight(0xf43f5e, displayMode === 'heatmap' ? 3 : 0.5, 25);
    heatLight.position.set(12, 8, -6);
    scene.add(heatLight);

    // Interactive Meshes Group
    const interactiveMeshes = [];
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Sort products by category to form Aisles
    const categories = [...new Set(products.map((p) => p.category || 'General'))];

    if (displayMode === 'planogram' || displayMode === 'heatmap') {
      // ----------------------------------------------------
      // SUPERMARKET AISLE & SHELF PLANOGRAM
      // ----------------------------------------------------
      const aisleCount = Math.max(1, Math.min(4, categories.length));
      const shelfWidth = 2.4;
      const shelfHeight = 3.6;
      const shelfDepth = 1.0;
      const aisleSpacing = 5.5;

      categories.slice(0, 4).forEach((category, aisleIdx) => {
        const aisleX = (aisleIdx - (aisleCount - 1) / 2) * aisleSpacing;
        const aisleProducts = products.filter((p) => (p.category || 'General') === category);

        // Rack Uprights (Vertical metal posts)
        const postGeo = new THREE.BoxGeometry(0.12, shelfHeight, 0.12);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });

        [
          [-shelfWidth / 2, -shelfDepth / 2],
          [shelfWidth / 2, -shelfDepth / 2],
          [-shelfWidth / 2, shelfDepth / 2],
          [shelfWidth / 2, shelfDepth / 2],
        ].forEach(([px, pz]) => {
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(aisleX + px, shelfHeight / 2, pz);
          post.castShadow = true;
          mainGroup.add(post);
        });

        // 3 Horizontal Shelves
        const shelfLevels = [0.6, 1.8, 3.0];
        shelfLevels.forEach((levelY) => {
          const plankGeo = new THREE.BoxGeometry(shelfWidth, 0.08, shelfDepth);
          const plankMat = new THREE.MeshStandardMaterial({
            color: displayMode === 'heatmap' ? 0x1e1b4b : 0x475569,
            metalness: 0.5,
            roughness: 0.5,
          });
          const plank = new THREE.Mesh(plankGeo, plankMat);
          plank.position.set(aisleX, levelY, 0);
          plank.receiveShadow = true;
          mainGroup.add(plank);
        });

        // Overhead Aisle Header Signboard
        const signGeo = new THREE.BoxGeometry(2.2, 0.45, 0.15);
        const signMat = new THREE.MeshStandardMaterial({
          color: displayMode === 'heatmap' ? 0xe11d48 : 0x4338ca,
          roughness: 0.4,
        });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(aisleX, shelfHeight + 0.3, 0);
        mainGroup.add(sign);

        // Populate Products onto Shelf levels
        aisleProducts.forEach((prod, itemIdx) => {
          const levelIdx = itemIdx % shelfLevels.length;
          const levelY = shelfLevels[levelIdx];
          const slotX = aisleX + (itemIdx % 2 === 0 ? -0.55 : 0.55);
          const slotZ = 0;

          const stock = prod.stock_quantity;
          const isLowStock = stock <= prod.low_stock_threshold && stock > 0;
          const isOutOfStock = stock === 0;

          // Heatmap coloring based on sales price * stock or velocity
          let boxColor;
          if (displayMode === 'heatmap') {
            const revenuePotential = prod.selling_price * Math.max(1, stock);
            if (revenuePotential > 1000) {
              boxColor = 0x10b981; // High value / Hot (Emerald)
            } else if (revenuePotential > 400) {
              boxColor = 0xf59e0b; // Moderate (Amber)
            } else {
              boxColor = 0xf43f5e; // Cold / Low movement (Rose)
            }
          } else {
            // Planogram stock color
            boxColor = isOutOfStock ? 0xef4444 : isLowStock ? 0xf59e0b : 0x38bdf8;
          }

          const boxH = isOutOfStock ? 0.2 : Math.min(0.85, 0.4 + (stock / 20) * 0.4);
          const boxGeo = new THREE.BoxGeometry(0.75, boxH, 0.7);
          const boxMat = new THREE.MeshStandardMaterial({
            color: boxColor,
            roughness: 0.35,
            metalness: displayMode === 'heatmap' ? 0.6 : 0.2,
            transparent: isOutOfStock,
            opacity: isOutOfStock ? 0.4 : 0.95,
          });

          const boxMesh = new THREE.Mesh(boxGeo, boxMat);
          boxMesh.position.set(slotX, levelY + 0.04 + boxH / 2, slotZ);
          boxMesh.castShadow = true;
          boxMesh.receiveShadow = true;
          boxMesh.userData = { product: prod, initialY: levelY + 0.04 + boxH / 2 };

          mainGroup.add(boxMesh);
          interactiveMeshes.push(boxMesh);
        });
      });
    } else {
      // ----------------------------------------------------
      // WAREHOUSE PALLET STACKS
      // ----------------------------------------------------
      const cols = 6;
      const spacingX = 3.2;
      const spacingZ = 3.4;

      products.forEach((prod, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const posX = (col - (cols - 1) / 2) * spacingX;
        const posZ = (row - 1) * spacingZ;

        // Pallet
        const palletGeo = new THREE.BoxGeometry(2.2, 0.2, 2.2);
        const palletMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
        const pallet = new THREE.Mesh(palletGeo, palletMat);
        pallet.position.set(posX, 0.1, posZ);
        pallet.receiveShadow = true;
        mainGroup.add(pallet);

        const stock = prod.stock_quantity;
        const isLowStock = stock <= prod.low_stock_threshold && stock > 0;
        const isOutOfStock = stock === 0;

        const color = isOutOfStock ? 0xef4444 : isLowStock ? 0xf59e0b : 0x10b981;
        const stackHeight = isOutOfStock ? 0.3 : Math.min(3.2, Math.max(0.6, (stock / 30) * 2.8));

        const crateGeo = new THREE.BoxGeometry(1.8, stackHeight, 1.8);
        const crateMat = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.4,
          metalness: 0.3,
          transparent: isOutOfStock,
          opacity: isOutOfStock ? 0.45 : 0.95,
        });

        const crate = new THREE.Mesh(crateGeo, crateMat);
        crate.position.set(posX, 0.2 + stackHeight / 2, posZ);
        crate.castShadow = true;
        crate.receiveShadow = true;
        crate.userData = { product: prod, initialY: 0.2 + stackHeight / 2 };

        mainGroup.add(crate);
        interactiveMeshes.push(crate);
      });
    }

    // Raycaster for Hover & Selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (event) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -(((event.clientY - rect.top) / height) * 2 - 1);

      setMousePos({ x: event.clientX - rect.left, y: event.clientY - rect.top });

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        setHoveredProduct(hit.userData.product);
        container.style.cursor = 'pointer';
      } else {
        setHoveredProduct(null);
        container.style.cursor = 'default';
      }
    };

    const handleClick = () => {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes);
      if (intersects.length > 0 && onSelectProduct) {
        onSelectProduct(intersects[0].object.userData.product);
      }
    };

    container.addEventListener('mousemove', handlePointerMove);
    container.addEventListener('click', handleClick);

    // Camera Orbit Mouse Drag
    let isDragging = false;
    let prevMouseX = 0;
    let currentOrbitAngle = 0;

    const onMouseDown = (e) => {
      if (e.button === 0) {
        isDragging = true;
        prevMouseX = e.clientX;
      }
    };
    const onMouseUp = () => {
      isDragging = false;
    };
    const onDragMove = (e) => {
      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        prevMouseX = e.clientX;
        currentOrbitAngle += deltaX * 0.007;
      }
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onDragMove);

    // Animation Loop
    let animId;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Subtle float for hovered mesh
      interactiveMeshes.forEach((mesh) => {
        if (mesh.userData.product === hoveredProduct) {
          mesh.position.y = mesh.userData.initialY + Math.sin(elapsedTime * 6) * 0.12;
        } else {
          mesh.position.y = mesh.userData.initialY;
        }
      });

      // Smooth camera orbit
      const radius = 20;
      const angle = currentOrbitAngle + (isDragging ? 0 : elapsedTime * 0.04);
      camera.position.x = Math.sin(angle) * radius;
      camera.position.z = Math.cos(angle) * radius;
      camera.position.y = 11 + Math.sin(angle * 0.5) * 1.5;
      camera.lookAt(0, 1.8, 0);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousemove', handlePointerMove);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onDragMove);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [products, displayMode, onSelectProduct]);

  return (
    <div className="relative w-full h-[520px] rounded-3xl overflow-hidden bg-slate-950 border border-slate-700/80 shadow-2xl flex flex-col justify-between">
      {/* Top 3D Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-slate-700 shadow-lg text-xs">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="font-extrabold text-white">Interactive 3D Twin</span>
          <span className="text-slate-400 font-mono text-[10px]">
            {products.length} Products Loaded
          </span>
        </div>

        {/* 3D Mode Selector Chips */}
        <div className="flex items-center bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl border border-slate-700 shadow-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setDisplayMode('planogram')}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition ${
              displayMode === 'planogram'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Store Planogram</span>
          </button>

          <button
            type="button"
            onClick={() => setDisplayMode('heatmap')}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition ${
              displayMode === 'heatmap'
                ? 'bg-gradient-to-r from-rose-600 to-amber-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Sales Heatmap</span>
          </button>

          <button
            type="button"
            onClick={() => setDisplayMode('warehouse')}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition ${
              displayMode === 'warehouse'
                ? 'bg-slate-700 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Pallet Bay</span>
          </button>
        </div>
      </div>

      {/* 3D Canvas Mount Point */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Bottom Legend */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-4">
          {displayMode === 'heatmap' ? (
            <>
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                Hot Revenue Zone (&gt; ₹1,000)
              </span>
              <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
                Medium Movement
              </span>
              <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_#ef4444]" />
                Cold Spot / Slow Moving
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-sky-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                In Stock on Shelf
              </span>
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Low Stock Warning
              </span>
              <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Out of Stock Empty Shelf
              </span>
            </>
          )}
        </div>

        <span className="text-slate-400 text-[11px] font-mono">
          💡 Click any item to restock • Drag mouse to orbit 360°
        </span>
      </div>

      {/* Floating Raycast Tooltip */}
      {hoveredProduct && (
        <div
          className="pointer-events-none absolute z-30 bg-slate-900/95 backdrop-blur-xl border border-indigo-500/50 p-3.5 rounded-2xl shadow-2xl text-xs text-white transform -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${mousePos.x}px`,
            top: `${mousePos.y}px`,
            minWidth: '220px',
          }}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
              <ProductIcon icon={hoveredProduct.image_emoji} className="w-6 h-6 object-cover" textClassName="text-base" />
            </div>
            <div>
              <p className="font-bold text-white line-clamp-1 m-0">{hoveredProduct.name}</p>
              <p className="text-[10px] text-slate-400 font-mono m-0">
                {hoveredProduct.sku} • {hoveredProduct.category}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/60 text-[11px]">
            <div>
              <span className="text-slate-400 block text-[10px]">Shelf Stock:</span>
              <span
                className={`font-mono font-bold ${
                  hoveredProduct.stock_quantity === 0
                    ? 'text-rose-400'
                    : hoveredProduct.stock_quantity <= hoveredProduct.low_stock_threshold
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {hoveredProduct.stock_quantity} {hoveredProduct.unit}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Selling Price:</span>
              <span className="font-mono font-bold text-white">
                {currencySymbol}{hoveredProduct.selling_price}
              </span>
            </div>
          </div>

          <p className="mt-2 text-[10px] text-indigo-300 text-center font-semibold bg-indigo-950/80 py-1 rounded-lg m-0">
            Click to manage or restock item
          </p>
        </div>
      )}
    </div>
  );
}
