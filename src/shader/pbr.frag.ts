export default `

precision highp float;

// Varyings
in vec3 vNormalWS;
in vec3 vPositionWS;

// Fragment shader output
out vec4 outFragColor;

// Uniforms
struct Camera
{
  mat4 WS_to_CS; // World-Space to Clip-Space (view * proj)
  vec3 positionWS; // Camera position in World-Space
};
uniform Camera uCamera;

struct Material
{
  vec3 albedo;
};
uniform Material uMaterial;

struct PointLight
{
  vec3 positionWS;
  vec3 color;
  float intensity;
};
uniform PointLight uPointLights[POINT_LIGHT_COUNT];

// From three.js
vec4 sRGBToLinear( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}

// From three.js
vec4 LinearTosRGB( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}

vec3 RGBMDecode(vec4 rgbm) {
  return 6.0 * rgbm.rgb * rgbm.a;
}

int getColumnIndex(float x) {
  if (x < -3.75) {
    return 0;
  } else if (x < -1.25) {
    return 1;
  } else if (x < 1.25) {
    return 2;
  } else if (x < 3.75) {
    return 3;
  } else {
    return 4;
  }
}

int getRowIndex(float y) {
  if (y < -3.75) {
    return 0;
  } else if (y < -1.25) {
    return 1;
  } else if (y < 1.25) {
    return 2;
  } else if (y < 3.75) {
    return 3;
  } else {
    return 4;
  }
}

float columnIndexToRoughness(int index) {
  switch(index) {
    case 0: return 0.01;
    case 1: return 0.1;
    case 2: return 0.2;
    case 3: return 0.3;
    case 4: return 0.5;
    default: return 0.5;
  }
}

float rowIndexToMetallic(int index) {
  switch(index) {
    case 0: return 0.1;
    case 1: return 0.1;
    case 2: return 0.2;
    case 3: return 0.3;
    case 4: return 0.4;
    default: return 0.2;
  }
}

void main()
{
  // **DO NOT** forget to do all your computation in linear space.
  vec3 albedo = sRGBToLinear(vec4(uMaterial.albedo, 1.0)).rgb;

  vec3 n = normalize(vNormalWS);
  vec3 w_o = normalize(uCamera.positionWS - vPositionWS);
  float nDOTw_o = clamp(dot(n, w_o), 0.0, 1.0);
  float a = columnIndexToRoughness(getColumnIndex(vPositionWS.x)); // Roughness
  float metallic = rowIndexToMetallic(getRowIndex(vPositionWS.y)); // Mettalic

  vec3 irradiance = vec3(0.0);
  for (int i = 0; i < POINT_LIGHT_COUNT; ++i) {
    vec3 w_i = normalize(uPointLights[i].positionWS - vPositionWS);
    float nDOTw_i = clamp(dot(n, w_i), 0.0, 1.0);

    // PointLight intensity
    vec3 Li = (uPointLights[i].intensity / (4.0 * 3.14 * length(w_i))) * nDOTw_i * vec3(1.0);
    Li *= uPointLights[i].color;

    // Diffuse
    vec3 fd = albedo / 3.14;
    fd *= (1.0 - metallic);
    
    // Specular (Cook-Torrance GGX model)
    // Normal Distribution Function
    vec3 h = normalize(w_o + w_i); // Halfway vector
    float D = (a * a) / (3.14 * pow((pow(dot(n, h), 2.0) * (a * a - 1.0) + 1.0), 2.0) /*+ 0.001*/); // + 0.001
    
    // Geometry Function (Smith masking function with Schlick-GGX function)
    float k = pow(a + 1.0, 2.0) / 8.0;
    float Gshadowing = nDOTw_i / (nDOTw_i * (1.0 - k) + k);
    float Gobstruction = nDOTw_o / (nDOTw_o * (1.0 - k) + k);
    float G = Gshadowing * Gobstruction;

    // Specular Function (whithout Fresnel term)
    vec3 fs = D * G / (4.0 * nDOTw_o * nDOTw_i) * vec3(1.0); // + 0.001
    
    // Fresnel Function (Schlick's approximation)
    float dielectricF0 = 0.04;
    float metallicF0 = albedo.r + albedo.g + albedo.b / 3.0;
    float F0 = mix(dielectricF0, metallicF0, metallic);
    F0 = dielectricF0 * (1.0 - metallic) + metallic * metallicF0;
    float F = F0 + (1.0 - F0) * pow(1.0 - clamp(dot(w_o, h), 0.0, 1.0), 5.0);

    // BRDF
    float kd = 1.0 - F;
    float ks = F;
    vec3 fr = kd * fd + ks * fs;

    // Rendering equation
    irradiance += clamp(fr * Li, vec3(0.0), vec3(1.0));
  }

  // NormalWS
  // vec3 NormalWS = (vNormalWS + 1.0) / 2.0;
  // outFragColor = LinearTosRGB(vec4(NormalWS, 1.0));

  // ViewDirectionWS
  // vec3 ViewDirectionWS = normalize(uCamera.positionWS - vPositionWS);
  // outFragColor = LinearTosRGB(vec4(ViewDirectionWS, 1.0));

  // ACES
  vec3 colorACES = clamp((irradiance * (2.51 * irradiance + 0.03)) / (irradiance * (2.43 * irradiance + 0.59) + 0.14), vec3(0.0), vec3(1.0));

  outFragColor = LinearTosRGB(vec4(colorACES, 1.0));
}
`;
