import { useRef, useEffect } from 'react';
import { Renderer, Program, Mesh, Triangle, Vec2 } from 'ogl';
import './DarkVeil.css';

const vertex = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragment = `
#ifdef GL_ES
precision lowp float;
#endif
uniform vec2 uResolution;
uniform float uTime;
uniform float uHueShift;
uniform float uNoise;
uniform float uScan;
uniform float uScanFreq;
uniform float uWarp;
#define iTime uTime
#define iResolution uResolution

vec4 buf[8];
float rand(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }

mat3 rgb2yiq = mat3(0.299, 0.587, 0.114, 0.596, -0.274, -0.322, 0.211, -0.523, 0.312);
mat3 yiq2rgb = mat3(1.0, 0.956, 0.621, 1.0, -0.272, -0.647, 1.0, -1.106, 1.703);

vec3 hueShiftRGB(vec3 col, float deg) {
    vec3 yiq = rgb2yiq * col;
    float rad = radians(deg);
    float cosh = cos(rad), sinh = sin(rad);
    vec3 yiqShift = vec3(yiq.x, yiq.y * cosh - yiq.z * sinh, yiq.y * sinh + yiq.z * cosh);
    return clamp(yiq2rgb * yiqShift, 0.0, 1.0);
}

vec4 sigmoid(vec4 x) { return 1. / (1. + exp(-x)); }

vec4 cppn_fn(vec2 coordinate, float in0, float in1, float in2) {
    buf[6] = vec4(coordinate.x, coordinate.y, 0.3948333106474662 + in0, 0.36 + in1);
    buf[7] = vec4(0.14 + in2, sqrt(coordinate.x * coordinate.x + coordinate.y * coordinate.y), 0., 0.);
    
    // Initialize first layer
    buf[0] = mat4(vec4(6.5404263,-3.6126034,0.7590882,-1.13613),vec4(2.4582713,3.1660357,1.2219609,0.06276096),vec4(-5.478085,-6.159632,1.8701609,-4.7742867),vec4(6.039214,-5.542865,-0.90925294,3.251348))*buf[6] + 
              mat4(vec4(0.8473259,-5.722911,3.975766,1.6522468),vec4(-0.24321538,0.5839259,-1.7661959,-5.350116),vec4(0.,0.,0.,0.),vec4(0.,0.,0.,0.))*buf[7] + 
              vec4(0.21808943,1.1243913,-1.7969975,5.0294676);
    
    buf[1] = mat4(vec4(-3.3522482,-6.0612736,0.55641043,-4.4719114),vec4(0.8631464,1.7432913,5.643898,1.6106541),vec4(2.4941394,-3.5012043,1.7184316,6.357333),vec4(3.310376,8.209261,1.1355612,-1.165539))*buf[6] + 
             mat4(vec4(5.24046,-13.034365,0.009859298,15.870829),vec4(2.987511,3.129433,-0.89023495,-1.6822904),vec4(0.,0.,0.,0.),vec4(0.,0.,0.,0.))*buf[7] + 
             vec4(-5.9457836,-6.573602,-0.8812491,1.5436668);
    
    buf[0] = sigmoid(buf[0]);
    buf[1] = sigmoid(buf[1]);
    
    // Second layer
    buf[2] = mat4(vec4(-15.219568,8.095543,-2.429353,-1.9381982),vec4(-5.951362,4.3115187,2.6393783,1.274315),vec4(-7.3145227,6.7297835,5.2473326,5.9411426),vec4(5.0796127,8.979051,-1.7278991,-1.158976))*buf[6] + 
             mat4(vec4(-11.967154,-11.608155,6.1486754,11.237008),vec4(2.124141,-6.263192,-1.7050359,-0.7021966),vec4(0.,0.,0.,0.),vec4(0.,0.,0.,0.))*buf[7] + 
             vec4(-4.17164,-3.2281182,-4.576417,-3.6401186);
    
    buf[3] = mat4(vec4(3.1832156,-13.738922,1.879223,3.233465),vec4(0.64300746,12.768129,1.9141049,0.50990224),vec4(-0.049295485,4.4807224,1.4733979,1.801449),vec4(5.0039253,13.000481,3.3991797,-4.5561905))*buf[6] + 
             mat4(vec4(-0.1285731,7.720628,-3.1425676,4.742367),vec4(0.6393625,3.714393,-0.8108378,-0.39174938),vec4(0.,0.,0.,0.),vec4(0.,0.,0.,0.))*buf[7] + 
             vec4(-1.1811101,-21.621881,0.7851888,1.2329718);
    
    buf[2] = sigmoid(buf[2]);
    buf[3] = sigmoid(buf[3]);
    
    // Output layer
    buf[0] = mat4(vec4(1.6794263,1.3817469,2.9625452,0.),vec4(-1.8834411,-1.4806935,-3.5924516,0.),vec4(-1.3279216,-1.0918057,-2.3124623,0.),vec4(0.2662234,0.23235129,0.44178495,0.))*buf[0] + 
             mat4(vec4(-0.6299101,-0.5945583,-0.9125601,0.),vec4(0.17828953,0.18300213,0.18182953,0.),vec4(-2.96544,-2.5819945,-4.9001055,0.),vec4(1.4195864,1.1868085,2.5176322,0.))*buf[1] + 
             mat4(vec4(-1.2584374,-1.0552157,-2.1688404,0.),vec4(-0.7200217,-0.52666044,-1.438251,0.),vec4(0.15345335,0.15196142,0.272854,0.),vec4(0.945728,0.8861938,1.2766753,0.))*buf[2] + 
             mat4(vec4(-2.4218085,-1.968602,-4.35166,0.),vec4(-22.683098,-18.0544,-41.954372,0.),vec4(0.63792,0.5470648,1.1078634,0.),vec4(-1.5489894,-1.3075932,-2.6444845,0.))*buf[3] + 
             vec4(-1.5468478,-3.6171484,0.24762098,0.);
    
    buf[0] = sigmoid(buf[0]);
    return vec4(buf[0].x, buf[0].y, buf[0].z, 1.);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / uResolution.xy * 2. - 1.;
    uv.y *= -1.;
    uv += uWarp * vec2(sin(uv.y * 6.283 + uTime * 0.5), cos(uv.x * 6.283 + uTime * 0.5)) * 0.05;
    fragColor = cppn_fn(uv, 0.1 * sin(0.3 * uTime), 0.1 * sin(0.69 * uTime), 0.1 * sin(0.44 * uTime));
}

void main() {
    vec4 col; 
    mainImage(col, gl_FragCoord.xy);
    
    // Add a more pronounced gradient that covers more of the screen
    float rightGradient = smoothstep(0.3, 1.0, gl_FragCoord.x / uResolution.x) * 0.3;
    col.rgb = mix(col.rgb, vec3(0.1, 0.0, 0.2), rightGradient);
    
    // Apply the original effects
    col.rgb = hueShiftRGB(col.rgb, uHueShift);
    
    // Minimal scanline effect - barely visible
    float scanlineFreq = uScanFreq * 0.1;  // Drastically reduced frequency
    float scanlineIntensity = uScan * 0.1;  // Minimized intensity
    
    // Very subtle single scanline pattern
    float scanline = sin(gl_FragCoord.y * scanlineFreq) * 0.5 + 0.5;
    col.rgb = mix(col.rgb, col.rgb * 0.98, scanline * scanlineIntensity);
    col.rgb += (rand(gl_FragCoord.xy + uTime) - 0.5) * uNoise;
    
    gl_FragColor = vec4(clamp(col.rgb, 0.0, 1.0), 1.0);
}
`;

