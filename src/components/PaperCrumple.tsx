"use client";

import { useRef, useState, useEffect, useCallback } from "react";

// ─── WebGL Shaders ───

const VERT_SRC = `
attribute vec2 aPosition;
varying vec2 vTexCoord;
uniform vec2 uCropOffset;
uniform vec2 uCropScale;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
  // Map [-1,1] clip space to [0,1] UV, then apply crop for object-fit:cover
  vec2 uv = aPosition * 0.5 + 0.5;
  uv.y = 1.0 - uv.y; // flip Y for video
  vTexCoord = uCropOffset + uv * uCropScale;
}
`;

const FRAG_SRC = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uVideo;

void main() {
  vec4 color = texture2D(uVideo, vTexCoord);
  float r = color.r;
  float g = color.g;
  float b = color.b;

  // Chroma key: if pixel is predominantly green, make transparent
  if (g > 0.35 && g > r * 1.3 && g > b * 1.3) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
  } else {
    // Despill: remove green tint from edges
    float avgRB = (r + b) * 0.5;
    float newG = min(g, avgRB + 0.05);
    gl_FragColor = vec4(r, newG, b, 1.0);
  }
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  if (!vert || !frag) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

// ─── Component ───

interface PaperCrumpleProps {
  onComplete: () => void;
}

