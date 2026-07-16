/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/** @color @default #69D4CB */
uniform vec3 u_signalColor;

/** @color @default #D6A15F */
uniform vec3 u_underColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = mat2(1.62, -1.18, 1.18, 1.62) * p + 13.1;
    a *= 0.5;
  }
  return v;
}

float disk(vec2 p, vec2 c, float r) {
  return smoothstep(r, r * 0.62, length(p - c));
}

float ridge(vec2 p, vec2 a, vec2 b, float w) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return smoothstep(w, 0.0, length(pa - ba * h));
}

float islandMask(vec2 p) {
  float m = 0.0;
  m = max(m, disk(p, vec2(-0.75, 0.15), 1.25));
  m = max(m, disk(p, vec2(0.15, 0.05), 1.42));
  m = max(m, disk(p, vec2(0.92, -0.18), 0.92));
  m = max(m, disk(p, vec2(-0.18, -0.72), 0.95));
  float bite = disk(p, vec2(0.22, -1.25), 0.52);
  return clamp(m - bite * 0.62, 0.0, 1.0);
}

float heightAt(vec2 p) {
  float m = islandMask(p);
  float n = fbm(p * 2.1);
  float cliffs = pow(m, 1.8) * 0.86;
  float plateau = 0.46 * disk(p, vec2(-0.48, 0.45), 0.62);
  plateau += 0.38 * disk(p, vec2(0.42, 0.30), 0.50);
  plateau += 0.30 * disk(p, vec2(0.70, -0.52), 0.44);
  float mountains = 0.62 * disk(p, vec2(0.78, 0.42), 0.38) * (0.55 + n);
  return m * (0.05 + cliffs + plateau + mountains + n * 0.22) * 0.48;
}

vec3 normalAt(vec2 p) {
  float e = 0.006;
  float h = heightAt(p);
  float hx = heightAt(p + vec2(e, 0.0));
  float hz = heightAt(p + vec2(0.0, e));
  return normalize(vec3(h - hx, e * 3.0, h - hz));
}

mat3 camera(vec3 ro, vec3 ta, float roll) {
  vec3 cw = normalize(ta - ro);
  vec3 cp = vec3(sin(roll), cos(roll), 0.0);
  vec3 cu = normalize(cross(cw, cp));
  vec3 cv = normalize(cross(cu, cw));
  return mat3(cu, cv, cw);
}

float routeLine(vec2 p) {
  float r = 0.0;
  r = max(r, ridge(p, vec2(-0.95, -0.68), vec2(-0.35, -0.35), 0.014));
  r = max(r, ridge(p, vec2(-0.35, -0.35), vec2(0.08, -0.08), 0.014));
  r = max(r, ridge(p, vec2(0.08, -0.08), vec2(0.58, 0.22), 0.014));
  r = max(r, ridge(p, vec2(0.58, 0.22), vec2(1.08, 0.42), 0.014));
  return r;
}

float roadNetwork(vec2 p) {
  float grid = smoothstep(0.014, 0.0, abs(fract((p.x + p.y * 0.44) * 12.0) - 0.5) / 12.0);
  grid *= smoothstep(0.014, 0.0, abs(fract((p.x * 0.35 - p.y) * 10.0) - 0.5) / 10.0);
  float rings = smoothstep(0.014, 0.0, abs(fract(length(p - vec2(-0.42, 0.42)) * 10.0) - 0.5) / 10.0);
  return clamp(grid * 0.35 + rings * 0.42 + routeLine(p), 0.0, 1.0);
}