export default function DarkVeil({
  hueShift = 0,              // No hue shift (0 degrees)
  noiseIntensity = 0.02,     // Subtle noise
  scanlineIntensity = 0.05,  // Subtle scanlines
  speed = 2.0,               // Much faster animation
  scanlineFrequency = 1.5,   // Fewer scanlines
  warpAmount = 0.05,         // Subtle warping
  resolutionScale = 1,
  debug = false
}) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      console.error('DarkVeil: Canvas ref is null');
      return;
    }

    const parent = canvas.parentElement;
    if (!parent) {
      console.error('DarkVeil: Parent element not found');
      return;
    }

    try {
      const renderer = new Renderer({
        canvas,
        width: parent.clientWidth,
        height: parent.clientHeight,
        dpr: Math.min(window.devicePixelRatio, 2),
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true
      });

      const gl = renderer.gl;

      // Set a transparent clear color
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const geometry = new Triangle(gl);

      // Create program and attach shaders
      const program = new Program(gl, {
        vertex,
        fragment,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: new Vec2(parent.clientWidth, parent.clientHeight) },
          uHueShift: { value: hueShift },
          uNoise: { value: noiseIntensity },
          uScan: { value: scanlineIntensity },
          uScanFreq: { value: scanlineFrequency },
          uWarp: { value: warpAmount }
        }
      });

      const mesh = new Mesh(gl, { geometry, program });

      const resize = () => {
        const width = parent.clientWidth;
        const height = parent.clientHeight;
        renderer.setSize(width * resolutionScale, height * resolutionScale);
        program.uniforms.uResolution.value.set(width, height);
      };

      window.addEventListener('resize', resize);
      resize();

      const start = performance.now();
      let frame = null;

      const animate = () => {
        try {
          const time = (performance.now() - start) / 1000 * speed;
          program.uniforms.uTime.value = time;
          program.uniforms.uHueShift.value = hueShift;
          program.uniforms.uNoise.value = noiseIntensity;
          program.uniforms.uScan.value = scanlineIntensity;
          program.uniforms.uScanFreq.value = scanlineFrequency;
          program.uniforms.uWarp.value = warpAmount;

          renderer.render({ scene: mesh });
          frame = requestAnimationFrame(animate);
        } catch (error) {
          console.error('Error in animation loop:', error);
        }
      };

      // Start animation
      animate();

      // Cleanup
      return () => {
        if (frame) cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);

        // Clean up WebGL resources
        if (gl) {
          if (program && program.program) {
            gl.deleteProgram(program.program);
          }
          if (geometry && geometry.attributes && geometry.attributes.position) {
            gl.deleteBuffer(geometry.attributes.position.buffer);
          }
        }
      };
    } catch (error) {
      console.error('Error initializing DarkVeil:', error);
    }
  }, [hueShift, noiseIntensity, scanlineIntensity, speed, scanlineFrequency, warpAmount, resolutionScale]);

  return <canvas ref={ref} className="darkveil-canvas" />;
}
