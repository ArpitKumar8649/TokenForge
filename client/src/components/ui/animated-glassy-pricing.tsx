"use client";

import React, { useRef, useEffect, useState } from "react";
import { RippleButton } from "@/components/ui/multi-type-ripple-buttons";

// --- Internal Helper Components --- //

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const ShaderCanvas = ({ className }: { className?: string } = {}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glProgramRef = useRef<WebGLProgram | null>(null);
  const glBgColorLocationRef = useRef<WebGLUniformLocation | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const [backgroundColor, setBackgroundColor] = useState([0.05, 0.05, 0.08]);

  useEffect(() => {
    const root = document.documentElement;
    const updateColor = () => {
      const isDark = root.classList.contains("dark") || true; // dark by default in TokenForge
      setBackgroundColor(isDark ? [0.05, 0.05, 0.08] : [1.0, 1.0, 1.0]);
    };
    updateColor();
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          updateColor();
        }
      }
    });
    observer.observe(root, { attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const gl = glRef.current;
    const program = glProgramRef.current;
    const location = glBgColorLocationRef.current;
    if (gl && program && location) {
      gl.useProgram(program);
      gl.uniform3fv(location, new Float32Array(backgroundColor));
    }
  }, [backgroundColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl");
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }
    glRef.current = gl;

    const vertexShaderSource = `attribute vec2 aPosition; void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`;
    const fragmentShaderSource = `
      precision highp float;
      uniform float iTime;
      uniform vec2 iResolution;
      uniform vec3 uBackgroundColor;
      mat2 rotate2d(float angle){ float c=cos(angle),s=sin(angle); return mat2(c,-s,s,c); }
      float variation(vec2 v1,vec2 v2,float strength,float speed){ return sin(dot(normalize(v1),normalize(v2))*strength+iTime*speed)/100.0; }
      vec3 paintCircle(vec2 uv,vec2 center,float rad,float width){
        vec2 diff = center-uv;
        float len = length(diff);
        len += variation(diff,vec2(0.,1.),5.,2.);
        len -= variation(diff,vec2(1.,0.),5.,2.);
        float circle = smoothstep(rad-width,rad,len)-smoothstep(rad,rad+width,len);
        return vec3(circle);
      }
      void main(){
        vec2 uv = gl_FragCoord.xy/iResolution.xy;
        uv.x *= 1.5; uv.x -= 0.25;
        float mask = 0.0;
        float radius = .35;
        vec2 center = vec2(.5);
        mask += paintCircle(uv,center,radius,.035).r;
        mask += paintCircle(uv,center,radius-.018,.01).r;
        mask += paintCircle(uv,center,radius+.018,.005).r;
        vec2 v=rotate2d(iTime)*uv;
        vec3 foregroundColor=vec3(v.x,v.y,.7-v.y*v.x);
        vec3 color=mix(uBackgroundColor,foregroundColor,mask);
        color=mix(color,vec3(1.),paintCircle(uv,center,radius,.003).r);
        gl_FragColor=vec4(color,1.);
      }`;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Could not create shader");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || "Shader compilation error");
      }
      return shader;
    };

    const program = gl.createProgram();
    if (!program) throw new Error("Could not create program");
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);
    glProgramRef.current = program;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const iTimeLoc = gl.getUniformLocation(program, "iTime");
    const iResLoc = gl.getUniformLocation(program, "iResolution");
    glBgColorLocationRef.current = gl.getUniformLocation(program, "uBackgroundColor");
    gl.uniform3fv(glBgColorLocationRef.current, new Float32Array(backgroundColor));

    let animationFrameId: number;
    const render = (time: number) => {
      gl.uniform1f(iTimeLoc, time * 0.001);
      gl.uniform2f(iResLoc, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    };
    const handleResize = () => {
      const parent = canvas.parentElement;
      if (parent && (className?.includes("absolute") || canvas.classList.contains("absolute"))) {
        canvas.width = parent.clientWidth || window.innerWidth;
        canvas.height = parent.clientHeight || window.innerHeight;
      } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    animationFrameId = requestAnimationFrame(render);
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [className]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "fixed top-0 left-0 w-full h-full block z-0 bg-background pointer-events-none"}
    />
  );
};

// --- EXPORTED Building Blocks --- //

export interface PricingCardProps {
  planName: string;
  description: string;
  price: string;
  period?: string;
  currencySymbol?: string;
  features: string[];
  buttonText: string;
  isPopular?: boolean;
  buttonVariant?: "primary" | "secondary";
  onSelect?: () => void;
}

