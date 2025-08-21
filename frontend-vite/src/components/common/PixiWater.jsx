import React, { useLayoutEffect, useRef, useImperativeHandle } from 'react';
import * as PIXI from 'pixi.js';

// Shader fragment simple para olas animadas
// Shader de desplazamiento para simular olas tipo mar real
const waterFrag = `
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform sampler2D dispMap;
uniform float time;
void main(void) {
    vec2 uv = vTextureCoord;
    // Obtener desplazamiento del mapa
    float disp = texture2D(dispMap, uv).r;
    // Desplaza la textura base según el mapa
    uv.y += disp * 0.06;
    uv.x += disp * 0.06;
    vec4 color = texture2D(uSampler, uv);
    gl_FragColor = color;
}
`;


const PixiWater = React.forwardRef(function PixiWater({ width = 1920, height = 1080, isDark = false }, ref) {
  const pixiContainer = useRef(null);
  const dispMapCanvas = useRef(null);
  const dispMapTexture = useRef(null);
  const drops = useRef([]); // [{x, y, r, strength, t}]

  // Expone la función dropAt para golpear el agua desde fuera
  useImperativeHandle(ref, () => ({
    dropAt: (x, y, radius = 32, strength = 1) => {
      drops.current.push({
        x: x / width,
        y: y / height,
        r: radius / Math.max(width, height),
        strength,
        t: 0
      });
    }
  }), [width, height]);

  useLayoutEffect(() => {
    if (!pixiContainer.current) return;
    let destroyed = false;
    let app = null;
    let filter = null;
    let dispCanvas, dispCtx;

    const createApp = async () => {
      try {
        try {
          app = new PIXI.Application({
            width,
            height,
            backgroundAlpha: 0,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
          });
        } catch (err) {
          console.error('Error al crear PIXI.Application:', err);
          app = null;
        }
        if (!app || destroyed) {
          if (app && typeof app.destroy === 'function') {
            try { app.destroy(true, { children: true, texture: true, baseTexture: true }); } catch {}
          }
          return;
        }
        // Pixi v8+: app.canvas, Pixi v6/v7: app.view
        if (!app || !app.canvas) {
          // Pixi falló y no hay canvas, aborta
          return;
        }
        pixiContainer.current.appendChild(app.canvas);
        // Sprite base de agua
        const water = PIXI.Sprite.from(PIXI.Texture.WHITE);
        water.width = width;
        water.height = height;
        water.tint = isDark ? 0x1e293b : 0xbae6fd;
        app.stage.addChild(water);
        // --- displacement map setup ---
        dispCanvas = document.createElement('canvas');
        dispCanvas.width = width;
        dispCanvas.height = height;
        dispCtx = dispCanvas.getContext('2d');
        dispMapTexture.current = PIXI.Texture.from(dispCanvas);
        // Filtro shader de olas con displacement
        filter = new PIXI.Filter(null, waterFrag, {
          time: 0,
          dispMap: dispMapTexture.current,
        });
        water.filters = [filter];
        // Mouse interaction
        const handlePointer = (e) => {
          if (!(app && app.canvas)) return;
          const rect = app.canvas.getBoundingClientRect();
          const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
          const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
          drops.current.push({
            x: x / width,
            y: y / height,
            r: 0.04,
            strength: 1,
            t: 0
          });
        };
        if (app && app.canvas) {
          app.canvas.addEventListener('pointerdown', handlePointer);
          app.canvas.addEventListener('pointermove', (e) => {
            if (e.buttons) handlePointer(e);
          });
        }
        // --- Animación y olas ---
        app.ticker.add((delta) => {
          // Decae y dibuja las gotas en el displacement map
          dispCtx.clearRect(0, 0, width, height);
          // Decaer fuerza de cada gota
          drops.current.forEach((d) => { d.t += delta; });
          drops.current = drops.current.filter((d) => d.t < 60);
          drops.current.forEach(({x, y, r, strength, t}) => {
            const px = x * width;
            const py = y * height;
            const pr = r * Math.max(width, height);
            const alpha = Math.max(0, 1 - t / 60);
            const grad = dispCtx.createRadialGradient(px, py, 0, px, py, pr);
            grad.addColorStop(0, `rgba(255,255,255,${0.18 * strength * alpha})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            dispCtx.beginPath();
            dispCtx.arc(px, py, pr, 0, 2 * Math.PI);
            dispCtx.closePath();
            dispCtx.fillStyle = grad;
            dispCtx.fill();
          });
          dispMapTexture.current.update();
          filter.uniforms.time += delta / 60;
        });
      } catch (e) {
        console.error('Error al inicializar Pixi.js:', e);
      }
    };
    createApp();
    return () => {
      destroyed = true;
      if (app && typeof app.destroy === 'function') {
        try {
          app.destroy(true, { children: true, texture: true, baseTexture: true });
        } catch (e) {
          // Silencia cualquier error de destroy
        }
        app = null;
      }
    };

  }, [width, height, isDark]);

  return (
    <div
      ref={pixiContainer}
      className="absolute inset-0 w-full h-full !m-0 !p-0"
      style={{
        zIndex: 5,
        pointerEvents: 'none',
      }}
    />
  );
});

export default PixiWater;