export function PaperCrumple({ onComplete }: PaperCrumpleProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<{
    gl: WebGLRenderingContext;
    program: WebGLProgram;
    texture: WebGLTexture;
    cropOffsetLoc: WebGLUniformLocation | null;
    cropScaleLoc: WebGLUniformLocation | null;
  } | null>(null);
  const rafRef = useRef<number | null>(null);

  const [mounted, setMounted] = useState(false);
  const [written, setWritten] = useState(false);
  const [crumpling, setCrumpling] = useState(false);
  const [done, setDone] = useState(false);

  // Mount + writing timer
  useEffect(() => {
    console.log("[PaperCrumple] Component mounted");
    setMounted(true);
    const t = setTimeout(() => setWritten(true), 1800);
    return () => clearTimeout(t);
  }, []);

  // Set up WebGL context on the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    console.log("[PaperCrumple] WebGL setup - canvas:", canvas);
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
    console.log("[PaperCrumple] WebGL context:", gl);
    if (!gl) return;

    const program = createProgram(gl);
    console.log("[PaperCrumple] Shader program:", program);
    if (!program) return;

    gl.useProgram(program);

    // Fullscreen quad: two triangles covering [-1,1]
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    // Video texture
    const texture = gl.createTexture();
    if (!texture) return;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    glRef.current = {
      gl,
      program,
      texture,
      cropOffsetLoc: gl.getUniformLocation(program, "uCropOffset"),
      cropScaleLoc: gl.getUniformLocation(program, "uCropScale"),
    };
    console.log("[PaperCrumple] WebGL fully initialized, glRef set");
  }, [mounted]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = glRef.current;
      if (ctx) {
        ctx.gl.viewport(0, 0, canvas.width, canvas.height);
      }
    };
    setSize();
    window.addEventListener("resize", setSize);
    return () => window.removeEventListener("resize", setSize);
  }, [mounted]);

  // Render loop: upload video frame as texture, draw with chroma key shader
  const renderLoopStarted = useRef(false);
  const renderFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = glRef.current;
    if (!video || !canvas || !ctx) {
      console.log("[PaperCrumple] renderFrame bail - video:", !!video, "canvas:", !!canvas, "glRef:", !!ctx);
      return;
    }
    if (video.ended || video.paused) {
      console.log("[PaperCrumple] renderFrame bail - ended:", video.ended, "paused:", video.paused);
      return;
    }
    if (!renderLoopStarted.current) {
      console.log("[PaperCrumple] Render loop started");
      renderLoopStarted.current = true;
    }

    const { gl, texture, cropOffsetLoc, cropScaleLoc } = ctx;

    // Calculate object-fit:cover crop
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cw = canvas.width;
    const ch = canvas.height;

    if (vw > 0 && vh > 0) {
      const videoAspect = vw / vh;
      const canvasAspect = cw / ch;
      let offsetX = 0, offsetY = 0, scaleX = 1, scaleY = 1;

      if (videoAspect > canvasAspect) {
        // Video wider than canvas: crop sides
        scaleX = canvasAspect / videoAspect;
        offsetX = (1 - scaleX) / 2;
      } else {
        // Video taller than canvas: crop top/bottom
        scaleY = videoAspect / canvasAspect;
        offsetY = (1 - scaleY) / 2;
      }

      gl.uniform2f(cropOffsetLoc, offsetX, offsetY);
      gl.uniform2f(cropScaleLoc, scaleX, scaleY);

      // Upload video frame as texture
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

      // Draw
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    rafRef.current = requestAnimationFrame(renderFrame);
  }, []);

  const handleClick = useCallback(() => {
    console.log("[PaperCrumple] Click handler fired - crumpling:", crumpling, "written:", written);
    if (crumpling || !written) return;
    setCrumpling(true);
    const video = videoRef.current;
    console.log("[PaperCrumple] Video element:", video, "readyState:", video?.readyState);
    if (video) {
      video.currentTime = 0;
      video.play().then(() => {
        console.log("[PaperCrumple] Video playing - dimensions:", video.videoWidth, "x", video.videoHeight);
        renderFrame();
      }).catch((err) => {
        console.error("[PaperCrumple] Video play FAILED:", err);
        setTimeout(() => { setDone(true); onComplete(); }, 500);
      });
    }
  }, [crumpling, written, onComplete, renderFrame]);

  const handleVideoEnd = useCallback(() => {
    console.log("[PaperCrumple] Video ended");
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // Render one final frame to capture the last video frame
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = glRef.current;
    if (video && canvas && ctx) {
      const { gl, texture, cropOffsetLoc, cropScaleLoc } = ctx;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cw = canvas.width;
      const ch = canvas.height;
      if (vw > 0 && vh > 0) {
        const videoAspect = vw / vh;
        const canvasAspect = cw / ch;
        let offsetX = 0, offsetY = 0, scaleX = 1, scaleY = 1;
        if (videoAspect > canvasAspect) {
          scaleX = canvasAspect / videoAspect;
          offsetX = (1 - scaleX) / 2;
        } else {
          scaleY = videoAspect / canvasAspect;
          offsetY = (1 - scaleY) / 2;
        }
        gl.uniform2f(cropOffsetLoc, offsetX, offsetY);
        gl.uniform2f(cropScaleLoc, scaleX, scaleY);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    }
    setTimeout(() => { setDone(true); onComplete(); }, 100);
  }, [onComplete]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!mounted) {
    console.log("[PaperCrumple] Rendering pre-mount placeholder");
    return <div style={{ position: "fixed", inset: 0, backgroundColor: "#f5f5f0", zIndex: 9999 }} />;
  }

  if (done) {
    console.log("[PaperCrumple] Done, returning null");
    return null;
  }

  console.log("[PaperCrumple] Rendering full UI - written:", written, "crumpling:", crumpling);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, cursor: written && !crumpling ? "pointer" : "default" }}
      onClick={handleClick}
    >
      {/* Paper background — visible until crumple starts, then actual canvas shows through chroma key */}
      {!crumpling && (
        <div
          style={{
            position: "absolute", inset: 0,
            backgroundColor: "#f5f5f0",
            backgroundImage: `
              repeating-linear-gradient(transparent, transparent 31px, rgba(140,180,220,0.25) 31px, rgba(140,180,220,0.25) 32px),
              linear-gradient(90deg, transparent 11.5%, rgba(220,80,80,0.3) 11.5%, rgba(220,80,80,0.3) 12%, transparent 12%)
            `,
            backgroundSize: "100% 32px, 100% 100%",
            backgroundPosition: "0 48px, 0 0",
          }}
        />
      )}

      {/* SVG handwriting animation */}
      {!crumpling && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
          <svg viewBox="0 0 200 80" style={{ width: "clamp(200px, 30vw, 400px)", overflow: "visible" }}>
            <text x="50%" y="55" textAnchor="middle" style={{
              fontFamily: "'PaperHand', cursive", fontSize: "60px",
              fill: "none", stroke: "#1a1a2e", strokeWidth: 0.6,
              strokeDasharray: 300, strokeDashoffset: 300,
              animation: "write 1.5s ease forwards 0.3s",
            }}>akin</text>
            <text x="50%" y="55" textAnchor="middle" style={{
              fontFamily: "'PaperHand', cursive", fontSize: "60px",
              fill: "#1a1a2e", stroke: "none", opacity: 0,
              animation: "fadeIn 0.4s ease forwards 1.6s",
            }}>akin</text>
          </svg>
        </div>
      )}

      {/* Click hint */}
      {written && !crumpling && (
        <div style={{
          position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
          color: "rgba(100,100,100,0.5)", fontSize: 13,
          fontFamily: "'PaperHand', cursive", letterSpacing: "0.05em",
          zIndex: 3, animation: "fadeIn 0.5s ease forwards",
        }}>
          {/* click anywhere */}
        </div>
      )}

      {/* Hidden video source — browser still decodes frames */}
      <video
        ref={videoRef}
        muted
        playsInline
        preload="auto"
        onEnded={handleVideoEnd}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", zIndex: -1 }}
      >
        <source src="/crumple.webm" type="video/webm" />
        <source src="/crumple.mp4" type="video/mp4" />
      </video>

      {/* WebGL canvas — chroma key shader strips green, paper shows through */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          zIndex: 1,
          backgroundColor: "transparent",
          pointerEvents: "none",
        }}
      />

      <style>{`
        @keyframes write { to { stroke-dashoffset: 0; } }
        @keyframes fadeIn { to { opacity: 1; } }
      `}</style>
    </div>
  );
}