export const PricingCard = ({
  planName,
  description,
  price,
  period = "month",
  currencySymbol = "$",
  features,
  buttonText,
  isPopular = false,
  buttonVariant = "primary",
  onSelect,
}: PricingCardProps) => {
  const cardClasses = `
    backdrop-blur-[16px] bg-gradient-to-br rounded-3xl shadow-xl flex-1 max-w-sm w-full px-5 py-6 sm:px-6 sm:py-7 flex flex-col transition-all duration-300
    from-black/40 to-black/20 border border-white/10
    dark:from-white/10 dark:to-white/5 dark:border-white/10 dark:backdrop-brightness-[0.91]
    ${isPopular ? "scale-[1.02] xl:scale-105 relative ring-2 ring-rose-400/30 dark:from-white/15 dark:to-white/10 dark:border-rose-400/40 shadow-2xl shadow-rose-950/40 z-10" : "hover:border-white/20"}
  `;
  const buttonClasses = `
    mt-auto w-full py-3 rounded-xl font-semibold text-[14px] transition font-sans cursor-pointer
    ${
      buttonVariant === "primary"
        ? "bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/25 active:bg-rose-600"
        : "bg-white/10 hover:bg-white/20 text-white border border-white/15"
    }
  `;

  return (
    <div className={cardClasses.trim()}>
      {isPopular && (
        <div className="absolute -top-3.5 right-6 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)]">
          Most Popular
        </div>
      )}
      <div className="mb-3">
        <h2 className="text-[38px] sm:text-[44px] font-extralight tracking-[-0.03em] text-white font-display leading-tight">
          {planName}
        </h2>
        <p className="text-[14px] text-slate-300 mt-1 font-sans leading-relaxed min-h-[42px]">{description}</p>
      </div>
      <div className="my-5 flex items-baseline gap-1.5">
        <span className="text-2xl font-light text-slate-300 font-display">{currencySymbol}</span>
        <span className="text-[44px] font-extralight text-white font-display tracking-tight">
          {price}
        </span>
        <span className="text-[14px] text-slate-400 font-sans">/{period}</span>
      </div>
      <div className="card-divider w-full mb-5 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12)_20%,rgba(255,255,255,0.25)_50%,rgba(255,255,255,0.12)_80%,transparent)]"></div>
      <ul className="flex flex-col gap-3 text-[13.5px] text-slate-200 mb-8 font-sans">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2.5 leading-snug">
            <CheckIcon className="text-rose-400 w-4 h-4 shrink-0 mt-0.5" /> <span>{feature}</span>
          </li>
        ))}
      </ul>
      <RippleButton
        type="button"
        onClick={onSelect}
        rippleColor={buttonVariant === "primary" ? "rgba(255, 255, 255, 0.4)" : "rgba(244, 63, 94, 0.3)"}
        className={buttonClasses.trim()}
      >
        {buttonText}
      </RippleButton>
    </div>
  );
};

// --- EXPORTED Customizable Page Component --- //

export interface ModernPricingPageProps {
  /** The main title. Can be a string or a ReactNode for more complex content. */
  title: React.ReactNode;
  /** The subtitle text appearing below the main title. */
  subtitle: React.ReactNode;
  /** An array of plan objects that conform to PricingCardProps. */
  plans?: PricingCardProps[];
  /** Whether to show the animated WebGL background. Defaults to true. */
  showAnimatedBackground?: boolean;
  /** Custom children injected between header and cards (e.g. switcher) */
  children?: React.ReactNode;
  /** Additional custom content rendered after or in place of the plan cards */
  contentAfterPlans?: React.ReactNode;
}

export const ModernPricingPage = ({
  title,
  subtitle,
  plans = [],
  showAnimatedBackground = true,
  children,
  contentAfterPlans,
}: ModernPricingPageProps) => {
  return (
    <div className="bg-[#09090b] text-slate-100 min-h-screen w-full overflow-x-hidden relative">
      {showAnimatedBackground && <ShaderCanvas />}
      <main className="relative z-10 w-full min-h-screen flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-5xl mx-auto text-center mb-10">
          <h1 className="text-[44px] md:text-[60px] font-extralight leading-tight tracking-[-0.03em] bg-clip-text text-transparent bg-gradient-to-r from-white via-rose-300 to-rose-500 font-display">
            {title}
          </h1>
          <p className="mt-4 text-[15px] md:text-[18px] text-slate-300 max-w-2xl mx-auto font-sans leading-relaxed">
            {subtitle}
          </p>
        </div>

        {children && <div className="w-full max-w-4xl mx-auto mb-10 flex flex-col items-center">{children}</div>}

        {plans && plans.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 justify-center items-stretch w-full max-w-7xl mx-auto">
            {plans.map((plan) => (
              <PricingCard key={plan.planName} {...plan} />
            ))}
          </div>
        )}

        {contentAfterPlans && (
          <div className="w-full max-w-7xl mx-auto mt-8 flex flex-col items-center">
            {contentAfterPlans}
          </div>
        )}
      </main>
    </div>
  );
};