vec3 terrainColor(vec2 p, float h) {
  vec3 rock = vec3(0.105, 0.120, 0.120);
  vec3 ice = vec3(0.70, 0.82, 0.90);
  vec3 forest = vec3(0.18, 0.36, 0.19);
  vec3 city = vec3(0.47, 0.47, 0.42);
  vec3 under = u_underColor * 0.75;
  vec3 dream = vec3(0.42, 0.17, 0.72);
  vec3 col = mix(rock, forest, disk(p, vec2(-0.08, -0.40), 0.68));
  col = mix(col, city, disk(p, vec2(-0.18, 0.10), 0.56));
  col = mix(col, under, disk(p, vec2(-0.88, -0.70), 0.42));
  col = mix(col, dream, disk(p, vec2(0.72, -0.72), 0.42));
  col = mix(col, ice, smoothstep(1.12, 1.78, h) * disk(p, vec2(0.78, 0.42), 0.52));
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
  uv.y -= 0.02;

  vec3 ro = vec3(0.0, 1.72, 3.42);
  vec3 ta = vec3(0.0, 0.18, -0.12);
  mat3 cam = camera(ro, ta, 0.0);
  vec3 rd = cam * normalize(vec3(uv.x, uv.y, 1.92));

  vec3 skyTop = vec3(0.008, 0.019, 0.026);
  vec3 skyLow = vec3(0.028, 0.041, 0.048);
  vec3 col = mix(skyLow, skyTop, clamp(uv.y + 0.45, 0.0, 1.0));

  float t = 0.0;
  float hit = 0.0;
  vec3 pos = ro;
  for (int i = 0; i < 86; i++) {
    pos = ro + rd * t;
    float h = heightAt(pos.xz);
    float d = pos.y - h;
    if (d < 0.003 && islandMask(pos.xz) > 0.02) {
      hit = 1.0;
      break;
    }
    t += max(0.014, d * 0.42);
    if (t > 7.2) break;
  }

  if (hit > 0.5) {
    vec2 p = pos.xz;
    float h = heightAt(p);
    vec3 n = normalAt(p);
    vec3 lightDir = normalize(vec3(-0.35, 0.72, 0.48));
    float diff = max(dot(n, lightDir), 0.0);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.2);
    float mask = islandMask(p);
    vec3 base = terrainColor(p, h);
    float roads = roadNetwork(p) * mask;
    float route = routeLine(p) * mask;
    float cityLights = pow(fbm(p * 18.0), 8.0) * disk(p, vec2(-0.18, 0.10), 0.64);
    cityLights += pow(fbm(p * 16.0 + 4.0), 8.0) * disk(p, vec2(-0.84, -0.66), 0.42);
    cityLights += pow(fbm(p * 14.0 + 9.0), 9.0) * disk(p, vec2(0.72, -0.72), 0.44);
    col = base * (0.24 + diff * 0.86);
    col += rim * vec3(0.18, 0.36, 0.44);
    col = mix(col, vec3(0.72, 0.78, 0.72), roads * 0.62);
    col += route * u_signalColor * 1.6;
    col += cityLights * vec3(1.0, 0.67, 0.34) * 1.2;
    float cliff = smoothstep(0.06, 0.0, mask) * smoothstep(0.12, 0.42, h);
    col = mix(vec3(0.035, 0.041, 0.044), col, mask);
    col += cliff * vec3(0.09, 0.14, 0.15);
    float fog = smoothstep(3.0, 6.8, t);
    col = mix(col, skyLow, fog * 0.62);
  } else {
    float cloud = fbm(vec2(uv.x * 2.4 + u_time * 0.01, uv.y * 1.5));
    col += smoothstep(0.42, 0.86, cloud) * vec3(0.035, 0.055, 0.065);
  }

  float beam = 0.0;
  beam += smoothstep(0.020, 0.0, abs(uv.x - 0.00)) * smoothstep(0.58, -0.06, uv.y);
  beam += smoothstep(0.015, 0.0, abs(uv.x - 0.62)) * smoothstep(0.45, -0.08, uv.y) * 0.45;
  col += beam * u_signalColor * 0.75;

  float vignette = smoothstep(1.0, 0.18, length(uv * vec2(0.82, 1.18)));
  col *= 0.42 + vignette * 0.82;

  gl_FragColor = vec4(pow(col, vec3(0.92)), 1.0);
}
