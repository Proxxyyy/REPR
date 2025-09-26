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

uniform sampler2D uDiffuseTexture;
uniform sampler2D uSpecularTexture;
uniform sampler2D uBRDFTexture;

float PI = 3.14159265359;

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

vec2 cartesianToSpherical(vec3 cartesian) {
  // Compute azimuthal angle, in [-PI, PI]
  float phi = atan(cartesian.z, cartesian.x);
  // Compute polar angle, in [-PI/2, PI/2]
  float theta = asin(cartesian.y);
  return vec2(phi, theta);
}

vec2 ToUV(vec3 direction) {
  vec2 spherical = cartesianToSpherical(direction);
  vec2 remapSpherical = 0.5 * (spherical / vec2(PI, PI / 2.0) + 1.0);
  return vec2(remapSpherical.x, 1.0 - remapSpherical.y);
}

vec2 offsetUV(vec2 uv, int roughnessLevel) {
  switch(roughnessLevel) {
    case 0: return vec2(uv.x, uv.y / 2.0);
    case 1: return vec2(uv.x / 2.0, uv.y / 4.0 + 0.5);
    case 2: return vec2(uv.x / 4.0, uv.y / 8.0 + 0.75);
    case 3: return vec2(uv.x / 8.0, uv.y / 16.0 + 0.875);
    case 4: return vec2(uv.x / 16.0, uv.y / 32.0 + 0.9375);
    case 5: return vec2(uv.x / 32.0, uv.y / 64.0 + 0.96875);
    default: return uv;
  }
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
    case 0: return 0.005;
    case 1: return 1.0 / 12.0;
    case 2: return 2.0 / 12.0;
    case 3: return 5.0 / 12.0;
    case 4: return 7.0 / 12.0;
    default: return 0.5;
  }
}

float rowIndexToMetallic(int index) {
  switch(index) {
    case 0: return 0.1;
    case 1: return 0.3;
    case 2: return 0.5;
    case 3: return 0.7;
    case 4: return 0.9;
    default: return 0.5;
  }
}

