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

void main()
{
  // **DO NOT** forget to do all your computation in linear space.
  vec3 albedo = sRGBToLinear(vec4(uMaterial.albedo, 1.0)).rgb;

  vec3 n = normalize(vNormalWS);
  vec3 w0 = normalize(uCamera.positionWS - vPositionWS);
  float nDOTw0 = clamp(dot(n, w0), 0.0, 1.0);
  vec3 L0 = vec3(0.0);
  for (int i = 0; i < POINT_LIGHT_COUNT; ++i) {
    vec3 wi = normalize(uPointLights[i].positionWS - vPositionWS);
    float nDOTwi = clamp(dot(n, wi), 0.0, 1.0);

    // PointLight intensity
    vec3 Li = (uPointLights[i].intensity / (4.0 * 3.14 * length(wi))) * nDOTwi * vec3(1.0);

    // Diffuse
    vec3 fd = albedo / 3.14;
    
    // Specular
    vec3 h = normalize(w0 + wi); // Halfway vector
    float a = 0.1; // Roughness
    float D = (a * a) / (3.14 * pow((pow(dot(n, h), 2.0) * (a * a - 1.0) + 1.0), 2.0) /*+ 0.001*/); // + 0.001
    
    float k = pow(a + 1.0, 2.0) / 8.0;
    float Gshadowing = nDOTwi / (nDOTwi * (1.0 - k) + k);
    float Gobstruction = nDOTw0 / (nDOTw0 * (1.0 - k) + k);
    float G = Gshadowing * Gobstruction;

    // TODO: handle metals
    vec3 F = vec3(0.04); // Dielectric

    vec3 fs = D * F * G / (4.0 * nDOTw0 * nDOTwi); // + 0.001
    
    // BRDF
    float kd = 0.5;
    float ks = 0.5;
    vec3 fr = kd * fd + ks * fs;

    // Rendering equation
    L0 += clamp(fr * Li, vec3(0.0), vec3(1.0));
  }

  // NormalWS
  // vec3 NormalWS = (vNormalWS + 1.0) / 2.0;
  // outFragColor = LinearTosRGB(vec4(NormalWS, 1.0));

  // ViewDirectionWS
  // vec3 ViewDirectionWS = normalize(uCamera.positionWS - vPositionWS);
  // outFragColor = LinearTosRGB(vec4(ViewDirectionWS, 1.0));

  // ACES
  vec3 colorACES = clamp((L0 * (2.51 * L0 + 0.03)) / (L0 * (2.43 * L0 + 0.59) + 0.14), vec3(0.0), vec3(1.0));

  outFragColor = LinearTosRGB(vec4(colorACES, 1.0));
}
`;