void main()
{
  // **DO NOT** forget to do all your computation in linear space.
  vec3 albedo = sRGBToLinear(vec4(uMaterial.albedo, 1.0)).rgb;

  vec3 n = normalize(vNormalWS);
  vec3 w_o = normalize(uCamera.positionWS - vPositionWS);
  float nDOTw_o = clamp(dot(n, w_o), 0.0, 1.0);
  float a = columnIndexToRoughness(getColumnIndex(vPositionWS.x));
  float metallic = rowIndexToMetallic(getRowIndex(vPositionWS.y));

  ///////////
  /// IBL ///
  ///////////

  // IBL Generation
  /*vec3 irradiance = vec3(0.0);
  int count = 0;
  for(float phi = 0.0; phi < 2.0 * PI; phi += 0.25)
  {
    for(float theta = 0.0; theta < 0.5 * PI; theta += 0.25)
    {
        // Direction must be updated using phi and theta.
        vec3 direction = 
        irradiance += RGBMDecode(texture(uDiffuseTexture, ToUV(direction))) * cos(theta) * sin(theta);;
        count++;
    }
  }
  irradiance = PI * irradiance / float(count);
  irradiance = irradiance * (1.0 - metallic);*/

  // IBL Sampling
  vec3 dielectricF0 = 0.04 * vec3(1.0);
  vec3 F0 = mix(dielectricF0, albedo, metallic);
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - clamp(dot(w_o, n), 0.0, 1.0), 5.0);

  vec3 ks = F;
  vec3 kd = (1.0 - ks) * (1.0 - metallic);

  vec3 diffuse = kd * albedo * RGBMDecode(texture(uDiffuseTexture, ToUV(n)));

  vec2 reflected = ToUV(reflect(w_o, n));

  int upperRoughnessLevel = min(int(a * 6.0) + 1, 5);
  int lowerRoughnessLevel = int(a * 6.0);
  //int lowerRoughnessLevel = clamp(int(a * 6.0), 0, 4);
  //int upperRoughnessLevel = lowerRoughnessLevel + 1;

  float distanceToUpper = float(upperRoughnessLevel) / 6.0 - a;
  float distanceToLower = a - float(lowerRoughnessLevel) / 6.0;
  float totalDistance = distanceToUpper + distanceToLower;
  float upperLerpFactor = distanceToLower / totalDistance;

  vec2 upperSpecularUV = offsetUV(reflected, upperRoughnessLevel);
  vec2 lowerSpecularUV = offsetUV(reflected, lowerRoughnessLevel);
  vec3 upperSpecular = RGBMDecode(texture(uSpecularTexture, upperSpecularUV));
  vec3 lowerSpecular = RGBMDecode(texture(uSpecularTexture, lowerSpecularUV));
  vec3 specular = mix(lowerSpecular, upperSpecular, upperLerpFactor);

  vec2 BRDF = sRGBToLinear(texture(uBRDFTexture, vec2(nDOTw_o, a))).xy;
  vec3 specularBRDF = specular * (ks * BRDF.x + BRDF.y);

  vec3 irradiance = diffuse + specularBRDF;

  ////////////
  //// DL ////
  ////////////

  /*vec3 irradiance = vec3(0.0);
  for (int i = 0; i < POINT_LIGHT_COUNT; ++i) {
    vec3 w_i = normalize(uPointLights[i].positionWS - vPositionWS);
    float nDOTw_i = clamp(dot(n, w_i), 0.0, 1.0);

    // PointLight intensity
    vec3 Li = (uPointLights[i].intensity / (4.0 * PI * length(w_i))) * nDOTw_i * vec3(1.0);
    Li *= uPointLights[i].color;

    // Diffuse
    vec3 fd = albedo / PI;
    
    // Specular (Cook-Torrance GGX model)
    // Normal Distribution Function
    vec3 h = normalize(w_o + w_i); // Halfway vector
    float D = (a * a) / (PI * pow((pow(dot(n, h), 2.0) * (a * a - 1.0) + 1.0), 2.0)); // + 0.001
    
    // Geometry Function (Smith masking function with Schlick-GGX function)
    float k = pow(a + 1.0, 2.0) / 8.0;
    float Gshadowing = nDOTw_i / (nDOTw_i * (1.0 - k) + k);
    float Gobstruction = nDOTw_o / (nDOTw_o * (1.0 - k) + k);
    float G = Gshadowing * Gobstruction;

    // Specular Function (whithout Fresnel term)
    vec3 fs = D * G / (4.0 * nDOTw_o * nDOTw_i) * vec3(1.0); // + 0.001
    
    // Fresnel Function (Schlick's approximation)
    vec3 dielectricF0 = 0.04 * vec3(1.0);
    vec3 F0 = mix(dielectricF0, albedo, metallic);
    vec3 F = F0 + (1.0 - F0) * pow(1.0 - clamp(dot(w_o, h), 0.0, 1.0), 5.0);

    // BRDF
    vec3 ks = F;
    vec3 kd = 1.0 - ks;
    kd *= (1.0 - metallic);

    vec3 fr = kd * fd + ks * fs;

    // Rendering equation
    irradiance += clamp(fr * Li, vec3(0.0), vec3(1.0));
  }*/

  // NormalWS
  // vec3 NormalWS = (vNormalWS + 1.0) / 2.0;
  // outFragColor = LinearTosRGB(vec4(NormalWS, 1.0));

  // ViewDirectionWS
  // vec3 ViewDirectionWS = normalize(uCamera.positionWS - vPositionWS);
  // outFragColor = LinearTosRGB(vec4(ViewDirectionWS, 1.0));

  vec3 colorACES = clamp((irradiance * (2.51 * irradiance + 0.03)) / (irradiance * (2.43 * irradiance + 0.59) + 0.14), vec3(0.0), vec3(1.0));
  outFragColor = LinearTosRGB(vec4(colorACES, 1.0));
}
`;
